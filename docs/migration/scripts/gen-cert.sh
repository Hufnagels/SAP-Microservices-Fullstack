#!/bin/bash
# Generate a local CA + self-signed server cert for Traefik TLS
# Usage: ./scripts/gen-cert.sh [domain]
# Default domain: brd.internal
set -e

DOMAIN="${1:-brd.internal}"
OUT="$(dirname "$0")/../api-gateway/traefik/certs"
mkdir -p "$OUT"

echo "Generating CA + cert for: $DOMAIN"

# Local CA
openssl genrsa -out "$OUT/ca.key" 4096
openssl req -x509 -new -nodes -key "$OUT/ca.key" -sha256 -days 3650 \
  -subj "/CN=BRD Internal CA/O=BRD" \
  -out "$OUT/ca.crt"

# Server key + CSR
openssl genrsa -out "$OUT/server.key" 2048
openssl req -new -key "$OUT/server.key" \
  -subj "/CN=$DOMAIN/O=BRD" \
  -out "$OUT/server.csr"

# Sign with CA (includes SAN)
openssl x509 -req \
  -in "$OUT/server.csr" \
  -CA "$OUT/ca.crt" -CAkey "$OUT/ca.key" -CAcreateserial \
  -out "$OUT/server.crt" \
  -days 3650 -sha256 \
  -extfile <(printf "subjectAltName=DNS:%s,DNS:*.%s,IP:10.63.10.111" "$DOMAIN" "$DOMAIN")

echo ""
echo "Certificates written to: $OUT"
echo "  CA cert:     $OUT/ca.crt  ← import this into your browser/OS"
echo "  Server cert: $OUT/server.crt"
echo "  Server key:  $OUT/server.key"
