<?php

namespace App\Http\Controllers;

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

        // Unicrop's own products (for the dropdown)
        $unicropProducts = Product::select('id', 'name', 'packing_size')
            ->orderBy('name')
            ->get();

        // All other active companies (child companies)
        $companies = \App\Models\Company::where('id', '!=', $currentId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        // All child-company product mappings (products that have a parent_product_id)
        $products = Product::withoutGlobalScopes()
            ->whereNotNull('parent_product_id')
            ->with(['parent:id,name,packing_size', 'company:id,name'])
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
        $product->parent_product_id = $data['parent_product_id'];
        $product->gst_percent = 18;
        $product->save();

        return redirect()->back()->with('success', 'Product mapping added.');
    }

    public function update(Request $request, int $product): RedirectResponse
    {
        $product = Product::withoutGlobalScopes()->findOrFail($product);

        $data = $this->validateProduct($request, $product);

        $product->name = $data['name'];
        $product->parent_product_id = $data['parent_product_id'];
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
            'company_id' => 'required|integer|exists:companies,id',
            'name' => 'required|string|max:255',
            'parent_product_id' => 'required|integer|exists:products,id',
        ]);
    }
}
