<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A name one company uses for a shared material. A company may have several —
 * position 0 is its main name, the rest are alternatives it also orders by.
 */
#[Fillable(['raw_material_id', 'company_id', 'name', 'position'])]
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
