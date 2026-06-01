<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('erp/users/index', [
            'pageTitle' => 'User Management',
            'users' => User::query()
                ->with('roles')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'phone', 'notes', 'is_active', 'cost_access', 'modules', 'permissions', 'company_access', 'password_plain', 'created_at', 'updated_at']),
            'roles' => Role::query()
                ->orderBy('name')
                ->get(['id', 'name', 'slug']),
            'companies' => [],
            'isAdmin' => auth()->user()?->hasRole(Role::ADMIN) ?? false,
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'password_plain' => $data['password'],
            'phone' => $data['phone'] ?? null,
            'notes' => $data['notes'] ?? null,
            'is_active' => $data['status'] === 'active',
            'cost_access' => $data['cost_access'] ?? false,
            'modules' => $data['modules'] ?? [],
            'permissions' => $data['permissions'] ?? [],
            'company_access' => $data['company_access'] ?? [],
        ]);

        $user->roles()->sync($data['roles']);

        return redirect()->back();
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $data = $request->validated();

        $user->fill([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'notes' => $data['notes'] ?? null,
            'is_active' => $data['status'] === 'active',
            'cost_access' => $data['cost_access'] ?? false,
            'modules' => $data['modules'] ?? [],
            'permissions' => $data['permissions'] ?? [],
            'company_access' => $data['company_access'] ?? [],
        ]);

        if (! empty($data['password'])) {
            $user->password = $data['password'];
            $user->password_plain = $data['password'];
        }

        $user->save();
        $user->roles()->sync($data['roles']);

        return redirect()->back();
    }

    public function destroy(User $user): RedirectResponse
    {
        $user->roles()->detach();
        $user->delete();

        return redirect()->back();
    }
}
