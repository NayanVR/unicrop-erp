<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Services\CurrentCompany;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'name',
    'email',
    'password',
    'password_plain',
    'phone',
    'notes',
    'is_active',
    'cost_access',
    'modules',
    'hidden_nav_items',
    'permissions',
    'company_access',
])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'cost_access' => 'boolean',
            'modules' => 'array',
            'hidden_nav_items' => 'array',
            'permissions' => 'array',
            'company_access' => 'array',
        ];
    }

    /**
     * @return BelongsToMany<Role>
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function hasRole(string $role): bool
    {
        return $this->roles->contains('slug', $role);
    }

    /**
     * @param  array<int, string>  $roles
     */
    public function hasAnyRole(array $roles): bool
    {
        return $this->roles->whereIn('slug', $roles)->isNotEmpty();
    }

    /**
     * @return BelongsToMany<Company>
     */
    public function companies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class)
            ->withPivot(['policy_id', 'role_id', 'is_default']);
    }

    public function policyFor(?Company $company = null): ?Policy
    {
        $company ??= app(CurrentCompany::class)->model();

        if (! $company) {
            return null;
        }

        $pivot = $this->companies->firstWhere('id', $company->id)?->pivot;

        if (! $pivot || ! $pivot->policy_id) {
            return null;
        }

        return Policy::find($pivot->policy_id);
    }

    /**
     * Union of permissions granted by every role this user currently holds,
     * derived from Policy::legacyRolePermissions(). Used as the source of
     * truth for permission checks until admins assign custom, non-system
     * policies that should take precedence (see can()).
     *
     * @return array<int, string>
     */
    public function legacyPermissions(): array
    {
        $map = Policy::legacyRolePermissions();

        return $this->roles
            ->flatMap(fn (Role $role) => $map[$role->slug] ?? [])
            ->unique()
            ->values()
            ->all();
    }

    public function can($abilities, $arguments = []): bool
    {
        if (is_string($abilities) && str_contains($abilities, '.')) {
            $company = $arguments instanceof Company ? $arguments : null;
            $policy = $this->policyFor($company);

            if ($policy && ! $policy->is_system) {
                return in_array($abilities, $policy->permissions ?? [], true);
            }

            return in_array($abilities, $this->legacyPermissions(), true);
        }

        return parent::can($abilities, $arguments);
    }
}
