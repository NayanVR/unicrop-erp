import {
    destroy as billDestroy,
    store as billStore,
    update as billUpdate,
} from '@/routes/purchase-bills';
import { Head, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Bill = {
    id: number;
    vendor_name: string;
    bill_number?: string | null;
    bill_date: string;
    amount: string | number;
    gst_amount: string | number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    category?: string | null;
    notes?: string | null;
    user?: { id: number; name: string } | null;
    created_at: string;
};

type Summary = { total: number; unpaid: number; paid: number };

type Props = {
    bills: Bill[];
    summary: Summary;
};

type BillForm = {
    vendor_name: string;
    bill_number: string;
    bill_date: string;
    amount: string;
    gst_amount: string;
    payment_status: string;
    category: string;
    notes: string;
};

const STATUS_CLASS: Record<string, string> = {
    unpaid: 'badge amber',
    partial: 'badge sky',
    paid: 'badge teal',
};

const CATEGORIES = ['Raw Materials', 'Packaging', 'Labour', 'Utilities', 'Transport', 'Other'];

const formatAmt = (v: string | number) =>
    '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

const formatDate = (v: string) =>
    new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

export default function PurchaseBillsIndex({ bills, summary }: Props) {
    const [modal, setModal] = useState(false);
    const [editingBill, setEditingBill] = useState<Bill | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('all');

    const form = useForm<BillForm>({
        vendor_name: '',
        bill_number: '',
        bill_date: new Date().toISOString().slice(0, 10),
        amount: '',
        gst_amount: '0',
        payment_status: 'unpaid',
        category: '',
        notes: '',
    });

    const openNew = () => {
        form.reset();
        form.setData('bill_date', new Date().toISOString().slice(0, 10));
        form.clearErrors();
        setEditingBill(null);
        setModal(true);
    };

    const openEdit = (b: Bill) => {
        form.setData({
            vendor_name: b.vendor_name,
            bill_number: b.bill_number ?? '',
            bill_date: b.bill_date,
            amount: String(b.amount),
            gst_amount: String(b.gst_amount),
            payment_status: b.payment_status,
            category: b.category ?? '',
            notes: b.notes ?? '',
        });
        form.clearErrors();
        setEditingBill(b);
        setModal(true);
    };

    const save = () => {
        if (editingBill) {
            form.patch(billUpdate(editingBill.id).url, {
                preserveScroll: true,
                onSuccess: () => { setModal(false); form.reset(); setEditingBill(null); },
            });
        } else {
            form.post(billStore().url, {
                preserveScroll: true,
                onSuccess: () => { setModal(false); form.reset(); },
            });
        }
    };

    const deleteBill = (b: Bill) => {
        if (!confirm(`Delete bill from "${b.vendor_name}"?`)) return;
        form.delete(billDestroy(b.id).url, { preserveScroll: true });
    };

    const visibleBills = useMemo(() => {
        if (filterStatus === 'all') return bills;
        return bills.filter((b) => b.payment_status === filterStatus);
    }, [bills, filterStatus]);

    return (
        <>
            <Head title="Purchase Bills" />
            <div id="view-purchase-bills" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Purchase Bills</h1>
                        <p>Track vendor bills and payment status</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                        ＋ Add Bill
                    </button>
                </div>

                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    <div className="stat-card c-slate">
                        <div className="stat-icon si-slate">🧾</div>
                        <div className="stat-val">{bills.length}</div>
                        <div className="stat-label">Total Bills</div>
                        <div className="stat-sub neu">{formatAmt(summary.total)}</div>
                    </div>
                    <div className="stat-card c-amber">
                        <div className="stat-icon si-amber">⏳</div>
                        <div className="stat-val">
                            {bills.filter((b) => b.payment_status !== 'paid').length}
                        </div>
                        <div className="stat-label">Pending Payment</div>
                        <div className="stat-sub" style={{ color: 'var(--warning)' }}>
                            {formatAmt(summary.unpaid)}
                        </div>
                    </div>
                    <div className="stat-card c-green">
                        <div className="stat-icon si-green">✅</div>
                        <div className="stat-val">
                            {bills.filter((b) => b.payment_status === 'paid').length}
                        </div>
                        <div className="stat-label">Paid</div>
                        <div className="stat-sub up">{formatAmt(summary.paid)}</div>
                    </div>
                </div>

                <div className="filter-bar">
                    <h2>Bills</h2>
                    {(['all', 'unpaid', 'partial', 'paid'] as const).map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`pill${filterStatus === s ? ' active' : ''}`}
                            onClick={() => setFilterStatus(s)}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="card">
                    {visibleBills.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🧾</div>
                            <p>No bills found.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Vendor</th>
                                        <th>Bill #</th>
                                        <th>Date</th>
                                        <th>Amount</th>
                                        <th>GST</th>
                                        <th>Total</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleBills.map((b) => (
                                        <tr key={b.id}>
                                            <td>
                                                <div className="prod-name">{b.vendor_name}</div>
                                                {b.user && (
                                                    <div className="prod-detail">by {b.user.name}</div>
                                                )}
                                            </td>
                                            <td>{b.bill_number ?? '—'}</td>
                                            <td>{formatDate(b.bill_date)}</td>
                                            <td>{formatAmt(b.amount)}</td>
                                            <td>{formatAmt(b.gst_amount)}</td>
                                            <td>
                                                <strong>
                                                    {formatAmt(Number(b.amount) + Number(b.gst_amount))}
                                                </strong>
                                            </td>
                                            <td>{b.category ?? '—'}</td>
                                            <td>
                                                <span className={STATUS_CLASS[b.payment_status] ?? 'badge gray'}>
                                                    {b.payment_status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button className="btn sm" onClick={() => openEdit(b)}>
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn danger-xs"
                                                        onClick={() => deleteBill(b)}
                                                    >
                                                        Del
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ModalPortal>
            <div className={`modal-overlay${modal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '520px' }}>
                    <div className="modal-header">
                        <h2>{editingBill ? 'Edit Bill' : 'Add Purchase Bill'}</h2>
                        <button className="modal-close" onClick={() => setModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Vendor Name *</label>
                                <input
                                    type="text"
                                    value={form.data.vendor_name}
                                    onChange={(e) => form.setData('vendor_name', e.target.value)}
                                    placeholder="Supplier / Vendor"
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill Number</label>
                                <input
                                    type="text"
                                    value={form.data.bill_number}
                                    onChange={(e) => form.setData('bill_number', e.target.value)}
                                    placeholder="INV-001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill Date *</label>
                                <input
                                    type="date"
                                    value={form.data.bill_date}
                                    onChange={(e) => form.setData('bill_date', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Amount (excl. GST) *</label>
                                <input
                                    type="number"
                                    value={form.data.amount}
                                    onChange={(e) => form.setData('amount', e.target.value)}
                                    step="0.01" min="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>GST Amount</label>
                                <input
                                    type="number"
                                    value={form.data.gst_amount}
                                    onChange={(e) => form.setData('gst_amount', e.target.value)}
                                    step="0.01" min="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                >
                                    <option value="">— Select —</option>
                                    {CATEGORIES.map((c) => (
                                        <option key={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Payment Status *</label>
                                <select
                                    value={form.data.payment_status}
                                    onChange={(e) => form.setData('payment_status', e.target.value)}
                                >
                                    <option value="unpaid">Unpaid</option>
                                    <option value="partial">Partial</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea
                                    value={form.data.notes}
                                    onChange={(e) => form.setData('notes', e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={save} disabled={form.processing}>
                            {editingBill ? 'Update Bill' : 'Add Bill'}
                        </button>
                    </div>
                </div>
            </div>
            </ModalPortal>
        </>
    );
}
