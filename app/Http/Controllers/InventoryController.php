<?php

namespace App\Http\Controllers;

use App\Models\InventoryTransaction;
use App\Models\RawMaterial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(): Response
    {
        $materials = RawMaterial::query()
            ->withCount('transactions')
            ->orderBy('name')
            ->get();

        $recentTransactions = InventoryTransaction::query()
            ->with(['rawMaterial:id,name,unit', 'user:id,name'])
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        return Inertia::render('erp/inventory/index', [
            'pageTitle' => 'Inventory',
            'materials' => $materials,
            'recentTransactions' => $recentTransactions,
        ]);
    }

    public function storeMaterial(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:20',
            'category' => 'nullable|string|max:100',
            'min_stock' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        RawMaterial::create($data);

        return redirect()->back()->with('success', 'Material added.');
    }

    public function updateMaterial(Request $request, RawMaterial $material): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:20',
            'category' => 'nullable|string|max:100',
            'min_stock' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'supplier' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
            'is_active' => 'boolean',
        ]);

        $material->update($data);

        return redirect()->back()->with('success', 'Material updated.');
    }

    public function addTransaction(Request $request, RawMaterial $material): RedirectResponse
    {
        $data = $request->validate([
            'type' => 'required|in:purchase,issue,adjustment,return',
            'qty' => 'required|numeric|not_in:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'reference' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($data, $material, $request) {
            InventoryTransaction::create([
                ...$data,
                'raw_material_id' => $material->id,
                'user_id' => $request->user()?->id,
            ]);

            $delta = in_array($data['type'], ['purchase', 'return'])
                ? abs((float) $data['qty'])
                : -abs((float) $data['qty']);

            $material->increment('stock_qty', $delta);

            if (! empty($data['cost_per_unit'])) {
                $material->update(['cost_per_unit' => $data['cost_per_unit']]);
            }

            return redirect()->back()->with('success', 'Stock updated.');
        });
    }

    /** GET /api/v1/inventory/search?q=humic */
    public function search(Request $request): JsonResponse
    {
        $q = (string) $request->query('q', '');

        $materials = RawMaterial::query()
            ->where('is_active', true)
            ->when(strlen($q) >= 1, fn ($query) => $query->where('name', 'like', "%{$q}%"))
            ->orderBy('name')
            ->limit(15)
            ->get(['id', 'name', 'unit', 'cost_per_unit'])
            ->map(fn ($m) => [
                'id'   => (string) $m->id,
                'name' => $m->name,
                'unit' => $m->unit,
                'cost' => (float) $m->cost_per_unit,
            ]);

        return response()->json($materials);
    }
}
