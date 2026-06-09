<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\PartyDocument;
use App\Models\ProductPhoto;
use App\Models\ProductPhotoFolder;
use App\Models\ProductRate;
use App\Models\Transport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PartyController extends Controller
{
    public function index(): Response
    {
        $parties = Party::withCount('documents')
            ->with(['productRates' => fn ($q) => $q->orderBy('our_brand')->orderBy('packing_size')])
            ->where('type', 'customer')
            ->latest()
            ->get();

        $stats = [
            'total'     => $parties->count(),
            'customers' => $parties->count(),
            'suppliers' => 0,
            'active'    => $parties->where('is_active', true)->count(),
        ];

        $transports = Transport::transports()->orderBy('name')->get(['id', 'name']);
        $couriers = Transport::couriers()->orderBy('name')->get(['id', 'name']);

        $partyPhotos = ProductPhoto::whereNotNull('party_id')
            ->get()
            ->map(fn ($p) => [
                'id'          => $p->id,
                'party_id'    => $p->party_id,
                'our_brand'   => $p->our_brand,
                'party_brand' => $p->party_brand,
                'photo_url'   => $p->photo_url,
            ]);

        return Inertia::render('erp/parties/index', compact('parties', 'stats', 'transports', 'couriers', 'partyPhotos'));
    }

    public function suppliersIndex(): Response
    {
        $parties = Party::withCount('documents')
            ->with(['productRates' => fn ($q) => $q->orderBy('our_brand')->orderBy('packing_size')])
            ->whereIn('type', ['supplier', 'vendor', 'both'])
            ->latest()
            ->get();

        $stats = [
            'total'     => $parties->count(),
            'customers' => 0,
            'suppliers' => $parties->count(),
            'active'    => $parties->where('is_active', true)->count(),
        ];

        $transports = Transport::transports()->orderBy('name')->get(['id', 'name']);
        $couriers   = Transport::couriers()->orderBy('name')->get(['id', 'name']);

        $partyPhotos = ProductPhoto::whereNotNull('party_id')
            ->get()
            ->map(fn ($p) => [
                'id'          => $p->id,
                'party_id'    => $p->party_id,
                'our_brand'   => $p->our_brand,
                'party_brand' => $p->party_brand,
                'photo_url'   => $p->photo_url,
            ]);

        $defaultFilter = 'all';
        $pageTitle     = 'Supplier / Vendor';

        return Inertia::render('erp/parties/index', compact('parties', 'stats', 'transports', 'couriers', 'partyPhotos', 'defaultFilter', 'pageTitle'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'customer_name' => 'nullable|string|max:255',
            'type'          => 'required|in:customer,supplier,both',
            'gst_no'        => 'nullable|string|max:20',
            'pan_no'        => 'nullable|string|max:10',
            'pan_card_file' => 'nullable|file|max:5120|mimes:pdf,jpg,jpeg,png',
            'phone'   => 'nullable|string|max:20',
            'email'   => 'nullable|email|max:255',
            'address' => 'nullable|string',
            'city'    => 'nullable|string|max:100',
            'state'   => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:10',
            'notes'                  => 'nullable|string',
            'default_transport_type' => 'nullable|in:transport,courier',
            'default_transport_id'   => 'nullable|integer|exists:transports,id',
        ]);

        $panCardFile = $request->file('pan_card_file');
        unset($data['pan_card_file']);
        $data['created_by'] = $request->user()?->id;

        $party = Party::create($data);

        if ($panCardFile) {
            $ext = strtolower($panCardFile->getClientOriginalExtension() ?: 'pdf');
            $path = $panCardFile->storeAs("party-pan-cards/{$party->id}", "pan_card.{$ext}", 'local');
            $party->update(['pan_card_path' => $path]);
        }

        return redirect()->back()->with('success', 'Party added.');
    }

    public function update(Request $request, Party $party): RedirectResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'customer_name' => 'nullable|string|max:255',
            'type'          => 'required|in:customer,supplier,both',
            'gst_no'        => 'nullable|string|max:20',
            'pan_no'        => 'nullable|string|max:10',
            'pan_card_file' => 'nullable|file|max:5120|mimes:pdf,jpg,jpeg,png',
            'phone'     => 'nullable|string|max:20',
            'email'     => 'nullable|email|max:255',
            'address'   => 'nullable|string',
            'city'      => 'nullable|string|max:100',
            'state'     => 'nullable|string|max:100',
            'pincode'   => 'nullable|string|max:10',
            'notes'                  => 'nullable|string',
            'is_active'              => 'boolean',
            'default_transport_type' => 'nullable|in:transport,courier',
            'default_transport_id'   => 'nullable|integer|exists:transports,id',
        ]);

        $panCardFile = $request->file('pan_card_file');
        unset($data['pan_card_file']);

        if ($panCardFile) {
            if ($party->pan_card_path) {
                Storage::disk('local')->delete($party->pan_card_path);
            }
            $ext = strtolower($panCardFile->getClientOriginalExtension() ?: 'pdf');
            $data['pan_card_path'] = $panCardFile->storeAs("party-pan-cards/{$party->id}", "pan_card.{$ext}", 'local');
        }

        $party->update($data);

        return redirect()->back()->with('success', 'Party updated.');
    }

    public function showPanCard(Party $party): StreamedResponse
    {
        abort_if(! $party->pan_card_path, 404);
        abort_if(! Storage::disk('local')->exists($party->pan_card_path), 404);

        return Storage::disk('local')->response($party->pan_card_path);
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

    public function storeProductPhoto(Request $request, Party $party): RedirectResponse
    {
        $request->validate([
            'our_brand'   => 'required|string|max:255',
            'party_brand' => 'nullable|string|max:255',
            'photo'       => 'required|image|mimes:jpg,jpeg,png,webp|max:8192',
        ]);

        $disk = config('filesystems.default') === 's3' ? 's3' : 'public';
        $path = $request->file('photo')->store('product-photos', $disk);

        ProductPhoto::updateOrCreate(
            [
                'party_id'    => $party->id,
                'our_brand'   => $request->input('our_brand'),
                'party_brand' => $request->input('party_brand') ?: null,
            ],
            [
                'packing_size' => null,
                'photo_path'   => $path,
                'uploaded_by'  => $request->user()?->id,
            ]
        );

        ProductPhotoFolder::firstOrCreate(
            ['party_id' => $party->id],
            ['created_by' => $request->user()?->id]
        );

        return redirect()->back()->with('success', 'Product photo saved.');
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

        $partyBrand = ($data['party_brand'] ?? '') ?: null;

        $party->productRates()->updateOrCreate(
            [
                'our_brand'    => $data['our_brand'],
                'party_brand'  => $partyBrand,
                'packing_size' => $data['packing_size'],
            ],
            array_merge($data, ['party_brand' => $partyBrand])
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
