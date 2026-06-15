<?php

namespace App\Http\Controllers;

use App\Models\Godown;
use App\Models\RawMaterial;
use App\Models\UnitTransfer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UnitTransferController extends Controller
{
    public function index(): Response
    {
        $transfers = UnitTransfer::with(['creator:id,name', 'receiver:id,name'])
            ->latest()
            ->get();

        $stats = [
            'total'       => $transfers->count(),
            'in_transit'  => $transfers->where('status', 'in-transit')->count(),
            'received'    => $transfers->where('status', 'unloaded')->count(),
            'cancelled'   => $transfers->where('status', 'cancelled')->count(),
        ];

        $godowns       = Godown::where('is_active', true)->orderBy('name')->get(['id', 'name', 'is_default']);
        $inventoryItems = RawMaterial::where('is_active', true)->orderBy('name')->get(['id', 'name', 'unit', 'category']);

        return Inertia::render('erp/unit-transfer/index', compact('transfers', 'stats', 'godowns', 'inventoryItems'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'order_number' => 'nullable|string|max:50',
            'from_unit'    => 'required|string|max:100',
            'to_unit'      => 'required|string|max:100',
            'item_type'    => 'required|in:raw_material,finished_good,other',
            'item_name'    => 'required|string|max:255',
            'quantity'     => 'required|numeric|min:0.001',
            'unit'         => 'required|string|max:20',
            'notes'        => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['status']     = 'in-transit';   // immediately "On the Way"

        UnitTransfer::create($data);

        return redirect()->back()->with('success', 'Transfer created — On the Way.');
    }

    public function updateStatus(Request $request, UnitTransfer $unitTransfer): RedirectResponse
    {
        $data = $request->validate([
            'status' => 'required|in:in-transit,unloaded,cancelled',
        ]);

        if ($unitTransfer->status === 'unloaded' || $unitTransfer->status === 'cancelled') {
            return redirect()->back()->with('error', 'Transfer is already finalised.');
        }

        $extra = [];
        if ($data['status'] === 'unloaded') {
            $extra['received_by_user_id'] = $request->user()?->id;
            $extra['received_at']         = now();
            $extra['transferred_at']      = now();
        }

        $unitTransfer->update(array_merge($data, $extra));

        $label = $data['status'] === 'unloaded' ? 'Received' : ucfirst($data['status']);
        return redirect()->back()->with('success', "Transfer marked as {$label}.");
    }

    public function destroy(UnitTransfer $unitTransfer): RedirectResponse
    {
        $unitTransfer->delete();

        return redirect()->back()->with('success', 'Transfer deleted.');
    }
}
