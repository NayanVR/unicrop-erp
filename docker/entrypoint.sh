#!/bin/sh
set -e

# Ensure storage directories exist on fresh volumes
mkdir -p \
    storage/framework/sessions \
    storage/framework/views \
    storage/framework/cache \
    storage/logs \
    storage/app/public

chown -R www-data:www-data storage
chmod -R 775 storage

case "$CONTAINER_ROLE" in
    queue)
        echo "Starting queue worker..."
        exec php artisan queue:work --tries=3 --timeout=90 --sleep=3
        ;;
    scheduler)
        echo "Starting task scheduler..."
        exec php artisan schedule:work
        ;;
    *)
        echo "Running migrations..."
        php artisan migrate --force --seed

        echo "Caching config/routes/views..."
        php artisan config:cache
        php artisan route:cache
        php artisan view:cache

        php artisan storage:link --quiet 2>/dev/null || true

        echo "Starting web server..."
        exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
        ;;
esac
