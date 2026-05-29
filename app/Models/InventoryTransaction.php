<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['raw_material_id', 'user_id', 'type', 'qty', 'previous_stock', 'new_stock', 'cost_per_unit', 'reference', 'notes'])]
class InventoryTransaction extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'qty' => 'decimal:3',
            'cost_per_unit' => 'decimal:2',
            'previous_stock' => 'decimal:3',
            'new_stock' => 'decimal:3',
        ];
    }

    /**
     * @return BelongsTo<RawMaterial, InventoryTransaction>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }

    /**
     * @return BelongsTo<User, InventoryTransaction>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
