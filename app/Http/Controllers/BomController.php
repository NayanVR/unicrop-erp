<?php

namespace App\Http\Controllers;

use App\Models\Bom;
use App\Models\FinishedGood;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\ProductionRun;
use App\Models\RawMaterial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class BomController extends Controller
{
    public function index(): Response
    {
        $boms = Bom::query()
            ->with(['product:id,name', 'items.rawMaterial:id,name,unit,stock_qty,cost_per_unit'])
            ->orderBy('name')
            ->get();

        $products  = Product::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']);
        $materials = RawMaterial::query()->where('is_active', true)->orderBy('name')->get(['id', 'name', 'unit', 'stock_qty', 'cost_per_unit']);

        $productionRuns = ProductionRun::query()
            ->with('user:id,name')
            ->latest()
            ->limit(300)
            ->get(['id', 'batch_number', 'bom_id', 'bom_name', 'user_id', 'batch_count', 'batch_size', 'batch_unit', 'total_cost', 'notes', 'items', 'created_at']);

        return Inertia::render('erp/bom/index', [
            'pageTitle'      => 'Bill of Materials',
            'boms'           => $boms,
            'products'       => $products,
            'materials'      => $materials,
            'productionRuns' => $productionRuns,
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
                'name'         => $data['name'],
                'product_id'   => $data['product_id'] ?? null,
                'packing_size' => $data['packing_size'] ?? null,
                'batch_size'   => $data['batch_size'],
                'batch_unit'   => $data['batch_unit'],
                'notes'        => $data['notes'] ?? null,
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $bom->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_batch'   => $item['qty_per_batch'],
                    'unit'            => $item['unit'] ?? null,
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
                'name'         => $data['name'],
                'product_id'   => $data['product_id'] ?? null,
                'packing_size' => $data['packing_size'] ?? null,
                'batch_size'   => $data['batch_size'],
                'batch_unit'   => $data['batch_unit'],
                'notes'        => $data['notes'] ?? null,
                'is_active'    => $data['is_active'] ?? true,
            ]);

            $bom->items()->delete();
            foreach ($data['items'] ?? [] as $item) {
                $bom->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_batch'   => $item['qty_per_batch'],
                    'unit'            => $item['unit'] ?? null,
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
            'batch_count'  => 'required|numeric|min:0.001',
            'batch_number' => 'nullable|string|max:50',
            'notes'        => 'nullable|string|max:500',
        ]);

        $batchCount = (float) $data['batch_count'];

        // Auto-generate batch number if not provided
        $batchNumber = trim($data['batch_number'] ?? '');
        if ($batchNumber === '') {
            $words  = preg_split('/\s+/', trim($bom->name), -1, PREG_SPLIT_NO_EMPTY);
            $prefix = count($words) > 1
                ? strtoupper(implode('', array_map(fn ($w) => $w[0], $words)))
                : strtoupper(substr($bom->name, 0, 3));
            $today      = now()->format('Ymd');
            $todayCount = ProductionRun::whereDate('created_at', now()->toDateString())->count();
            $batchNumber = $prefix . '-' . $today . '-' . str_pad($todayCount + 1, 3, '0', STR_PAD_LEFT);
        }

        return DB::transaction(function () use ($bom, $batchCount, $batchNumber, $data, $request) {
            $shortfalls = [];

            foreach ($bom->items()->with('rawMaterial')->get() as $item) {
                $itemUnit  = $item->unit ?: $item->rawMaterial->unit;
                $required  = $this->convertQty((float) $item->qty_per_batch * $batchCount, $itemUnit, $item->rawMaterial->unit);
                $available = (float) $item->rawMaterial->stock_qty;

                if ($available < $required) {
                    $shortfalls[] = "{$item->rawMaterial->name}: need {$required} {$item->rawMaterial->unit}, have {$available}";
                }
            }

            if ($shortfalls) {
                return redirect()->back()->with('error', 'Insufficient stock: ' . implode('; ', $shortfalls));
            }

            $runItems  = [];
            $totalCost = 0.0;

            foreach ($bom->items()->with('rawMaterial')->get() as $item) {
                $itemUnit    = $item->unit ?: $item->rawMaterial->unit;
                $matUnit     = $item->rawMaterial->unit;
                $qtyUsed     = (float) $item->qty_per_batch * $batchCount;
                $qtyDeducted = $this->convertQty($qtyUsed, $itemUnit, $matUnit);
                $cost        = $qtyDeducted * (float) $item->rawMaterial->cost_per_unit;

                $item->rawMaterial->decrement('stock_qty', $qtyDeducted);

                InventoryTransaction::create([
                    'raw_material_id' => $item->rawMaterial->id,
                    'user_id'         => $request->user()?->id,
                    'type'            => 'issue',
                    'qty'             => $qtyDeducted,
                    'reference'       => "BOM Run: {$bom->name} × {$batchCount}",
                    'notes'           => $data['notes'] ?? null,
                ]);

                $runItems[] = [
                    'name'         => $item->rawMaterial->name,
                    'qty_used'     => $qtyUsed,
                    'item_unit'    => $itemUnit,
                    'qty_deducted' => $qtyDeducted,
                    'mat_unit'     => $matUnit,
                    'cost'         => $cost,
                ];
                $totalCost += $cost;
            }

            ProductionRun::create([
                'batch_number' => $batchNumber,
                'bom_id'       => $bom->id,
                'bom_name'     => $bom->name,
                'user_id'      => $request->user()?->id,
                'batch_count'  => $batchCount,
                'batch_size'   => $bom->batch_size,
                'batch_unit'   => $bom->batch_unit,
                'total_cost'   => $totalCost,
                'notes'        => $data['notes'] ?? null,
                'items'        => $runItems,
            ]);

            // Add produced quantity to finished goods (semi-finished stock)
            FinishedGood::create([
                'product_id'   => $bom->product_id,
                'bom_id'       => $bom->id,
                'created_by'   => $request->user()?->id,
                'name'         => $bom->name,
                'packing_size' => $bom->packing_size,
                'batch_ref'    => $batchNumber,
                'quantity'     => (float) $bom->batch_size * $batchCount,
                'unit'         => $bom->batch_unit,
                'notes'        => $data['notes'] ?? null,
                'source'       => 'production',
            ]);

            return redirect()->back()->with('success', "Production run {$batchNumber} completed. Raw materials deducted.");
        });
    }

    // Convert qty between compatible units (weight: kg/g/mg; volume: L/mL).
    private function convertQty(float $qty, string $fromUnit, string $toUnit): float
    {
        $from = strtolower(trim($fromUnit));
        $to   = strtolower(trim($toUnit));
        if ($from === $to || $from === '' || $to === '') return $qty;

        $weight = ['kg' => 1, 'kgs' => 1, 'g' => 1e-3, 'gm' => 1e-3, 'gram' => 1e-3, 'grams' => 1e-3, 'mg' => 1e-6, 'milligram' => 1e-6, 'milligrams' => 1e-6];
        $volume = ['l' => 1, 'ltr' => 1, 'liter' => 1, 'litre' => 1, 'liters' => 1, 'litres' => 1, 'ml' => 1e-3, 'milliliter' => 1e-3, 'millilitre' => 1e-3, 'milliliters' => 1e-3, 'millilitres' => 1e-3];

        if (isset($weight[$from], $weight[$to])) return $qty * ($weight[$from] / $weight[$to]);
        if (isset($volume[$from], $volume[$to])) return $qty * ($volume[$from] / $volume[$to]);

        return $qty;
    }
}
