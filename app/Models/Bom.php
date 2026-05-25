<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['product_id', 'name', 'packing_size', 'batch_size', 'batch_unit', 'notes', 'is_active'])]
class Bom extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'batch_size' => 'decimal:3',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Product, Bom>
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * @return HasMany<BomItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(BomItem::class);
    }
}
