<?php

namespace App\Models;

use Database\Factories\RoleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['name', 'slug'])]
class Role extends Model
{
    /** @use HasFactory<RoleFactory> */
    use HasFactory;

    public const ADMIN = 'admin';

    public const OFFICE = 'office';

    public const FACTORY = 'factory';

    public const DESIGN = 'design';

    public const ACCOUNTANT = 'accountant';

    /**
     * @return array<int, array{slug: string, name: string}>
     */
    public static function defaultRoles(): array
    {
        return [
            ['slug' => self::ADMIN, 'name' => 'Admin'],
            ['slug' => self::OFFICE, 'name' => 'Sales'],
            ['slug' => self::FACTORY, 'name' => 'Factory'],
            ['slug' => self::DESIGN, 'name' => 'Design'],
            ['slug' => self::ACCOUNTANT, 'name' => 'Accounts'],
        ];
    }

    /**
     * @return BelongsToMany<User>
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
