#!/bin/sh
# Run ONCE after the first deployment to initialise Garage.
#
# Usage (from the project root, after `docker compose up -d`):
#   docker compose exec garage sh /garage-setup.sh
#
# The script is idempotent — safe to re-run.

set -e

BUCKET="${AWS_BUCKET:-unicrop-photos}"
KEY_NAME="unicrop-app"

echo "==> Checking Garage cluster status..."
garage status || true

# ── 1. Create the cluster layout (single node, 1 GB capacity tag) ──────────
echo "==> Assigning layout..."
NODE=$(garage node id -q 2>/dev/null | cut -d'@' -f1 | head -1)
if [ -z "$NODE" ]; then
  echo "ERROR: Could not get node ID. Is Garage running?"
  exit 1
fi
garage layout assign -z dc1 -c 1 "$NODE" 2>/dev/null || true
garage layout apply --version 1 2>/dev/null || true

# ── 2. Create the bucket ────────────────────────────────────────────────────
echo "==> Creating bucket '$BUCKET'..."
garage bucket create "$BUCKET" 2>/dev/null || echo "  (already exists)"

# Make bucket publicly readable so photos are accessible via browser
garage bucket allow --read --website "$BUCKET" 2>/dev/null || true

# ── 3. Create or reuse an access key ───────────────────────────────────────
echo "==> Creating access key '$KEY_NAME'..."
if garage key info "$KEY_NAME" > /dev/null 2>&1; then
  echo "  (key already exists)"
else
  garage key create -n "$KEY_NAME"
fi

# Grant the key read+write on the bucket
garage bucket allow --read --write --owner "$BUCKET" --key "$KEY_NAME"

echo ""
echo "==> Setup complete! Copy the key details above into your Dokploy env vars:"
echo "    AWS_ACCESS_KEY_ID     = <Key ID from above>"
echo "    AWS_SECRET_ACCESS_KEY = <Secret key from above>"
echo "    AWS_BUCKET            = $BUCKET"
echo "    AWS_ENDPOINT          = http://garage:3900"
echo "    AWS_DEFAULT_REGION    = garage"
echo "    AWS_USE_PATH_STYLE_ENDPOINT = true"
echo "    AWS_URL               = not required when product photos are proxied through the app"
echo "    FILESYSTEM_DISK       = s3"
