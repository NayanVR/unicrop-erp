<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['batch_number', 'bom_id', 'bom_name', 'user_id', 'batch_count', 'batch_size', 'batch_unit', 'total_cost', 'notes', 'items', 'charges'])]
class ProductionRun extends Model
{
    protected $casts = [
        'items'       => 'array',
        'charges'     => 'array',
        'batch_count' => 'float',
        'batch_size'  => 'float',
        'total_cost'  => 'float',
    ];

    public function bom(): BelongsTo
    {
        return $this->belongsTo(Bom::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
