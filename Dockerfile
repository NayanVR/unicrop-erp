# Stage 1: Install PHP dependencies
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-interaction \
    --prefer-dist
COPY . .
RUN composer dump-autoload --optimize --no-dev

# Stage 2: Build frontend assets (needs PHP for wayfinder + Node for Vite)
FROM php:8.4-cli-alpine AS assets
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy full Laravel app + vendor from the composer stage
COPY --from=vendor /app .

# Provide a minimal .env so Laravel can boot for artisan commands
RUN cp .env.example .env && php artisan key:generate --quiet

# Generate route types before Vite runs (avoids subprocess issues in the plugin)
RUN php artisan wayfinder:generate --with-form

# Install JS deps and build; SKIP_WAYFINDER=1 so the plugin uses `true` (no-op)
ENV SKIP_WAYFINDER=1
RUN npm ci && npm run build

# Stage 3: Production image
FROM php:8.4-fpm-alpine AS app

RUN apk add --no-cache \
        nginx \
        supervisor \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        libzip-dev \
        icu-dev \
        oniguruma-dev \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        opcache \
        gd \
        zip \
        bcmath \
        intl \
        pcntl \
        mbstring \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del .build-deps \
    && rm -rf /var/cache/apk/* /tmp/pear \
    # Run nginx as www-data (same as php-fpm) so it can read app files
    && sed -i 's/user nginx;/user www-data;/' /etc/nginx/nginx.conf

WORKDIR /var/www/html

# PHP source + vendor (no .env — entrypoint gets env from Docker/Dokploy)
COPY --from=vendor /app .
# Compiled frontend assets
COPY --from=assets /app/public/build ./public/build

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/99-app.ini
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && mkdir -p \
        storage/framework/sessions \
        storage/framework/views \
        storage/framework/cache \
        storage/logs \
        storage/app/public \
        bootstrap/cache \
        /run/nginx \
        /var/log/supervisor \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
