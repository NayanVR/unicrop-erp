<?php

namespace App\Http\Controllers;

use App\Models\FillingRecipe;
use App\Models\FillingRun;
use App\Models\FinishedGood;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Services\InventoryPoolService;
use App\Services\LowStockAlertService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class FillingController extends Controller
{
    public function index(): Response
    {
        $recipes = FillingRecipe::query()
            ->with(['outputMaterial:id,name,unit,stock_qty,min_stock,category', 'items.rawMaterial:id,name,unit,stock_qty,cost_per_unit,category,dim_l,dim_w,dim_h'])
            ->orderByRaw("CASE WHEN group_name IS NULL OR group_name = '' THEN 1 ELSE 0 END")
            ->orderBy('group_name')
            ->orderBy('name')
            ->get();

        $materials = RawMaterial::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'stock_qty', 'cost_per_unit', 'category', 'shape', 'dim_l', 'dim_w', 'dim_h']);

        $finishedGoodMaterials = $materials->filter(fn ($m) => strtolower(trim($m->category ?? '')) === 'finished good')->values();

        $fillingRuns = FillingRun::with('user:id,name')
            ->latest()
            ->limit(300)
            ->get(['id', 'filling_recipe_id', 'our_brand', 'packing_size', 'quantity', 'user_id', 'items', 'created_at']);

        return Inertia::render('erp/filling/index', [
            'pageTitle'             => 'Filling',
            'recipes'               => $recipes,
            'materials'             => $materials,
            'finishedGoodMaterials' => $finishedGoodMaterials,
            'fillingRuns'           => $fillingRuns,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateRecipe($request);

        DB::transaction(function () use ($data) {
            $outputMat = $data['output_raw_material_id'] ? RawMaterial::find($data['output_raw_material_id']) : null;
            $recipe = FillingRecipe::create([
                'output_raw_material_id' => $outputMat?->id,
                'name'                   => $outputMat?->name ?? '',
                'group_name'             => $data['group_name'] ?? null,
                'packing_size'           => $data['packing_size'] ?? null,
                'fill_quantity'          => $data['fill_quantity'] ?? 1,
                'notes'                  => $data['notes'] ?? null,
                'charges'                => $this->normalizeCharges($data['charges'] ?? []),
            ]);

            foreach ($data['items'] ?? [] as $item) {
                $recipe->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_unit'    => $item['qty_per_unit'],
                    'unit'            => $item['unit'] ?? null,
                ]);
            }

            $this->syncOutputCost($recipe);
        });

        return redirect()->back()->with('success', 'Filling recipe created.');
    }

    public function update(Request $request, FillingRecipe $recipe): RedirectResponse
    {
        $data = $this->validateRecipe($request, true);

        DB::transaction(function () use ($data, $recipe) {
            $outputMat = $data['output_raw_material_id'] ? RawMaterial::find($data['output_raw_material_id']) : null;
            $recipe->update([
                'output_raw_material_id' => $outputMat?->id,
                'name'                   => $outputMat?->name ?? '',
                'group_name'             => $data['group_name'] ?? null,
                'packing_size'           => $data['packing_size'] ?? null,
                'fill_quantity'          => $data['fill_quantity'] ?? 1,
                'notes'                  => $data['notes'] ?? null,
                'charges'                => $this->normalizeCharges($data['charges'] ?? []),
                'is_active'              => $data['is_active'] ?? true,
            ]);

            $recipe->items()->delete();
            foreach ($data['items'] ?? [] as $item) {
                $recipe->items()->create([
                    'raw_material_id' => $item['raw_material_id'],
                    'qty_per_unit'    => $item['qty_per_unit'],
                    'unit'            => $item['unit'] ?? null,
                ]);
            }

            $this->syncOutputCost($recipe);
        });

        return redirect()->back()->with('success', 'Filling recipe updated.');
    }

    public function destroy(Request $request, FillingRecipe $recipe): RedirectResponse
    {
        $user  = $request->user();
        $perms = $user?->permissions ?? [];
        if ($user?->role !== 'admin' && ! in_array('filling', $perms)) {
            abort(403);
        }

        $recipe->delete();

        return redirect()->back()->with('success', 'Filling recipe deleted.');
    }

    public function runFilling(Request $request, FillingRecipe $recipe): RedirectResponse
    {
        $data = $request->validate([
            'quantity'     => 'required|numeric|min:0.001',
            'bottle_shape' => 'nullable|string|max:50',
            'notes'        => 'nullable|string|max:500',
        ]);

        $qty = (float) $data['quantity'];

        return DB::transaction(function () use ($recipe, $qty, $data, $request) {
            $items = $recipe->items()->with('rawMaterial')->get();

            if ($items->isEmpty()) {
                return redirect()->back()->with('error', 'This recipe has no materials. Add ingredients first.');
            }

            // Stock check
            $shortfalls = [];
            foreach ($items as $item) {
                if (! $item->rawMaterial) continue;
                $itemUnit = $item->unit ?: $item->rawMaterial->unit;
                $required = $this->convertQty((float) $item->qty_per_unit * $qty, $itemUnit, $item->rawMaterial->unit);
                if ((float) $item->rawMaterial->stock_qty < $required) {
                    $shortfalls[] = "{$item->rawMaterial->name}: need {$required} {$item->rawMaterial->unit}, have {$item->rawMaterial->stock_qty}";
                }
            }
            if ($shortfalls) {
                return redirect()->back()->with('error', 'Insufficient stock: ' . implode('; ', $shortfalls));
            }

            $runItems  = [];
            $totalCost = 0.0;
            foreach ($items as $item) {
                if (! $item->rawMaterial) continue;
                $itemUnit    = $item->unit ?: $item->rawMaterial->unit;
                $matUnit     = $item->rawMaterial->unit;
                $qtyUsed     = (float) $item->qty_per_unit * $qty;
                $qtyDeducted = $this->convertQty($qtyUsed, $itemUnit, $matUnit);
                $lineCost    = $qtyDeducted * (float) $item->rawMaterial->cost_per_unit;
                $totalCost  += $lineCost;

                $product = Product::where('raw_material_id', $item->rawMaterial->id)->first();
                $pooled = $product
                    ? app(InventoryPoolService::class)->decrementForProduct(
                        $product,
                        $qtyDeducted,
                        "Filling: {$recipe->name} × {$qty}",
                        $request->user(),
                        $data['notes'] ?? null,
                    )
                    : false;

                if (! $pooled) {
                    $prev = (float) $item->rawMaterial->stock_qty;
                    $item->rawMaterial->decrement('stock_qty', $qtyDeducted);

                    InventoryTransaction::create([
                        'raw_material_id' => $item->rawMaterial->id,
                        'user_id'         => $request->user()?->id,
                        'type'            => 'issue',
                        'qty'             => $qtyDeducted,
                        'previous_stock'  => $prev,
                        'new_stock'       => $prev - $qtyDeducted,
                        'reference'       => "Filling: {$recipe->name} × {$qty}",
                        'notes'           => $data['notes'] ?? null,
                    ]);
                }

                $item->rawMaterial->refresh();
                (new LowStockAlertService())->checkAndAlert($item->rawMaterial);

                $runItems[] = [
                    'raw_material_id' => $item->rawMaterial->id,
                    'name'            => $item->rawMaterial->name,
                    'qty'             => $qtyDeducted,
                    'unit'            => $matUnit,
                ];
            }

            // Apply extra per-piece charges (man power, electricity, etc.) scaled by quantity.
            $runCharges = [];
            foreach ($this->normalizeCharges($recipe->charges ?? []) as $charge) {
                $lineTotal    = (float) $charge['amount'] * $qty;
                $totalCost   += $lineTotal;
                $runCharges[] = [
                    'label'  => $charge['label'],
                    'amount' => (float) $charge['amount'],
                    'total'  => $lineTotal,
                ];
            }

            $costPerPc = $qty > 0 ? round($totalCost / $qty, 4) : 0;

            $bottleShape = trim($data['bottle_shape'] ?? '');

            FillingRun::create([
                'filling_recipe_id' => $recipe->id,
                'our_brand'         => $recipe->name,
                'packing_size'      => $recipe->packing_size,
                'bottle_shape'      => $bottleShape ?: null,
                'quantity'          => $qty,
                'user_id'           => $request->user()?->id,
                'items'             => $runItems,
                'charges'           => $runCharges,
            ]);

            FinishedGood::create([
                'created_by'    => $request->user()?->id,
                'name'          => $recipe->name,
                'packing_size'  => $recipe->packing_size,
                'quantity'      => $qty,
                'unit'          => 'pcs',
                'source'        => 'filling',
                'cost_per_unit' => $costPerPc,
                'total_cost'    => round($totalCost, 4),
            ]);

            // Find output material: prefer shape-specific match, fall back to recipe's output_raw_material_id
            $output = null;
            if ($bottleShape !== '') {
                $output = RawMaterial::whereRaw('LOWER(TRIM(name)) = ?', [strtolower(trim($recipe->name))])
                    ->whereRaw('LOWER(TRIM(COALESCE(shape,\'\'))) = ?', [strtolower($bottleShape)])
                    ->first();
            }
            if (! $output && $recipe->output_raw_material_id) {
                $output = RawMaterial::find($recipe->output_raw_material_id);
            }

            // Increment output material stock and update its cost_per_unit
            if ($output) {
                $prevStock = (float) $output->stock_qty;
                $newStock  = $prevStock + $qty;
                $output->stock_qty = $newStock;
                $output->cost_per_unit = $costPerPc;
                $output->save();

                $shapeLabel = $bottleShape ? " ({$bottleShape})" : '';
                InventoryTransaction::create([
                    'raw_material_id' => $output->id,
                    'user_id'         => $request->user()?->id,
                    'type'            => 'purchase',
                    'qty'             => $qty,
                    'previous_stock'  => $prevStock,
                    'new_stock'       => $newStock,
                    'cost_per_unit'   => $costPerPc > 0 ? $costPerPc : null,
                    'reference'       => "Filling: {$recipe->name}{$shapeLabel}" . ($recipe->packing_size ? " {$recipe->packing_size}" : '') . " × {$qty}",
                    'notes'           => $data['notes'] ?? null,
                ]);
            }

            return redirect()->back()->with('success', "Filling done for {$recipe->name} ({$qty} pcs). Materials deducted, stock updated.");
        });
    }

    public function destroyRun(FillingRun $run): RedirectResponse
    {
        DB::transaction(function () use ($run) {
            foreach ($run->items ?? [] as $item) {
                $mat = RawMaterial::find($item['raw_material_id'] ?? null);
                if ($mat) {
                    $prev = (float) $mat->stock_qty;
                    $mat->increment('stock_qty', $item['qty']);

                    InventoryTransaction::create([
                        'raw_material_id' => $mat->id,
                        'user_id'         => request()->user()?->id,
                        'type'            => 'return',
                        'qty'             => $item['qty'],
                        'previous_stock'  => $prev,
                        'new_stock'       => $prev + $item['qty'],
                        'reference'       => "Reversed filling: {$run->our_brand} {$run->packing_size}",
                    ]);
                }
            }

            $fg = FinishedGood::where('source', 'filling')
                ->where('name', $run->our_brand)
                ->where('packing_size', $run->packing_size)
                ->where('quantity', $run->quantity)
                ->latest('id')
                ->first();
            $fg?->delete();

            // Reverse output material stock
            $recipe = $run->fillingRecipe;
            if ($recipe && $recipe->output_raw_material_id) {
                $output = RawMaterial::find($recipe->output_raw_material_id);
                if ($output) {
                    $prev = (float) $output->stock_qty;
                    $newStock = max(0, $prev - (float) $run->quantity);
                    $output->stock_qty = $newStock;
                    $output->save();

                    InventoryTransaction::create([
                        'raw_material_id' => $output->id,
                        'user_id'         => request()->user()?->id,
                        'type'            => 'issue',
                        'qty'             => (float) $run->quantity,
                        'previous_stock'  => $prev,
                        'new_stock'       => $newStock,
                        'reference'       => "Reversed filling: {$run->our_brand}" . ($run->packing_size ? " {$run->packing_size}" : ''),
                    ]);
                }
            }

            $run->delete();
        });

        return redirect()->back()->with('success', 'Filling run deleted and stock reversed.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateRecipe(Request $request, bool $withActive = false): array
    {
        $rules = [
            'output_raw_material_id'  => 'required|exists:raw_materials,id',
            'group_name'              => 'nullable|string|max:100',
            'packing_size'            => 'nullable|string|max:50',
            'fill_quantity'           => 'nullable|numeric|min:0.001',
            'notes'                   => 'nullable|string|max:1000',
            'items'                   => 'array',
            'items.*.raw_material_id' => 'required|exists:raw_materials,id',
            'items.*.qty_per_unit'    => 'required|numeric|min:0.001',
            'items.*.unit'            => 'nullable|string|max:20',
            'charges'                 => 'array',
            'charges.*.label'         => 'required|string|max:100',
            'charges.*.amount'        => 'required|numeric|min:0',
        ];
        if ($withActive) {
            $rules['is_active'] = 'boolean';
        }

        return $request->validate($rules);
    }

    // Calculate cost per piece from recipe items and push to output inventory material.
    private function syncOutputCost(FillingRecipe $recipe): void
    {
        if (! $recipe->output_raw_material_id) return;

        $items = $recipe->items()->with('rawMaterial')->get();
        $costPerPc = 0.0;

        foreach ($items as $item) {
            if (! $item->rawMaterial) continue;
            $itemUnit  = $item->unit ?: $item->rawMaterial->unit;
            $matUnit   = $item->rawMaterial->unit;
            $qtyInMat  = $this->convertQty((float) $item->qty_per_unit, $itemUnit, $matUnit);
            $costPerPc += $qtyInMat * (float) $item->rawMaterial->cost_per_unit;
        }

        // Per-piece charges add directly to the per-piece cost.
        foreach ($this->normalizeCharges($recipe->charges ?? []) as $charge) {
            $costPerPc += (float) $charge['amount'];
        }

        RawMaterial::where('id', $recipe->output_raw_material_id)
            ->update(['cost_per_unit' => round($costPerPc, 4)]);
    }

    /**
     * Keep only valid {label, amount} charge rows with a non-empty label.
     *
     * @param  array<int, mixed>  $charges
     * @return array<int, array{label: string, amount: float}>
     */
    private function normalizeCharges(array $charges): array
    {
        $clean = [];
        foreach ($charges as $charge) {
            $label = trim((string) ($charge['label'] ?? ''));
            if ($label === '') continue;
            $clean[] = ['label' => $label, 'amount' => (float) ($charge['amount'] ?? 0)];
        }

        return $clean;
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
