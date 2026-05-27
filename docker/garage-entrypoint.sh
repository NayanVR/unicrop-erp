#!/bin/sh
# Garage wrapper — injects GARAGE_RPC_SECRET into garage.toml before starting.
set -e

CONFIG=/etc/garage.toml

if [ -n "$GARAGE_RPC_SECRET" ]; then
  # Replace the placeholder in the config with the actual secret
  sed -i "s/REPLACE_WITH_64_HEX_CHARS_openssl_rand_hex_32/$GARAGE_RPC_SECRET/g" "$CONFIG"
fi

exec /garage server
