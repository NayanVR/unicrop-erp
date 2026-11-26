<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\PriceListItem;
use App\Services\CurrentCompany;
use App\Services\SalesCatalogue;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

class PriceListController extends Controller
{
    /** Cover and letterhead text, with the defaults taken from the printed list. */
    private const SETTING_DEFAULTS = [
        'price_list_title'      => 'Bio Stimulant Product Price List',
        'price_list_tagline'    => 'Leading Innovative Pesticide & Bio Fertilizer Company',
        'price_list_strapline'  => "Your Trusted Source for\nAdvanced Agrochemicals!",
        'price_list_ribbon'     => 'FERTILIZERS | PESTICIDES | BIO STIMULANTS | BIO FERTILIZERS | BIO PESTICIDES | SPREAD ADJUVANTS',
        'price_list_email'      => 'sales@unicropbiochem.com',
        'price_list_phone'      => '+91- 9904746467, 9574866222',
        'price_list_plants'     => "Our Manufacturing Plants :\nBio Fertilizer Unit:\nA-10, Prime Industrial Estate, Manjusar GIDC, Vadodara, Gujarat, India – 391775\nPesticide Unit:\n204/P2 Bautha Radhanpura Road, At Bautha. Savli, Vadodara, Gujarat, India – 391775",
        'price_list_website'    => 'www.unicropbiochem.com',
    ];

    public function index(Request $request): Response
    {
        $isAdmin = $this->isAdmin($request);

        $items = $this->items();

        return Inertia::render('erp/price-list/index', [
            'pageTitle'  => 'Price List',
            'items'      => $items->map(fn ($item) => $this->itemPayload($item))->values(),
            'categories' => $items->map->category()->filter()->unique()->sort()->values(),
            'groups'     => $items->map->group()->filter()->unique()->sort()->values(),
            'settings'   => $this->settings(),
            'canEdit'    => $isAdmin,
            'importable' => $isAdmin ? $this->importable()->count() : 0,
            'products'   => $isAdmin ? $this->linkableProducts() : [],
        ]);
    }

    /** The PDF the sales team hands to a customer. */
    public function download(Request $request): HttpResponse
    {
        $data = $request->validate([
            'only'     => ['nullable', 'string', 'max:20000'],
            'for'      => ['nullable', 'string', 'max:120'],
            'category' => ['nullable', 'string', 'max:120'],
            'group'    => ['nullable', 'string', 'max:120'],
        ]);

        $items    = $this->itemsFor($data);
        $settings = $this->settings();
        $scope    = ($data['group'] ?? '') ?: ($data['category'] ?? '') ?: null;

        if ($scope) {
            $settings['price_list_title'] = $scope.' Price List';
        }

        $pdf = Pdf::loadView('pdf.price-list', [
            'settings' => $settings,
            'sections' => $items->where('is_bulk', false)->groupBy(fn ($i) => $i->heading()),
            'bulk'     => $items->where('is_bulk', true)->groupBy(fn ($i) => $i->heading()),
            'for'      => trim($data['for'] ?? ''),
            'date'     => now()->format('F Y'),
            'logo'     => $this->logo(),
        ])->setPaper('a4');

        $slug = $scope ? '-'.str($scope)->slug() : '';

        return $pdf->download('Price-List'.$slug.'-'.now()->format('Y-m-d').'.pdf');
    }

    /**
     * Exactly what a PDF built with these filters would print. A price list
     * is usually pulled for one category or group at a time — "the finished
     * goods one", "the bio stimulant one".
     *
     * @param  array{category?: string|null, group?: string|null, only?: string|null}  $filters
     * @return Collection<int, PriceListItem>
     */
    public function itemsFor(array $filters): Collection
    {
        $items = $this->items()->where('is_active', true);

        if (! empty($filters['category'])) {
            $items = $items->filter(fn ($item) => $item->category() === $filters['category']);
        }

        if (! empty($filters['group'])) {
            $items = $items->filter(fn ($item) => $item->group() === $filters['group']);
        }

        if (! empty($filters['only'])) {
            $wanted = collect(explode(',', $filters['only']))
                ->map(fn ($id) => (int) trim($id))
                ->filter()
                ->flip();

            $items = $items->filter(fn ($item) => $wanted->has($item->id));
        }

        // Keep a product off the sheet unless it has a price to print.
        return $items->filter(fn ($item) => $item->packings->isNotEmpty())->values();
    }

    /**
     * @return array<string, mixed>
     */
    private function itemPayload(PriceListItem $item): array
    {
        return [
            'id'          => $item->id,
            'name'        => $item->name,
            'description' => $item->description,
            'section'     => $item->section,
            'heading'     => $item->heading(),
            'category'    => $item->category(),
            'group'       => $item->group(),
            'raw_material_id' => $item->raw_material_id,
            'gst_percent' => (float) $item->gst_percent,
            'is_bulk'     => $item->is_bulk,
            'is_active'   => $item->is_active,
            'sort_order'  => $item->sort_order,
            'packings'    => $item->packings->map(fn ($p) => [
                'id'              => $p->id,
                'packing'         => $p->packing,
                'raw_material_id' => $p->raw_material_id,
                'mrp'             => $p->mrp !== null ? (float) $p->mrp : null,
                'rate'            => $p->liveRate(),
                'typed_rate'      => (float) $p->rate,
                'is_live'         => $p->followsProduct(),
                'qty_per_box'     => $p->qty_per_box,
            ])->values(),
        ];
    }

    /**
     * Products an admin may point a packing at, so its rate stays live.
     *
     * @return array<int, array<string, mixed>>
     */
    private function linkableProducts(): array
    {
        return SalesCatalogue::pricedProducts()
            ->map(fn ($m) => [
                'id'       => $m->id,
                'name'     => $m->display_name,
                'category' => $m->category,
                'group'    => $m->group_name,
                'rate'     => (float) $m->selling_rate,
            ])
            ->all();
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        $data = $this->validated($request);

        DB::transaction(function () use ($data) {
            $item = PriceListItem::create(collect($data)->except('packings')->all());
            $this->syncPackings($item, $data['packings'] ?? []);
        });

        return redirect()->back()->with('success', 'Product added to the price list.');
    }

    public function update(Request $request, PriceListItem $priceListItem): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        $data = $this->validated($request);

        DB::transaction(function () use ($priceListItem, $data) {
            $priceListItem->update(collect($data)->except('packings')->all());
            $this->syncPackings($priceListItem, $data['packings'] ?? []);
        });

        return redirect()->back()->with('success', 'Price list updated.');
    }

    public function destroy(Request $request, PriceListItem $priceListItem): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        $name = $priceListItem->name;
        $priceListItem->delete();

        return redirect()->back()->with('success', "\"{$name}\" removed from the price list.");
    }

    /**
     * First run: start the list from the products sales may already sell, so
     * the admin fills in packings rather than typing every name again.
     */
    public function import(Request $request): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        $companyId = app(CurrentCompany::class)->id();
        $added = 0;

        DB::transaction(function () use ($companyId, &$added) {
            foreach ($this->importable() as $material) {
                $item = PriceListItem::create([
                    'raw_material_id' => $material->id,
                    'name'            => $material->nameForCompany($companyId),
                    'description'     => $material->description,
                    'gst_percent'     => $material->gst ?: 18,
                ]);

                // Pointed at the product, so the printed rate follows
                // whatever inventory says today.
                $item->packings()->create([
                    'packing'         => $material->unit ?: 'unit',
                    'raw_material_id' => $material->id,
                    'rate'            => (float) $material->selling_rate,
                ]);

                $added++;
            }
        });

        return redirect()->back()->with(
            'success',
            $added === 0
                ? 'Every priced product is already on the list.'
                : "Brought in {$added} product".($added === 1 ? '' : 's').'. Fill in each one\'s packings and MRP.',
        );
    }

    public function updateSettings(Request $request): RedirectResponse
    {
        abort_unless($this->isAdmin($request), 403);

        $rules = [];
        foreach (array_keys(self::SETTING_DEFAULTS) as $key) {
            $rules[$key] = ['nullable', 'string', 'max:1000'];
        }

        $data = $request->validate($rules);

        AppSetting::setMany(collect($data)->map(fn ($v) => trim((string) $v))->all());

        return redirect()->back()->with('success', 'Price list cover saved.');
    }

    /**
     * Products already on the list, newest ordering kept stable. Anything
     * whose linked material sits in a category sales may not see is dropped,
     * so the printed list can never leak a product sales cannot offer.
     *
     * @return Collection<int, PriceListItem>
     */
    private function items(): Collection
    {
        $hidden = SalesCatalogue::hiddenCategories();
        $isHidden = fn (?string $category) => $hidden->contains(mb_strtolower(trim((string) $category)));

        return PriceListItem::query()
            ->with(['packings.rawMaterial', 'rawMaterial'])
            ->orderBy('is_bulk')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->reject(fn ($item) => $item->rawMaterial && $isHidden($item->rawMaterial->category))
            // Headings come from live inventory groups, so they can only be
            // sorted once the rows are in hand.
            ->sortBy(fn ($item) => [$item->is_bulk ? 1 : 0, $item->heading(), $item->sort_order, $item->id])
            ->values();
    }

    /**
     * Priced, sales-visible products that are not on the list yet.
     *
     * @return Collection<int, \App\Models\RawMaterial>
     */
    private function importable(): Collection
    {
        $already = PriceListItem::query()->whereNotNull('raw_material_id')->pluck('raw_material_id')->flip();

        return SalesCatalogue::pricedProducts()->reject(fn ($m) => $already->has($m->id))->values();
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:255'],
            // Blank means "follow the product's group / category".
            'section'         => ['nullable', 'string', 'max:120'],
            'raw_material_id' => ['nullable', 'integer', 'exists:raw_materials,id'],
            'gst_percent'     => ['required', 'numeric', 'min:0', 'max:100'],
            'is_bulk'         => ['boolean'],
            'is_active'       => ['boolean'],
            'sort_order'      => ['nullable', 'integer', 'min:0', 'max:9999'],

            'packings'                   => ['array', 'max:20'],
            'packings.*.packing'         => ['required', 'string', 'max:60'],
            'packings.*.raw_material_id' => ['nullable', 'integer', 'exists:raw_materials,id'],
            'packings.*.mrp'             => ['nullable', 'numeric', 'min:0'],
            // Only needed when the packing has no product to take it from.
            'packings.*.rate'            => ['nullable', 'numeric', 'min:0'],
            'packings.*.qty_per_box'     => ['nullable', 'integer', 'min:0'],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function syncPackings(PriceListItem $item, array $rows): void
    {
        $item->packings()->delete();

        foreach (array_values($rows) as $i => $row) {
            $item->packings()->create([
                'packing'         => $row['packing'],
                'raw_material_id' => $row['raw_material_id'] ?? null,
                'mrp'             => $row['mrp'] ?? null,
                'rate'            => $row['rate'] ?? 0,
                'qty_per_box'     => $row['qty_per_box'] ?? null,
                'sort_order'      => $i,
            ]);
        }
    }

    /**
     * @return array<string, string>
     */
    private function settings(): array
    {
        $out = ['company' => app(CurrentCompany::class)->model()?->name ?? config('app.name')];

        foreach (self::SETTING_DEFAULTS as $key => $default) {
            $out[$key] = (string) AppSetting::get($key, $default);
        }

        return $out;
    }

    private function isAdmin(Request $request): bool
    {
        $request->user()?->loadMissing('roles');

        return $request->user()?->roles->first()?->slug === 'admin';
    }

    /**
     * The logo as a data URI. dompdf resolves local paths inconsistently
     * depending on where it runs from, and inlining always works.
     */
    private function logo(): ?string
    {
        foreach (['ubc-logo.png', 'icon-512.png'] as $file) {
            $path = public_path($file);

            if (is_file($path)) {
                return 'data:image/png;base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return null;
    }
}
