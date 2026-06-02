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
    'mrp',
    'photo_path',
    'uploaded_by',
    'updated_by',
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

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getPhotoUrlAttribute(): string
    {
        return route('product-photos.show', ['photo' => $this->getKey()]);
    }
}
