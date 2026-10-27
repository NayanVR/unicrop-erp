<?php

namespace App\Models;

use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A thing the company owns and keeps: an instrument, a machine, a vehicle, a
 * laptop, a phone, a piece of property.
 */
#[Fillable([
    'name',
    'category',
    'code',
    'quantity',
    'unit',
    'location',
    'assigned_to',
    'status',
    'purchase_date',
    'purchase_cost',
    'notes',
    'last_changes',
])]
class CompanyAsset extends Model
{
    use BelongsToCompany;

    /** Suggested in the editor; anything else typed in is kept as it is. */
    public const CATEGORIES = [
        'Instrument',
        'Machine',
        'Property',
        'Vehicle',
        'Laptop / Computer',
        'Mobile',
        'Furniture',
        'Tool',
        'Other',
    ];

    /** @var array<string, string> */
    public const STATUSES = [
        'in_use'   => 'In use',
        'idle'     => 'Idle',
        'repair'   => 'Under repair',
        'scrapped' => 'Scrapped',
        'sold'     => 'Sold',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity'      => 'decimal:2',
            'purchase_cost' => 'decimal:2',
            'purchase_date' => 'date',
            'last_changes'  => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, CompanyAsset>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
