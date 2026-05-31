<?php

namespace App\Http\Controllers;

use App\Models\UnitTransfer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UnitTransferController extends Controller
{
    public function index(): Response
    {
        $transfers = UnitTransfer::with('creator:id,name')
            ->latest()
            ->get();

        $stats = [
            'total' => $transfers->count(),
            'loading' => $transfers->where('status', 'loading')->count(),
            'in_transit' => $transfers->where('status', 'in-transit')->count(),
            'unloaded' => $transfers->where('status', 'unloaded')->count(),
        ];

        return Inertia::render('erp/unit-transfer/index', compact('transfers', 'stats'));
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
            'received_by'  => 'nullable|string|max:100',
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['status'] = 'loading';

        UnitTransfer::create($data);

        return redirect()->back()->with('success', 'Transfer created.');
    }

    public function updateStatus(Request $request, UnitTransfer $unitTransfer): RedirectResponse
    {
        $data = $request->validate([
            'status' => 'required|in:loading,in-transit,unloaded,cancelled',
        ]);

        if ($unitTransfer->status === 'unloaded' || $unitTransfer->status === 'cancelled') {
            return redirect()->back()->with('error', 'Transfer is already finalised.');
        }

        $extra = [];
        if ($data['status'] === 'unloaded') {
            $extra['transferred_at'] = now();
        }

        $unitTransfer->update(array_merge($data, $extra));

        return redirect()->back()->with('success', "Status updated to {$data['status']}.");
    }

    public function destroy(UnitTransfer $unitTransfer): RedirectResponse
    {
        $unitTransfer->delete();

        return redirect()->back()->with('success', 'Transfer deleted.');
    }
}
