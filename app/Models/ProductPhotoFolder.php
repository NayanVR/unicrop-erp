<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['party_id', 'created_by'])]
class ProductPhotoFolder extends Model
{
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }
}
