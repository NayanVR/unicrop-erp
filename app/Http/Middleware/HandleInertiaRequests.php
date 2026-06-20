<?php

namespace App\Http\Middleware;

use App\Services\CurrentCompany;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        if ($user) {
            $user->loadMissing('roles', 'companies');
        }

        $currentCompany = app(CurrentCompany::class)->model();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error'   => fn () => $request->session()->get('error'),
            ],
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                    'phone' => $user->phone,
                    'notes' => $user->notes,
                    'is_active' => $user->is_active,
                    'cost_access' => $user->cost_access,
                    'modules' => $user->modules,
                    'hidden_nav_items' => $user->hidden_nav_items,
                    'permissions' => $user->permissions,
                    'company_access' => $user->company_access,
                    'roles' => $user->roles->map(fn ($role) => [
                        'id' => $role->id,
                        'name' => $role->name,
                        'slug' => $role->slug,
                    ]),
                    'role' => $user->roles->first()?->slug,
                    'companies' => $user->companies->map(fn ($company) => [
                        'id' => $company->id,
                        'name' => $company->name,
                    ]),
                ] : null,
                'current_company' => $currentCompany ? [
                    'id' => $currentCompany->id,
                    'name' => $currentCompany->name,
                ] : null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
