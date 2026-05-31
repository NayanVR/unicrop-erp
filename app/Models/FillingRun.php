<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['filling_recipe_id', 'our_brand', 'packing_size', 'quantity', 'user_id', 'items'])]
class FillingRun extends Model
{
    protected $casts = [
        'items'    => 'array',
        'quantity' => 'float',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fillingRecipe(): BelongsTo
    {
        return $this->belongsTo(FillingRecipe::class);
    }
}
