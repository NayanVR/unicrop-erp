<?php

namespace App\Http\Controllers;

use App\Models\BomRecipe;
use App\Models\InventoryTransaction;
use App\Models\Product;
use App\Models\RawMaterial;
use App\Services\InventoryPoolService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BomRecipeController extends Controller
{
    /** Blade page */
    public function webIndex()
    {
        return view('bom.index');
    }

    /** GET /api/v1/bom */
    public function index(): JsonResponse
    {
        $boms = BomRecipe::with('outputMaterial:id,name,unit')->orderBy('id')->get()->map(fn ($b) => $this->withComputed($b));

        return response()->json($boms);
    }

    /** POST /api/v1/bom */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                       => 'required|string|max:255',
            'yield_qty'                  => 'required|numeric|min:0.001',
            'yield_unit'                 => 'required|string|max:20',
            'output_raw_material_id'     => 'nullable|exists:raw_materials,id',
            'ingredients'                => 'required|array|min:1',
            'ingredients.*.name'         => 'required|string|max:255',
            'ingredients.*.qty'          => 'required|numeric|min:0',
            'ingredients.*.unit'         => 'required|string|max:20',
            'ingredients.*.cost'         => 'required|numeric|min:0',
            'ingredients.*.invId'        => 'nullable|string',
            'notes'                      => 'nullable|string|max:2000',
        ]);

        $bom = BomRecipe::create([
            'id'                     => $this->generateId(),
            'name'                   => $data['name'],
            'yield_qty'              => $data['yield_qty'],
            'yield_unit'             => $data['yield_unit'],
            'output_raw_material_id' => $data['output_raw_material_id'] ?? null,
            'ingredients'            => $data['ingredients'],
            'notes'                  => $data['notes'] ?? null,
            'created_by'             => $request->user()?->name,
        ]);

        return response()->json($this->withComputed($bom), 201);
    }

    /** PUT /api/v1/bom/{id} */
    public function update(Request $request, string $id): JsonResponse
    {
        $bom = BomRecipe::findOrFail($id);

        $data = $request->validate([
            'name'                       => 'required|string|max:255',
            'yield_qty'                  => 'required|numeric|min:0.001',
            'yield_unit'                 => 'required|string|max:20',
            'output_raw_material_id'     => 'nullable|exists:raw_materials,id',
            'ingredients'                => 'required|array|min:1',
            'ingredients.*.name'         => 'required|string|max:255',
            'ingredients.*.qty'          => 'required|numeric|min:0',
            'ingredients.*.unit'         => 'required|string|max:20',
            'ingredients.*.cost'         => 'required|numeric|min:0',
            'ingredients.*.invId'        => 'nullable|string',
            'notes'                      => 'nullable|string|max:2000',
        ]);

        $bom->update([
            'name'                   => $data['name'],
            'yield_qty'              => $data['yield_qty'],
            'yield_unit'             => $data['yield_unit'],
            'output_raw_material_id' => $data['output_raw_material_id'] ?? null,
            'ingredients'            => $data['ingredients'],
            'notes'                  => $data['notes'] ?? null,
        ]);

        return response()->json($this->withComputed($bom->fresh()));
    }

    /** DELETE /api/v1/bom/{id} */
    public function destroy(string $id): JsonResponse
    {
        $bom = BomRecipe::findOrFail($id);
        $bom->delete();

        return response()->json(['message' => 'BOM deleted successfully.']);
    }

    /** POST /api/v1/bom/{id}/duplicate */
    public function duplicate(string $id): JsonResponse
    {
        $original = BomRecipe::findOrFail($id);

        $copy = BomRecipe::create([
            'id'          => $this->generateId(),
            'name'        => 'Copy of ' . $original->name,
            'yield_qty'   => $original->yield_qty,
            'yield_unit'  => $original->yield_unit,
            'ingredients' => $original->ingredients,
            'notes'       => $original->notes,
            'created_by'  => request()->user()?->name,
        ]);

        return response()->json($this->withComputed($copy), 201);
    }

    /** POST /api/v1/bom/{id}/run — deduct linked raw materials from inventory */
    public function run(Request $request, string $id): JsonResponse
    {
        $bom = BomRecipe::findOrFail($id);

        $data = $request->validate([
            'batch_count' => 'required|numeric|min:0.001',
            'notes'       => 'nullable|string|max:500',
        ]);

        $batchCount = (float) $data['batch_count'];

        return DB::transaction(function () use ($bom, $batchCount, $data, $request) {
            $shortfalls   = [];
            $deductions   = [];

            foreach ($bom->ingredients ?? [] as $ing) {
                if (empty($ing['invId'])) {
                    continue;
                }

                $material = RawMaterial::find((int) $ing['invId']);
                if (! $material) {
                    continue;
                }

                $required = (float) $ing['qty'] * $batchCount;

                if ((float) $material->stock_qty < $required) {
                    $shortfalls[] = "{$ing['name']}: need {$required} {$ing['unit']}, have {$material->stock_qty}";
                } else {
                    $deductions[] = ['material' => $material, 'qty' => $required, 'name' => $ing['name']];
                }
            }

            if (! empty($shortfalls)) {
                return response()->json([
                    'message'    => 'Insufficient stock for production run.',
                    'shortfalls' => $shortfalls,
                ], 422);
            }

            foreach ($deductions as $d) {
                $product = Product::where('raw_material_id', $d['material']->id)->first();
                $pooled = $product
                    ? app(InventoryPoolService::class)->decrementForProduct(
                        $product,
                        $d['qty'],
                        "BOM Run: {$bom->name} × {$batchCount}",
                        $request->user(),
                        $data['notes'] ?? null,
                    )
                    : false;

                if (! $pooled) {
                    $prev = (float) $d['material']->stock_qty;
                    $d['material']->decrement('stock_qty', $d['qty']);

                    InventoryTransaction::create([
                        'raw_material_id' => $d['material']->id,
                        'user_id'         => $request->user()?->id,
                        'type'            => 'issue',
                        'qty'             => $d['qty'],
                        'previous_stock'  => $prev,
                        'new_stock'       => $prev - $d['qty'],
                        'reference'       => "BOM Run: {$bom->name} × {$batchCount}",
                        'notes'           => $data['notes'] ?? null,
                    ]);
                }
            }

            // Add finished/semi-finished product to inventory
            $outputAdded = false;
            if ($bom->output_raw_material_id) {
                $output   = RawMaterial::find($bom->output_raw_material_id);
                if ($output) {
                    $yieldTotal   = (float) $bom->yield_qty * $batchCount;
                    $prevStock    = (float) $output->stock_qty;
                    $newStock     = $prevStock + $yieldTotal;
                    $costPerUnit  = $bom->cost_per_unit;

                    $output->stock_qty = $newStock;
                    if ($costPerUnit > 0) {
                        $output->cost_per_unit = $costPerUnit;
                    }
                    $output->save();

                    InventoryTransaction::create([
                        'raw_material_id' => $output->id,
                        'user_id'         => $request->user()?->id,
                        'type'            => 'purchase',
                        'qty'             => $yieldTotal,
                        'previous_stock'  => $prevStock,
                        'new_stock'       => $newStock,
                        'cost_per_unit'   => $costPerUnit > 0 ? $costPerUnit : null,
                        'reference'       => "BOM Run: {$bom->name} × {$batchCount}",
                        'notes'           => $data['notes'] ?? null,
                    ]);

                    $outputAdded = true;
                }
            }

            $deducted = count($deductions);

            return response()->json([
                'message' => "Production run of {$batchCount} batch(es) completed." .
                    ($deducted ? " {$deducted} raw material(s) deducted." : '') .
                    ($outputAdded ? " Output added to inventory stock." : ' (No output inventory item linked — stock not updated.)'),
            ]);
        });
    }

    private function withComputed(BomRecipe $bom): array
    {
        return array_merge($bom->toArray(), [
            'total_cost'           => round($bom->total_cost, 2),
            'cost_per_unit'        => round($bom->cost_per_unit, 4),
            'output_material_name' => $bom->outputMaterial?->name,
            'output_material_unit' => $bom->outputMaterial?->unit,
        ]);
    }

    private function generateId(): string
    {
        $maxNum = BomRecipe::pluck('id')
            ->filter(fn ($id) => str_starts_with($id, 'BOM-'))
            ->map(fn ($id) => (int) substr($id, 4))
            ->max() ?? 0;

        return 'BOM-' . str_pad($maxNum + 1, 3, '0', STR_PAD_LEFT);
    }
}
