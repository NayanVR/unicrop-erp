<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['inventory_pool_id', 'product_id', 'user_id', 'type', 'qty', 'previous_stock', 'new_stock', 'reference', 'notes'])]
class InventoryPoolTransaction extends Model
{
    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'previous_stock' => 'decimal:3',
            'new_stock' => 'decimal:3',
        ];
    }

    public function inventoryPool(): BelongsTo
    {
        return $this->belongsTo(InventoryPool::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
