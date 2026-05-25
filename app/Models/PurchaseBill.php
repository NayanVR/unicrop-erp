<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'vendor_name', 'bill_number', 'bill_date', 'amount', 'gst_amount', 'payment_status', 'category', 'notes', 'scan_path'])]
class PurchaseBill extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'bill_date' => 'date',
            'amount' => 'decimal:2',
            'gst_amount' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<User, PurchaseBill>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
