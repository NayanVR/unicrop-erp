<?php

namespace App\Http\Controllers;

use App\Models\DesignOrder;
use App\Models\Order;
use App\Models\Role;
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

        return $this->salesDashboard($currentUser);
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
            'pageTitle'     => 'Dashboard',
            'salesData'     => $salesData,
            'currentUserId' => $user->id,
        ]);
    }
}
