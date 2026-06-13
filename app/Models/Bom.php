<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Models\RawMaterial;

#[Fillable(['name', 'packing_size', 'batch_size', 'batch_unit', 'output_raw_material_id', 'notes', 'is_active'])]
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
     * @return HasMany<BomItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(BomItem::class);
    }

    /**
     * @return BelongsTo<RawMaterial, Bom>
     */
    public function outputMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class, 'output_raw_material_id');
    }
}
