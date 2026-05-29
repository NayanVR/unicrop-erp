<?php

namespace App\Http\Controllers;

use App\Events\ErpActivity;
use App\Http\Requests\StoreOrderRequest;
use App\Http\Requests\UpdateOrderRequest;
use App\Models\DesignOrder;
use App\Models\Order;
use App\Models\Party;
use App\Models\ProductPhoto;
use App\Models\Role;
use App\Models\Transport;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class OrderController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $role = $user->roles->first()?->slug;

        $ordersQuery = Order::query()
            ->with([
                'items',
                'salesUser:id,name',
                'createdBy:id,name',
                'confirmedBy:id,name',
                'designOrders:id,order_id,order_item_id,assigned_to,status,order_qty,pcs_to_print,labels_received,skip_party_approval,stage_log',
                'designOrders.assignee:id,name',
            ])
            ->orderByDesc('order_date')
            ->orderByDesc('id');

        // Design users see confirmed orders (sent to both factory & design) and design-only orders
        if ($role === Role::DESIGN) {
            $ordersQuery->whereIn('status', ['confirmed', 'design']);
        }
        // Admin and office see all orders

        $orders = $ordersQuery->get();

        // Surface activity attribution as plain fields, then drop the relation
        // objects whose serialized keys would clobber the created_by / confirmed_by columns.
        $orders->each(function (Order $order) {
            $order->confirmed_by_name = $order->confirmedBy?->name;
            $order->created_by_name = $order->createdBy?->name;
            $order->design_handlers = $order->designOrders
                ->map(fn ($d) => $d->assignee?->name)
                ->filter()
                ->unique()
                ->values()
                ->all();

            // Per-item design workflow data, keyed by order_item_id for the design view
            $order->design_items = $order->designOrders->map(fn ($d) => [
                'id'                  => $d->id,
                'order_item_id'       => $d->order_item_id,
                'status'              => $d->status,
                'order_qty'           => $d->order_qty,
                'pcs_to_print'        => $d->pcs_to_print,
                'labels_received'     => $d->labels_received,
                'skip_party_approval' => (bool) $d->skip_party_approval,
                'assignee'            => $d->assignee?->name,
                'stage_log'           => $d->stage_log,
            ])->all();

            $order->unsetRelation('confirmedBy');
            $order->unsetRelation('createdBy');
            $order->unsetRelation('designOrders');
        });

        return Inertia::render('erp/orders/index', [
            'pageTitle'     => 'All Orders',
            'orders'        => $orders,
            'currentUserId' => $user?->id,
            'userRole'      => $role,
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
                ->get(['id', 'name', 'customer_name', 'gst_no', 'pan_no', 'pan_card_path', 'phone', 'address', 'city', 'state', 'default_transport_type', 'default_transport_id']),
            'currentUser' => ['id' => $user?->id, 'name' => $user?->name],
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

    public function store(StoreOrderRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $itemsData = $data['items'] ?? [];
        $freight = (float) ($data['freight_amount'] ?? 0);
        $courier = (float) ($data['courier_amount'] ?? 0);
        $roundOff = (float) ($data['round_off'] ?? 0);
        $saveAsDraft = $request->boolean('save_as_draft');

        try {
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
        } catch (\Throwable $e) {
            Log::error('Order creation failed', [
                'user_id' => $user?->id,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return redirect()->back()
                ->withInput()
                ->withErrors(['order_error' => 'Server error: '.$e->getMessage()]);
        }
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

        $user = $request->user();
        broadcast(new ErpActivity(
            type: 'order_confirmed',
            message: "{$user?->name} confirmed Order {$order->order_number} ({$order->company_name})",
            by: $user?->name ?? 'System',
            meta: ['order_id' => $order->id],
        ));

        return redirect()->back()->with('success', "Order {$order->order_number} confirmed.");
    }

    public function sendToDesign(Request $request, Order $order): RedirectResponse
    {
        if ($order->status !== 'confirmed') {
            return redirect()->back()->with('error', 'Order must be confirmed before sending to design team.');
        }

        $data = $request->validate([
            'note'                => 'nullable|string|max:1000',
            'skip_party_approval' => 'boolean',
            'item_ids'            => 'nullable|array',
            'item_ids.*'          => 'integer',
        ]);

        $itemIds    = $data['item_ids'] ?? null;
        $skip       = (bool) ($data['skip_party_approval'] ?? false);
        $note       = $data['note'] ?? null;

        $items = $order->items()
            ->when($itemIds, fn ($q) => $q->whereIn('id', $itemIds))
            ->get();

        foreach ($items as $item) {
            DesignOrder::create([
                'created_by'          => $request->user()?->id,
                'order_id'            => $order->id,
                'order_item_id'       => $item->id,
                'order_qty'           => (int) $item->quantity,
                'party_brand'         => $item->party_brand ?? '',
                'product_name'        => $item->our_brand ?? '',
                'packing_size'        => $item->packing_size,
                'instructions'        => $note,
                'status'              => 'pending',
                'skip_party_approval' => $skip,
                'stage_log'           => [['stage' => 'pending', 'at' => now()->toISOString(), 'by' => $request->user()?->name]],
            ]);
        }

        return redirect()->back()->with('success', "Order {$order->order_number} sent to Design team.");
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

    public function edit(Request $request, Order $order): Response|RedirectResponse
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $isAdmin = $user->roles->contains('slug', Role::ADMIN);

        if (! in_array($order->status, ['draft', 'submitted'])) {
            return redirect()->route('orders.index')->with('error', 'Cannot edit a confirmed order.');
        }
        if (! $isAdmin && $order->created_by !== $user->id) {
            return redirect()->route('orders.index')->with('error', 'You can only edit orders you created.');
        }

        $salesUsers = User::query()
            ->where('is_active', true)
            ->whereHas('roles', fn ($query) => $query->whereIn('slug', [Role::ADMIN, Role::OFFICE]))
            ->orderBy('name')
            ->get(['id', 'name']);

        $order->loadMissing('items');

        return Inertia::render('erp/orders/create', [
            'pageTitle'    => 'Edit Order '.$order->order_number,
            'salesUsers'   => $salesUsers,
            'transports'   => Transport::transports()->orderBy('name')->get(['id', 'name']),
            'couriers'     => Transport::couriers()->orderBy('name')->get(['id', 'name']),
            'parties'      => Party::where('is_active', true)->orderBy('name')
                ->with(['productRates' => fn ($q) => $q->where('is_active', true)->orderBy('our_brand')->orderBy('packing_size')])
                ->get(['id', 'name', 'customer_name', 'gst_no', 'pan_no', 'pan_card_path', 'phone', 'address', 'city', 'state', 'default_transport_type', 'default_transport_id']),
            'currentUser'  => ['id' => $user?->id, 'name' => $user?->name],
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
            'editingOrder' => [
                'id'               => $order->id,
                'order_number'     => $order->order_number,
                'party_id'         => $order->party_id,
                'company_name'     => $order->company_name,
                'customer_name'    => $order->customer_name,
                'gst_no'           => $order->gst_no,
                'pan_no'           => $order->pan_no,
                'aadhaar_no'       => $order->aadhaar_no,
                'sales_user_id'    => $order->sales_user_id,
                'order_date'       => $order->order_date?->toDateString(),
                'transport_type'   => $order->transport_type ?? 'transport',
                'transport_name'   => $order->transport_name,
                'destination'      => $order->destination,
                'delivery_address' => $order->delivery_address,
                'phone'            => $order->phone,
                'priority'         => $order->priority ?? 'normal',
                'notes'            => $order->notes,
                'freight_amount'   => (string) ($order->freight_amount ?? '0'),
                'courier_amount'   => (string) ($order->courier_amount ?? '0'),
                'round_off'        => (string) ($order->round_off ?? '0'),
                'items'            => $order->items->map(fn ($item) => [
                    'our_brand'    => $item->our_brand,
                    'party_brand'  => $item->party_brand,
                    'packing_size' => $item->packing_size,
                    'quantity'     => (string) $item->quantity,
                    'rate'         => (string) $item->rate,
                    'gst_percent'  => (string) $item->gst_percent,
                    'type'         => $item->type,
                    'shape'        => $item->shape,
                    'cap_color'    => $item->cap_color,
                ])->all(),
            ],
        ]);
    }

    public function destroy(Request $request, Order $order): RedirectResponse
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $isAdmin = $user->roles->contains('slug', Role::ADMIN);

        if (in_array($order->status, ['draft', 'submitted'])) {
            if (! $isAdmin && $order->created_by !== $user->id) {
                return redirect()->back()->with('error', 'You can only delete orders you created.');
            }
        } else {
            // Confirmed or later — admin only
            if (! $isAdmin) {
                return redirect()->back()->with('error', 'Only admins can delete confirmed orders.');
            }
        }

        $orderNumber = $order->order_number;
        $order->delete(); // cascades to order_items, order_attachments

        return redirect()->route('orders.index')->with('success', "Order {$orderNumber} deleted.");
    }

    public function update(UpdateOrderRequest $request, Order $order): RedirectResponse
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $isAdmin = $user->roles->contains('slug', Role::ADMIN);

        if (! in_array($order->status, ['draft', 'submitted'])) {
            return redirect()->back()->with('error', 'Cannot edit a confirmed order.');
        }
        if (! $isAdmin && $order->created_by !== $user->id) {
            return redirect()->back()->with('error', 'You can only edit orders you created.');
        }

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

        // No PAN file uploaded — copy from party's permanent PAN card if available
        if (! $request->hasFile('pan_file') && $request->filled('party_id')) {
            $party = Party::find($request->input('party_id'));
            if ($party?->pan_card_path && Storage::disk('local')->exists($party->pan_card_path)) {
                try {
                    $content = Storage::disk('local')->get($party->pan_card_path);
                    $ext = strtolower(pathinfo($party->pan_card_path, PATHINFO_EXTENSION)) ?: 'pdf';
                    $newPath = 'orders/'.$order->id.'/kyc/pan_card_'.Str::random(8).'.'.$ext;
                    Storage::disk('public')->put($newPath, $content);
                    $attachments[] = [
                        'original_name' => 'PAN_Card.'.strtoupper($ext),
                        'path'          => $newPath,
                        'mime_type'     => $ext === 'pdf' ? 'application/pdf' : 'image/'.$ext,
                        'size'          => Storage::disk('local')->size($party->pan_card_path),
                        'document_type' => 'pan',
                    ];
                } catch (\Throwable $e) {
                    Log::warning('Failed to copy party PAN card to order', [
                        'party_id' => $party->id,
                        'error'    => $e->getMessage(),
                    ]);
                }
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
