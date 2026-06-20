<?php

namespace App\Http\Controllers;

use App\Models\InventoryPool;
use App\Models\Product;
use App\Models\ProductInventoryLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryPoolController extends Controller
{
    public function index(): Response
    {
        $pools = InventoryPool::withCount('links')->latest()->get();

        $links = ProductInventoryLink::with(['product:id,name,company_id', 'product.company:id,name', 'inventoryPool:id,name'])
            ->get();

        $products = Product::withoutGlobalScopes()
            ->with('company:id,name')
            ->whereDoesntHave('inventoryLink')
            ->orderBy('name')
            ->get(['id', 'name', 'company_id']);

        return Inertia::render('erp/inventory-pools/index', compact('pools', 'links', 'products'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'stock_qty' => 'required|numeric|min:0',
            'unit' => 'required|string|max:20',
            'notes' => 'nullable|string',
        ]);

        InventoryPool::create($data);

        return redirect()->back()->with('success', 'Inventory pool created.');
    }

    public function update(Request $request, InventoryPool $inventoryPool): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:20',
            'notes' => 'nullable|string',
        ]);

        $inventoryPool->update($data);

        return redirect()->back()->with('success', 'Inventory pool updated.');
    }

    public function destroy(InventoryPool $inventoryPool): RedirectResponse
    {
        $inventoryPool->delete();

        return redirect()->back()->with('success', 'Inventory pool deleted.');
    }

    public function link(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'inventory_pool_id' => 'required|exists:inventory_pools,id',
        ]);

        $product = Product::withoutGlobalScopes()->findOrFail($data['product_id']);

        DB::transaction(function () use ($product, $data, $request) {
            ProductInventoryLink::updateOrCreate(
                ['product_id' => $product->id],
                [
                    'inventory_pool_id' => $data['inventory_pool_id'],
                    'linked_by' => $request->user()?->id,
                    'linked_at' => now(),
                ],
            );
        });

        return redirect()->back()->with('success', "{$product->name} linked to shared inventory pool.");
    }

    public function unlink(ProductInventoryLink $productInventoryLink): RedirectResponse
    {
        $productInventoryLink->delete();

        return redirect()->back()->with('success', 'Product unlinked from inventory pool.');
    }
}
