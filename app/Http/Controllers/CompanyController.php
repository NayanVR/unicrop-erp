<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class CompanyController extends Controller
{
    public function switch(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'company_id' => ['required', 'integer'],
        ]);

        $user = $request->user();

        abort_unless(
            $user->companies()->where('companies.id', $data['company_id'])->exists(),
            403,
        );

        $request->session()->put('current_company_id', $data['company_id']);

        return redirect()->back();
    }

    public function index(): Response
    {
        $companies = Company::withCount('users')->orderBy('name')->get();

        return Inertia::render('erp/companies/index', compact('companies'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateCompany($request);
        $data['slug'] = ($data['slug'] ?? null) ?: Str::slug($data['name']);

        Company::create($data);

        return redirect()->back()->with('success', 'Company created.');
    }

    public function update(Request $request, Company $company): RedirectResponse
    {
        $data = $this->validateCompany($request, $company);
        $data['slug'] = ($data['slug'] ?? null) ?: Str::slug($data['name']);

        $company->update($data);

        return redirect()->back()->with('success', 'Company updated.');
    }

    public function destroy(Company $company): RedirectResponse
    {
        if (Company::count() <= 1) {
            return redirect()->back()->with('error', 'At least one company must remain.');
        }

        $company->delete();

        return redirect()->back()->with('success', 'Company deleted.');
    }

    private function validateCompany(Request $request, ?Company $company = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => [
                'nullable', 'string', 'max:255',
                Rule::unique('companies', 'slug')->ignore($company?->id),
            ],
            'is_active' => ['boolean'],
        ]);
    }
}
