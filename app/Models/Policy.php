<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['company_id', 'name', 'slug', 'permissions', 'is_system'])]
class Policy extends Model
{
    protected function casts(): array
    {
        return [
            'permissions' => 'array',
            'is_system' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    /**
     * One permission key per route-middleware grouping in routes/web.php,
     * named after the feature it gates rather than the controller action.
     *
     * @return array<int, string>
     */
    public static function defaultPermissionKeys(): array
    {
        return [
            'users.manage',
            'orders.view',
            'orders.print',
            'orders.documents.manage',
            'orders.edit',
            'orders.process',
            'factory.manage',
            'inventory.view',
            'inventory.edit',
            'admin.settings',
            'rate-calculator.view',
            'finished-goods.manage',
            'design.manage',
            'design.gallery.manage',
            'parties.manage',
            'suppliers.manage',
            'party-ledger.view',
            'products.manage',
            'products.link_inventory',
        ];
    }

    /**
     * Permission set that reproduces today's `role:` middleware grants for
     * each of the 5 legacy roles, derived directly from routes/web.php.
     *
     * @return array<string, array<int, string>>
     */
    public static function legacyRolePermissions(): array
    {
        return [
            Role::ADMIN => self::defaultPermissionKeys(),
            Role::SALES => [
                'orders.view',
                'orders.print',
                'orders.edit',
                'orders.process',
                'inventory.view',
                'rate-calculator.view',
                'design.gallery.manage',
                'parties.manage',
                'party-ledger.view',
                'products.manage',
            ],
            Role::FACTORY => [
                'users.manage',
                'orders.print',
                'factory.manage',
                'inventory.view',
                'inventory.edit',
                'finished-goods.manage',
                'products.manage',
            ],
            Role::DESIGN => [
                'orders.view',
                'orders.print',
                'design.manage',
                'design.gallery.manage',
            ],
            Role::ACCOUNTANT => [
                'orders.view',
                'orders.print',
                'orders.documents.manage',
                'inventory.view',
                'inventory.edit',
                'party-ledger.view',
            ],
        ];
    }
}
