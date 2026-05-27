<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductRate;
use App\Models\Transport;
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
            'transports' => Transport::query()->orderBy('type')->orderBy('name')->get(),
            'productRates' => ProductRate::query()->orderBy('our_brand')->orderBy('packing_size')->get(),
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

    public function storeTransport(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:transport,courier',
        ]);

        Transport::create($data);

        return redirect()->back()->with('success', ucfirst($data['type']).' added.');
    }

    public function updateTransport(Request $request, Transport $transport): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:transport,courier',
        ]);

        $transport->update($data);

        return redirect()->back()->with('success', ucfirst($data['type']).' updated.');
    }

    public function destroyTransport(Transport $transport): RedirectResponse
    {
        $transport->delete();

        return redirect()->back()->with('success', 'Deleted.');
    }

    public function storeProductRate(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'   => 'required|string|max:255',
            'party_brand' => 'nullable|string|max:255',
            'packing_size' => 'required|string|max:50',
            'rate'        => 'required|numeric|min:0',
            'gst_percent' => 'required|numeric|min:0|max:100',
        ]);

        ProductRate::updateOrCreate(
            ['our_brand' => $data['our_brand'], 'packing_size' => $data['packing_size']],
            $data
        );

        return redirect()->back()->with('success', 'Rate saved.');
    }

    public function updateProductRate(Request $request, ProductRate $productRate): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'   => 'required|string|max:255',
            'party_brand' => 'nullable|string|max:255',
            'packing_size' => 'required|string|max:50',
            'rate'        => 'required|numeric|min:0',
            'gst_percent' => 'required|numeric|min:0|max:100',
            'is_active'   => 'boolean',
        ]);

        $productRate->update($data);

        return redirect()->back()->with('success', 'Rate updated.');
    }

    public function destroyProductRate(ProductRate $productRate): RedirectResponse
    {
        $productRate->delete();

        return redirect()->back()->with('success', 'Rate deleted.');
    }
}
