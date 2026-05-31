<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'packing_size', 'fill_quantity', 'notes', 'is_active'])]
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
     * @return HasMany<FillingRecipeItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(FillingRecipeItem::class);
    }
}
