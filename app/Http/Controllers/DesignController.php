<?php

namespace App\Http\Controllers;

use App\Models\DesignOrder;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DesignController extends Controller
{
    private const STAGE_FLOW = [
        'pending'        => 'accepted',
        'accepted'       => 'design-ready',
        'design-ready'   => 'approved-party',
        'approved-party' => 'sent-print',
        'sent-print'     => 'completed',
        'completed'      => 'received-factory',
    ];

    public function index(): Response
    {
        $designOrders = DesignOrder::forLiveOrders()
            ->with([
                'creator:id,name',
                'assignee:id,name',
                'order:id,order_number,company_name,customer_name',
            ])
            ->latest()
            ->get();

        $designers = User::whereHas('roles', fn ($q) => $q->where('slug', 'design'))
            ->get(['id', 'name']);

        $stats = [
            'total'            => $designOrders->count(),
            'pending'          => $designOrders->where('status', 'pending')->count(),
            'in_progress'      => $designOrders->whereNotIn('status', ['pending', 'completed', 'received-factory'])->count(),
            'completed'        => $designOrders->where('status', 'completed')->count(),
            'received_factory' => $designOrders->where('status', 'received-factory')->count(),
        ];

        return Inertia::render('erp/design/index', compact('designOrders', 'designers', 'stats'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'assigned_to' => 'nullable|exists:users,id',
            'order_id' => 'nullable|exists:orders,id',
            'party_brand' => 'required|string|max:255',
            'product_name' => 'required|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'label_dimensions' => 'nullable|string|max:100',
            'instructions' => 'nullable|string',
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['status'] = 'accepted';
        $data['stage_log'] = [
            ['stage' => 'accepted', 'at' => now()->toISOString(), 'by' => $request->user()?->name],
        ];

        DesignOrder::create($data);

        return redirect()->back()->with('success', 'Design order created.');
    }

    public function update(Request $request, DesignOrder $designOrder): RedirectResponse
    {
        $data = $request->validate([
            'assigned_to' => 'nullable|exists:users,id',
            'party_brand' => 'required|string|max:255',
            'product_name' => 'required|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'label_dimensions' => 'nullable|string|max:100',
            'instructions' => 'nullable|string',
            'notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $designOrder->update($data);

        return redirect()->back()->with('success', 'Design order updated.');
    }

    public function advance(Request $request, DesignOrder $designOrder): RedirectResponse
    {
        $next = self::STAGE_FLOW[$designOrder->status] ?? null;

        if (! $next) {
            return redirect()->back()->with('error', 'Design order is already at the final stage.');
        }

        // Skip party approval step when configured
        if ($next === 'approved-party' && $designOrder->skip_party_approval) {
            $next = 'sent-print';
        }

        $log = $designOrder->stage_log ?? [];
        $log[] = ['stage' => $next, 'at' => now()->toISOString(), 'by' => $request->user()?->name];

        $update = ['status' => $next, 'stage_log' => $log];

        // The first design user to move the order is the one who accepts it
        if (! $designOrder->assigned_to) {
            $update['assigned_to'] = $request->user()?->id;
        }

        $designOrder->update($update);

        return redirect()->back()->with('success', "Moved to: {$next}");
    }

    public function setStage(Request $request, DesignOrder $designOrder): RedirectResponse
    {
        $allStages = array_keys(self::STAGE_FLOW);
        $allStages[] = 'received-factory';

        $data = $request->validate([
            'stage' => ['required', 'string', 'in:' . implode(',', $allStages)],
        ]);

        $stage = $data['stage'];

        $log = $designOrder->stage_log ?? [];
        $log[] = ['stage' => $stage, 'at' => now()->toISOString(), 'by' => $request->user()?->name];

        $update = ['status' => $stage, 'stage_log' => $log];

        if (! $designOrder->assigned_to) {
            $update['assigned_to'] = $request->user()?->id;
        }

        $designOrder->update($update);

        return redirect()->back()->with('success', "Stage updated.");
    }

    public function updateTracking(Request $request, DesignOrder $designOrder): RedirectResponse
    {
        if ($designOrder->status === 'pending') {
            return redirect()->back()->with('error', 'Order must be accepted before updating tracking.');
        }

        $data = $request->validate([
            'pcs_to_print'    => 'nullable|integer|min:0',
            'labels_received' => 'nullable|integer|min:0',
        ]);

        if (array_key_exists('pcs_to_print', $data)) {
            $max = $designOrder->order_qty ?? PHP_INT_MAX;
            if ((int) $data['pcs_to_print'] > $max) {
                return redirect()->back()->with('error', "Pieces to print cannot exceed order quantity ({$max}).");
            }
            $designOrder->pcs_to_print = $data['pcs_to_print'];
        }

        if (array_key_exists('labels_received', $data)) {
            $max = $designOrder->pcs_to_print ?? ($designOrder->order_qty ?? PHP_INT_MAX);
            if ((int) $data['labels_received'] > $max) {
                return redirect()->back()->with('error', "Labels received cannot exceed pieces to print ({$max}).");
            }
            $designOrder->labels_received = $data['labels_received'];
        }

        $designOrder->save();

        return redirect()->back()->with('success', 'Tracking updated.');
    }

    public function destroy(DesignOrder $designOrder): RedirectResponse
    {
        $designOrder->delete();

        return redirect()->back()->with('success', 'Design order deleted.');
    }
}
