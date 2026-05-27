<?php

use App\Models\ProductPhoto;
use Illuminate\Support\Facades\Storage;

test('it generates a temporary s3 url for product photos', function () {
    config()->set('filesystems.default', 's3');

    Storage::shouldReceive('disk')
        ->once()
        ->with('s3')
        ->andReturn(new class {
        public function url(string $path): string
        {
            expect($path)->toBe('product-photos/our-brand/example.jpg');

            return 'https://storage.example.test/unicrop-photos/product-photos/our-brand/example.jpg';
        }
        });

    $photo = ProductPhoto::make([
        'photo_path' => 'product-photos/our-brand/example.jpg',
    ]);

    expect($photo->photo_url)->toBe('https://storage.example.test/unicrop-photos/product-photos/our-brand/example.jpg');
});
