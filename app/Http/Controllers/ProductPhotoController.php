<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\ProductPhoto;
use App\Models\ProductPhotoFolder;
use App\Models\ProductRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductPhotoController extends Controller
{
    public function index(): Response
    {
        $photos = ProductPhoto::with('party:id,name')
            ->orderBy('party_id')
            ->orderBy('our_brand')
            ->orderBy('party_brand')
            ->orderBy('packing_size')
            ->get()
            ->map(fn ($p) => [
                'id'          => $p->id,
                'party_id'    => $p->party_id,
                'party_name'  => $p->party?->name,
                'our_brand'   => $p->our_brand,
                'party_brand' => $p->party_brand,
                'packing_size' => $p->packing_size,
                'photo_url'   => $p->photo_url,
            ]);

        $folders = ProductPhotoFolder::with('party:id,name')
            ->orderBy('id')
            ->get()
            ->map(fn ($f) => [
                'id'         => $f->id,
                'party_id'   => $f->party_id,
                'party_name' => $f->party?->name,
            ]);

        $parties = Party::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        $ourBrands = ProductRate::select('our_brand')
            ->distinct()
            ->orderBy('our_brand')
            ->pluck('our_brand');

        $partyRates = ProductRate::whereNotNull('party_brand')
            ->select('party_id', 'our_brand', 'party_brand', 'packing_size')
            ->orderBy('party_brand')
            ->get();

        $packingSizes = ProductRate::select('packing_size')
            ->distinct()
            ->orderBy('packing_size')
            ->pluck('packing_size');

        return Inertia::render('erp/design/gallery', [
            'photos'       => $photos,
            'folders'      => $folders,
            'parties'      => $parties,
            'ourBrands'    => $ourBrands,
            'partyRates'   => $partyRates,
            'packingSizes' => $packingSizes,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'party_id'    => 'nullable|exists:parties,id',
            'our_brand'   => 'required|string|max:255',
            'party_brand' => 'nullable|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'photo'       => 'required|image|mimes:jpg,jpeg,png,webp|max:8192',
        ]);

        $path = $request->file('photo')->store('product-photos', 'public');

        ProductPhoto::create([
            'party_id'    => $request->input('party_id') ?: null,
            'our_brand'   => $request->input('our_brand'),
            'party_brand' => $request->input('party_brand') ?: null,
            'packing_size' => $request->input('packing_size') ?: null,
            'photo_path'  => $path,
            'uploaded_by' => $request->user()?->id,
        ]);

        return redirect()->back()->with('success', 'Photo uploaded successfully.');
    }

    public function storeFolder(Request $request): RedirectResponse
    {
        $request->validate([
            'party_id' => 'required|exists:parties,id',
        ]);

        ProductPhotoFolder::firstOrCreate(
            ['party_id' => $request->input('party_id')],
            ['created_by' => $request->user()?->id],
        );

        return redirect()->back()->with('success', 'Folder created.');
    }

    public function destroy(ProductPhoto $photo): RedirectResponse
    {
        Storage::disk('public')->delete($photo->photo_path);
        $photo->delete();

        return redirect()->back()->with('success', 'Photo deleted.');
    }
}
