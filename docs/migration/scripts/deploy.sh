#!/bin/bash
# Rsync the project to the LXC container at 10.63.10.111
# Usage: ./scripts/deploy.sh [host]
# Auth: pisti / Mancika (sudo). Root SSH login is disabled.
set -e

HOST="${1:-10.63.10.111}"
USER="pisti"
PASS="Mancika"
STAGING="~/ms-staging"
DEST="/opt/microservices"
SRC="$(cd "$(dirname "$0")/../../.." && pwd)/"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

# sshpass is required; install via Homebrew if missing
if ! command -v sshpass &>/dev/null; then
  echo "sshpass not found — installing via Homebrew..."
  brew install sshpass
fi

# Always clear any stale host key so changed LXC keys never block the transfer
ssh-keygen -R "$HOST" &>/dev/null || true

echo "=== Step 1: rsync to $USER@$HOST:$STAGING ==="
sshpass -p "$PASS" rsync -avz --progress \
  -e "ssh $SSH_OPTS" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='/.env' \
  --exclude='/data/' \
  --exclude='/files/' \
  --exclude='**/__pycache__' \
  --exclude='*.pyc' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  "$SRC" "$USER@$HOST:$STAGING/"

echo ""
echo "=== Step 2: sudo rsync staging → $DEST ==="
sshpass -p "$PASS" ssh $SSH_OPTS "$USER@$HOST" \
  "echo '$PASS' | sudo -S bash -c 'mkdir -p $DEST && ln -sfn /home/$USER/ms-staging /root/ms-staging && rsync -a --delete --exclude=/.env --exclude=/data/ --exclude=/files/ --exclude=/vpn/ $STAGING/ $DEST/'"

echo ""
echo "Done. Deployed to $HOST:$DEST"
echo ""
echo "Next steps on the LXC:"
echo "  ssh $USER@$HOST"
echo "  cd $DEST"
echo "  cp .env.example .env && nano .env   # fill in secrets"
echo "  sudo docker compose -f infrastructure/mssql/docker-compose.yml up -d"
echo "  sleep 20"
echo "  sudo docker compose up -d --build"
