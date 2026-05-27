<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

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
            return Storage::disk('s3')->url($this->photo_path);
        }

        return Storage::disk('public')->url($this->photo_path);
    }
}
