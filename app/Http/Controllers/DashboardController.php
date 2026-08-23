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

        if ($role === Role::ACCOUNTANT) {
            return $this->accountantDashboard();
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
            'name'      => $m->display_name,
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
            ->forLiveOrders()
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $activeOrders = DesignOrder::query()
            ->forLiveOrders()
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
            ->forLiveOrders()
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
            ->forLiveOrders()
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
                'name'      => $m->display_name,
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
            ->whereHas('order')
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

    private function accountantDashboard(): Response
    {
        $now = now();

        // All active orders with attachments
        $activeOrders = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->with(['attachments:id,order_id,document_type', 'salesUser:id,name'])
            ->orderByDesc('id')
            ->get();

        $mapped = $activeOrders->map(function (Order $o) {
            $docs    = $o->attachments->whereIn('document_type', ['tax_invoice', 'eway_bill']);
            $hasTax  = $docs->where('document_type', 'tax_invoice')->isNotEmpty();
            $hasEway = $docs->where('document_type', 'eway_bill')->isNotEmpty();
            $ewayOk  = $hasEway || $o->eway_bill_not_required || (float) $o->total_amount < 50000;

            return [
                'id'              => $o->id,
                'order_number'    => $o->order_number,
                'company_name'    => $o->company_name,
                'total_amount'    => (float) $o->total_amount,
                'order_date'      => $o->order_date?->toDateString(),
                'status'          => $o->status,
                'priority'        => $o->priority ?? 'normal',
                'has_tax_invoice' => $hasTax,
                'has_eway'        => $hasEway,
                'eway_ok'         => $ewayOk,
                'billing_done'    => $hasTax && $ewayOk,
                'sales_user'      => $o->salesUser?->name,
            ];
        });

        $pendingInvoice = $mapped->filter(fn ($o) => ! $o['has_tax_invoice'])->values();
        $pendingEway    = $mapped->filter(fn ($o) => $o['has_tax_invoice'] && ! $o['eway_ok'])->values();
        $billingDone    = $mapped->filter(fn ($o) => $o['billing_done'])->take(10)->values();

        // This month stats
        $thisMonthValue = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->whereMonth('order_date', $now->month)
            ->whereYear('order_date', $now->year)
            ->sum('total_amount');

        $thisMonthCount = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->whereMonth('order_date', $now->month)
            ->whereYear('order_date', $now->year)
            ->count();

        // Products missing HSN or GST
        $missingHsnGst = RawMaterial::query()
            ->where('is_active', true)
            ->where(fn ($q) => $q
                ->whereNull('hsn')->orWhere('hsn', '')
                ->orWhereNull('gst')->orWhere('gst', ''))
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'hsn', 'gst'])
            ->map(fn ($m) => [
                'id'       => $m->id,
                'name'     => $m->display_name,
                'category' => $m->category,
                'hsn'      => $m->hsn,
                'gst'      => $m->gst,
            ]);

        $totalStockValue = RawMaterial::query()
            ->where('is_active', true)
            ->get(['stock_qty', 'cost_per_unit'])
            ->sum(fn ($m) => (float) $m->stock_qty * (float) $m->cost_per_unit);

        return Inertia::render('erp/accountant-dashboard', [
            'pageTitle'      => 'Dashboard',
            'pendingInvoice' => $pendingInvoice,
            'pendingEway'    => $pendingEway,
            'billingDone'    => $billingDone,
            'missingHsnGst'  => $missingHsnGst->take(8)->values(),
            'stats'          => [
                'pendingInvoiceCount' => $pendingInvoice->count(),
                'pendingEwayCount'    => $pendingEway->count(),
                'thisMonthValue'      => (float) $thisMonthValue,
                'thisMonthCount'      => $thisMonthCount,
                'missingHsnGstCount'  => $missingHsnGst->count(),
                'totalStockValue'     => $totalStockValue,
            ],
        ]);
    }

    private function salesDashboard(User $user): Response
    {
        $salesUsers = User::where('is_active', true)
            ->whereHas('roles', fn ($q) => $q->whereIn('slug', [Role::SALES]))
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

            // Top parties for this user in this period
            $topParties = Order::query()
                ->where('sales_user_id', $user->id)
                ->where('status', 'confirmed')
                ->whereBetween('order_date', [$start, $end])
                ->selectRaw('company_name, COUNT(*) as orders_count, SUM(total_amount) as total_value')
                ->groupBy('company_name')
                ->orderByDesc('total_value')
                ->limit(5)
                ->get()
                ->map(fn ($r) => [
                    'company_name' => $r->company_name,
                    'orders'       => (int) $r->orders_count,
                    'value'        => (float) $r->total_value,
                ])->values();

            $salesData[$key] = [
                'myOrders'    => $myRow ? (int) $myRow->orders_count : 0,
                'myValue'     => $myRow ? (float) $myRow->total_value : 0.0,
                'leaderboard' => $leaderboard,
                'topParties'  => $topParties,
            ];
        }

        // My recent confirmed/dispatched orders (not period-specific)
        $recentOrders = Order::query()
            ->where('sales_user_id', $user->id)
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->orderByDesc('id')
            ->limit(8)
            ->get(['id', 'order_number', 'company_name', 'total_amount', 'status', 'order_date', 'priority'])
            ->map(fn ($o) => [
                'id'           => $o->id,
                'order_number' => $o->order_number,
                'company_name' => $o->company_name,
                'total_amount' => (float) $o->total_amount,
                'status'       => $o->status,
                'order_date'   => $o->order_date?->toDateString(),
                'priority'     => $o->priority ?? 'normal',
            ]);

        // My submitted/pending orders awaiting confirmation
        $pendingOrders = Order::query()
            ->where(fn ($q) => $q->where('sales_user_id', $user->id)->orWhere('created_by', $user->id))
            ->where('status', 'submitted')
            ->orderByDesc('id')
            ->get(['id', 'order_number', 'company_name', 'total_amount', 'order_date', 'priority'])
            ->map(fn ($o) => [
                'id'           => $o->id,
                'order_number' => $o->order_number,
                'company_name' => $o->company_name,
                'total_amount' => (float) $o->total_amount,
                'order_date'   => $o->order_date?->toDateString(),
                'priority'     => $o->priority ?? 'normal',
            ]);

        // Get confirmed orders for this user where total paid < total_amount
        $pendingPayments = \App\Models\Order::where('sales_user_id', $user->id)
            ->where('status', 'confirmed')
            ->whereNotNull('confirmed_at')
            ->get(['id', 'order_number', 'company_name', 'customer_name', 'total_amount', 'confirmed_at'])
            ->map(function ($order) {
                $paid = $order->payments()->sum('amount');
                $balance = $order->total_amount - $paid;
                return [
                    'order_id'     => $order->id,
                    'order_number' => $order->order_number,
                    'party_name'   => $order->company_name,
                    'total_amount' => $order->total_amount,
                    'paid_amount'  => $paid,
                    'balance'      => $balance,
                    'confirmed_at' => $order->confirmed_at?->format('d M Y'),
                ];
            })
            ->filter(fn($r) => $r['balance'] > 0.01)
            ->values();

        return Inertia::render('erp/dashboard', [
            'pageTitle'          => 'Dashboard',
            'salesData'          => $salesData,
            'currentUserId'      => $user->id,
            'recentOrders'       => $recentOrders,
            'pendingOrders'      => $pendingOrders,
            'pendingPayments'    => $pendingPayments,
            'lowStockProduction' => $this->lowStockProduction($user),
        ]);
    }
}
