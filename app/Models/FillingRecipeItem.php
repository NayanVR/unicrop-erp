<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['filling_recipe_id', 'raw_material_id', 'qty_per_unit', 'unit', 'notes'])]
class FillingRecipeItem extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty_per_unit' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<FillingRecipe, FillingRecipeItem>
     */
    public function fillingRecipe(): BelongsTo
    {
        return $this->belongsTo(FillingRecipe::class);
    }

    /**
     * @return BelongsTo<RawMaterial, FillingRecipeItem>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }
}
