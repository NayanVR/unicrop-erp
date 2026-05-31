<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['product_id', 'name', 'packing_size', 'fill_quantity', 'notes', 'is_active'])]
class FillingRecipe extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fill_quantity' => 'decimal:2',
            'is_active'     => 'boolean',
        ];
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\App\Models\Product, FillingRecipe>
     */
    public function product(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(\App\Models\Product::class);
    }

    /**
     * @return HasMany<FillingRecipeItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(FillingRecipeItem::class);
    }
}
