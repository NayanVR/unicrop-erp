<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Inertia\Inertia;
use Inertia\Response;

class FillingController extends Controller
{
    public function index(): Response
    {
        $orders = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->with(['items', 'party:id,company_name'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->get();

        // Keep only orders that have at least one item in filling stage
        $orders = $orders->filter(fn ($order) =>
            $order->items->contains(fn ($item) => $item->status === 'filling')
        )->values();

        return Inertia::render('erp/filling/index', [
            'pageTitle' => 'Filling',
            'orders'    => $orders,
        ]);
    }
}
