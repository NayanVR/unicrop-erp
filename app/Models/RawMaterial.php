<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use App\Services\CurrentCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'description', 'sku', 'hsn', 'gst', 'unit', 'density', 'potency', 'category', 'group_name', 'shape', 'stock_qty', 'min_stock', 'reorder_level', 'cost_per_unit', 'selling_rate', 'dim_l', 'dim_w', 'dim_h', 'supplier', 'notes', 'is_active', 'approval_status', 'requested_by'])]
class RawMaterial extends Model
{
    use BelongsToCompany;

    /**
     * Always loaded so display_name never costs an extra query per material.
     *
     * @var array<int, string>
     */
    protected $with = ['companyNames'];

    /** @var array<int, string> */
    protected $appends = ['display_name'];

    /** @var array<int, string> */
    protected $hidden = ['companyNames'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stock_qty' => 'decimal:3',
            'density' => 'decimal:4',
            'potency' => 'decimal:3',
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
     * A material is one physical product shared by the group; it is visible to
     * the company that owns it and to any company that has named it.
     */
    public static function applyCompanyScope(Builder $builder, int $companyId): void
    {
        $table = $builder->getModel()->qualifyColumn('company_id');

        $builder->where(function (Builder $query) use ($companyId, $table) {
            $query->where($table, $companyId)
                ->orWhereHas('companyNames', fn (Builder $names) => $names->where('company_id', $companyId));
        });
    }

    /**
     * @return HasMany<RawMaterialName>
     */
    public function companyNames(): HasMany
    {
        return $this->hasMany(RawMaterialName::class);
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

    /** The name the given company uses, falling back to the default name. */
    public function nameForCompany(?int $companyId): string
    {
        if ($companyId === null || $this->getKey() === null) {
            return (string) $this->name;
        }

        $named = $this->companyNames->firstWhere('company_id', $companyId);

        return $named?->name ?: (string) $this->name;
    }

    /** Name shown throughout the UI for whoever is looking at it right now. */
    public function getDisplayNameAttribute(): string
    {
        if ($this->getKey() === null) {
            return (string) $this->name;
        }

        return $this->nameForCompany(app(CurrentCompany::class)->id());
    }

    /**
     * Match a typed-in material name against the default name or any
     * company's name for it.
     *
     * @param  Builder<RawMaterial>  $query
     * @return Builder<RawMaterial>
     */
    public function scopeNamed(Builder $query, string $name): Builder
    {
        $needle = mb_strtolower(trim($name));

        return $query->where(function (Builder $q) use ($needle) {
            $q->whereRaw('LOWER(TRIM(name)) = ?', [$needle])
                ->orWhereHas('companyNames', fn (Builder $n) => $n->whereRaw('LOWER(TRIM(name)) = ?', [$needle]));
        });
    }

    public function isLowStock(): bool
    {
        return (float) $this->stock_qty <= (float) $this->min_stock;
    }
}
