<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['godown_id', 'raw_material_id', 'stock_qty'])]
class GodownStock extends Model
{
    protected function casts(): array
    {
        return ['stock_qty' => 'decimal:3'];
    }

    /** @return BelongsTo<Godown, GodownStock> */
    public function godown(): BelongsTo
    {
        return $this->belongsTo(Godown::class);
    }

    /** @return BelongsTo<RawMaterial, GodownStock> */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }
}
