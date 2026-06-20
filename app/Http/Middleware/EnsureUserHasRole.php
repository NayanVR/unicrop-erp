<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->is_active) {
            abort(403);
        }

        $user->loadMissing('roles');

        $permissions = array_filter($roles, fn (string $role) => str_contains($role, '.'));
        $roleSlugs = array_diff($roles, $permissions);

        if ($permissions !== [] && ! collect($permissions)->some(fn (string $permission) => $user->can($permission))) {
            abort(403);
        }

        if ($roleSlugs !== [] && ! $user->hasAnyRole($roleSlugs)) {
            abort(403);
        }

        return $next($request);
    }
}
