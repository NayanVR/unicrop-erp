<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Company;
use App\Models\Policy;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Build company_user pivot rows for the given company IDs, assigning each
     * the system policy matching the user's first selected role and marking
     * the first company as default. Falls back to the single default company
     * when none are explicitly selected, so every user keeps at least one.
     *
     * @param  array<int, int>  $companyIds
     * @param  array<int, int>  $roleIds
     * @return array<int, array<string, mixed>>
     */
    private function buildCompanyPivot(array $companyIds, array $roleIds): array
    {
        if ($companyIds === []) {
            $defaultCompanyId = Company::query()->orderBy('id')->value('id');
            $companyIds = $defaultCompanyId ? [$defaultCompanyId] : [];
        }

        $roleSlug = $roleIds === [] ? null : Role::find($roleIds[0])?->slug;
        $policyId = $roleSlug
            ? Policy::where('is_system', true)->where('slug', $roleSlug)->value('id')
            : null;

        $pivot = [];
        foreach (array_values($companyIds) as $index => $companyId) {
            $pivot[$companyId] = [
                'policy_id' => $policyId,
                'is_default' => $index === 0,
            ];
        }

        return $pivot;
    }

    private function canManageUsers(): bool
    {
        $user = auth()->user();
        return $user?->hasRole(Role::ADMIN)
            || in_array('manage_users', $user?->permissions ?? []);
    }

    /** Returns the slug of the role this non-admin manager is restricted to, or null for admin (unrestricted). */
    private function manageableRoleSlug(): ?string
    {
        $user = auth()->user();
        if ($user?->hasRole(Role::ADMIN)) {
            return null;
        }
        return $user?->roles->first()?->slug ?? null;
    }

    /** Abort 403 if a non-admin tries to touch a user outside their own role. */
    private function assertSameRole(User $target): void
    {
        $slug = $this->manageableRoleSlug();
        if ($slug === null) {
            return; // admin — unrestricted
        }
        if (! $target->roles->pluck('slug')->contains($slug)) {
            abort(403);
        }
    }

    public function index(): Response
    {
        $canManage = $this->canManageUsers();
        $manageableRoleSlug = $canManage ? $this->manageableRoleSlug() : null;

        $usersQuery = User::query()->with('roles', 'companies')->orderBy('name');
        if ($manageableRoleSlug !== null) {
            $usersQuery->whereHas('roles', fn ($q) => $q->where('slug', $manageableRoleSlug));
        }

        $users = $usersQuery->get(['id', 'name', 'email', 'phone', 'notes', 'is_active', 'cost_access', 'modules', 'hidden_nav_items', 'permissions', 'company_access', 'password_plain', 'created_at', 'updated_at']);

        if ($canManage) {
            $sessions = DB::table('sessions')
                ->whereIn('user_id', $users->pluck('id'))
                ->orderByDesc('last_activity')
                ->get(['user_id', 'ip_address', 'user_agent', 'last_activity'])
                ->groupBy('user_id');

            $users->each(function (User $user) use ($sessions) {
                $user->sessions = ($sessions->get($user->id) ?? collect())
                    ->map(fn ($s) => [
                        'ip_address'    => $s->ip_address,
                        'user_agent'    => $s->user_agent,
                        'last_activity' => $s->last_activity,
                    ])
                    ->values();
            });
        }

        return Inertia::render('erp/users/index', [
            'pageTitle' => 'User Management',
            'users' => $users,
            'roles' => Role::query()->orderBy('name')->get(['id', 'name', 'slug']),
            'companies' => Company::query()->orderBy('name')->get(['id', 'name']),
            'canManageUsers' => $canManage,
            'manageableRoleSlug' => $manageableRoleSlug,
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        abort_unless($this->canManageUsers(), 403);
        $data = $request->validated();

        $slug = $this->manageableRoleSlug();
        if ($slug !== null) {
            $allowedId = Role::where('slug', $slug)->value('id');
            abort_unless($allowedId && in_array($allowedId, (array) $data['roles']), 403);
            $data['roles'] = [$allowedId];
        }

        $user = User::create([
            'name'           => $data['name'],
            'email'          => $data['email'],
            'password'       => $data['password'],
            'password_plain' => $data['password'],
            'phone'          => $data['phone'] ?? null,
            'notes'          => $data['notes'] ?? null,
            'is_active'      => $data['status'] === 'active',
            'cost_access'    => $data['cost_access'] ?? false,
            'hidden_nav_items' => $data['hidden_nav_items'] ?? [],
            'permissions'    => $data['permissions'] ?? [],
            'company_access' => $data['company_access'] ?? [],
        ]);

        $user->roles()->sync($data['roles']);
        $user->companies()->sync($this->buildCompanyPivot($data['company_ids'] ?? [], $data['roles']));

        return redirect()->back();
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        abort_unless($this->canManageUsers(), 403);
        $user->loadMissing('roles');
        $this->assertSameRole($user);

        $data = $request->validated();

        $slug = $this->manageableRoleSlug();
        if ($slug !== null) {
            $allowedId = Role::where('slug', $slug)->value('id');
            $data['roles'] = [$allowedId];
        }

        $user->fill([
            'name'           => $data['name'],
            'email'          => $data['email'],
            'phone'          => $data['phone'] ?? null,
            'notes'          => $data['notes'] ?? null,
            'is_active'      => $data['status'] === 'active',
            'cost_access'    => $data['cost_access'] ?? false,
            'hidden_nav_items' => $data['hidden_nav_items'] ?? [],
            'permissions'    => $data['permissions'] ?? [],
            'company_access' => $data['company_access'] ?? [],
        ]);

        if (! empty($data['password'])) {
            $user->password = $data['password'];
            $user->password_plain = $data['password'];
        }

        $user->save();
        $user->roles()->sync($data['roles']);
        $user->companies()->sync($this->buildCompanyPivot($data['company_ids'] ?? [], $data['roles']));

        return redirect()->back();
    }

    public function destroy(User $user): RedirectResponse
    {
        abort_unless($this->canManageUsers(), 403);
        $user->loadMissing('roles');
        $this->assertSameRole($user);

        $user->roles()->detach();
        $user->companies()->detach();
        $user->delete();

        return redirect()->back();
    }
}
