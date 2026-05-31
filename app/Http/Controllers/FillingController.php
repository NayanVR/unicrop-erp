<?php

namespace App\Http\Controllers;

use App\Models\InventoryTransaction;
use App\Models\Order;
use App\Models\ProductFillingConfig;
use App\Models\RawMaterial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class FillingController extends Controller
{
    public function index(): Response
    {
        $orders = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->with(['items'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->get();

        // Only orders that have at least one item in filling stage
        $orders = $orders->filter(fn ($order) =>
            $order->items->contains(fn ($item) => $item->status === 'filling')
        )->values();

        // Configs with all related materials
        $configs = ProductFillingConfig::with([
            'fillMaterial:id,name,unit,stock_qty',
            'bottle:id,name,unit,stock_qty',
            'label:id,name,unit,stock_qty',
            'outerBox:id,name,unit,stock_qty',
            'printedBox:id,name,unit,stock_qty',
        ])->get();

        // All materials for config dropdowns
        $materials = RawMaterial::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'stock_qty', 'category']);

        return Inertia::render('erp/filling/index', [
            'pageTitle' => 'Filling',
            'orders'    => $orders,
            'configs'   => $configs,
            'materials' => $materials,
        ]);
    }

    public function saveConfig(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'        => 'required|string|max:100',
            'packing_size'     => 'nullable|string|max:50',
            'fill_material_id' => 'nullable|exists:raw_materials,id',
            'bottle_id'        => 'nullable|exists:raw_materials,id',
            'label_id'         => 'nullable|exists:raw_materials,id',
            'outer_box_id'     => 'nullable|exists:raw_materials,id',
            'printed_box_id'   => 'nullable|exists:raw_materials,id',
            'carton_size'      => 'required|integer|min:1|max:9999',
        ]);

        ProductFillingConfig::updateOrCreate(
            ['our_brand' => $data['our_brand'], 'packing_size' => $data['packing_size']],
            $data
        );

        return redirect()->back()->with('success', 'Config saved.');
    }

    public function destroyConfig(ProductFillingConfig $config): RedirectResponse
    {
        $config->delete();
        return redirect()->back()->with('success', 'Config deleted.');
    }

    public function runFilling(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'    => 'required|string|max:100',
            'packing_size' => 'nullable|string|max:50',
            'quantity'     => 'required|numeric|min:1',
        ]);

        $qty = (float) $data['quantity'];

        // Find config — exact pack-size match first, then brand-level fallback
        $config = ProductFillingConfig::with(['fillMaterial', 'bottle', 'label', 'outerBox', 'printedBox'])
            ->where('our_brand', $data['our_brand'])
            ->where(function ($q) use ($data) {
                $q->where('packing_size', $data['packing_size'])->orWhereNull('packing_size');
            })
            ->orderByRaw('packing_size IS NULL') // non-null (exact) first
            ->first();

        if (! $config) {
            return redirect()->back()->with('error', 'No filling config found for this product. Set it up first.');
        }

        $liters    = $this->packingToLiters($data['packing_size']);
        $cartonQty = max(1, (int) $config->carton_size);

        // Build the deduction list: [RawMaterial, qty needed]
        $deductions = [];
        if ($config->fillMaterial && $liters !== null) {
            $deductions[] = [$config->fillMaterial, $this->fillNeed($qty * $liters, $config->fillMaterial->unit), 'Fill'];
        }
        if ($config->bottle)     { $deductions[] = [$config->bottle, $qty, 'Bottle']; }
        if ($config->label)      { $deductions[] = [$config->label, $qty, 'Label']; }
        if ($config->outerBox)   { $deductions[] = [$config->outerBox, ceil($qty / $cartonQty), 'Outer Box']; }
        if ($config->printedBox) { $deductions[] = [$config->printedBox, $qty, 'Printed Box']; }

        if (empty($deductions)) {
            return redirect()->back()->with('error', 'No materials configured for this product.');
        }

        // Stock check
        $shortfalls = [];
        foreach ($deductions as [$mat, $need]) {
            if ((float) $mat->stock_qty < $need) {
                $shortfalls[] = "{$mat->name}: need " . rtrim(rtrim(number_format($need, 3), '0'), '.') . " {$mat->unit}, have {$mat->stock_qty}";
            }
        }
        if ($shortfalls) {
            return redirect()->back()->with('error', 'Insufficient stock: ' . implode('; ', $shortfalls));
        }

        $label = trim($data['our_brand'] . ' ' . ($data['packing_size'] ?? ''));

        DB::transaction(function () use ($deductions, $request, $label, $qty) {
            foreach ($deductions as [$mat, $need]) {
                $prev = (float) $mat->stock_qty;
                $new  = $prev - $need;

                $mat->decrement('stock_qty', $need);

                InventoryTransaction::create([
                    'raw_material_id' => $mat->id,
                    'user_id'         => $request->user()?->id,
                    'type'            => 'issue',
                    'qty'             => $need,
                    'previous_stock'  => $prev,
                    'new_stock'       => $new,
                    'reference'       => "Filling: {$label} × {$qty}",
                ]);
            }
        });

        return redirect()->back()->with('success', "Filling done for {$label} ({$qty} pcs). Materials deducted from stock.");
    }

    // Volume per unit in liters for a packing size string (e.g. "500ml" => 0.5, "1L" => 1).
    private function packingToLiters(?string $size): ?float
    {
        if (! $size) return null;
        $s = strtolower(trim($size));
        $num = (float) $s;
        if ($num <= 0) return null;
        if (str_contains($s, 'ml')) return $num / 1000;
        if (str_contains($s, 'l')) return $num;
        return null;
    }

    // Convert a liters value into the fill material's stocking unit.
    private function fillNeed(float $liters, string $unit): float
    {
        $u = strtolower(trim($unit));
        if (in_array($u, ['ml', 'milliliter', 'millilitre'])) return $liters * 1000;
        if (in_array($u, ['g', 'gm', 'gram', 'grams']))       return $liters * 1000; // density ~1
        // l, ltr, liter, kg, etc. → 1:1
        return $liters;
    }
}
