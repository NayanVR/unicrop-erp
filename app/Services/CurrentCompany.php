<?php

namespace App\Services;

use App\Models\Company;
use Illuminate\Http\Request;

class CurrentCompany
{
    protected ?Company $company = null;

    public function resolve(Request $request): void
    {
        $user = $request->user();

        $sessionCompanyId = $request->session()->get('current_company_id');

        if ($user && $sessionCompanyId) {
            $sessionCompany = $user->companies()->where('companies.id', $sessionCompanyId)->first();

            if ($sessionCompany) {
                $this->company = $sessionCompany;

                return;
            }
        }

        if ($user) {
            $first = $user->companies()->first();

            if ($first) {
                $this->company = $first;

                return;
            }
        }

        $this->company = Company::query()->orderBy('id')->first();
    }

    public function set(Company $company): void
    {
        $this->company = $company;
    }

    public function model(): ?Company
    {
        return $this->company;
    }

    public function id(): ?int
    {
        return $this->company?->id;
    }
}
