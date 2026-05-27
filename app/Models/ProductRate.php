<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'our_brand',
    'party_brand',
    'packing_size',
    'rate',
    'gst_percent',
    'is_active',
])]
class ProductRate extends Model {}
