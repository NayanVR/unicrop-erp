<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transport extends Model
{
    protected $fillable = ['name', 'type', 'is_active'];

    const TYPE_TRANSPORT = 'transport';
    const TYPE_COURIER = 'courier';

    public function scopeTransports($query)
    {
        return $query->where('type', self::TYPE_TRANSPORT)->where('is_active', true);
    }

    public function scopeCouriers($query)
    {
        return $query->where('type', self::TYPE_COURIER)->where('is_active', true);
    }
}
