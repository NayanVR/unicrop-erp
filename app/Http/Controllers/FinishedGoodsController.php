<?php

namespace App\Http\Controllers;

use App\Models\Bom;
use App\Models\FinishedGood;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FinishedGoodsController extends Controller
{
    public function index(): Response
    {
        $goods = FinishedGood::with(['product:id,name', 'bom:id,name', 'creator:id,name'])
            ->latest()
            ->get();

        $products = Product::where('is_active', true)->get(['id', 'name']);
        $boms = Bom::where('is_active', true)->get(['id', 'name', 'packing_size', 'batch_size', 'batch_unit']);

        $stats = [
            'total_batches' => $goods->count(),
            'total_quantity' => $goods->sum('quantity'),
            'production_batches' => $goods->where('source', 'production')->count(),
            'filling_batches' => $goods->where('source', 'filling')->count(),
            'manual_entries' => $goods->where('source', 'manual')->count(),
        ];

        return Inertia::render('erp/finished-goods/index', compact('goods', 'products', 'boms', 'stats'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => 'nullable|exists:products,id',
            'bom_id' => 'nullable|exists:boms,id',
            'name' => 'required|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'batch_ref' => 'nullable|string|max:100',
            'quantity' => 'required|numeric|min:0.001',
            'unit' => 'required|string|max:20',
            'notes' => 'nullable|string',
            'source' => 'required|in:production,manual',
        ]);

        $data['created_by'] = $request->user()?->id;

        FinishedGood::create($data);

        return redirect()->back()->with('success', 'Finished good entry added.');
    }

    public function update(Request $request, FinishedGood $finishedGood): RedirectResponse
    {
        $data = $request->validate([
            'product_id' => 'nullable|exists:products,id',
            'bom_id' => 'nullable|exists:boms,id',
            'name' => 'required|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'batch_ref' => 'nullable|string|max:100',
            'quantity' => 'required|numeric|min:0.001',
            'unit' => 'required|string|max:20',
            'notes' => 'nullable|string',
            'source' => 'required|in:production,manual',
        ]);

        $finishedGood->update($data);

        return redirect()->back()->with('success', 'Entry updated.');
    }

    public function destroy(FinishedGood $finishedGood): RedirectResponse
    {
        $finishedGood->delete();

        return redirect()->back()->with('success', 'Entry deleted.');
    }
}
