<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'sku', 'hsn', 'gst', 'unit', 'category', 'group_name', 'shape', 'stock_qty', 'min_stock', 'reorder_level', 'cost_per_unit', 'selling_rate', 'dim_l', 'dim_w', 'dim_h', 'supplier', 'notes', 'is_active', 'approval_status', 'requested_by'])]
class RawMaterial extends Model
{
    use BelongsToCompany;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock_qty' => 'decimal:3',
            'min_stock' => 'decimal:3',
            'cost_per_unit' => 'decimal:2',
            'is_active' => 'boolean',
            'gst' => 'decimal:2',
            'reorder_level' => 'decimal:3',
            'selling_rate' => 'decimal:2',
            'dim_l' => 'decimal:2',
            'dim_w' => 'decimal:2',
            'dim_h' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<User, RawMaterial>
     */
    public function requestedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /**
     * @return HasMany<InventoryTransaction>
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryTransaction::class);
    }

    /**
     * @return HasMany<BomItem>
     */
    public function bomItems(): HasMany
    {
        return $this->hasMany(BomItem::class);
    }

    public function isLowStock(): bool
    {
        return (float) $this->stock_qty <= (float) $this->min_stock;
    }
}
