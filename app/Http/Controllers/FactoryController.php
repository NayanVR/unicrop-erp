<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FactoryController extends Controller
{
    private const STAGE_FLOW = [
        'pending' => 'processing',
        'processing' => 'filling',
        'filling' => 'labeling',
        'labeling' => 'ready',
        'ready' => 'dispatched',
    ];

    public function index(): Response
    {
        $orders = Order::query()
            ->where('status', 'confirmed')
            ->with(['items', 'salesUser:id,name', 'createdBy:id,name'])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->get();

        $urgentPending = Order::query()
            ->where('status', 'submitted')
            ->where('priority', 'urgent')
            ->whereNull('urgent_approved')
            ->with(['items:id,order_id,our_brand,packing_size,quantity', 'salesUser:id,name', 'createdBy:id,name'])
            ->orderByDesc('id')
            ->get();

        return Inertia::render('erp/factory/index', [
            'pageTitle' => 'Production Orders',
            'orders' => $orders,
            'stageFlow' => self::STAGE_FLOW,
            'urgentPending' => $urgentPending,
        ]);
    }

    public function advanceStage(Request $request, OrderItem $item): RedirectResponse
    {
        $user = $request->user();
        $currentStage = $item->status ?? 'pending';
        $nextStage = self::STAGE_FLOW[$currentStage] ?? null;

        if ($nextStage === null) {
            return redirect()->back()->with('error', 'Item is already at final stage.');
        }

        if ($user && $user->permissions && ! in_array($nextStage, (array) $user->permissions)) {
            if (! $user->hasRole('admin') && ! $user->hasRole('factory')) {
                return redirect()->back()->with('error', 'You do not have permission for this stage.');
            }
        }

        $stageLog = (array) ($item->stage_log ?? []);
        $stageLog[] = [
            'from' => $currentStage,
            'to' => $nextStage,
            'by' => $user?->id,
            'name' => $user?->name,
            'at' => now()->toISOString(),
        ];

        $item->update([
            'status' => $nextStage,
            'stage_log' => $stageLog,
        ]);

        if ($nextStage === 'dispatched') {
            $order = $item->order;
            $allDispatched = $order->items()->where('status', '!=', 'dispatched')->doesntExist();
            if ($allDispatched) {
                $order->update(['status' => 'dispatched']);
            }
        }

        return redirect()->back()->with('success', "Item moved to {$nextStage}.");
    }

    public function revertStage(Request $request, OrderItem $item): RedirectResponse
    {
        $user = $request->user();
        $currentStage = $item->status ?? 'pending';
        $prevStage = array_search($currentStage, self::STAGE_FLOW);

        if ($prevStage === false) {
            return redirect()->back()->with('error', 'Item is already at initial stage.');
        }

        $stageLog = (array) ($item->stage_log ?? []);
        $stageLog[] = [
            'from' => $currentStage,
            'to' => $prevStage,
            'by' => $user?->id,
            'name' => $user?->name,
            'at' => now()->toISOString(),
            'revert' => true,
        ];

        $item->update([
            'status' => $prevStage,
            'stage_log' => $stageLog,
        ]);

        return redirect()->back()->with('success', "Item reverted to {$prevStage}.");
    }
}
