<?php

namespace App\Services;

use App\Models\InventoryPoolTransaction;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class InventoryPoolService
{
    /**
     * Decrements the shared inventory pool linked to a product, if one exists.
     *
     * Returns false (no-op) when the product has no pool link, so callers
     * fall through to the existing per-company RawMaterial decrement.
     */
    public function decrementForProduct(Product $product, float $qty, string $reference, ?User $user = null, ?string $notes = null): bool
    {
        $link = $product->inventoryLink()->with('inventoryPool')->first();

        if (! $link || ! $link->inventoryPool) {
            return false;
        }

        DB::transaction(function () use ($link, $qty, $reference, $user, $notes) {
            $pool = $link->inventoryPool;
            $previousStock = (float) $pool->stock_qty;
            $newStock = $previousStock - $qty;

            $pool->decrement('stock_qty', $qty);

            InventoryPoolTransaction::create([
                'inventory_pool_id' => $pool->id,
                'product_id' => $link->product_id,
                'user_id' => $user?->id,
                'type' => 'issue',
                'qty' => $qty,
                'previous_stock' => $previousStock,
                'new_stock' => $newStock,
                'reference' => $reference,
                'notes' => $notes,
            ]);
        });

        return true;
    }
}
