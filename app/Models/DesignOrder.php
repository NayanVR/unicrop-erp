<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesignOrder extends Model
{
    protected $fillable = [
        'created_by',
        'assigned_to',
        'order_id',
        'order_item_id',
        'order_qty',
        'pcs_to_print',
        'labels_received',
        'party_brand',
        'product_name',
        'packing_size',
        'label_dimensions',
        'instructions',
        'notes',
        'status',
        'skip_party_approval',
        'stage_log',
        'due_date',
    ];

    protected $casts = [
        'skip_party_approval' => 'boolean',
        'stage_log' => 'array',
        'due_date' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
