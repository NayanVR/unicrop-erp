<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\ProductPhoto;
use App\Models\ProductPhotoFolder;
use App\Models\ProductRate;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class ProductPhotoController extends Controller
{
    private function storageDisk(): string
    {
        return config('filesystems.default') === 's3' ? 's3' : 'public';
    }

    public function index(): Response
    {
        $photos = ProductPhoto::with('party:id,name')
            ->orderBy('party_id')
            ->orderBy('our_brand')
            ->orderBy('party_brand')
            ->orderBy('packing_size')
            ->get()
            ->map(fn ($p) => [
                'id'           => $p->id,
                'party_id'     => $p->party_id,
                'party_name'   => $p->party?->name,
                'our_brand'    => $p->our_brand,
                'party_brand'  => $p->party_brand,
                'packing_size' => $p->packing_size,
                'photo_url'    => $p->photo_url,
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
        Log::error('[gallery-debug] store() reached', [
            'has_photo' => $request->hasFile('photo'),
            'disk'      => config('filesystems.default'),
            'endpoint'  => config('filesystems.disks.s3.endpoint'),
        ]);

        $data = $request->validate([
            'party_id'     => 'nullable|exists:parties,id',
            'our_brand'    => 'required|string|max:255',
            'party_brand'  => 'nullable|string|max:255',
            'packing_size' => 'nullable|string|max:100',
            'photo'        => 'required|image|mimes:jpg,jpeg,png,webp|max:8192',
        ]);

        Log::error('[gallery-debug] validation passed');

        $disk = $this->storageDisk();

        if (! empty($data['party_id'])) {
            $party = Party::find($data['party_id']);
            $folderName = Str::slug($party?->name ?? 'party-' . $data['party_id']);
        } else {
            $folderName = 'our-brand';
        }

        $productLabel = ! empty($data['party_brand']) ? $data['party_brand'] : $data['our_brand'];
        $ext          = $request->file('photo')->getClientOriginalExtension() ?: 'jpg';
        $filename     = Str::slug($productLabel) . '_' . Str::random(8) . '.' . strtolower($ext);
        $path         = 'product-photos/' . $folderName . '/' . $filename;

        Log::error('[gallery-debug] attempting S3 put', ['disk' => $disk, 'path' => $path]);

        try {
            Storage::disk($disk)->put(
                $path,
                file_get_contents($request->file('photo')->getRealPath()),
            );
            Log::error('[gallery-debug] S3 put succeeded');
        } catch (\Throwable $e) {
            Log::error('Photo upload failed', [
                'disk'  => $disk,
                'path'  => $path,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', 'Upload failed: ' . $e->getMessage());
        }

        ProductPhoto::create([
            'party_id'     => $data['party_id'] ?? null,
            'our_brand'    => $data['our_brand'],
            'party_brand'  => $data['party_brand'] ?? null,
            'packing_size' => $data['packing_size'] ?? null,
            'photo_path'   => $path,
            'uploaded_by'  => $request->user()?->id,
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
        $disk = $this->storageDisk();

        try {
            Storage::disk($disk)->delete($photo->photo_path);
        } catch (\Throwable $e) {
            Log::warning('Photo file delete failed', ['disk' => $disk, 'path' => $photo->photo_path, 'error' => $e->getMessage()]);
        }

        $photo->delete();

        return redirect()->back()->with('success', 'Photo deleted.');
    }
}
