<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'our_brand', 'packing_size',
    'fill_material_id', 'bottle_id', 'label_id', 'outer_box_id', 'printed_box_id',
    'carton_size',
])]
class ProductFillingConfig extends Model
{
    public function fillMaterial(): BelongsTo  { return $this->belongsTo(RawMaterial::class, 'fill_material_id'); }
    public function bottle(): BelongsTo        { return $this->belongsTo(RawMaterial::class, 'bottle_id'); }
    public function label(): BelongsTo         { return $this->belongsTo(RawMaterial::class, 'label_id'); }
    public function outerBox(): BelongsTo      { return $this->belongsTo(RawMaterial::class, 'outer_box_id'); }
    public function printedBox(): BelongsTo    { return $this->belongsTo(RawMaterial::class, 'printed_box_id'); }
}
