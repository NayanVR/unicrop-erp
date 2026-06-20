<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'stock_qty', 'unit', 'notes'])]
class InventoryPool extends Model
{
    protected function casts(): array
    {
        return [
            'stock_qty' => 'decimal:3',
        ];
    }

    public function links(): HasMany
    {
        return $this->hasMany(ProductInventoryLink::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(InventoryPoolTransaction::class);
    }
}
