<?php

namespace App\Http\Controllers;

use App\Models\FinishedGood;
use App\Models\FillingRecipe;
use App\Models\Order;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportController extends Controller
{
    /**
     * Profit / Loss report — admin only.
     *
     * Sales come from confirmed/dispatched order items (ex-GST amounts).
     * Cost per unit is resolved per product (our_brand + packing_size):
     * first from the matching filling recipe's output material cost
     * (kept in sync with the recipe by FillingController::syncOutputCost,
     * unit-converted), falling back to the latest finished-goods batch cost.
     */
    public function profitLoss(Request $request): Response
    {
        $years = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->whereNotNull('order_date')
            ->pluck('order_date')
            ->map(fn ($d) => (int) \Illuminate\Support\Carbon::parse($d)->year)
            ->unique()
            ->sortDesc()
            ->values();

        if ($years->isEmpty()) {
            $years = collect([now()->year]);
        }

        $year = (int) $request->query('year', (string) $years->first());

        $orders = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->whereYear('order_date', $year)
            ->with('items:id,order_id,our_brand,party_brand,packing_size,quantity,rate,amount')
            ->get(['id', 'order_date', 'status']);

        // Group by month + product (our_brand + packing_size) in PHP — DB agnostic.
        $rows = [];
        foreach ($orders as $order) {
            $month = (int) $order->order_date->format('n');
            foreach ($order->items as $item) {
                $brand = trim((string) $item->our_brand);
                $size  = trim((string) $item->packing_size);
                if ($brand === '') {
                    continue;
                }
                $key = $month . '|' . mb_strtolower($brand) . '|' . mb_strtolower($size);
                if (! isset($rows[$key])) {
                    $rows[$key] = [
                        'month'        => $month,
                        'our_brand'    => $brand,
                        'packing_size' => $size,
                        'qty'          => 0.0,
                        'sales'        => 0.0,
                    ];
                }
                $rows[$key]['qty']   += (float) $item->quantity;
                $rows[$key]['sales'] += (float) $item->amount;
            }
        }
        $rows = array_values($rows);

        // Resolve cost per unit for every product appearing in the rows.
        $costs = [];
        $productKeys = collect($rows)
            ->map(fn ($r) => mb_strtolower($r['our_brand']) . '|' . mb_strtolower($r['packing_size']))
            ->unique();

        $recipes = FillingRecipe::with('outputMaterial:id,cost_per_unit')
            ->where('is_active', true)
            ->get(['id', 'name', 'packing_size', 'output_raw_material_id']);

        $latestFg = FinishedGood::query()
            ->orderBy('id')
            ->get(['name', 'packing_size', 'cost_per_unit'])
            ->keyBy(fn ($fg) => mb_strtolower(trim((string) $fg->name)) . '|' . mb_strtolower(trim((string) $fg->packing_size)));

        foreach ($productKeys as $key) {
            [$brand, $size] = explode('|', $key, 2);

            $recipe = $recipes->first(fn ($r) => mb_strtolower(trim((string) $r->name)) === $brand
                && mb_strtolower(trim((string) $r->packing_size)) === $size);

            if ($recipe) {
                $cost = (float) ($recipe->outputMaterial->cost_per_unit ?? 0);
                if ($cost > 0) {
                    $costs[$key] = round($cost, 4);
                    continue;
                }
            }

            if ($fg = $latestFg->get($key)) {
                $cost = (float) $fg->cost_per_unit;
                if ($cost > 0) {
                    $costs[$key] = round($cost, 4);
                }
            }
        }

        return Inertia::render('erp/reports/profit-loss', [
            'rows'      => $rows,
            'costs'     => $costs,
            'years'     => $years,
            'year'      => $year,
            'pageTitle' => 'Profit / Loss',
        ]);
    }
}
