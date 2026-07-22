#!/bin/bash
# Sync updates from the standalone LOTGEN dev project into this monorepo's
# services/lotgen-service + frontend/lotgen-ui, preserving the microservices-
# specific integration (shared-JWT auth, Docker build context, nginx proxy).
#
# Usage: bash docs/migration/scripts/sync-lotgen.sh [path-to-standalone-LOTGEN]
# Default source: /Users/pisti/My Projects.local/dev/BRD/LOTGEN
set -e

SRC="${1:-/Users/pisti/My Projects.local/dev/BRD/LOTGEN}"
DST="$(cd "$(dirname "$0")/../../.." && pwd)"

BACKEND_SRC="$SRC/backend"
BACKEND_DST="$DST/services/lotgen-service"
FRONTEND_SRC="$SRC/frontend"
FRONTEND_DST="$DST/frontend/lotgen-ui"

if [ ! -d "$SRC" ]; then
  echo "Standalone LOTGEN not found at: $SRC"
  echo "Usage: $0 [path-to-standalone-LOTGEN]"
  exit 1
fi

echo "=== Syncing LOTGEN ==="
echo "  Source: $SRC"
echo "  Dest:   $DST"
echo ""

# ── Backend ──────────────────────────────────────────────────────────────────
#
# Files that are pure business logic (no auth/deploy divergence) — safe to
# overwrite wholesale.
SAFE_BACKEND_FILES=(
  "app/lot_format.py"
  "app/routes/lot.py"
  "app/security.py"
  "requirements.txt"
)

# Files known to carry the microservices-specific adaptation (shared-JWT auth,
# container-network hostnames, build context) — never auto-overwritten.
# The standalone versions have their own local JSON/SQL auth wiring that must
# NOT replace this repo's shared auth-service integration.
REVIEW_BACKEND_FILES=(
  "app/database.py"
  "app/main.py"
  "app/settings.py"
  "Dockerfile"
)

echo "--- Backend: safe files (auto-copied) ---"
for f in "${SAFE_BACKEND_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ]; then
    cp "$BACKEND_SRC/$f" "$BACKEND_DST/$f"
    echo "  copied: $f"
  fi
done

echo ""
echo "--- Backend: files requiring manual review (NOT auto-copied) ---"
for f in "${REVIEW_BACKEND_FILES[@]}"; do
  if [ -f "$BACKEND_SRC/$f" ] && ! diff -q "$BACKEND_SRC/$f" "$BACKEND_DST/$f" &>/dev/null; then
    echo ""
    echo "  >>> $f differs — review and merge by hand: <<<"
    diff -u "$BACKEND_DST/$f" "$BACKEND_SRC/$f" || true
  fi
done

echo ""
echo "--- Backend: local-auth route (never copied) ---"
if [ -f "$BACKEND_SRC/app/routes/auth.py" ]; then
  echo "  LOTGEN/backend/app/routes/auth.py exists in source but is intentionally"
  echo "  NOT copied — this repo authenticates via the shared auth-service."
fi

# ── Frontend ─────────────────────────────────────────────────────────────────
#
# Full src/ mirror — LOTGEN's frontend has no auth-integration divergence
# baked into most files; the few that do are patched below.
echo ""
echo "--- Frontend: mirroring src/ ---"
rsync -a --delete "$FRONTEND_SRC/src/" "$FRONTEND_DST/src/"
echo "  synced $FRONTEND_SRC/src/ -> $FRONTEND_DST/src/"

# Known standalone-dev URLs that must be rewritten to relative paths so they
# route through this repo's nginx -> Traefik -> service chain instead of
# LOTGEN's direct backend port (localhost:8001).
echo ""
echo "--- Frontend: patching standalone dev URLs ---"
grep -rl "'http://localhost:8001/auth'" "$FRONTEND_DST/src" 2>/dev/null | while read -r file; do
  sed -i '' "s#'http://localhost:8001/auth'#'/auth'#g" "$file"
  echo "  patched (auth): $file"
done
grep -rl "'http://localhost:8001'" "$FRONTEND_DST/src" 2>/dev/null | while read -r file; do
  sed -i '' "s#'http://localhost:8001'#''#g" "$file"
  echo "  patched (api):  $file"
done

echo ""
echo "--- Frontend: scanning for any remaining hardcoded ports (manual review) ---"
if grep -rn "localhost:[0-9]" "$FRONTEND_DST/src" 2>/dev/null; then
  echo "  ^ review the lines above — anything with an explicit :PORT is probably"
  echo "    a standalone-dev leftover and should be relative or go through /auth,/lot."
else
  echo "  none found."
fi

echo ""
echo "=== Sync complete. Next steps ==="
echo "  1. Review any '>>> ... differs <<<' diffs above and merge by hand into:"
for f in "${REVIEW_BACKEND_FILES[@]}"; do echo "       services/lotgen-service/$f"; done
echo "  2. Verify: cd frontend/lotgen-ui && npx tsc --noEmit"
echo "  3. Rebuild + smoke test:"
echo "       docker compose up -d --build lotgen-service lotgen-ui"
echo "       curl http://localhost/lot/health"
echo "  4. See docs/migration/LOTGEN_Migration_Guide.md for the full checklist."
