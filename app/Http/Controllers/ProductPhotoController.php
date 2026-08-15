<?php

namespace App\Http\Controllers;

use App\Models\Party;
use App\Models\ProductPhoto;
use App\Models\ProductPhotoFolder;
use App\Models\ProductRate;
use App\Models\RawMaterial;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductPhotoController extends Controller
{
    private function storageDisk(): string
    {
        return config('filesystems.default') === 's3' ? 's3' : 'public';
    }

    public function index(): Response
    {
        $user = request()->user();
        $user?->loadMissing('roles');
        $isSales = $user?->roles->first()?->slug === 'sales';
        $myPartyIds = $isSales
            ? Party::where('created_by', $user->id)->pluck('id')->all()
            : [];

        $photos = ProductPhoto::with(['party:id,name', 'uploader:id,name', 'updater:id,name'])
            ->orderBy('party_id')
            ->orderBy('our_brand')
            ->orderBy('party_brand')
            ->get()
            ->map(fn($p) => [
                'can_modify'     => ! $isSales
                    || ($p->party_id && in_array($p->party_id, $myPartyIds))
                    || (int) $p->uploaded_by === (int) $user->id,
                'id'             => $p->id,
                'party_id'       => $p->party_id,
                'party_name'     => $p->party?->name,
                'our_brand'      => $p->our_brand,
                'party_brand'    => $p->party_brand,
                'packing_size'   => $p->packing_size,
                'mrp'            => $p->mrp,
                'sizes'          => $p->sizes ?? [['packing_size' => $p->packing_size ?? '', 'mrp' => $p->mrp ?? '']],
                'bottle_jar'     => $p->bottle_jar,
                'cap_color'      => $p->cap_color,
                'photo_url'      => $p->photo_url,
                'uploaded_by'    => $p->uploader?->name,
                'updated_by'     => $p->updater?->name,
                'updated_at'     => $p->updated_at?->toDateString(),
            ]);

        $folders = ProductPhotoFolder::with('party:id,name')
            ->orderBy('id')
            ->get()
            ->map(fn($f) => [
                'id' => $f->id,
                'party_id' => $f->party_id,
                'party_name' => $f->party?->name,
            ]);

        $parties = Party::where('is_active', true)
            ->whereIn('type', ['customer', 'both'])
            ->orderBy('name')
            ->get(['id', 'name']);

        $ourBrands = RawMaterial::where('is_active', true)
            ->whereRaw("LOWER(category) LIKE ? AND LOWER(category) NOT LIKE ?", ['%finish%good%', '%semi%'])
            ->select('name')
            ->orderBy('name')
            ->pluck('name');

        // Debug: all distinct categories so we can verify the exact name
        $allCategories = RawMaterial::whereNotNull('category')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        $partyRates = ProductRate::whereNotNull('party_brand')
            ->select('party_id', 'our_brand', 'party_brand', 'packing_size')
            ->orderBy('party_brand')
            ->get();

        $packingSizes = ProductRate::select('packing_size')
            ->distinct()
            ->orderBy('packing_size')
            ->pluck('packing_size');

        // Bottle/Jar options — same finish-goods category as ourBrands, for autofill
        $bottleJarOptions = RawMaterial::where('is_active', true)
            ->whereRaw("LOWER(category) LIKE ?", ['%bottle%'])
            ->orWhere(function ($q) {
                $q->where('is_active', true)->whereRaw("LOWER(category) LIKE ?", ['%jar%']);
            })
            ->select('name')
            ->orderBy('name')
            ->pluck('name');

        // Also include existing saved bottle_jar values
        $savedBottleJars = ProductPhoto::whereNotNull('bottle_jar')
            ->distinct()
            ->orderBy('bottle_jar')
            ->pluck('bottle_jar');

        $bottleJarOptions = $bottleJarOptions->merge($savedBottleJars)->unique()->sort()->values();

        $capColorOptions = ProductPhoto::whereNotNull('cap_color')
            ->distinct()
            ->orderBy('cap_color')
            ->pluck('cap_color');

        // Brand → bottle name lookup from filling config
        $brandBottleMap = \App\Models\ProductFillingConfig::with('bottle:id,name')
            ->whereNotNull('bottle_id')
            ->get(['our_brand', 'bottle_id'])
            ->mapWithKeys(fn ($c) => [$c->our_brand => $c->bottle?->name])
            ->filter();

        return Inertia::render('erp/design/gallery', [
            'photos' => $photos,
            'folders' => $folders,
            'parties' => $parties,
            'ourBrands' => $ourBrands,
            'allCategories' => $allCategories,
            'partyRates' => $partyRates,
            'packingSizes' => $packingSizes,
            'bottleJarOptions' => $bottleJarOptions,
            'capColorOptions' => $capColorOptions,
            'brandBottleMap' => $brandBottleMap,
        ]);
    }

    public function show(Request $request, ProductPhoto $photo)
    {
        // Version tag from the stored path + updated_at, so the browser can
        // cache aggressively but still pick up a re-uploaded image.
        $etag = '"' . md5($photo->photo_path . '|' . $photo->updated_at) . '"';
        $cacheHeaders = [
            'ETag'          => $etag,
            'Cache-Control' => 'public, max-age=604800', // 7 days
        ];

        // Browser already holds the current version — answer without touching S3.
        if (trim((string) $request->headers->get('If-None-Match')) === $etag) {
            return response('', 304, $cacheHeaders);
        }

        /** @var FilesystemAdapter $storage */
        $storage = Storage::disk($this->storageDisk());

        try {
            $contents = $storage->get($photo->photo_path);
        } catch (\Throwable $e) {
            Log::warning('Product photo fetch failed', ['id' => $photo->id, 'path' => $photo->photo_path, 'error' => $e->getMessage()]);
            $contents = null;
        }

        if ($contents === null) {
            abort(404);
        }

        $ext = strtolower(pathinfo($photo->photo_path, PATHINFO_EXTENSION));
        $mime = match ($ext) {
            'webp' => 'image/webp',
            'png'  => 'image/png',
            default => 'image/jpeg',
        };

        return response($contents, 200, $cacheHeaders + ['Content-Type' => $mime]);
    }

    public function store(Request $request): RedirectResponse
    {
        Log::error('[gallery-debug] store() reached', [
            'has_photo' => $request->hasFile('photo'),
            'disk' => config('filesystems.default'),
            'endpoint' => config('filesystems.disks.s3.endpoint'),
        ]);

        $data = $request->validate([
            'party_id'              => 'nullable|exists:parties,id',
            'our_brand'             => 'required|string|max:255',
            'party_brand'           => 'nullable|string|max:255',
            'sizes'                 => 'required|array|min:1',
            'sizes.*.packing_size'  => 'nullable|string|max:100',
            'sizes.*.mrp'           => 'nullable|string|max:50',
            'bottle_jar'            => 'nullable|string|max:150',
            'cap_color'             => 'nullable|string|max:100',
            'photo'                 => 'required|image|mimes:jpg,jpeg,png,webp|max:8192',
        ]);

        Log::error('[gallery-debug] validation passed');

        $disk = $this->storageDisk();

        if (!empty($data['party_id'])) {
            $party = Party::find($data['party_id']);
            $folderName = Str::slug($party?->name ?? 'party-' . $data['party_id']);
        } else {
            $folderName = 'our-brand';
        }

        $productLabel = !empty($data['party_brand']) ? $data['party_brand'] : $data['our_brand'];
        $imgExt = function_exists('imagewebp') ? 'webp' : 'jpg';
        $filename = Str::slug($productLabel) . '_' . Str::random(8) . '.' . $imgExt;
        $path = 'product-photos/' . $folderName . '/' . $filename;

        Log::error('[gallery-debug] attempting S3 put', ['disk' => $disk, 'path' => $path]);

        try {
            $compressed = $this->compressImage($request->file('photo')->getRealPath());
            Storage::disk($disk)->put($path, $compressed);
            Log::error('[gallery-debug] S3 put succeeded');
        } catch (\Throwable $e) {
            Log::error('Photo upload failed', [
                'disk' => $disk,
                'path' => $path,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->with('error', 'Upload failed: ' . $e->getMessage());
        }

        $firstSize = $data['sizes'][0] ?? [];
        ProductPhoto::create([
            'party_id'    => $data['party_id'] ?? null,
            'our_brand'   => $data['our_brand'],
            'party_brand' => $data['party_brand'] ?? null,
            'packing_size'=> ($firstSize['packing_size'] ?? null) ?: null,
            'mrp'         => ($firstSize['mrp'] ?? null) ?: null,
            'sizes'       => $data['sizes'],
            'bottle_jar'  => ($data['bottle_jar'] ?? null) ?: null,
            'cap_color'   => ($data['cap_color'] ?? null) ?: null,
            'photo_path'  => $path,
            'uploaded_by' => $request->user()?->id,
        ]);

        return redirect()->back()->with('success', 'Product uploaded successfully.');
    }

    /**
     * Sales users may only modify photos of parties they created
     * (or photos they uploaded themselves). Other roles are unrestricted.
     */
    private function authorizePhotoModify(Request $request, ProductPhoto $photo): void
    {
        $user = $request->user();
        $user->loadMissing('roles');
        if ($user->roles->first()?->slug !== 'sales') {
            return;
        }

        $ownsParty  = $photo->party_id && Party::where('id', $photo->party_id)->where('created_by', $user->id)->exists();
        $ownsUpload = (int) $photo->uploaded_by === (int) $user->id;

        if (! $ownsParty && ! $ownsUpload) {
            abort(403, 'You can only edit or delete products of your own parties.');
        }
    }

    public function update(Request $request, ProductPhoto $photo): RedirectResponse
    {
        $this->authorizePhotoModify($request, $photo);

        $data = $request->validate([
            'our_brand'             => 'required|string|max:255',
            'party_brand'           => 'nullable|string|max:255',
            'packing_size'          => 'nullable|string|max:100',
            'mrp'                   => 'nullable|string|max:50',
            'sizes'                 => 'nullable|array',
            'sizes.*.packing_size'  => 'nullable|string|max:100',
            'sizes.*.mrp'           => 'nullable|string|max:50',
            'bottle_jar'            => 'nullable|string|max:150',
            'cap_color'             => 'nullable|string|max:100',
            'photo'                 => 'nullable|image|mimes:jpg,jpeg,png,webp|max:8192',
        ]);

        if ($request->hasFile('photo')) {
            $disk = $this->storageDisk();

            try {
                Storage::disk($disk)->delete($photo->photo_path);
            } catch (\Throwable $e) {
                Log::warning('Old photo delete failed on update', ['path' => $photo->photo_path, 'error' => $e->getMessage()]);
            }

            if ($photo->party_id) {
                $party = Party::find($photo->party_id);
                $folderName = Str::slug($party?->name ?? 'party-' . $photo->party_id);
            } else {
                $folderName = 'our-brand';
            }

            $productLabel = !empty($data['party_brand']) ? $data['party_brand'] : $data['our_brand'];
            $imgExt = function_exists('imagewebp') ? 'webp' : 'jpg';
            $filename = Str::slug($productLabel) . '_' . Str::random(8) . '.' . $imgExt;
            $path = 'product-photos/' . $folderName . '/' . $filename;

            try {
                $compressed = $this->compressImage($request->file('photo')->getRealPath());
                Storage::disk($disk)->put($path, $compressed);
            } catch (\Throwable $e) {
                Log::error('Photo update upload failed', ['path' => $path, 'error' => $e->getMessage()]);
                return redirect()->back()->with('error', 'Upload failed: ' . $e->getMessage());
            }

            $photo->photo_path = $path;
        }

        $photo->our_brand    = $data['our_brand'];
        $photo->party_brand  = $data['party_brand'] ?? null;
        $photo->bottle_jar   = ($data['bottle_jar'] ?? null) ?: null;
        $photo->cap_color    = ($data['cap_color'] ?? null) ?: null;

        if (!empty($data['sizes'])) {
            $firstSize = $data['sizes'][0];
            $photo->packing_size = ($firstSize['packing_size'] ?? null) ?: null;
            $photo->mrp          = ($firstSize['mrp'] ?? null) ?: null;
            $photo->sizes        = $data['sizes'];
        } else {
            $photo->packing_size = $data['packing_size'] ?? null;
            $photo->mrp          = $data['mrp'] ?? null;
        }

        $photo->updated_by   = auth()->id();
        $photo->save();

        return redirect()->back()->with('success', 'Photo updated successfully.');
    }

    /**
     * Compress an image to ≤5 KB WebP with best possible clarity.
     * Starts at quality 85, resizes to fit 300×300, then lowers quality until target size is met.
     */
    private function compressImage(string $sourcePath): string
    {
        $targetBytes = 50 * 1024; // 50 KB — sharp on screen, loads in <0.5s on 3G
        $maxDim = 800;
        $useWebp = function_exists('imagewebp') && function_exists('imagecreatefromwebp');

        $info = getimagesize($sourcePath);
        $mime = $info['mime'] ?? '';

        $src = match ($mime) {
            'image/jpeg' => imagecreatefromjpeg($sourcePath),
            'image/png'  => imagecreatefrompng($sourcePath),
            'image/webp' => $useWebp ? imagecreatefromwebp($sourcePath) : imagecreatefromjpeg($sourcePath),
            default      => imagecreatefromjpeg($sourcePath),
        };

        $ow = imagesx($src);
        $oh = imagesy($src);

        $ratio = min($maxDim / $ow, $maxDim / $oh, 1.0);
        $nw = max(1, (int) round($ow * $ratio));
        $nh = max(1, (int) round($oh * $ratio));

        $dst = imagecreatetruecolor($nw, $nh);
        // White background (handles PNG transparency → JPEG)
        $white = imagecolorallocate($dst, 255, 255, 255);
        imagefill($dst, 0, 0, $white);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $ow, $oh);
        imagedestroy($src);

        $encode = $useWebp
            ? fn($quality) => imagewebp($dst, null, $quality)
            : fn($quality) => imagejpeg($dst, null, $quality);

        // Binary-search quality between 10 and 85
        $lo = 10;
        $hi = 85;
        $best = '';

        while ($lo <= $hi) {
            $mid = (int)(($lo + $hi) / 2);
            ob_start();
            $encode($mid);
            $data = ob_get_clean();

            if (strlen($data) <= $targetBytes) {
                $best = $data;
                $lo = $mid + 1;
            } else {
                $hi = $mid - 1;
            }
        }

        // Fallback: if even quality 10 exceeded target, use it anyway
        if ($best === '') {
            ob_start();
            $encode(10);
            $best = ob_get_clean();
        }

        imagedestroy($dst);

        return $best;
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
        $this->authorizePhotoModify(request(), $photo);

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
