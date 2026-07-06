<?php

namespace App\Http\Controllers;

use App\Models\FinishedGood;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Services\CurrentCompany;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(): Response
    {
        $products = Product::with(['rawMaterial:id,name', 'finishedGood:id,name', 'parent:id,name,our_brand,packing_size'])
            ->latest()
            ->get();

        $rawMaterials = RawMaterial::where('is_active', true)->get(['id', 'name']);
        $finishedGoods = FinishedGood::latest()->get(['id', 'name']);

        $currentCompanyId = app(CurrentCompany::class)->id();
        $parentProducts = Product::withoutGlobalScopes()
            ->where('company_id', '!=', $currentCompanyId)
            ->where('is_active', true)
            ->with('company:id,name')
            ->get(['id', 'company_id', 'name', 'our_brand', 'packing_size'])
            ->map(fn($p) => [
                'id' => $p->id,
                'label' => "[{$p->company->name}] {$p->name} ({$p->packing_size})",
                'name' => $p->name,
                'our_brand' => $p->our_brand,
                'packing_size' => $p->packing_size,
            ]);

        return Inertia::render('erp/products/index', compact('products', 'rawMaterials', 'finishedGoods', 'parentProducts'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProduct($request);

        Product::create($data);

        return redirect()->back()->with('success', 'Product added.');
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $data = $this->validateProduct($request, $product);

        $product->update($data);

        return redirect()->back()->with('success', 'Product updated.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()->back()->with('success', 'Product deleted.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProduct(Request $request, ?Product $product = null): array
    {
        $companyId = app(CurrentCompany::class)->id();

        $data = $request->validate([
            'raw_material_id' => 'nullable|exists:raw_materials,id',
            'finished_good_id' => 'nullable|exists:finished_goods,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('products')
                    ->where('company_id', $companyId)
                    ->where('packing_size', $request->input('packing_size'))
                    ->ignore($product?->id),
            ],
            'our_brand' => 'nullable|string|max:255',
            'sku' => 'nullable|string|max:100',
            'hsn_code' => 'nullable|string|max:20',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'category' => 'nullable|string|max:100',
            'packing_size' => 'nullable|string|max:100',
            'is_active' => 'boolean',
            'parent_product_id' => 'nullable|integer|exists:products,id',
        ]);

        return $data;
    }
}
