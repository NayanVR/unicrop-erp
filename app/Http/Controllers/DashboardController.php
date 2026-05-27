<?php

namespace App\Http\Controllers;

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

            $leaderboard = $salesUsers->map(function (User $user) use ($results) {
                $row = $results->get($user->id);

                return [
                    'userId' => $user->id,
                    'name'   => $user->name,
                    'orders' => $row ? (int) $row->orders_count : 0,
                    'value'  => $row ? (float) $row->total_value : 0.0,
                ];
            })->sortByDesc('value')->values();

            $myRow = $results->get($currentUser?->id);

            $salesData[$key] = [
                'myOrders'    => $myRow ? (int) $myRow->orders_count : 0,
                'myValue'     => $myRow ? (float) $myRow->total_value : 0.0,
                'leaderboard' => $leaderboard,
            ];
        }

        return Inertia::render('erp/dashboard', [
            'pageTitle'     => 'Dashboard',
            'salesData'     => $salesData,
            'currentUserId' => $currentUser?->id,
        ]);
    }
}
