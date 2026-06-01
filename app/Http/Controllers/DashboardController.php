<?php

namespace App\Http\Controllers;

use App\Models\Bom;
use App\Models\DesignOrder;
use App\Models\FillingRecipe;
use App\Models\FinishedGood;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\UnitTransfer;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $currentUser = $request->user();
        $currentUser->loadMissing('roles');
        $role = $currentUser->roles->first()?->slug;

        if ($role === Role::DESIGN) {
            return $this->designDashboard($currentUser);
        }

        if ($role === Role::FACTORY) {
            return $this->factoryDashboard($currentUser);
        }

        return $this->salesDashboard($currentUser);
    }

    /**
     * Low-stock BOM & Filling output products (produced in-house).
     * Returns null when the user is not allowed to see it.
     */
    private function lowStockProduction(User $user): ?array
    {
        $allowed = $user->hasRole(Role::ADMIN)
            || in_array('low_stock_alerts', $user->permissions ?? []);

        if (! $allowed) {
            return null;
        }

        $bomMap = Bom::query()
            ->whereNotNull('output_raw_material_id')
            ->where('is_active', true)
            ->get(['output_raw_material_id', 'name'])
            ->groupBy('output_raw_material_id')
            ->map(fn ($g) => $g->pluck('name')->values()->toArray());

        $fillingMap = FillingRecipe::query()
            ->whereNotNull('output_raw_material_id')
            ->where('is_active', true)
            ->get(['output_raw_material_id', 'name', 'packing_size'])
            ->groupBy('output_raw_material_id')
            ->map(fn ($g) => $g->map(fn ($r) => $r->name . ($r->packing_size ? " ({$r->packing_size})" : ''))->values()->toArray());

        $outputIds = $bomMap->keys()->merge($fillingMap->keys())->unique()->all();

        if (empty($outputIds)) {
            return ['bom' => [], 'filling' => []];
        }

        $materials = RawMaterial::query()
            ->whereIn('id', $outputIds)
            ->where('is_active', true)
            ->get(['id', 'name', 'unit', 'stock_qty', 'min_stock'])
            ->filter(fn ($m) => (float) $m->stock_qty <= (float) $m->min_stock || (float) $m->stock_qty <= 0)
            ->keyBy('id');

        $row = fn ($m, array $recipes) => [
            'id'        => $m->id,
            'name'      => $m->name,
            'unit'      => $m->unit,
            'stock_qty' => (float) $m->stock_qty,
            'min_stock' => (float) $m->min_stock,
            'recipes'   => $recipes,
        ];

        $bom = [];
        foreach ($bomMap as $matId => $recipes) {
            if ($materials->has($matId)) {
                $bom[] = $row($materials->get($matId), $recipes);
            }
        }

        $filling = [];
        foreach ($fillingMap as $matId => $recipes) {
            if ($materials->has($matId)) {
                $filling[] = $row($materials->get($matId), $recipes);
            }
        }

        return ['bom' => $bom, 'filling' => $filling];
    }

    private function designDashboard(User $user): Response
    {
        $statusCounts = DesignOrder::query()
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $activeOrders = DesignOrder::query()
            ->whereNotIn('status', ['completed', 'received-factory'])
            ->with(['order:id,order_number,company_name,priority', 'assignee:id,name'])
            ->orderBy('updated_at', 'desc')
            ->get()
            ->map(fn ($d) => [
                'id'           => $d->id,
                'order_number' => $d->order?->order_number,
                'company_name' => $d->order?->company_name,
                'priority'     => $d->order?->priority ?? 'normal',
                'party_brand'  => $d->party_brand,
                'product_name' => $d->product_name,
                'packing_size' => $d->packing_size,
                'status'       => $d->status,
                'assignee'     => $d->assignee?->name,
                'updated_at'   => $d->updated_at?->diffForHumans(),
            ]);

        $recentlyCompleted = DesignOrder::query()
            ->whereIn('status', ['completed', 'received-factory'])
            ->with(['order:id,order_number,company_name'])
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($d) => [
                'id'           => $d->id,
                'order_number' => $d->order?->order_number,
                'company_name' => $d->order?->company_name,
                'party_brand'  => $d->party_brand,
                'product_name' => $d->product_name,
                'packing_size' => $d->packing_size,
                'status'       => $d->status,
                'completed_at' => $d->updated_at?->diffForHumans(),
            ]);

        $completedThisWeek = DesignOrder::query()
            ->whereIn('status', ['completed', 'received-factory'])
            ->where('updated_at', '>=', now()->startOfWeek())
            ->count();

        return Inertia::render('erp/design-dashboard', [
            'pageTitle'          => 'Dashboard',
            'statusCounts'       => $statusCounts,
            'activeOrders'       => $activeOrders,
            'recentlyCompleted'  => $recentlyCompleted,
            'completedThisWeek'  => $completedThisWeek,
        ]);
    }

    private function factoryDashboard(User $user): Response
    {
        // Production item stage breakdown (confirmed orders only)
        $stageCounts = OrderItem::query()
            ->whereHas('order', fn ($q) => $q->where('status', 'confirmed'))
            ->selectRaw('COALESCE(status, \'pending\') as stage, COUNT(*) as count')
            ->groupBy('stage')
            ->pluck('count', 'stage')
            ->toArray();

        // Active confirmed orders with items for the production queue
        $activeOrders = Order::query()
            ->where('status', 'confirmed')
            ->with(['items:id,order_id,our_brand,party_brand,packing_size,quantity,status', 'createdBy:id,name'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END")
            ->orderByDesc('id')
            ->limit(20)
            ->get()
            ->map(fn ($o) => [
                'id'           => $o->id,
                'order_number' => $o->order_number,
                'company_name' => $o->company_name,
                'priority'     => $o->priority ?? 'normal',
                'order_date'   => $o->order_date?->toDateString(),
                'items'        => $o->items->map(fn ($i) => [
                    'id'           => $i->id,
                    'our_brand'    => $i->our_brand,
                    'party_brand'  => $i->party_brand,
                    'packing_size' => $i->packing_size,
                    'quantity'     => (float) $i->quantity,
                    'status'       => $i->status ?? 'pending',
                ]),
            ]);

        // Urgent orders awaiting factory approval
        $urgentPending = Order::query()
            ->where('status', 'submitted')
            ->where('priority', 'urgent')
            ->whereNull('urgent_approved')
            ->count();

        // Low stock materials
        $lowStock = RawMaterial::query()
            ->where('is_active', true)
            ->whereColumn('stock_qty', '<=', 'min_stock')
            ->orderBy('name')
            ->get(['id', 'name', 'unit', 'stock_qty', 'min_stock', 'category'])
            ->map(fn ($m) => [
                'id'        => $m->id,
                'name'      => $m->name,
                'unit'      => $m->unit,
                'stock_qty' => (float) $m->stock_qty,
                'min_stock' => (float) $m->min_stock,
                'category'  => $m->category,
            ]);

        // Pending unit transfers
        $pendingTransfers = UnitTransfer::query()
            ->where('status', 'pending')
            ->count();

        // Finished goods added this week
        $finishedThisWeek = FinishedGood::query()
            ->where('created_at', '>=', now()->startOfWeek())
            ->count();

        // Recently dispatched items (last 10)
        $recentDispatched = OrderItem::query()
            ->where('status', 'dispatched')
            ->with('order:id,order_number,company_name')
            ->orderBy('updated_at', 'desc')
            ->limit(10)
            ->get()
            ->map(fn ($i) => [
                'id'           => $i->id,
                'order_number' => $i->order?->order_number,
                'company_name' => $i->order?->company_name,
                'our_brand'    => $i->our_brand,
                'packing_size' => $i->packing_size,
                'quantity'     => (float) $i->quantity,
                'dispatched_at'=> $i->updated_at?->diffForHumans(),
            ]);

        return Inertia::render('erp/factory-dashboard', [
            'pageTitle'           => 'Dashboard',
            'stageCounts'         => $stageCounts,
            'activeOrders'        => $activeOrders,
            'urgentPending'       => $urgentPending,
            'lowStock'            => $lowStock,
            'pendingTransfers'    => $pendingTransfers,
            'finishedThisWeek'    => $finishedThisWeek,
            'recentDispatched'    => $recentDispatched,
            'lowStockProduction'  => $this->lowStockProduction($user),
        ]);
    }

    private function salesDashboard(User $user): Response
    {
        $salesUsers = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', [Role::ADMIN, Role::OFFICE]))
            ->orderBy('name')
            ->get(['id', 'name']);

        $now = now();

        $periods = [
            'today'     => [$now->copy()->startOfDay()->toDateString(),       $now->copy()->endOfDay()->toDateString()],
            'thisWeek'  => [$now->copy()->startOfWeek()->toDateString(),      $now->copy()->endOfWeek()->toDateString()],
            'lastWeek'  => [$now->copy()->subWeek()->startOfWeek()->toDateString(), $now->copy()->subWeek()->endOfWeek()->toDateString()],
            'thisMonth' => [$now->copy()->startOfMonth()->toDateString(),     $now->copy()->endOfMonth()->toDateString()],
            'lastMonth' => [$now->copy()->subMonth()->startOfMonth()->toDateString(), $now->copy()->subMonth()->endOfMonth()->toDateString()],
            'thisYear'  => [$now->copy()->startOfYear()->toDateString(),      $now->copy()->endOfYear()->toDateString()],
            'lastYear'  => [$now->copy()->subYear()->startOfYear()->toDateString(),  $now->copy()->subYear()->endOfYear()->toDateString()],
        ];

        $salesData = [];

        foreach ($periods as $key => [$start, $end]) {
            $results = Order::query()
                ->where('status', 'confirmed')
                ->whereBetween('order_date', [$start, $end])
                ->selectRaw('sales_user_id, COUNT(*) as orders_count, SUM(total_amount) as total_value')
                ->groupBy('sales_user_id')
                ->get()
                ->keyBy('sales_user_id');

            $leaderboard = $salesUsers->map(function (User $u) use ($results) {
                $row = $results->get($u->id);
                return [
                    'userId' => $u->id,
                    'name'   => $u->name,
                    'orders' => $row ? (int) $row->orders_count : 0,
                    'value'  => $row ? (float) $row->total_value : 0.0,
                ];
            })->sortByDesc('value')->values();

            $myRow = $results->get($user->id);

            $salesData[$key] = [
                'myOrders'    => $myRow ? (int) $myRow->orders_count : 0,
                'myValue'     => $myRow ? (float) $myRow->total_value : 0.0,
                'leaderboard' => $leaderboard,
            ];
        }

        return Inertia::render('erp/dashboard', [
            'pageTitle'          => 'Dashboard',
            'salesData'          => $salesData,
            'currentUserId'      => $user->id,
            'lowStockProduction' => $this->lowStockProduction($user),
        ]);
    }
}
