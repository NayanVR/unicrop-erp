<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\RawMaterial;

class BomRecipe extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'yield_qty',
        'yield_unit',
        'output_raw_material_id',
        'ingredients',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'ingredients' => 'array',
            'yield_qty'   => 'float',
        ];
    }

    public function outputMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class, 'output_raw_material_id');
    }

    public function getTotalCostAttribute(): float
    {
        $total = 0.0;
        foreach ($this->ingredients ?? [] as $ing) {
            $total += (float) ($ing['qty'] ?? 0) * (float) ($ing['cost'] ?? 0);
        }

        return $total;
    }

    public function getCostPerUnitAttribute(): float
    {
        $yieldQty = (float) $this->yield_qty;

        return $yieldQty > 0 ? $this->total_cost / $yieldQty : 0.0;
    }
}
