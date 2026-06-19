<?php

namespace App\Http\Controllers;

use App\Models\InventoryPurchaseBillItem;
use App\Models\Party;
use App\Models\PartyDocument;
use App\Models\ProductPhoto;
use App\Models\ProductPhotoFolder;
use App\Models\ProductRate;
use App\Models\RawMaterial;
use App\Models\Role;
use App\Models\Transport;
use App\Services\LowStockAlertService;
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

        $parties->each(function (Party $party) {
            $party->purchased_products = $this->purchasedMaterialsForParty($party)
                ->map(fn (RawMaterial $m) => [
                    'id'            => $m->id,
                    'name'          => $m->name,
                    'unit'          => $m->unit,
                    'category'      => $m->category,
                    'stock_qty'     => $m->stock_qty,
                    'min_stock'     => $m->min_stock,
                    'reorder_level' => $m->reorder_level,
                    'is_low_stock'  => $m->isLowStock(),
                ])
                ->values();
        });

        $defaultFilter = 'all';
        $pageTitle     = 'Supplier / Vendor';

        return Inertia::render('erp/parties/index', compact('parties', 'stats', 'transports', 'couriers', 'partyPhotos', 'defaultFilter', 'pageTitle'));
    }

    public function notifySupplier(Party $party): RedirectResponse
    {
        $materials = $this->purchasedMaterialsForParty($party)
            ->filter(fn (RawMaterial $m) => $m->isLowStock());

        if ($materials->isEmpty()) {
            return redirect()->back()->with('error', 'No low-stock products found for this supplier.');
        }

        $result = app(LowStockAlertService::class)->sendSupplierLowStockAlert($party, $materials);

        return redirect()->back()->with(
            $result['ok'] ? 'success' : 'error',
            $result['ok']
                ? "WhatsApp alert sent to {$party->name}."
                : "Failed to send alert: {$result['detail']}"
        );
    }

    /**
     * A raw material can be bought from more than one supplier (e.g. "Humic" from ~10
     * vendors), so a party's purchased products are the union of:
     *  - materials whose single `supplier` name field matches this party, and
     *  - materials this party has actually been billed for in purchase-bill history.
     *
     * @return \Illuminate\Support\Collection<int, RawMaterial>
     */
    private function purchasedMaterialsForParty(Party $party): \Illuminate\Support\Collection
    {
        $byName = RawMaterial::where('approval_status', 'approved')
            ->whereRaw('LOWER(supplier) = ?', [mb_strtolower(trim($party->name))])
            ->get();

        $historyIds = InventoryPurchaseBillItem::whereNotNull('raw_material_id')
            ->whereHas('inventoryPurchaseBill', fn ($q) => $q->where('party_id', $party->id))
            ->pluck('raw_material_id')
            ->unique();

        $byHistory = RawMaterial::where('approval_status', 'approved')
            ->whereIn('id', $historyIds)
            ->get();

        return $byName->concat($byHistory)->unique('id')->values();
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
            'destination'            => 'nullable|string|max:255',
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
            'destination'            => 'nullable|string|max:255',
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

    public function ledgerIndex(Request $request): Response
    {
        return Inertia::render('erp/parties/ledger', [
            'pageTitle' => 'Party Ledger',
            'parties'   => $this->ledgerPartyOptions($request),
            'party'     => null,
            'entries'   => [],
            'summary'   => null,
        ]);
    }

    public function ledger(Request $request, Party $party): Response
    {
        $this->guardLedgerAccess($request, $party);

        ['entries' => $entries, 'summary' => $summary] = $this->buildLedger($party);

        return Inertia::render('erp/parties/ledger', [
            'pageTitle' => 'Party Ledger',
            'parties'   => $this->ledgerPartyOptions($request),
            'party'     => [
                'id'            => $party->id,
                'name'          => $party->name,
                'customer_name' => $party->customer_name,
                'gst_no'        => $party->gst_no,
                'phone'         => $party->phone,
            ],
            'entries' => $entries,
            'summary' => $summary,
        ]);
    }

    public function ledgerPrint(Request $request, Party $party): \Illuminate\View\View
    {
        $this->guardLedgerAccess($request, $party);

        ['entries' => $entries, 'summary' => $summary] = $this->buildLedger($party);

        return view('parties.ledger-print', ['party' => $party, 'entries' => $entries, 'summary' => $summary]);
    }

    private function guardLedgerAccess(Request $request, Party $party): void
    {
        if ($this->cannotViewSuppliers($request) && in_array($party->type, ['supplier', 'vendor'], true)) {
            abort(403);
        }
    }

    /**
     * @return array{entries: array<int, array<string, mixed>>, summary: array<string, float>}
     */
    private function buildLedger(Party $party): array
    {
        $party->load([
            'orders' => fn ($q) => $q->orderBy('order_date')->orderBy('id'),
            'orders.payments' => fn ($q) => $q->orderBy('created_at'),
            'orders.payments.bankAccount:id,name',
        ]);

        $entries = collect();

        foreach ($party->orders as $order) {
            if (in_array($order->status, ['confirmed', 'dispatched'], true)) {
                $invoiceDate = $order->confirmed_at ?? $order->order_date;
                $entries->push([
                    'sort'        => $invoiceDate->timestamp,
                    'date'        => $invoiceDate->format('d M Y'),
                    'type'        => 'invoice',
                    'description' => "Order #{$order->order_number}",
                    'debit'       => (float) $order->total_amount,
                    'credit'      => 0.0,
                ]);
            }

            foreach ($order->payments as $payment) {
                $entries->push([
                    'sort'        => $payment->created_at->timestamp,
                    'date'        => $payment->created_at->format('d M Y'),
                    'type'        => 'payment',
                    'description' => "Payment for #{$order->order_number}"
                        .($payment->reference_number ? " · Ref: {$payment->reference_number}" : '')
                        .($payment->bankAccount ? " · {$payment->bankAccount->name}" : ''),
                    'debit'       => 0.0,
                    'credit'      => (float) $payment->amount,
                ]);
            }
        }

        $balance = 0.0;
        $entries = $entries->sortBy('sort')->values()->map(function ($entry) use (&$balance) {
            $balance += $entry['debit'] - $entry['credit'];
            unset($entry['sort']);
            $entry['balance'] = round($balance, 2);

            return $entry;
        });

        return [
            'entries' => $entries->values()->all(),
            'summary' => [
                'total_invoiced' => round($entries->sum('debit'), 2),
                'total_received' => round($entries->sum('credit'), 2),
                'balance_due'    => round($balance, 2),
            ],
        ];
    }

    /**
     * @return \Illuminate\Support\Collection<int, Party>
     */
    private function ledgerPartyOptions(Request $request)
    {
        $query = Party::where('is_active', true);

        if ($this->cannotViewSuppliers($request)) {
            $query->whereNotIn('type', ['supplier', 'vendor']);
        }

        return $query->orderBy('name')->get(['id', 'name', 'customer_name']);
    }

    private function cannotViewSuppliers(Request $request): bool
    {
        return $request->user()?->roles->pluck('slug')->intersect([Role::ADMIN, Role::ACCOUNTANT])->isEmpty() ?? false;
    }
}
