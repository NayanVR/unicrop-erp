<?php

namespace App\Http\Controllers;

use App\Models\Bom;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\RawMaterial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class BomController extends Controller
{
    public function show(Bom $bom): Response
    {
        $bom->load(['product:id,name', 'items.rawMaterial:id,name,unit,stock_qty,cost_per_unit']);

        $products  = Product::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $materials = RawMaterial::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'unit', 'stock_qty', 'cost_per_unit']);

        return Inertia::render('erp/bom/show', [
            'pageTitle' => $bom->name,
            'bom'       => $bom,
            'products'  => $products,
            'materials' => $materials,
        ]);
    }

    public function index(): Response
    {
        $boms = Bom::query()
            ->with(['product:id,name', 'items.rawMaterial:id,name,unit,stock_qty'])
            ->orderBy('name')
            ->get();

        $products = Product::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $materials = RawMaterial::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'unit', 'stock_qty', 'cost_per_unit']);

        return Inertia::render('erp/bom/index', [
            'pageTitle' => 'Bill of Materials',
            'boms' => $boms,
            'products' => $products,
            'materials' => $materials,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'product_id' => 'nullable|exists:products,id',
            'packing_size' => 'nullable|string|max:50',
            'batch_size' => 'required|numeric|min:0.001',
            'batch_unit' => 'required|string|max:20',
            'notes' => 'nullable|string|max:1000',
            'items' => 'array',
            'items.*.raw_material_id' => 'required|exists:raw_materials,id',
            'items.*.qty_per_batch' => 'required|numeric|min:0.001',
            'items.*.unit' => 'nullable|string|max:20',
        ]);

        return DB::transaction(function () use ($data) {
            $bom = Bom::create([
                'name' => $data['name'],
                'product_id' => $data['product_id'] ?? null,
                'packing_size' => $data['packing_size'] ?? null,
                'batch_size' => $data['batch_size'],
                'batch_unit' => $data['batch_unit'],
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $bom->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_batch' => $item['qty_per_batch'],
                    'unit' => $item['unit'] ?? null,
                ]);
            }

            return redirect()->back()->with('success', 'BOM created.');
        });
    }

    public function update(Request $request, Bom $bom): RedirectResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'product_id' => 'nullable|exists:products,id',
            'packing_size' => 'nullable|string|max:50',
            'batch_size' => 'required|numeric|min:0.001',
            'batch_unit' => 'required|string|max:20',
            'notes' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
            'items' => 'array',
            'items.*.raw_material_id' => 'required|exists:raw_materials,id',
            'items.*.qty_per_batch' => 'required|numeric|min:0.001',
            'items.*.unit' => 'nullable|string|max:20',
        ]);

        return DB::transaction(function () use ($data, $bom) {
            $bom->update([
                'name' => $data['name'],
                'product_id' => $data['product_id'] ?? null,
                'packing_size' => $data['packing_size'] ?? null,
                'batch_size' => $data['batch_size'],
                'batch_unit' => $data['batch_unit'],
                'notes' => $data['notes'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ]);

            $bom->items()->delete();
            foreach ($data['items'] ?? [] as $item) {
                $bom->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_batch' => $item['qty_per_batch'],
                    'unit' => $item['unit'] ?? null,
                ]);
            }

            return redirect()->back()->with('success', 'BOM updated.');
        });
    }

    public function destroy(Bom $bom): RedirectResponse
    {
        $bom->delete();

        return redirect()->back()->with('success', 'BOM deleted.');
    }

    public function runProduction(Request $request, Bom $bom): RedirectResponse
    {
        $data = $request->validate([
            'batch_count' => 'required|numeric|min:0.001',
            'notes' => 'nullable|string|max:500',
        ]);

        $batchCount = (float) $data['batch_count'];

        return DB::transaction(function () use ($bom, $batchCount, $data, $request) {
            $shortfalls = [];

            foreach ($bom->items()->with('rawMaterial')->get() as $item) {
                $required = (float) $item->qty_per_batch * $batchCount;
                $available = (float) $item->rawMaterial->stock_qty;

                if ($available < $required) {
                    $shortfalls[] = "{$item->rawMaterial->name}: need {$required} {$item->rawMaterial->unit}, have {$available}";
                }
            }

            if ($shortfalls) {
                return redirect()->back()->with('error', 'Insufficient stock: '.implode('; ', $shortfalls));
            }

            foreach ($bom->items()->with('rawMaterial')->get() as $item) {
                $qty = (float) $item->qty_per_batch * $batchCount;

                $item->rawMaterial->decrement('stock_qty', $qty);

                InventoryTransaction::create([
                    'raw_material_id' => $item->rawMaterial->id,
                    'user_id' => $request->user()?->id,
                    'type' => 'issue',
                    'qty' => $qty,
                    'reference' => "BOM Run: {$bom->name} × {$batchCount}",
                    'notes' => $data['notes'] ?? null,
                ]);
            }

            return redirect()->back()->with('success', "Production run of {$batchCount} batch(es) completed. Raw materials deducted.");
        });
    }
}
