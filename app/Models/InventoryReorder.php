<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['raw_material_id', 'qty_ordered', 'unit', 'supplier', 'order_date', 'expected_delivery', 'transport_name', 'lr_number', 'notes', 'status', 'received_at'])]
class InventoryReorder extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty_ordered' => 'decimal:3',
            'order_date' => 'date',
            'expected_delivery' => 'date',
            'received_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<RawMaterial, InventoryReorder>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }
}
