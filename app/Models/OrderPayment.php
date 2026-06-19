<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderPayment extends Model
{
    protected $fillable = [
        'order_id', 'bank_account_id', 'amount', 'reference_number', 'created_by',
        'tally_entry_done', 'tally_entry_done_at', 'tally_entry_done_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'tally_entry_done' => 'boolean',
            'tally_entry_done_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tallyEntryDoneBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'tally_entry_done_by');
    }
}
