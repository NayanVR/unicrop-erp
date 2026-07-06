<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['raw_material_id', 'finished_good_id', 'parent_product_id', 'name', 'our_brand', 'sku', 'hsn_code', 'gst_percent', 'category', 'packing_size', 'is_active'])]
class Product extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return [
            'gst_percent' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }

    public function finishedGood(): BelongsTo
    {
        return $this->belongsTo(FinishedGood::class);
    }

    public function inventoryLink(): HasOne
    {
        return $this->hasOne(ProductInventoryLink::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'parent_product_id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(Product::class, 'parent_product_id');
    }
}
