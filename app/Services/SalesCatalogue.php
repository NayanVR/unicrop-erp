<?php

namespace App\Services;

use App\Models\InventoryCategory;
use App\Models\RawMaterial;
use Illuminate\Support\Collection;

/**
 * What the sales team is allowed to see and sell. Admins decide this by
 * ticking "visible to sales" on an inventory category; everything here
 * follows from that one switch, so the price list a customer receives can
 * never show a product sales was not meant to offer.
 */
class SalesCatalogue
{
    /** Categories kept away from sales, lowercased for comparison. */
    public static function hiddenCategories(): Collection
    {
        return InventoryCategory::query()
            ->where('visible_to_sales', false)
            ->pluck('name')
            ->map(fn ($name) => mb_strtolower(trim((string) $name)));
    }

    public static function hidesCategory(?string $category): bool
    {
        return self::hiddenCategories()->contains(mb_strtolower(trim((string) $category)));
    }

    /**
     * The sellable products: approved, in stock-keeping use, in a category
     * sales may see, and priced. A product with no selling rate has nothing
     * to say on a price list, so it is left off.
     *
     * @return Collection<int, RawMaterial>
     */
    public static function pricedProducts(): Collection
    {
        $hidden = self::hiddenCategories();

        return RawMaterial::query()
            ->where('approval_status', 'approved')
            ->where('is_active', true)
            ->whereNotNull('selling_rate')
            ->where('selling_rate', '>', 0)
            ->orderBy('category')
            ->orderBy('group_name')
            ->orderBy('name')
            ->get()
            ->reject(fn ($m) => $hidden->contains(mb_strtolower(trim((string) $m->category))))
            ->values();
    }
}
