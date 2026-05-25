<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UnitTransfer extends Model
{
    protected $fillable = [
        'created_by',
        'from_unit',
        'to_unit',
        'item_type',
        'item_name',
        'quantity',
        'unit',
        'notes',
        'status',
        'transferred_at',
    ];

    protected $casts = [
        'transferred_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
