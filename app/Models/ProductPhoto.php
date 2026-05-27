<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'party_id',
    'our_brand',
    'party_brand',
    'packing_size',
    'photo_path',
    'uploaded_by',
])]
class ProductPhoto extends Model
{
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function getPhotoUrlAttribute(): string
    {
        $disk = config('filesystems.default', 'public');

        if ($disk === 's3') {
            $baseUrl = rtrim((string) config('filesystems.disks.s3.url', ''), '/');

            if ($baseUrl === '') {
                $baseUrl = rtrim((string) config('filesystems.disks.s3.endpoint', ''), '/') . '/' . trim((string) config('filesystems.disks.s3.bucket', ''), '/');
            }

            return $baseUrl . '/' . ltrim($this->photo_path, '/');
        }

        $baseUrl = rtrim((string) config('filesystems.disks.public.url', ''), '/');

        return $baseUrl . '/' . ltrim($this->photo_path, '/');
    }
}
