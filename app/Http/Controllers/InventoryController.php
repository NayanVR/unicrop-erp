<?php

namespace App\Http\Controllers;

use App\Models\Bom;
use App\Models\FillingRecipe;
use App\Models\Godown;
use App\Models\GodownStock;
use App\Models\InventoryCategory;
use App\Models\InventoryPurchaseBill;
use App\Models\InventoryPurchaseBillItem;
use App\Models\InventoryReorder;
use App\Models\InventoryTransaction;
use App\Models\Party;
use App\Models\RawMaterial;
use App\Services\LowStockAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $role = $user->roles->first()?->slug;
        $fullAccessRoles = ['admin', 'factory', 'accountant'];
        $isSales = ! in_array($role, $fullAccessRoles);

        $materials = RawMaterial::query()
            ->withCount('transactions')
            ->where('approval_status', 'approved')
            ->orderBy('name')
            ->get();

        $pendingMaterials = collect();
        if ($role === 'admin') {
            $pendingMaterials = RawMaterial::query()
                ->where('approval_status', 'pending')
                ->with('requestedByUser:id,name')
                ->orderByDesc('id')
                ->get();
        } elseif ($role === 'accountant') {
            $pendingMaterials = RawMaterial::query()
                ->where('approval_status', 'pending')
                ->where('requested_by', $user->id)
                ->orderByDesc('id')
                ->get();
        }

        if ($isSales) {
            // Admin controls which categories the sales team can see
            $hiddenCategories = InventoryCategory::query()
                ->where('visible_to_sales', false)
                ->pluck('name')
                ->map(fn ($n) => mb_strtolower(trim($n)));

            $materials = $materials->reject(
                fn ($m) => $hiddenCategories->contains(mb_strtolower(trim((string) $m->category)))
            )->values();
        }

        if ($isSales) {
            $materials->each(function ($m) {
                $m->cost_per_unit = null;
                $m->supplier      = null;
                $m->notes         = null;
                $m->hsn           = null;
                $m->gst           = null;
                $m->min_stock     = 0;
                $m->reorder_level = 0;
            });
        }

        $recentTransactions = $isSales ? collect() : InventoryTransaction::query()
            ->with(['rawMaterial:id,name,unit', 'user:id,name'])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $purchaseBills = $isSales ? collect() : InventoryPurchaseBill::query()
            ->with(['items', 'user:id,name'])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $reorders = $isSales ? collect() : InventoryReorder::query()
            ->with(['rawMaterial:id,name', 'receivedByUser:id,name'])
            ->orderByDesc('id')
            ->get();

        $vendors = $isSales ? collect() : Party::query()
            ->where('is_active', true)
            ->whereIn('type', ['supplier', 'both'])
            ->orderBy('name')
            ->get(['id', 'name', 'gst_no']);

        $activeMaterials = $materials->where('is_active', true);

        $stats = [
            'totalMaterials' => $materials->count(),
            'lowStock' => $activeMaterials->filter(
                fn ($m) => (float) $m->stock_qty <= (float) $m->min_stock
            )->count(),
            'outOfStock' => $activeMaterials->filter(
                fn ($m) => (float) $m->stock_qty <= 0
            )->count(),
            'totalStockValue' => $isSales ? 0 : $activeMaterials->sum(
                fn ($m) => (float) $m->stock_qty * (float) $m->cost_per_unit
            ),
        ];

        $inventoryCategories = InventoryCategory::orderBy('name')->get();
        if ($isSales) {
            $inventoryCategories = $inventoryCategories->where('visible_to_sales', true)->values();
        }

        $bomOutputMap    = $isSales ? [] : Bom::whereNotNull('output_raw_material_id')
            ->where('is_active', true)
            ->get(['output_raw_material_id', 'name'])
            ->groupBy('output_raw_material_id')
            ->map(fn ($g) => $g->pluck('name')->toArray());

        $fillingOutputMap = $isSales ? [] : FillingRecipe::whereNotNull('output_raw_material_id')
            ->where('is_active', true)
            ->get(['output_raw_material_id', 'name', 'packing_size'])
            ->groupBy('output_raw_material_id')
            ->map(fn ($g) => $g->map(fn ($r) => $r->name . ($r->packing_size ? " ({$r->packing_size})" : ''))->toArray());

        $godowns = $isSales ? collect() : Godown::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->with(['stocks.rawMaterial:id,name,unit,category'])
            ->get();

        $finishGoodGroups = RawMaterial::whereRaw("LOWER(category) LIKE ? AND LOWER(category) NOT LIKE ?", ['%finish%good%', '%semi%'])
            ->whereNotNull('group_name')
            ->where('group_name', '!=', '')
            ->selectRaw('group_name, COUNT(*) as cnt')
            ->groupBy('group_name')
            ->orderBy('group_name')
            ->get()
            ->map(fn ($r) => ['name' => $r->group_name, 'count' => (int) $r->cnt]);

        return Inertia::render('erp/inventory/index', array_merge(
            compact('materials', 'pendingMaterials', 'recentTransactions', 'purchaseBills', 'reorders', 'stats', 'vendors', 'inventoryCategories', 'bomOutputMap', 'fillingOutputMap', 'godowns', 'finishGoodGroups'),
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
            'group_name'    => 'nullable|string|max:100',
            'shape'         => 'nullable|string|max:50',
            'min_stock'     => 'nullable|numeric|min:0',
            'reorder_level' => 'nullable|numeric|min:0',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'selling_rate'  => 'nullable|numeric|min:0',
            'stock_qty'     => 'nullable|numeric|min:0',
            'dim_l'         => 'nullable|numeric|min:0',
            'dim_w'         => 'nullable|numeric|min:0',
            'dim_h'         => 'nullable|numeric|min:0',
            'supplier'      => 'nullable|string|max:255',
            'notes'         => 'nullable|string|max:500',
        ]);

        foreach (['cost_per_unit', 'selling_rate', 'min_stock', 'reorder_level', 'stock_qty', 'gst', 'dim_l', 'dim_w', 'dim_h'] as $field) {
            $data[$field] = $data[$field] ?? 0;
        }

        $user = $request->user();
        $user->loadMissing('roles');
        $needsApproval = $user->roles->first()?->slug === 'accountant';

        if ($needsApproval) {
            $data['approval_status'] = 'pending';
            $data['requested_by'] = $user->id;
            $data['is_active'] = false;
        }

        RawMaterial::create($data);
        $this->ensureSupplierParty($data['supplier'] ?? null);

        return redirect()->back()->with('success', $needsApproval
            ? 'Material submitted for admin approval. It will appear in inventory once approved.'
            : 'Material added.');
    }

    public function approveMaterial(RawMaterial $material): RedirectResponse
    {
        $material->update(['approval_status' => 'approved', 'is_active' => true]);

        return redirect()->back()->with('success', "\"{$material->name}\" approved and added to inventory.");
    }

    public function rejectMaterial(RawMaterial $material): RedirectResponse
    {
        $name = $material->name;
        $material->delete();

        return redirect()->back()->with('success', "\"{$name}\" request rejected and removed.");
    }

    /**
     * Make sure a supplier typed into any inventory form (material, packaging
     * wizard, purchase bill) also exists as a Party in the Supplier/Vendor list,
     * so suppliers stay in sync no matter where they were entered.
     */
    private function ensureSupplierParty(?string $name): void
    {
        $name = trim((string) $name);
        if ($name === '') {
            return;
        }

        $existing = Party::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->first();

        if ($existing) {
            // A customer that also supplies us becomes "both".
            if ($existing->type === 'customer') {
                $existing->update(['type' => 'both']);
            }
            return;
        }

        Party::create([
            'name'      => $name,
            'type'      => 'supplier',
            'is_active' => true,
            'created_by' => auth()->id(),
        ]);
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
            'group_name'    => 'nullable|string|max:100',
            'shape'         => 'nullable|string|max:50',
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

        foreach (['cost_per_unit', 'selling_rate', 'min_stock', 'reorder_level', 'gst', 'dim_l', 'dim_w', 'dim_h'] as $field) {
            $data[$field] = $data[$field] ?? 0;
        }

        $material->update($data);
        $this->ensureSupplierParty($data['supplier'] ?? null);

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
            'godown_id'     => 'nullable|exists:godowns,id',
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
                'godown_id'       => $data['godown_id'] ?? null,
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

            $material->refresh();
            (new LowStockAlertService())->checkAndAlert($material);

            // Update godown stock if a godown is specified
            if (! empty($data['godown_id'])) {
                $this->updateGodownStock((int) $data['godown_id'], $material->id, $data['type'], abs((float) $qty));
            }

            return redirect()->back()->with('success', 'Stock updated.');
        });
    }

    private function updateGodownStock(int $godownId, int $materialId, string $type, float $qty): void
    {
        $stock = GodownStock::firstOrCreate(
            ['godown_id' => $godownId, 'raw_material_id' => $materialId],
            ['stock_qty' => 0]
        );

        $current = (float) $stock->stock_qty;

        $stock->stock_qty = match ($type) {
            'purchase', 'return' => $current + $qty,
            'issue'              => max(0, $current - $qty),
            'adjustment'         => $qty,
            default              => $current,
        };

        $stock->save();
    }

    public function storePurchaseBill(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vendor_name'           => 'nullable|string|max:255',
            'party_id'              => 'nullable|exists:parties,id',
            'bill_number'           => 'nullable|string|max:100',
            'bill_date'             => 'nullable|date',
            'total_amount'          => 'nullable|numeric|min:0',
            'freight_charges'       => 'nullable|numeric|min:0',
            'round_off'             => 'nullable|numeric',
            'bill_file'             => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'add_to_stock'          => 'boolean',
            'godown_id'             => 'nullable|exists:godowns,id',
            'items'                    => 'required|array|min:1',
            'items.*.raw_material_id'  => 'nullable|exists:raw_materials,id',
            'items.*.material_name'    => 'required|string|max:255',
            'items.*.sku'              => 'nullable|string|max:100',
            'items.*.category'         => 'nullable|string|max:100',
            'items.*.hsn'              => 'nullable|string|max:50',
            'items.*.qty'              => 'required|numeric|min:0.001',
            'items.*.unit'             => 'required|string|max:20',
            'items.*.rate'             => 'nullable|numeric|min:0',
            'items.*.gst'              => 'nullable|numeric|min:0|max:100',
            'items.*.amount'           => 'nullable|numeric|min:0',
        ]);

        if (empty($data['vendor_name']) && empty($data['party_id'])) {
            return redirect()->back()->withErrors(['vendor_name' => 'Vendor/Supplier is required.']);
        }

        // Resolve vendor name from party if not supplied directly
        $vendorName = $data['vendor_name'] ?? null;
        if (! $vendorName && ! empty($data['party_id'])) {
            $party = Party::find($data['party_id']);
            $vendorName = $party?->name ?? '';
        }

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

        // A manually-typed vendor (no party selected) should also land in the
        // Supplier/Vendor list so it can be picked next time.
        if (empty($data['party_id'])) {
            $this->ensureSupplierParty($vendorName);
        }

        DB::transaction(function () use ($data, $billNumber, $billFilePath, $billFileName, $request, $vendorName) {
            $bill = InventoryPurchaseBill::create([
                'vendor_name'     => $vendorName,
                'party_id'        => $data['party_id'] ?? null,
                'bill_number'     => $billNumber,
                'bill_date'       => $data['bill_date'] ?? null,
                'total_amount'    => $data['total_amount'] ?? 0,
                'freight_charges' => $data['freight_charges'] ?? 0,
                'round_off'       => $data['round_off'] ?? 0,
                'bill_file'       => $billFilePath,
                'bill_name'       => $billFileName,
                'add_to_stock'    => $data['add_to_stock'] ?? false,
                'user_id'         => $request->user()?->id,
            ]);

            $addToStock = (bool) ($data['add_to_stock'] ?? false);

            foreach ($data['items'] as $item) {
                $sku = $item['sku'] ?? null;

                if (! empty($item['raw_material_id'])) {
                    $material = RawMaterial::findOrFail($item['raw_material_id']);
                } elseif ($sku) {
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
                        'godown_id'       => $data['godown_id'] ?? null,
                        'type'            => 'purchase',
                        'qty'             => $item['qty'],
                        'previous_stock'  => $previous,
                        'new_stock'       => $new,
                        'reference'       => $billNumber,
                    ]);

                    if (! empty($data['godown_id'])) {
                        $this->updateGodownStock((int) $data['godown_id'], $material->id, 'purchase', (float) $item['qty']);
                    }
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
        $this->ensureSupplierParty($data['supplier'] ?? null);

        return redirect()->back()->with('success', 'Reorder created.');
    }

    public function receiveReorder(Request $request, InventoryReorder $reorder): RedirectResponse
    {
        if ($reorder->status === 'received') {
            return redirect()->back()->with('error', 'Already received.');
        }

        // Mark as received only. Stock is updated when the purchase bill is entered.
        $reorder->update([
            'status'      => 'received',
            'received_at' => now(),
            'received_by' => auth()->id(),
        ]);

        return redirect()->back()->with('success', 'Marked as received. Now enter the purchase bill to update stock.');
    }

    public function receiveWithBill(Request $request, InventoryReorder $reorder): RedirectResponse
    {
        if ($reorder->billed_at) {
            return redirect()->back()->with('error', 'Bill already entered for this order.');
        }

        $data = $request->validate([
            'vendor_name'  => 'required|string|max:255',
            'bill_number'  => 'nullable|string|max:100',
            'bill_date'    => 'nullable|date',
            'rate'         => 'nullable|numeric|min:0',
            'total_amount' => 'nullable|numeric|min:0',
            'bill_file'    => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
        ]);

        // Duplicate bill number check
        if (! empty($data['bill_number'])) {
            $exists = InventoryPurchaseBill::where('bill_number', $data['bill_number'])->exists();
            if ($exists) {
                return redirect()->back()->withErrors(['bill_number' => 'This bill number already exists.']);
            }
        }

        $billFile = null;
        $billName = null;
        if ($request->hasFile('bill_file')) {
            $billFile = $request->file('bill_file')->store('inventory/bills', 'public');
            $billName = $request->file('bill_file')->getClientOriginalName();
        }

        DB::transaction(function () use ($data, $reorder, $billFile, $billName, $request) {
            $material = RawMaterial::findOrFail($reorder->raw_material_id);
            $qty      = (float) $reorder->qty_ordered;
            $rate     = (float) ($data['rate'] ?? 0);
            $amount   = $rate > 0 ? round($qty * $rate, 2) : (float) ($data['total_amount'] ?? 0);

            // Create purchase bill
            $bill = InventoryPurchaseBill::create([
                'vendor_name'  => $data['vendor_name'],
                'bill_number'  => $data['bill_number'] ?? null,
                'bill_date'    => $data['bill_date'] ?? null,
                'total_amount' => $amount,
                'bill_file'    => $billFile,
                'bill_name'    => $billName,
                'add_to_stock' => true,
                'user_id'      => auth()->id(),
            ]);

            // Create purchase bill item
            InventoryPurchaseBillItem::create([
                'inventory_purchase_bill_id' => $bill->id,
                'raw_material_id'            => $material->id,
                'material_name'              => $material->name,
                'sku'                        => $material->sku,
                'category'                   => $material->category,
                'hsn'                        => $material->hsn,
                'qty'                        => $qty,
                'unit'                       => $reorder->unit,
                'rate'                       => $rate,
                'gst'                        => (float) ($material->gst ?? 0),
                'amount'                     => $amount,
            ]);

            // Update stock
            $previous = (float) $material->stock_qty;
            $new      = $previous + $qty;
            $material->stock_qty = $new;
            if ($rate > 0) {
                $material->cost_per_unit = $rate;
            }
            $material->save();

            // Transaction log
            InventoryTransaction::create([
                'raw_material_id' => $material->id,
                'user_id'         => auth()->id(),
                'type'            => 'purchase',
                'qty'             => $qty,
                'previous_stock'  => $previous,
                'new_stock'       => $new,
                'reference'       => $data['bill_number'] ?? ('Reorder #' . $reorder->id),
                'notes'           => 'Received — bill: ' . ($data['vendor_name']),
            ]);

            // Mark reorder done — received + billed
            $reorder->update([
                'status'      => 'received',
                'received_at' => $reorder->received_at ?? now(),
                'received_by' => $reorder->received_by ?? auth()->id(),
                'billed_at'   => now(),
            ]);
        });

        return redirect()->back()->with('success', 'Bill saved and stock updated.');
    }

    public function destroyReorder(InventoryReorder $reorder): RedirectResponse
    {
        $reorder->delete();

        return redirect()->back()->with('success', 'Reorder deleted.');
    }

    /** GET /api/v1/inventory/search?q=humic */
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));

        $materials = RawMaterial::query()
            ->where('is_active', true)
            ->when(strlen($q) >= 1, fn ($query) => $query->where(function ($sub) use ($q) {
                $sub->where('name', 'like', "%{$q}%")
                    ->orWhere('sku', 'like', "%{$q}%")
                    ->orWhere('hsn', 'like', "%{$q}%");
            }))
            ->orderBy('name')
            ->limit(15)
            ->get(['id', 'name', 'sku', 'hsn', 'gst', 'category', 'unit', 'cost_per_unit'])
            ->map(fn ($m) => [
                'id'            => (int) $m->id,
                'name'          => $m->name,
                'sku'           => $m->sku,
                'hsn'           => $m->hsn,
                'gst'           => (float) $m->gst,
                'category'      => $m->category,
                'unit'          => $m->unit,
                'cost_per_unit' => (float) $m->cost_per_unit,
                // kept for backward-compatibility with any older consumer
                'cost'          => (float) $m->cost_per_unit,
            ]);

        return response()->json($materials);
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:100|unique:inventory_categories,name',
            'color'            => 'nullable|string|max:20',
            'visible_to_sales' => 'boolean',
        ]);
        InventoryCategory::create($data);
        return redirect()->back()->with('success', 'Category created.');
    }

    public function updateCategory(Request $request, InventoryCategory $category): RedirectResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:100|unique:inventory_categories,name,' . $category->id,
            'color'            => 'nullable|string|max:20',
            'visible_to_sales' => 'boolean',
        ]);

        $oldName = $category->name;

        DB::transaction(function () use ($category, $data, $oldName) {
            $category->update($data);

            if ($oldName !== $data['name']) {
                RawMaterial::whereRaw('LOWER(TRIM(category)) = ?', [mb_strtolower(trim($oldName))])
                    ->update(['category' => $data['name']]);
            }
        });

        return redirect()->back()->with('success', 'Category updated.');
    }

    public function destroyCategory(InventoryCategory $category): RedirectResponse
    {
        $category->delete();
        return redirect()->back()->with('success', 'Category deleted.');
    }
}
