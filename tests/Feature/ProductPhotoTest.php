<?php

use App\Models\ProductPhoto;

test('it generates a public s3 url for product photos', function () {
    config()->set('filesystems.default', 's3');
    config()->set('filesystems.disks.s3.url', 'https://unicrop-photos.unicroperpstorage.nayan.cloud');

    $photo = ProductPhoto::make([
        'photo_path' => 'product-photos/our-brand/example.jpg',
    ]);

    expect($photo->photo_url)->toBe('https://unicrop-photos.unicroperpstorage.nayan.cloud/product-photos/our-brand/example.jpg');
});
