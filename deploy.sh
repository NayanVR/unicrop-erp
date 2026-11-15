#!/bin/bash
# Runs on the CloudPanel server as the site user, from the site's root.
set -euo pipefail
cd "$(dirname "$0")"

PHP=php8.4
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

git pull --ff-only origin main
$PHP "$(command -v composer)" install --no-dev --optimize-autoloader --no-interaction
npm ci
npm run build
$PHP artisan migrate --force
$PHP artisan optimize
$PHP artisan queue:restart
$PHP artisan reverb:restart
