<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'location', 'notes', 'is_active', 'is_default'])]
class Godown extends Model
{
    use BelongsToCompany;

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'is_default' => 'boolean'];
    }

    /** @return HasMany<GodownStock> */
    public function stocks(): HasMany
    {
        return $this->hasMany(GodownStock::class);
    }
}
