<?php

namespace App\Models;

use Database\Factories\OrderItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id',
    'our_brand',
    'party_brand',
    'packing_size',
    'box_size',
    'boxes_override',
    'labels_received',
    'quantity',
    'dispatched_qty',
    'rate',
    'amount',
    'gst_percent',
    'gst_amount',
    'type',
    'shape',
    'cap_color',
    'status',
    'stage_log',
])]
class OrderItem extends Model
{
    /** @use HasFactory<OrderItemFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'dispatched_qty' => 'decimal:2',
            'rate' => 'decimal:2',
            'amount' => 'decimal:2',
            'gst_percent' => 'decimal:2',
            'gst_amount' => 'decimal:2',
            'box_size' => 'integer',
            'boxes_override' => 'integer',
            'labels_received' => 'integer',
            'stage_log' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Order, OrderItem>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
