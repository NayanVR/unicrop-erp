<?php

namespace App\Models;

use Database\Factories\OrderAttachmentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'order_id',
    'original_name',
    'path',
    'mime_type',
    'size',
    'document_type',
])]
class OrderAttachment extends Model
{
    /** @use HasFactory<OrderAttachmentFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<Order, OrderAttachment>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
