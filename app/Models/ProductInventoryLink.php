<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['product_id', 'inventory_pool_id', 'linked_by', 'linked_at'])]
class ProductInventoryLink extends Model
{
    protected function casts(): array
    {
        return [
            'linked_at' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function inventoryPool(): BelongsTo
    {
        return $this->belongsTo(InventoryPool::class);
    }

    public function linkedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_by');
    }
}
