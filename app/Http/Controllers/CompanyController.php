<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

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
}
