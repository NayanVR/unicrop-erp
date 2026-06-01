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

        // No roles assigned yet = treat as admin (first-setup / unassigned owner)
        if ($user->roles->isEmpty()) {
            return $next($request);
        }

        if ($roles !== [] && ! $user->hasAnyRole($roles)) {
            abort(403);
        }

        return $next($request);
    }
}
