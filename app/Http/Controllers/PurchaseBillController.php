<?php

namespace App\Http\Controllers;

use App\Models\PurchaseBill;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseBillController extends Controller
{
    public function index(): Response
    {
        $bills = PurchaseBill::query()
            ->with('user:id,name')
            ->orderByDesc('bill_date')
            ->orderByDesc('id')
            ->get();

        $summary = [
            'total' => $bills->sum(fn ($b) => (float) $b->amount + (float) $b->gst_amount),
            'unpaid' => $bills->where('payment_status', 'unpaid')->sum(fn ($b) => (float) $b->amount + (float) $b->gst_amount),
            'paid' => $bills->where('payment_status', 'paid')->sum(fn ($b) => (float) $b->amount + (float) $b->gst_amount),
        ];

        return Inertia::render('erp/purchase-bills/index', [
            'pageTitle' => 'Purchase Bills',
            'bills' => $bills,
            'summary' => $summary,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vendor_name' => 'required|string|max:255',
            'bill_number' => 'nullable|string|max:100',
            'bill_date' => 'required|date',
            'amount' => 'required|numeric|min:0',
            'gst_amount' => 'nullable|numeric|min:0',
            'payment_status' => 'required|in:unpaid,partial,paid',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
        ]);

        PurchaseBill::create([
            ...$data,
            'user_id' => $request->user()?->id,
        ]);

        return redirect()->back()->with('success', 'Bill added.');
    }

    public function update(Request $request, PurchaseBill $bill): RedirectResponse
    {
        $data = $request->validate([
            'vendor_name' => 'required|string|max:255',
            'bill_number' => 'nullable|string|max:100',
            'bill_date' => 'required|date',
            'amount' => 'required|numeric|min:0',
            'gst_amount' => 'nullable|numeric|min:0',
            'payment_status' => 'required|in:unpaid,partial,paid',
            'category' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:1000',
        ]);

        $bill->update($data);

        return redirect()->back()->with('success', 'Bill updated.');
    }

    public function destroy(PurchaseBill $bill): RedirectResponse
    {
        $bill->delete();

        return redirect()->back()->with('success', 'Bill deleted.');
    }
}
