<?php

namespace App\Http\Controllers;

use App\Models\CompanyAsset;
use App\Models\User;
use App\Services\RecordChangeLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class AssetController extends Controller
{
    /**
     * Who may open the asset register: admins, and anyone an admin has ticked
     * the box for. Being able to manage implies being able to look.
     */
    public static function canView(?User $user): bool
    {
        return self::has($user, 'assets_view') || self::canManage($user);
    }

    /** Who may add, edit or remove an entry. */
    public static function canManage(?User $user): bool
    {
        return self::has($user, 'assets_manage');
    }

    private static function has(?User $user, string $permission): bool
    {
        if (! $user) {
            return false;
        }

        $user->loadMissing('roles');

        if ($user->roles->first()?->slug === 'admin') {
            return true;
        }

        return in_array($permission, $user->permissions ?? [], true);
    }

    public function index(Request $request): Response
    {
        $user = $request->user();
        abort_unless(self::canView($user), 403);

        $assets = CompanyAsset::query()
            ->with('creator:id,name')
            ->orderBy('category')
            ->orderBy('name')
            ->get();

        // "How much of all this do we have?" — one row per category, so the
        // page answers that before anyone scrolls the table.
        $summary = $assets
            ->groupBy('category')
            ->map(fn ($group, $category) => [
                'category' => $category,
                'entries'  => $group->count(),
                'quantity' => (float) $group->sum('quantity'),
                'value'    => (float) $group->sum('purchase_cost'),
            ])
            ->sortByDesc('quantity')
            ->values();

        return Inertia::render('erp/assets/index', [
            'pageTitle'  => 'Assets',
            'assets'     => $assets,
            'summary'    => $summary,
            'categories' => CompanyAsset::CATEGORIES,
            'statuses'   => CompanyAsset::STATUSES,
            'canManage'  => self::canManage($user),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        abort_unless(self::canManage($request->user()), 403);

        $asset = CompanyAsset::make($this->validated($request));
        $asset->created_by = $request->user()->id;
        $asset->save();

        return redirect()->back()->with('success', "\"{$asset->name}\" added to assets.");
    }

    public function update(Request $request, CompanyAsset $asset): RedirectResponse
    {
        abort_unless(self::canManage($request->user()), 403);

        $data   = $this->validated($request);
        $before = $this->snapshot($asset);

        $asset->fill($data);
        $asset->last_changes = RecordChangeLog::build(
            $before,
            $this->snapshot($asset),
            by: $request->user()->name,
        ) ?? $asset->last_changes;
        $asset->save();

        return redirect()->back()->with('success', "\"{$asset->name}\" updated.");
    }

    public function destroy(Request $request, CompanyAsset $asset): RedirectResponse
    {
        abort_unless(self::canManage($request->user()), 403);

        $name = $asset->name;
        $asset->delete();

        return redirect()->back()->with('success', "\"{$name}\" removed from assets.");
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name'          => ['required', 'string', 'max:255'],
            'category'      => ['required', 'string', 'max:100'],
            'code'          => ['nullable', 'string', 'max:100'],
            'quantity'      => ['required', 'numeric', 'min:0'],
            'unit'          => ['required', 'string', 'max:20'],
            'location'      => ['nullable', 'string', 'max:255'],
            'assigned_to'   => ['nullable', 'string', 'max:255'],
            'status'        => ['required', Rule::in(array_keys(CompanyAsset::STATUSES))],
            'purchase_date' => ['nullable', 'date'],
            'purchase_cost' => ['nullable', 'numeric', 'min:0'],
            'notes'         => ['nullable', 'string', 'max:2000'],
        ]);
    }

    /**
     * The fields worth telling someone about when they change.
     *
     * @return array<string, mixed>
     */
    private function snapshot(CompanyAsset $asset): array
    {
        return [
            'Name'        => $asset->name,
            'Category'    => $asset->category,
            'Code'        => $asset->code,
            'Quantity'    => trim($asset->quantity.' '.$asset->unit),
            'Location'    => $asset->location,
            'Assigned to' => $asset->assigned_to,
            'Status'      => CompanyAsset::STATUSES[$asset->status] ?? $asset->status,
            'Bought on'   => $asset->purchase_date?->format('d M Y'),
            'Cost'        => $asset->purchase_cost,
            'Notes'       => $asset->notes,
        ];
    }
}
