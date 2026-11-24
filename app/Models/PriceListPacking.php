<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One pack size of a price list product: its MRP, rate and box count. */
#[Fillable(['price_list_item_id', 'packing', 'mrp', 'rate', 'qty_per_box', 'sort_order'])]
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
     * @return BelongsTo<PriceListItem, PriceListPacking>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(PriceListItem::class, 'price_list_item_id');
    }
}
