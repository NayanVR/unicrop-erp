<?php

namespace App\Http\Controllers;

use App\Models\Godown;
use App\Models\GodownStock;
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

    /** Adjust godown-level stock for a named godown + item. Direction: 'add' or 'deduct'. */
    private function adjustGodownStock(string $godownName, string $itemName, float $qty, string $direction): void
    {
        $godown   = Godown::where('name', $godownName)->first();
        $material = RawMaterial::where('name', $itemName)->first();
        if (! $godown || ! $material) return;

        $stock = GodownStock::firstOrCreate(
            ['godown_id' => $godown->id, 'raw_material_id' => $material->id],
            ['stock_qty' => 0]
        );

        $stock->stock_qty = $direction === 'add'
            ? (float) $stock->stock_qty + $qty
            : max(0, (float) $stock->stock_qty - $qty);

        $stock->save();
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
        $data['status']     = 'in-transit';

        $transfer = UnitTransfer::create($data);

        // Deduct stock from the sending godown immediately on dispatch
        $this->adjustGodownStock($transfer->from_unit, $transfer->item_name, (float) $transfer->quantity, 'deduct');

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
            // Credit stock to the receiving godown
            $this->adjustGodownStock($unitTransfer->to_unit, $unitTransfer->item_name, (float) $unitTransfer->quantity, 'add');
        }

        if ($data['status'] === 'cancelled') {
            // Return stock to the sending godown
            $this->adjustGodownStock($unitTransfer->from_unit, $unitTransfer->item_name, (float) $unitTransfer->quantity, 'add');
        }

        $unitTransfer->update(array_merge($data, $extra));

        $label = $data['status'] === 'unloaded' ? 'Received' : ucfirst($data['status']);
        return redirect()->back()->with('success', "Transfer marked as {$label}.");
    }

    public function destroy(UnitTransfer $unitTransfer): RedirectResponse
    {
        // If still in-transit, return stock to sender before deleting
        if ($unitTransfer->status === 'in-transit') {
            $this->adjustGodownStock($unitTransfer->from_unit, $unitTransfer->item_name, (float) $unitTransfer->quantity, 'add');
        }

        $unitTransfer->delete();

        return redirect()->back()->with('success', 'Transfer deleted.');
    }
}
