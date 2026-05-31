<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinishedGood extends Model
{
    protected $fillable = [
        'product_id',
        'bom_id',
        'created_by',
        'name',
        'packing_size',
        'batch_ref',
        'quantity',
        'unit',
        'notes',
        'source',
        'cost_per_unit',
        'total_cost',
    ];

    protected function casts(): array
    {
        return [
            'cost_per_unit' => 'decimal:4',
            'total_cost'    => 'decimal:4',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function bom(): BelongsTo
    {
        return $this->belongsTo(Bom::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
