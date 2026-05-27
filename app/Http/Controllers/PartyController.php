<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\PartyDocument;
use App\Models\ProductRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class PartyController extends Controller
{
    public function index(): Response
    {
        $parties = Party::withCount('documents')
            ->with(['productRates' => fn ($q) => $q->orderBy('our_brand')->orderBy('packing_size')])
            ->latest()
            ->get();

        $stats = [
            'total' => $parties->count(),
            'customers' => $parties->whereIn('type', ['customer', 'both'])->count(),
            'suppliers' => $parties->whereIn('type', ['supplier', 'both'])->count(),
            'active' => $parties->where('is_active', true)->count(),
        ];

        return Inertia::render('erp/parties/index', compact('parties', 'stats'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'    => 'required|string|max:255',
            'type'    => 'required|in:customer,supplier,both',
            'gst_no'  => 'nullable|string|max:20',
            'pan_no'  => 'nullable|string|max:10',
            'phone'   => 'nullable|string|max:20',
            'email'   => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'city'    => 'nullable|string|max:100',
            'state'   => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:10',
            'notes'   => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()?->id;
        Party::create($data);

        return redirect()->back()->with('success', 'Party added.');
    }

    public function update(Request $request, Party $party): RedirectResponse
    {
        $data = $request->validate([
            'name'      => 'required|string|max:255',
            'type'      => 'required|in:customer,supplier,both',
            'gst_no'    => 'nullable|string|max:20',
            'pan_no'    => 'nullable|string|max:10',
            'phone'     => 'nullable|string|max:20',
            'email'     => 'nullable|email|max:255',
            'address'   => 'nullable|string',
            'city'      => 'nullable|string|max:100',
            'state'     => 'nullable|string|max:100',
            'pincode'   => 'nullable|string|max:10',
            'notes'     => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $party->update($data);

        return redirect()->back()->with('success', 'Party updated.');
    }

    public function destroy(Party $party): RedirectResponse
    {
        $party->documents->each(fn ($doc) => Storage::delete($doc->path));
        $party->delete();

        return redirect()->back()->with('success', 'Party deleted.');
    }

    public function uploadDocument(Request $request, Party $party): RedirectResponse
    {
        $request->validate([
            'file'  => 'required|file|max:10240',
            'type'  => 'required|in:gst_certificate,pan_card,agreement,invoice,other',
            'label' => 'nullable|string|max:255',
        ]);

        $file = $request->file('file');
        $path = $file->store("party-documents/{$party->id}", 'local');

        $party->documents()->create([
            'uploaded_by'   => $request->user()?->id,
            'type'          => $request->type,
            'label'         => $request->label,
            'original_name' => $file->getClientOriginalName(),
            'path'          => $path,
            'size'          => $file->getSize(),
        ]);

        return redirect()->back()->with('success', 'Document uploaded.');
    }

    public function deleteDocument(PartyDocument $document): RedirectResponse
    {
        Storage::delete($document->path);
        $document->delete();

        return redirect()->back()->with('success', 'Document removed.');
    }

    public function storeProductRate(Request $request, Party $party): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'    => 'required|string|max:255',
            'party_brand'  => 'nullable|string|max:255',
            'packing_size' => 'required|string|max:50',
            'rate'         => 'required|numeric|min:0',
            'gst_percent'  => 'required|numeric|min:0|max:100',
        ]);

        $party->productRates()->updateOrCreate(
            ['our_brand' => $data['our_brand'], 'packing_size' => $data['packing_size']],
            $data
        );

        return redirect()->back()->with('success', 'Product rate saved.');
    }

    public function updateProductRate(Request $request, ProductRate $productRate): RedirectResponse
    {
        $data = $request->validate([
            'our_brand'    => 'required|string|max:255',
            'party_brand'  => 'nullable|string|max:255',
            'packing_size' => 'required|string|max:50',
            'rate'         => 'required|numeric|min:0',
            'gst_percent'  => 'required|numeric|min:0|max:100',
        ]);

        $productRate->update($data);

        return redirect()->back()->with('success', 'Product rate updated.');
    }

    public function destroyProductRate(ProductRate $productRate): RedirectResponse
    {
        $productRate->delete();

        return redirect()->back()->with('success', 'Product rate deleted.');
    }
}
