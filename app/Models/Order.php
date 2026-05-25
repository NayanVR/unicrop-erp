<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'order_number',
    'company_name',
    'customer_name',
    'sales_user_id',
    'created_by',
    'confirmed_by',
    'order_date',
    'transport_name',
    'destination',
    'delivery_address',
    'phone',
    'priority',
    'status',
    'confirmed_at',
    'freight_amount',
    'courier_amount',
    'round_off',
    'subtotal',
    'gst_total',
    'total_amount',
    'notes',
])]
class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'order_date' => 'date',
            'confirmed_at' => 'datetime',
            'freight_amount' => 'decimal:2',
            'courier_amount' => 'decimal:2',
            'round_off' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'gst_total' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    /**
     * @return HasMany<OrderItem>
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /**
     * @return HasMany<OrderAttachment>
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(OrderAttachment::class);
    }

    /**
     * @return BelongsTo<User, Order>
     */
    public function salesUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_user_id');
    }

    /**
     * @return BelongsTo<User, Order>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<User, Order>
     */
    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
