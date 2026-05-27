<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderRequest;
use App\Models\Order;
use App\Models\Party;
use App\Models\Role;
use App\Models\Transport;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        $ordersQuery = Order::query()
            ->with(['items', 'salesUser'])
            ->orderByDesc('order_date')
            ->orderByDesc('id');

        if ($user && ! $user->hasRole(Role::ADMIN)) {
            $ordersQuery->where(function ($query) use ($user) {
                $query->where('created_by', $user->id)
                    ->orWhere('sales_user_id', $user->id);
            });
        }

        $orders = $ordersQuery->get();

        return Inertia::render('erp/orders/index', [
            'pageTitle' => 'All Orders',
            'orders' => $orders,
            'currentUserId' => $user?->id,
            'canViewAll' => $user?->hasRole(Role::ADMIN) ?? false,
        ]);
    }

    public function create(Request $request): Response
    {
        $user = $request->user();

        $salesUsers = User::query()
            ->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->whereIn('slug', [Role::ADMIN, Role::OFFICE]))
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('erp/orders/create', [
            'pageTitle' => 'New Order',
            'salesUsers' => $salesUsers,
            'transports' => Transport::transports()->orderBy('name')->get(['id', 'name']),
            'couriers' => Transport::couriers()->orderBy('name')->get(['id', 'name']),
            'parties' => Party::where('is_active', true)->orderBy('name')
                ->with(['productRates' => fn ($q) => $q->where('is_active', true)->orderBy('our_brand')->orderBy('packing_size')])
                ->get(['id', 'name', 'gst_no', 'pan_no', 'phone', 'address', 'city', 'state', 'default_transport_type', 'default_transport_id']),
            'currentUser' => ['id' => $user?->id, 'name' => $user?->name],
        ]);
    }

    public function store(StoreOrderRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $itemsData = $data['items'] ?? [];
        $freight = (float) ($data['freight_amount'] ?? 0);
        $courier = (float) ($data['courier_amount'] ?? 0);
        $roundOff = (float) ($data['round_off'] ?? 0);
        $saveAsDraft = $request->boolean('save_as_draft');

        return DB::transaction(function () use ($request, $data, $itemsData, $freight, $courier, $roundOff, $saveAsDraft, $user) {
            $orderNumber = $this->generateOrderNumber();
            $status = $saveAsDraft ? 'draft' : 'submitted';

            $order = Order::create([
                'order_number' => $orderNumber,
                'party_id' => $data['party_id'] ?? null,
                'company_name' => $data['company_name'] ?? 'Draft',
                'customer_name' => $data['customer_name'] ?? 'Draft',
                'gst_no' => $data['gst_no'] ?? null,
                'pan_no' => $data['pan_no'] ?? null,
                'aadhaar_no' => $data['aadhaar_no'] ?? null,
                'sales_user_id' => $data['sales_user_id'] ?? $user?->id,
                'created_by' => $user?->id,
                'order_date' => $data['order_date'] ?? ($saveAsDraft ? null : now()->toDateString()),
                'transport_name' => $data['transport_name'] ?? null,
                'transport_type' => $data['transport_type'] ?? 'transport',
                'destination' => $data['destination'] ?? null,
                'delivery_address' => $data['delivery_address'] ?? null,
                'phone' => $data['phone'] ?? null,
                'priority' => $data['priority'] ?? 'normal',
                'status' => $status,
                'notes' => $data['notes'] ?? null,
                'freight_amount' => $freight,
                'courier_amount' => $courier,
                'round_off' => $roundOff,
            ]);

            $totals = $this->syncOrderItems($order, $itemsData);
            $order->update([
                'subtotal' => $totals['subtotal'],
                'gst_total' => $totals['gst_total'],
                'total_amount' => $totals['total_amount'] + $freight + $courier + $roundOff,
            ]);

            $this->storeAttachments($order, $request);

            return redirect()
                ->route('orders.index')
                ->with('success', 'Order created.');
        });
    }

    public function confirm(Request $request, Order $order): RedirectResponse
    {
        if ($order->status !== 'submitted') {
            return redirect()->back()->with('error', 'Only submitted orders can be confirmed.');
        }

        if ($order->priority === 'urgent' && $order->urgent_approved !== true) {
            return redirect()->back()->with('error', 'Urgent orders must be approved by factory before confirming.');
        }

        $order->update([
            'status' => 'confirmed',
            'confirmed_by' => $request->user()?->id,
            'confirmed_at' => now(),
        ]);

        return redirect()->back()->with('success', "Order {$order->order_number} confirmed.");
    }

    public function approveUrgent(Request $request, Order $order): RedirectResponse
    {
        if ($order->priority !== 'urgent' || $order->status !== 'submitted') {
            return redirect()->back()->with('error', 'Order is not pending urgent approval.');
        }

        $order->update([
            'urgent_approved' => true,
            'urgent_approved_by' => $request->user()?->id,
            'urgent_approved_at' => now(),
        ]);

        return redirect()->back()->with('success', "Urgent order {$order->order_number} approved for production.");
    }

    public function rejectUrgent(Request $request, Order $order): RedirectResponse
    {
        if ($order->priority !== 'urgent' || $order->status !== 'submitted') {
            return redirect()->back()->with('error', 'Order is not pending urgent approval.');
        }

        $order->update([
            'urgent_approved' => false,
            'urgent_approved_by' => $request->user()?->id,
            'urgent_approved_at' => now(),
        ]);

        return redirect()->back()->with('success', "Urgent order {$order->order_number} rejected.");
    }

    public function update(UpdateOrderRequest $request, Order $order): RedirectResponse
    {
        $data = $request->validated();
        $itemsData = $data['items'] ?? [];
        $freight = (float) ($data['freight_amount'] ?? 0);
        $courier = (float) ($data['courier_amount'] ?? 0);
        $roundOff = (float) ($data['round_off'] ?? 0);
        $saveAsDraft = $request->boolean('save_as_draft');

        return DB::transaction(function () use ($request, $order, $data, $itemsData, $freight, $courier, $roundOff, $saveAsDraft) {
            $order->update([
                'company_name' => $data['company_name'] ?? $order->company_name,
                'customer_name' => $data['customer_name'] ?? $order->customer_name,
                'sales_user_id' => $data['sales_user_id'] ?? $order->sales_user_id,
                'order_date' => $data['order_date'] ?? $order->order_date,
                'transport_name' => $data['transport_name'] ?? $order->transport_name,
                'destination' => $data['destination'] ?? $order->destination,
                'delivery_address' => $data['delivery_address'] ?? $order->delivery_address,
                'phone' => $data['phone'] ?? $order->phone,
                'priority' => $data['priority'] ?? $order->priority,
                'notes' => $data['notes'] ?? $order->notes,
                'freight_amount' => $freight,
                'courier_amount' => $courier,
                'round_off' => $roundOff,
                'status' => $saveAsDraft ? 'draft' : $order->status,
            ]);

            if (array_key_exists('items', $data)) {
                $order->items()->delete();
                $totals = $this->syncOrderItems($order, $itemsData);

                $order->update([
                    'subtotal' => $totals['subtotal'],
                    'gst_total' => $totals['gst_total'],
                    'total_amount' => $totals['total_amount'] + $freight + $courier + $roundOff,
                ]);
            }

            $this->storeAttachments($order, $request);

            return redirect()
                ->route('orders.index')
                ->with('success', 'Order updated.');
        });
    }

    /**
     * @param  array<int, array<string, mixed>>  $itemsData
     * @return array{subtotal: float, gst_total: float, total_amount: float}
     */
    private function syncOrderItems(Order $order, array $itemsData): array
    {
        $items = [];
        $subtotal = 0.0;
        $gstTotal = 0.0;

        foreach ($itemsData as $item) {
            $quantity = (float) ($item['quantity'] ?? 0);
            $rate = (float) ($item['rate'] ?? 0);
            $gstPercent = (float) ($item['gst_percent'] ?? 0);

            $amount = $quantity * $rate;
            $gstAmount = $amount * ($gstPercent / 100);

            $subtotal += $amount;
            $gstTotal += $gstAmount;

            $items[] = [
                'our_brand' => $item['our_brand'] ?? null,
                'party_brand' => $item['party_brand'] ?? null,
                'packing_size' => $item['packing_size'] ?? null,
                'quantity' => $quantity,
                'rate' => $rate,
                'amount' => $amount,
                'gst_percent' => $gstPercent,
                'gst_amount' => $gstAmount,
                'type' => $item['type'] ?? null,
                'shape' => $item['shape'] ?? null,
                'cap_color' => $item['cap_color'] ?? null,
                'status' => $item['status'] ?? 'pending',
            ];
        }

        if ($items) {
            $order->items()->createMany($items);
        }

        return [
            'subtotal' => $subtotal,
            'gst_total' => $gstTotal,
            'total_amount' => $subtotal + $gstTotal,
        ];
    }

    private function storeAttachments(Order $order, Request $request): void
    {
        $attachments = [];

        foreach ($request->file('attachments', []) as $file) {
            $path = $file->store('orders/'.$order->id, 'public');
            $attachments[] = [
                'original_name' => $file->getClientOriginalName(),
                'path' => $path,
                'mime_type' => $file->getClientMimeType() ?? 'application/octet-stream',
                'size' => $file->getSize(),
                'document_type' => null,
            ];
        }

        foreach (['pan_file' => 'pan', 'aadhaar_file' => 'aadhaar'] as $field => $docType) {
            if ($request->hasFile($field)) {
                $file = $request->file($field);
                $path = $file->store('orders/'.$order->id.'/kyc', 'public');
                $attachments[] = [
                    'original_name' => $file->getClientOriginalName(),
                    'path' => $path,
                    'mime_type' => $file->getClientMimeType() ?? 'application/octet-stream',
                    'size' => $file->getSize(),
                    'document_type' => $docType,
                ];
            }
        }

        if ($attachments) {
            $order->attachments()->createMany($attachments);
        }
    }

    private function generateOrderNumber(): string
    {
        $nextId = (Order::max('id') ?? 0) + 1;

        return 'ORD-'.str_pad((string) $nextId, 4, '0', STR_PAD_LEFT);
    }
}
