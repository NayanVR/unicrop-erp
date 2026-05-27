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
    'rate',
    'gst_percent',
    'is_active',
])]
class ProductRate extends Model
{
    /**
     * @return BelongsTo<Party, ProductRate>
     */
    public function party(): BelongsTo
    {
        return $this->belongsTo(Party::class);
    }
}
