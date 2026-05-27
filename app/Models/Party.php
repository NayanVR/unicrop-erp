<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Party extends Model
{
    protected $fillable = [
        'created_by',
        'name',
        'type',
        'gst_no',
        'pan_no',
        'phone',
        'email',
        'address',
        'city',
        'state',
        'pincode',
        'notes',
        'is_active',
        'default_transport_type',
        'default_transport_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(PartyDocument::class);
    }

    /**
     * @return HasMany<ProductRate>
     */
    public function productRates(): HasMany
    {
        return $this->hasMany(ProductRate::class);
    }
}
