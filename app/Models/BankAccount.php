<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    protected $fillable = ['name', 'bank_name', 'account_number', 'ifsc', 'upi_id', 'is_active'];

    public function payments(): HasMany
    {
        return $this->hasMany(OrderPayment::class);
    }
}
