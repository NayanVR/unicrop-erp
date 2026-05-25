<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $totalActiveOrders = Order::query()
            ->whereNotIn('status', ['dispatched'])
            ->count();

        $itemsInProduction = OrderItem::query()
            ->whereIn('status', ['processing', 'filling', 'labeling'])
            ->count();

        $readyToDispatch = OrderItem::query()
            ->where('status', 'ready')
            ->count();

        $dispatchedThisMonth = OrderItem::query()
            ->where('status', 'dispatched')
            ->whereMonth('updated_at', now()->month)
            ->whereYear('updated_at', now()->year)
            ->count();

        $pipeline = OrderItem::query()
            ->whereNotIn('status', ['dispatched'])
            ->with(['order:id,order_number,company_name,customer_name,priority'])
            ->get(['id', 'order_id', 'our_brand', 'party_brand', 'packing_size', 'quantity', 'status'])
            ->groupBy('status')
            ->map(fn ($items) => $items->values());

        $recentOrders = Order::query()
            ->with(['salesUser:id,name', 'items:id,order_id,status'])
            ->orderByDesc('id')
            ->limit(10)
            ->get(['id', 'order_number', 'company_name', 'customer_name', 'order_date', 'total_amount', 'status', 'priority', 'sales_user_id']);

        return Inertia::render('erp/dashboard', [
            'pageTitle' => 'Dashboard',
            'stats' => [
                'totalActiveOrders' => $totalActiveOrders,
                'itemsInProduction' => $itemsInProduction,
                'readyToDispatch' => $readyToDispatch,
                'dispatchedThisMonth' => $dispatchedThisMonth,
            ],
            'pipeline' => $pipeline,
            'recentOrders' => $recentOrders,
        ]);
    }
}
