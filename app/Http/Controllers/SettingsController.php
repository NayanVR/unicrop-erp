<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('erp/settings/index', [
            'pageTitle' => 'Settings',
            'products' => Product::query()->orderBy('name')->get(),
        ]);
    }

    public function storeProduct(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'hsn_code' => 'nullable|string|max:20',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        Product::create($data);

        return redirect()->back()->with('success', 'Product added.');
    }

    public function updateProduct(Request $request, Product $product): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'hsn_code' => 'nullable|string|max:20',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'category' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $product->update($data);

        return redirect()->back()->with('success', 'Product updated.');
    }

    public function destroyProduct(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()->back()->with('success', 'Product deleted.');
    }
}
