<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['output_raw_material_id', 'name', 'group_name', 'packing_size', 'fill_quantity', 'notes', 'charges', 'is_active'])]
class FillingRecipe extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'fill_quantity' => 'decimal:2',
            'charges'       => 'array',
            'is_active'     => 'boolean',
        ];
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\App\Models\RawMaterial, FillingRecipe>
     */
    public function outputMaterial(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(\App\Models\RawMaterial::class, 'output_raw_material_id');
    }

    /**
     * @return HasMany<FillingRecipeItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(FillingRecipeItem::class);
    }
}
