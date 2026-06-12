<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'multiplier', 'pieces_per_box', 'pack_unit'])]
class PackingSize extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'multiplier' => 'decimal:3',
            'pieces_per_box' => 'integer',
        ];
    }
}
