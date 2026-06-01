<?php

namespace App\Http\Controllers;

use App\Events\ErpActivity;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductPhoto;
use App\Models\Role;
use App\Models\User;
use App\Notifications\OrderAllItemsReady;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FactoryController extends Controller
{
    private const STAGE_FLOW = [
        'accepted' => 'filling',
        'filling'  => 'labeling',
        'labeling' => 'ready',
        'ready'    => 'dispatched',
    ];

    private const DESIGN_LABELS = [
        'pending' => 'Pending Acceptance',
        'accepted' => 'Accepted',
        'design-ready' => 'Design Ready',
        'approved-party' => 'Party Approved',
        'sent-print' => 'Sent to Print',
        'completed' => 'Completed',
        'received-factory' => 'Received at Factory',
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $role = $user->roles->first()?->slug;
        $canAdvance = in_array($role, ['admin', 'factory']);

        $orders = Order::query()
            ->whereIn('status', ['confirmed', 'dispatched'])
            ->with([
                'items',
                'salesUser:id,name',
                'createdBy:id,name',
                'attachments:id,order_id,document_type',
                'designOrders:id,order_id,assigned_to,status,updated_at',
                'designOrders.assignee:id,name',
            ])
            ->orderByRaw("CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END")
            ->orderByDesc('id')
            ->get();

        $orders->each(function (Order $order) {
            $order->sales_user_name = $order->salesUser?->name;
            $order->created_by_name = $order->createdBy?->name;

            // Latest design activity for the "DESIGN: …" banner.
            $latestDesign = $order->designOrders->sortByDesc('updated_at')->first();
            $order->design_status = $latestDesign ? [
                'stage' => $latestDesign->status,
                'label' => self::DESIGN_LABELS[$latestDesign->status] ?? $latestDesign->status,
                'by'    => $latestDesign->assignee?->name,
                'at'    => $latestDesign->updated_at?->toISOString(),
            ] : null;

            // Tax documents — pass actual records for download links
            $taxDocs = $order->attachments
                ->whereIn('document_type', ['tax_invoice', 'eway_bill'])
                ->map(fn ($a) => [
                    'id'            => $a->id,
                    'document_type' => $a->document_type,
                    'original_name' => $a->original_name,
                ])->values()->all();
            $order->docs = $taxDocs;
            $order->tax_docs_pending = collect($taxDocs)->where('document_type', 'tax_invoice')->isEmpty();

            $order->unsetRelation('salesUser');
            $order->unsetRelation('createdBy');
            $order->unsetRelation('attachments');
            $order->unsetRelation('designOrders');
        });

        $urgentPending = $canAdvance ? Order::query()
            ->where('status', 'submitted')
            ->where('priority', 'urgent')
            ->whereNull('urgent_approved')
            ->with(['items:id,order_id,our_brand,packing_size,quantity', 'salesUser:id,name', 'createdBy:id,name'])
            ->orderByDesc('id')
            ->get() : collect();

        return Inertia::render('erp/factory/index', [
            'pageTitle' => 'Production Orders',
            'orders' => $orders,
            'stageFlow' => self::STAGE_FLOW,
            'urgentPending' => $urgentPending,
            'canAdvance' => $canAdvance,
            'productPhotos' => ProductPhoto::orderBy('our_brand')->orderBy('packing_size')
                ->get()
                ->map(fn ($p) => [
                    'id'           => $p->id,
                    'party_id'     => $p->party_id,
                    'our_brand'    => $p->our_brand,
                    'party_brand'  => $p->party_brand,
                    'packing_size' => $p->packing_size,
                    'photo_url'    => $p->photo_url,
                ]),
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

        // When an item reaches 'ready', check if all items are ready and amount > 50k
        if ($nextStage === 'ready') {
            $order = $item->order;
            $allReady = $order->items()
                ->whereNotIn('status', ['ready', 'dispatched'])
                ->doesntExist();

            if ($allReady && (float) $order->total_amount > 50000) {
                $notifyUsers = User::where('is_active', true)
                    ->whereHas('roles', fn ($q) => $q->whereIn('slug', [Role::ACCOUNTANT, Role::SALES]))
                    ->get();

                foreach ($notifyUsers as $notifyUser) {
                    // Avoid duplicate — skip if unread notification for this order already exists
                    $alreadyNotified = $notifyUser->unreadNotifications()
                        ->where('type', OrderAllItemsReady::class)
                        ->where('data->order_id', $order->id)
                        ->exists();

                    if (! $alreadyNotified) {
                        $notifyUser->notify(new OrderAllItemsReady($order));
                    }
                }
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

    /**
     * Set an item directly to any stage (factory user may pick any option,
     * not only the next/previous step).
     */
    public function setStage(Request $request, OrderItem $item): RedirectResponse
    {
        $stages = array_keys(self::STAGE_FLOW);
        $stages[] = 'dispatched';

        $data = $request->validate([
            'stage' => 'required|string|in:' . implode(',', $stages),
        ]);

        $user = $request->user();
        $currentStage = $item->status ?? 'pending';
        $targetStage = $data['stage'];

        if ($targetStage === $currentStage) {
            return redirect()->back();
        }

        // Determine if this is a backward move (for the history "revert" marker).
        $isBackward = array_search($targetStage, $stages, true) < array_search($currentStage, $stages, true);

        $stageLog = (array) ($item->stage_log ?? []);
        $stageLog[] = array_filter([
            'from' => $currentStage,
            'to' => $targetStage,
            'by' => $user?->id,
            'name' => $user?->name,
            'at' => now()->toISOString(),
            'revert' => $isBackward ?: null,
        ], fn ($v) => $v !== null);

        $item->update([
            'status' => $targetStage,
            'stage_log' => $stageLog,
        ]);

        $order = $item->order;
        if ($targetStage === 'dispatched') {
            $allDispatched = $order->items()->where('status', '!=', 'dispatched')->doesntExist();
            if ($allDispatched) {
                $order->update(['status' => 'dispatched']);
            }
        } elseif ($order->status === 'dispatched') {
            // Moving an item back out of dispatched re-opens the order.
            $order->update(['status' => 'confirmed']);
        }

        $label = $item->party_brand ?? $item->our_brand ?? 'Item';
        $stageName = ucfirst($targetStage);
        broadcast(new ErpActivity(
            type: 'stage_changed',
            message: "{$user?->name} moved {$label} to {$stageName} (Order {$order->order_number})",
            by: $user?->name ?? 'System',
            meta: ['order_id' => $order->id, 'item_id' => $item->id, 'stage' => $targetStage],
        ));

        return redirect()->back()->with('success', "Item set to {$targetStage}.");
    }

    public function updateItem(Request $request, OrderItem $item): RedirectResponse
    {
        $data = $request->validate([
            'box_size' => 'nullable|integer|min:1',
        ]);

        $item->update($data);

        return redirect()->back()->with('success', 'Item updated.');
    }

    /**
     * Record how many labels have been received at the factory for an item.
     */
    public function recordLabels(Request $request, OrderItem $item): RedirectResponse
    {
        $data = $request->validate([
            'labels_received' => 'required|integer|min:0',
        ]);

        $item->update(['labels_received' => $data['labels_received']]);

        return redirect()->back()->with('success', 'Labels received updated.');
    }

    /**
     * Record who last printed box labels for an order.
     */
    public function recordLabelPrint(Request $request, Order $order): RedirectResponse
    {
        $order->update([
            'labels_last_printed_by' => $request->user()?->name,
            'labels_last_printed_at' => now(),
        ]);

        return redirect()->back();
    }

    /**
     * Save free-text factory notes on an order.
     */
    public function saveNotes(Request $request, Order $order): RedirectResponse
    {
        $data = $request->validate([
            'factory_notes' => 'nullable|string|max:2000',
        ]);

        $order->update(['factory_notes' => $data['factory_notes'] ?? null]);

        return redirect()->back()->with('success', 'Factory notes saved.');
    }

    /**
     * Dispatch every item that has reached the "ready" stage.
     */
    public function dispatchOrder(Request $request, Order $order): RedirectResponse
    {
        $user = $request->user();
        $readyItems = $order->items()->where('status', 'ready')->get();

        if ($readyItems->isEmpty()) {
            return redirect()->back()->with('error', 'No items are ready for dispatch.');
        }

        foreach ($readyItems as $item) {
            $stageLog = (array) ($item->stage_log ?? []);
            $stageLog[] = [
                'from' => 'ready',
                'to' => 'dispatched',
                'by' => $user?->id,
                'name' => $user?->name,
                'at' => now()->toISOString(),
            ];
            $item->update(['status' => 'dispatched', 'stage_log' => $stageLog]);
        }

        $allDispatched = $order->items()->where('status', '!=', 'dispatched')->doesntExist();
        if ($allDispatched) {
            $order->update(['status' => 'dispatched']);
        }

        broadcast(new ErpActivity(
            type: 'dispatched',
            message: "{$user?->name} dispatched {$readyItems->count()} item(s) for Order {$order->order_number}",
            by: $user?->name ?? 'System',
            meta: ['order_id' => $order->id],
        ));

        return redirect()->back()->with('success', "Dispatched {$readyItems->count()} item(s).");
    }
}
