<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One product as it appears on the printed price list. */
#[Fillable([
    'raw_material_id',
    'name',
    'description',
    'section',
    'gst_percent',
    'is_bulk',
    'is_active',
    'sort_order',
])]
class PriceListItem extends Model
{
    use BelongsToCompany;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'gst_percent' => 'decimal:2',
            'is_bulk'     => 'boolean',
            'is_active'   => 'boolean',
        ];
    }

    /**
     * @return HasMany<PriceListPacking>
     */
    public function packings(): HasMany
    {
        return $this->hasMany(PriceListPacking::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    /**
     * @return BelongsTo<RawMaterial, PriceListItem>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }

    /** The inventory category this product is filed under, live. */
    public function category(): ?string
    {
        return $this->rawMaterial?->category ?: null;
    }

    /** The inventory group, live — "Bio Stimulant" and the like. */
    public function group(): ?string
    {
        return $this->rawMaterial?->group_name ?: null;
    }

    /**
     * The heading this product prints under. An admin may override it;
     * otherwise it follows the product's group, then its category.
     */
    public function heading(): string
    {
        return $this->section
            ?: $this->group()
            ?: $this->category()
            ?: 'Price List';
    }
}
