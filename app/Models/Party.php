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
        'customer_name',
        'type',
        'gst_no',
        'pan_no',
        'pan_card_path',
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
        'destination',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected $appends = ['pan_card_url'];

    public function getPanCardUrlAttribute(): ?string
    {
        return $this->pan_card_path
            ? route('parties.pan-card', ['party' => $this->getKey()])
            : null;
    }

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
