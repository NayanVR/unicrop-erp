<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\PackingSize;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TransportReportController extends Controller
{
    /** Standard pieces per box/bag/carba when the admin hasn't overridden it. */
    private const STD_PCS_PER_BOX = [
        '5ltr' => 2,   '5kg' => 2,
        '1ltr' => 10,  '1kg' => 10,
        '500ml' => 20, '500gm' => 20,
        '250ml' => 40, '250gm' => 40,
        '100ml' => 50, '100gm' => 50,
        '50ml' => 100, '50gm' => 100,
        '20ml' => 300, '20gm' => 300,
        '10ml' => 600, '10gm' => 600,
        '5ml' => 600,  '5gm' => 600,
        '10ltr' => 1, '20ltr' => 1, '50ltr' => 1, '200ltr' => 1,
        '10kg' => 1, '25kg' => 1, '50kg' => 1,
    ];

    public function index(Request $request): Response
    {
        $user = $request->user();
        $user->loadMissing('roles');
        $role = $user->roles->first()?->slug;

        // Sales, factory, accountant and admin only — design has no use for it.
        abort_if($role === 'design', 403);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to   = $request->date('to') ?? now()->endOfDay();

        $pcsOverrides = PackingSize::query()
            ->whereNotNull('pieces_per_box')
            ->pluck('pieces_per_box', 'name')
            ->mapWithKeys(fn ($v, $k) => [$this->normalizeSize($k) => (int) $v]);

        $query = Order::query()
            ->with(['items:id,order_id,our_brand,party_brand,packing_size,quantity,box_size,boxes_override'])
            ->whereIn('status', ['confirmed', 'dispatched', 'delivered'])
            ->whereBetween('order_date', [$from->copy()->startOfDay(), $to->copy()->endOfDay()]);

        // Sales users only account for their own orders; everyone else sees all.
        if ($role === 'sales') {
            $query->where('sales_user_id', $user->id);
        }

        $orders = $query->orderByDesc('order_date')->get();

        $rows = $orders->map(function (Order $o) use ($pcsOverrides) {
            $kg      = 0.0;
            $parcels = 0;
            $items   = [];

            foreach ($o->items as $item) {
                $qty      = (float) $item->quantity;
                $perPiece = $this->sizeInBaseUnits($item->packing_size);
                $itemKg   = $perPiece !== null ? $perPiece * $qty : 0.0;
                $kg      += $itemKg;

                $boxes    = $this->boxesFor($item, $pcsOverrides);
                $parcels += $boxes ?? 0;

                $items[] = [
                    'name'         => $item->party_brand ?: $item->our_brand,
                    'our_brand'    => $item->our_brand,
                    'packing_size' => $item->packing_size,
                    'quantity'     => $qty,
                    'kg'           => round($itemKg, 3),
                    'parcels'      => $boxes,
                ];
            }

            return [
                'order_id'       => $o->id,
                'order_number'   => $o->order_number,
                'order_date'     => $o->order_date?->format('Y-m-d'),
                'customer'       => $o->company_name,
                'destination'    => $o->destination,
                'status'         => $o->status,
                'transport_name' => trim((string) $o->transport_name) ?: 'Not assigned',
                'transport_type' => $o->transport_type,
                'total_amount'   => (float) $o->total_amount,
                'kg'             => round($kg, 3),
                'parcels'        => $parcels,
                'items'          => $items,
            ];
        });

        $transports = $rows
            ->groupBy('transport_name')
            ->map(fn ($group, $name) => [
                'transport_name' => $name,
                'transport_type' => $group->first()['transport_type'],
                'orders'         => $group->count(),
                'kg'             => round($group->sum('kg'), 3),
                'parcels'        => (int) $group->sum('parcels'),
                'amount'         => round($group->sum('total_amount'), 2),
                'rows'           => $group->values(),
            ])
            ->sortByDesc('amount')
            ->values();

        return Inertia::render('erp/transport-report/index', [
            'pageTitle'  => 'Transport Report',
            'transports' => $transports,
            'totals'     => [
                'orders'  => $rows->count(),
                'kg'      => round($rows->sum('kg'), 3),
                'parcels' => (int) $rows->sum('parcels'),
                'amount'  => round($rows->sum('total_amount'), 2),
            ],
            'filters' => [
                'from' => $from->format('Y-m-d'),
                'to'   => $to->format('Y-m-d'),
            ],
        ]);
    }

    /** Boxes for one line: an explicit override wins, else qty / pcs-per-box. */
    private function boxesFor($item, $overrides): ?int
    {
        if ($item->boxes_override !== null && $item->boxes_override > 0) {
            return (int) $item->boxes_override;
        }

        $key = $this->normalizeSize((string) $item->packing_size);
        $ppb = $item->box_size ?: ($overrides[$key] ?? self::STD_PCS_PER_BOX[$key] ?? null);

        if (! $ppb || $ppb <= 0) {
            return null;
        }

        return (int) ceil((float) $item->quantity / $ppb);
    }

    /** "1ltr" / "500ml" / "250gm" → litres or kg per piece. */
    private function sizeInBaseUnits(?string $packingSize): ?float
    {
        if (! $packingSize) {
            return null;
        }

        $s = $this->normalizeSize($packingSize);
        if (! preg_match('/^([\d.]+)(ltr|l|ml|kg|gm|g|mg)$/', $s, $m)) {
            return null;
        }

        $n = (float) $m[1];

        return match ($m[2]) {
            'ltr', 'l', 'kg' => $n,
            'ml', 'gm', 'g'  => $n / 1000,
            'mg'             => $n / 1_000_000,
            default          => null,
        };
    }

    private function normalizeSize(string $s): string
    {
        $s = mb_strtolower(preg_replace('/\s+/', '', $s));
        $s = preg_replace('/litre|liter|litres|liters/', 'ltr', $s);
        $s = preg_replace('/kilogram|kilograms|kgs\b/', 'kg', $s);
        $s = preg_replace('/gram|grams\b/', 'gm', $s);

        return preg_replace('/millilitre|milliliter|millilitres|milliliters|mls\b/', 'ml', $s);
    }
}
