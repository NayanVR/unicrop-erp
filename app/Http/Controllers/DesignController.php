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
        'accepted' => 'design-ready',
        'design-ready' => 'approved-party',
        'approved-party' => 'sent-print',
        'sent-print' => 'completed',
        'completed' => 'received-factory',
    ];

    public function index(): Response
    {
        $designOrders = DesignOrder::with([
            'creator:id,name',
            'assignee:id,name',
            'order:id,order_number,company_name',
        ])
            ->latest()
            ->get();

        $designers = User::whereHas('roles', fn ($q) => $q->where('slug', 'design'))
            ->get(['id', 'name']);

        $stats = [
            'total' => $designOrders->count(),
            'in_progress' => $designOrders->whereNotIn('status', ['completed', 'received-factory'])->count(),
            'completed' => $designOrders->where('status', 'completed')->count(),
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

        $log = $designOrder->stage_log ?? [];
        $log[] = ['stage' => $next, 'at' => now()->toISOString(), 'by' => $request->user()?->name];

        $designOrder->update(['status' => $next, 'stage_log' => $log]);

        return redirect()->back()->with('success', "Moved to: {$next}");
    }

    public function destroy(DesignOrder $designOrder): RedirectResponse
    {
        $designOrder->delete();

        return redirect()->back()->with('success', 'Design order deleted.');
    }
}
