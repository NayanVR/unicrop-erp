<?php

namespace App\Http\Controllers;

use App\Models\FinishedGood;
use App\Models\Product;
use App\Services\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        $currentId = app(CurrentCompany::class)->id();

        // Unicrop's finished goods = the "parent" products in dropdown
        $unicropProducts = FinishedGood::select('id', 'name')
            ->orderBy('name')
            ->get();

        // All other active companies (child companies)
        $companies = \App\Models\Company::where('id', '!=', $currentId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        // All child-company product mappings (products linked to a finished good)
        $products = Product::withoutGlobalScopes()
            ->whereNotNull('finished_good_id')
            ->whereColumn('company_id', '!=', \DB::raw($currentId))
            ->with(['finishedGood:id,name', 'company:id,name'])
            ->latest()
            ->get();

        return Inertia::render('erp/products/index', compact('products', 'unicropProducts', 'companies'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProduct($request);

        $product = new Product();
        $product->company_id = $data['company_id'];
        $product->name = $data['name'];
        $product->finished_good_id = $data['finished_good_id'];
        $product->gst_percent = 18;
        $product->save();

        return redirect()->back()->with('success', 'Product mapping added.');
    }

    public function update(Request $request, int $product): RedirectResponse
    {
        $product = Product::withoutGlobalScopes()->findOrFail($product);

        $data = $this->validateProduct($request, $product);

        $product->name = $data['name'];
        $product->finished_good_id = $data['finished_good_id'];
        $product->save();

        return redirect()->back()->with('success', 'Product mapping updated.');
    }

    public function destroy(int $product): RedirectResponse
    {
        $product = Product::withoutGlobalScopes()->findOrFail($product);
        $product->delete();

        return redirect()->back()->with('success', 'Product mapping deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProduct(Request $request, ?Product $product = null): array
    {
        return $request->validate([
            'company_id'       => 'required|integer|exists:companies,id',
            'name'             => 'required|string|max:255',
            'finished_good_id' => 'required|integer|exists:finished_goods,id',
        ]);
    }
}
