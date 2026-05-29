<?php

namespace App\Http\Controllers;

use App\Models\InventoryPurchaseBill;
use App\Models\InventoryPurchaseBillItem;
use App\Models\InventoryReorder;
use App\Models\InventoryTransaction;
use App\Models\RawMaterial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
            ->limit(50)
            ->get();

        $purchaseBills = InventoryPurchaseBill::query()
            ->with(['items', 'user:id,name'])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $reorders = InventoryReorder::query()
            ->with('rawMaterial:id,name')
            ->orderByDesc('id')
            ->get();

        $activeMaterials = $materials->where('is_active', true);

        $stats = [
            'totalMaterials' => $materials->count(),
            'lowStock' => $activeMaterials->filter(
                fn ($m) => (float) $m->stock_qty <= (float) $m->min_stock
            )->count(),
            'outOfStock' => $activeMaterials->filter(
                fn ($m) => (float) $m->stock_qty <= 0
            )->count(),
            'totalStockValue' => $activeMaterials->sum(
                fn ($m) => (float) $m->stock_qty * (float) $m->cost_per_unit
            ),
        ];

        return Inertia::render('erp/inventory/index', array_merge(
            compact('materials', 'recentTransactions', 'purchaseBills', 'reorders', 'stats'),
            ['pageTitle' => 'Inventory']
        ));
    }

    public function storeMaterial(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255|unique:raw_materials,name',
            'sku'           => 'nullable|string|max:100|unique:raw_materials,sku',
            'hsn'           => 'nullable|string|max:50',
            'gst'           => 'nullable|numeric|min:0|max:100',
            'unit'          => 'required|string|max:20',
            'category'      => 'nullable|string|max:100',
            'min_stock'     => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'selling_rate'  => 'nullable|numeric|min:0',
            'dim_l'         => 'nullable|numeric|min:0',
            'dim_w'         => 'nullable|numeric|min:0',
            'dim_h'         => 'nullable|numeric|min:0',
            'supplier'      => 'nullable|string|max:255',
            'notes'         => 'nullable|string|max:500',
        ]);

        RawMaterial::create($data);

        return redirect()->back()->with('success', 'Material added.');
    }

    public function updateMaterial(Request $request, RawMaterial $material): RedirectResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255|unique:raw_materials,name,' . $material->id,
            'sku'           => 'nullable|string|max:100|unique:raw_materials,sku,' . $material->id,
            'hsn'           => 'nullable|string|max:50',
            'gst'           => 'nullable|numeric|min:0|max:100',
            'unit'          => 'required|string|max:20',
            'category'      => 'nullable|string|max:100',
            'min_stock'     => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'selling_rate'  => 'nullable|numeric|min:0',
            'dim_l'         => 'nullable|numeric|min:0',
            'dim_w'         => 'nullable|numeric|min:0',
            'dim_h'         => 'nullable|numeric|min:0',
            'supplier'      => 'nullable|string|max:255',
            'notes'         => 'nullable|string|max:500',
            'is_active'     => 'boolean',
        ]);

        $material->update($data);

        return redirect()->back()->with('success', 'Material updated.');
    }

    public function destroyMaterial(RawMaterial $material): RedirectResponse
    {
        $material->delete();

        return redirect()->back()->with('success', 'Material deleted.');
    }

    public function addTransaction(Request $request, RawMaterial $material): RedirectResponse
    {
        $data = $request->validate([
            'type'          => 'required|in:purchase,issue,adjustment,return',
            'qty'           => 'required|numeric',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'reference'     => 'nullable|string|max:255',
            'notes'         => 'nullable|string|max:500',
        ]);

        return DB::transaction(function () use ($data, $material, $request) {
            $previous = (float) $material->stock_qty;
            $qty = $data['qty'];

            $new = match ($data['type']) {
                'purchase', 'return' => $previous + abs((float) $qty),
                'issue'              => max(0, $previous - abs((float) $qty)),
                'adjustment'         => abs((float) $qty),
                default              => $previous,
            };

            InventoryTransaction::create([
                'raw_material_id' => $material->id,
                'user_id'         => $request->user()?->id,
                'type'            => $data['type'],
                'qty'             => $data['qty'],
                'previous_stock'  => $previous,
                'new_stock'       => $new,
                'cost_per_unit'   => $data['cost_per_unit'] ?? null,
                'reference'       => $data['reference'] ?? null,
                'notes'           => $data['notes'] ?? null,
            ]);

            $material->update(['stock_qty' => $new]);

            if (! empty($data['cost_per_unit'])) {
                $material->update(['cost_per_unit' => $data['cost_per_unit']]);
            }

            return redirect()->back()->with('success', 'Stock updated.');
        });
    }

    public function storePurchaseBill(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vendor_name'           => 'required|string|max:255',
            'bill_number'           => 'nullable|string|max:100',
            'bill_date'             => 'nullable|date',
            'total_amount'          => 'nullable|numeric|min:0',
            'bill_file'             => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'add_to_stock'          => 'boolean',
            'items'                 => 'required|array|min:1',
            'items.*.material_name' => 'required|string|max:255',
            'items.*.sku'           => 'nullable|string|max:100',
            'items.*.category'      => 'nullable|string|max:100',
            'items.*.hsn'           => 'nullable|string|max:50',
            'items.*.qty'           => 'required|numeric|min:0.001',
            'items.*.unit'          => 'required|string|max:20',
            'items.*.rate'          => 'nullable|numeric|min:0',
            'items.*.gst'           => 'nullable|numeric|min:0|max:100',
            'items.*.amount'        => 'nullable|numeric|min:0',
        ]);

        $billNumber = $data['bill_number'] ?? null;

        if ($billNumber && InventoryPurchaseBill::where('bill_number', $billNumber)->exists()) {
            return redirect()->back()->withErrors(['bill_number' => 'This bill number already exists.']);
        }

        $billFilePath = null;
        $billFileName = null;

        if ($request->hasFile('bill_file')) {
            $billFilePath = $request->file('bill_file')->store('inventory/bills', 'public');
            $billFileName = $request->file('bill_file')->getClientOriginalName();
        }

        DB::transaction(function () use ($data, $billNumber, $billFilePath, $billFileName, $request) {
            $bill = InventoryPurchaseBill::create([
                'vendor_name'  => $data['vendor_name'],
                'bill_number'  => $billNumber,
                'bill_date'    => $data['bill_date'] ?? null,
                'total_amount' => $data['total_amount'] ?? 0,
                'bill_file'    => $billFilePath,
                'bill_name'    => $billFileName,
                'add_to_stock' => $data['add_to_stock'] ?? false,
                'user_id'      => $request->user()?->id,
            ]);

            $addToStock = (bool) ($data['add_to_stock'] ?? false);

            foreach ($data['items'] as $item) {
                $sku = $item['sku'] ?? null;

                if ($sku) {
                    $material = RawMaterial::firstOrCreate(
                        ['sku' => $sku],
                        [
                            'name'     => $item['material_name'],
                            'unit'     => $item['unit'],
                            'category' => $item['category'] ?? null,
                        ]
                    );
                } else {
                    $material = RawMaterial::firstOrCreate(
                        ['name' => $item['material_name']],
                        [
                            'unit'     => $item['unit'],
                            'category' => $item['category'] ?? null,
                        ]
                    );
                }

                InventoryPurchaseBillItem::create([
                    'inventory_purchase_bill_id' => $bill->id,
                    'raw_material_id'            => $material->id,
                    'material_name'              => $item['material_name'],
                    'sku'                        => $sku,
                    'category'                   => $item['category'] ?? null,
                    'hsn'                        => $item['hsn'] ?? null,
                    'qty'                        => $item['qty'],
                    'unit'                       => $item['unit'],
                    'rate'                       => $item['rate'] ?? 0,
                    'gst'                        => $item['gst'] ?? 0,
                    'amount'                     => $item['amount'] ?? 0,
                ]);

                if ($addToStock && (float) $item['qty'] > 0) {
                    $previous = (float) $material->stock_qty;
                    $new = $previous + (float) $item['qty'];

                    $material->stock_qty = $new;
                    if (! empty($item['rate']) && (float) $item['rate'] > 0) {
                        $material->cost_per_unit = $item['rate'];
                    }
                    $material->save();

                    InventoryTransaction::create([
                        'raw_material_id' => $material->id,
                        'user_id'         => $request->user()?->id,
                        'type'            => 'purchase',
                        'qty'             => $item['qty'],
                        'previous_stock'  => $previous,
                        'new_stock'       => $new,
                        'reference'       => $billNumber,
                    ]);
                }
            }
        });

        return redirect()->back()->with('success', 'Purchase bill added.');
    }

    public function destroyPurchaseBill(InventoryPurchaseBill $bill): RedirectResponse
    {
        if ($bill->bill_file) {
            Storage::disk('public')->delete($bill->bill_file);
        }

        $bill->delete();

        return redirect()->back()->with('success', 'Bill deleted.');
    }

    public function storeReorder(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'raw_material_id'   => 'required|exists:raw_materials,id',
            'qty_ordered'       => 'required|numeric|min:0.001',
            'unit'              => 'required|string|max:20',
            'supplier'          => 'nullable|string|max:255',
            'order_date'        => 'required|date',
            'expected_delivery' => 'nullable|date',
            'transport_name'    => 'nullable|string|max:255',
            'lr_number'         => 'nullable|string|max:100',
            'notes'             => 'nullable|string|max:500',
        ]);

        InventoryReorder::create($data);

        return redirect()->back()->with('success', 'Reorder created.');
    }

    public function receiveReorder(Request $request, InventoryReorder $reorder): RedirectResponse
    {
        if ($reorder->status === 'received') {
            return redirect()->back()->with('error', 'Already received.');
        }

        DB::transaction(function () use ($reorder, $request) {
            $material = RawMaterial::findOrFail($reorder->raw_material_id);
            $previous = (float) $material->stock_qty;
            $new = $previous + (float) $reorder->qty_ordered;

            $material->update(['stock_qty' => $new]);

            InventoryTransaction::create([
                'raw_material_id' => $material->id,
                'user_id'         => auth()->id(),
                'type'            => 'purchase',
                'qty'             => $reorder->qty_ordered,
                'previous_stock'  => $previous,
                'new_stock'       => $new,
                'reference'       => 'Reorder #' . $reorder->id,
                'notes'           => 'Received from reorder',
            ]);

            $reorder->update([
                'status'      => 'received',
                'received_at' => now(),
            ]);
        });

        return redirect()->back()->with('success', 'Reorder marked as received. Stock updated.');
    }

    public function destroyReorder(InventoryReorder $reorder): RedirectResponse
    {
        $reorder->delete();

        return redirect()->back()->with('success', 'Reorder deleted.');
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
