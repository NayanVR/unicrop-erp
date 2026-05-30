<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['vendor_name', 'bill_number', 'bill_date', 'total_amount', 'freight_charges', 'round_off', 'bill_file', 'bill_name', 'add_to_stock', 'user_id', 'party_id'])]
class InventoryPurchaseBill extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'bill_date'        => 'date',
            'total_amount'     => 'decimal:2',
            'freight_charges'  => 'decimal:2',
            'round_off'        => 'decimal:2',
            'add_to_stock'     => 'boolean',
        ];
    }

    /**
     * @return HasMany<InventoryPurchaseBillItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(InventoryPurchaseBillItem::class);
    }

    /**
     * @return BelongsTo<User, InventoryPurchaseBill>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
