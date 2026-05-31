<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\ProductFillingConfig;
use App\Models\RawMaterial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
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
}
