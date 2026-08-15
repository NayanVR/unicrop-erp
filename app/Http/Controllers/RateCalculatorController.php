<?php

namespace App\Http\Controllers;

use App\Models\FillingRecipe;
use Inertia\Inertia;
use Inertia\Response;

class RateCalculatorController extends Controller
{
    public function index(): Response
    {
        $user = request()->user();
        $user?->loadMissing('roles');
        // Only cost-cleared users get the per-item breakdown; for everyone else
        // it never leaves the server.
        $canSeeCost = $user?->roles->first()?->slug === 'admin' || $user?->cost_access === true;

        // Every packed size we can quote is a filling recipe: it already knows
        // the bottle, cap, label, outer box and the filling charges. The
        // calculator just adds the bulk material cost on top.
        $recipes = FillingRecipe::query()
            ->where('is_active', true)
            ->with([
                'outputMaterial:id,name,unit,shape,category',
                'items.rawMaterial:id,name,unit,category,selling_rate',
            ])
            ->orderBy('name')
            ->get()
            ->map(function (FillingRecipe $r) use ($canSeeCost) {
                // Only the bottle/jar and the outer box are quoted — caps,
                // labels and the rest are not part of the calculator's rate.
                $items = $r->items
                    ->filter(fn ($i) => $this->isQuotedPackaging($i->rawMaterial?->category))
                    ->map(fn ($i) => [
                        'name'     => $i->rawMaterial?->name ?? '—',
                        'category' => $i->rawMaterial?->category,
                        'qty'      => (float) $i->qty_per_unit,
                        'unit'     => $i->unit ?: $i->rawMaterial?->unit,
                        // Always quoted at the material's selling rate.
                        'rate'     => (float) ($i->rawMaterial?->selling_rate ?? 0),
                    ])->values();

                $charges = collect($r->charges ?? [])->map(fn ($c) => [
                    'label'  => $c['label'] ?? 'Charge',
                    'amount' => (float) ($c['amount'] ?? 0),
                ])->values();

                return [
                    'id'            => $r->id,
                    'name'          => $canSeeCost ? $r->name : null,
                    'group_name'    => $r->group_name,
                    'packing_size'  => $r->packing_size,
                    'fill_quantity' => (float) $r->fill_quantity,
                    'shape'         => $r->outputMaterial?->shape,
                    'output_unit'   => $r->outputMaterial?->unit,
                    'items'         => $canSeeCost ? $items : collect(),
                    'charges'       => $canSeeCost ? $charges : collect(),
                    'packaging_cost' => round($items->sum(fn ($i) => $i['qty'] * $i['rate']), 4),
                    'charges_cost'   => round($charges->sum('amount'), 4),
                ];
            })
            ->values();

        return Inertia::render('erp/rate-calculator/index', [
            'pageTitle' => 'Product Rate Calculator',
            'recipes'   => $recipes,
        ]);
    }

    /** Bottle/jar and outer box only — the two packaging costs we quote. */
    private function isQuotedPackaging(?string $category): bool
    {
        $c = $category ?? '';

        return (bool) preg_match('/bottle|botal|jar|dabba|box|carton|cartoon/i', $c);
    }
}
