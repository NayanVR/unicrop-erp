<?php

use App\Models\ProductPhoto;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

test('it generates an app proxy url for product photos', function () {
    URL::forceRootUrl('https://unicroperp.nayan.cloud');
    URL::forceScheme('https');

    $photo = ProductPhoto::make([
        'photo_path' => 'product-photos/our-brand/example.jpg',
    ]);
    $photo->id = 123;

    expect($photo->photo_url)->toBe('https://unicroperp.nayan.cloud/product-photos/123/image');
});

test('it serves product photo bytes through the app domain', function () {
    config()->set('filesystems.default', 's3');

    $user = User::factory()->create();
    $photo = ProductPhoto::create([
        'party_id' => null,
        'our_brand' => 'Ashirwad',
        'party_brand' => null,
        'packing_size' => null,
        'photo_path' => 'product-photos/our-brand/example.jpg',
        'uploaded_by' => $user->id,
    ]);

    Storage::shouldReceive('disk')
        ->once()
        ->with('s3')
        ->andReturn(new class {
        public function response(string $path)
        {
            expect($path)->toBe('product-photos/our-brand/example.jpg');

            return response('image-bytes', 200, ['Content-Type' => 'image/jpeg']);
        }
        });

    $response = $this->actingAs($user)->get(route('product-photos.show', $photo));

    $response->assertOk();
    $response->assertSee('image-bytes', false);
});
