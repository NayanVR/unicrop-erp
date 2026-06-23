<?php

namespace App\Http\Controllers;

use App\Models\Policy;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PolicyController extends Controller
{
    public function index(): Response
    {
        $policies = Policy::orderByDesc('is_system')->orderBy('name')->get();
        $permissionKeys = Policy::defaultPermissionKeys();

        return Inertia::render('erp/policies/index', compact('policies', 'permissionKeys'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validatePolicy($request);
        $data['slug'] = Str::slug($data['name']);
        $data['is_system'] = false;

        Policy::create($data);

        return redirect()->back()->with('success', 'Policy created.');
    }

    public function update(Request $request, Policy $policy): RedirectResponse
    {
        $data = $this->validatePolicy($request, $policy);

        if ($policy->is_system) {
            // The slug of a system policy is referenced by role lookups, so its
            // name/slug stay fixed — admins may only adjust its permissions.
            $policy->update(['permissions' => $data['permissions']]);

            return redirect()->back()->with('success', 'Policy updated.');
        }

        $data['slug'] = Str::slug($data['name']);

        $policy->update($data);

        return redirect()->back()->with('success', 'Policy updated.');
    }

    public function destroy(Policy $policy): RedirectResponse
    {
        if ($policy->is_system) {
            return redirect()->back()->with('error', 'System policies cannot be deleted.');
        }

        $policy->delete();

        return redirect()->back()->with('success', 'Policy deleted.');
    }

    private function validatePolicy(Request $request, ?Policy $policy = null): array
    {
        return $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('policies', 'name')->ignore($policy?->id),
            ],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string', Rule::in(Policy::defaultPermissionKeys())],
        ]);
    }
}
