<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The name one company uses for a shared material.
 */
#[Fillable(['raw_material_id', 'company_id', 'name'])]
class RawMaterialName extends Model
{
    /**
     * @return BelongsTo<RawMaterial, RawMaterialName>
     */
    public function rawMaterial(): BelongsTo
    {
        return $this->belongsTo(RawMaterial::class);
    }

    /**
     * @return BelongsTo<Company, RawMaterialName>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
