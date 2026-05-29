<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['inventory_purchase_bill_id', 'raw_material_id', 'material_name', 'sku', 'category', 'hsn', 'qty', 'unit', 'rate', 'gst', 'amount'])]
class InventoryPurchaseBillItem extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'rate' => 'decimal:2',
            'gst' => 'decimal:2',
            'amount' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<InventoryPurchaseBill, InventoryPurchaseBillItem>
     */
    public function inventoryPurchaseBill(): BelongsTo
    {
        return $this->belongsTo(InventoryPurchaseBill::class);
    }

    /**
     * @return BelongsTo<RawMaterial, InventoryPurchaseBillItem>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }
}
