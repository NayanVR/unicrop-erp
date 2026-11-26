<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One pack size of a price list product: its MRP, rate and box count. */
#[Fillable(['price_list_item_id', 'raw_material_id', 'packing', 'mrp', 'rate', 'qty_per_box', 'sort_order'])]
class PriceListPacking extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'mrp'  => 'decimal:2',
            'rate' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<RawMaterial, PriceListPacking>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }

    /**
     * What the customer is quoted: the product's selling rate as it stands
     * right now, or the rate typed on the list when no product is linked.
     */
    public function liveRate(): float
    {
        $live = $this->rawMaterial?->selling_rate;

        return $live !== null && (float) $live > 0
            ? (float) $live
            : (float) $this->rate;
    }

    /** True when the rate follows a product rather than being typed in. */
    public function followsProduct(): bool
    {
        return $this->rawMaterial !== null && (float) $this->rawMaterial->selling_rate > 0;
    }

    /**
     * @return BelongsTo<PriceListItem, PriceListPacking>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(PriceListItem::class, 'price_list_item_id');
    }
}
