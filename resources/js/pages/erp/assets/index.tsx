import { destroy as assetsDestroy, store as assetsStore, update as assetsUpdate } from '@/routes/assets';
import { router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';
import RecencyBadge, { type ChangeLog } from '@/components/recency-badge';

type Asset = {
    id: number;
    name: string;
    category: string;
    code: string | null;
    quantity: string | number;
    unit: string;
    location: string | null;
    assigned_to: string | null;
    status: string;
    purchase_date: string | null;
    purchase_cost: string | number | null;
    notes: string | null;
    creator?: { id: number; name: string } | null;
    created_at?: string;
    updated_at?: string;
    last_changes?: ChangeLog;
};

type SummaryRow = { category: string; entries: number; quantity: number; value: number };

type PageProps = {
    assets: Asset[];
    summary: SummaryRow[];
    categories: string[];
    statuses: Record<string, string>;
    canManage: boolean;
    flash?: { success?: string; error?: string };
};

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
    in_use:   { bg: '#dcfce7', fg: '#15803d' },
    idle:     { bg: '#f1f5f9', fg: '#475569' },
    repair:   { bg: '#fef9c3', fg: '#854d0e' },
    scrapped: { bg: '#fee2e2', fg: '#b91c1c' },
    sold:     { bg: '#e0e7ff', fg: '#4338ca' },
};

const emptyForm = {
    name: '',
    category: '',
    code: '',
    quantity: '1',
    unit: 'pcs',
    location: '',
    assigned_to: '',
    status: 'in_use',
    purchase_date: '',
    purchase_cost: '',
    notes: '',
};

const num = (v: string | number | null | undefined) => {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** 1250.5 → "1,250.5"; drops the decimals when there are none to show. */
const tidy = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function AssetsIndex() {
    const { assets, summary, categories, statuses, canManage, flash } = usePage<PageProps>().props;

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Asset | null>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [status, setStatus] = useState('');

    const { data, setData, post, patch, processing, reset, errors, clearErrors } = useForm(emptyForm);

    const openAdd = () => {
        reset();
        clearErrors();
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (a: Asset) => {
        clearErrors();
        setEditing(a);
        setData({
            name: a.name,
            category: a.category,
            code: a.code ?? '',
            quantity: String(num(a.quantity)),
            unit: a.unit,
            location: a.location ?? '',
            assigned_to: a.assigned_to ?? '',
            status: a.status,
            purchase_date: a.purchase_date ? a.purchase_date.slice(0, 10) : '',
            purchase_cost: a.purchase_cost != null ? String(num(a.purchase_cost)) : '',
            notes: a.notes ?? '',
        });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const done = { onSuccess: () => { setShowModal(false); reset(); } };

        if (editing) {
            patch(assetsUpdate(editing.id).url, done);
        } else {
            post(assetsStore().url, done);
        }
    };

    const remove = (a: Asset) => {
        if (!confirm(`Remove "${a.name}" from the asset register?`)) return;
        router.delete(assetsDestroy(a.id).url, { preserveScroll: true });
    };

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();

        return assets.filter((a) => {
            if (category && a.category !== category) return false;
            if (status && a.status !== status) return false;
            if (!q) return true;

            return [a.name, a.category, a.code, a.location, a.assigned_to, a.notes]
                .some((field) => (field ?? '').toLowerCase().includes(q));
        });
    }, [assets, search, category, status]);

    const totals = useMemo(() => ({
        entries:  visible.length,
        quantity: visible.reduce((sum, a) => sum + num(a.quantity), 0),
        value:    visible.reduce((sum, a) => sum + num(a.purchase_cost), 0),
    }), [visible]);

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Assets</h1>
                {canManage && <button className="btn-primary" onClick={openAdd}>+ Add Asset</button>}
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            {summary.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginBottom: 18 }}>
                    {summary.map((row) => (
                        <div
                            key={row.category}
                            className="stat-card"
                            onClick={() => setCategory(category === row.category ? '' : row.category)}
                            style={{ cursor: 'pointer', outline: category === row.category ? '2px solid var(--accent)' : undefined }}
                        >
                            <div className="stat-label">{row.category}</div>
                            <div className="stat-value">{tidy(row.quantity)}</div>
                            <div className="stat-sub">
                                {row.entries} entr{row.entries === 1 ? 'y' : 'ies'}
                                {row.value > 0 && ` · ₹${tidy(row.value)}`}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="card">
                <div className="card-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="search"
                        className="search-input"
                        placeholder="Search name, serial no, location, person…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">All categories</option>
                        {[...new Set([...categories, ...assets.map((a) => a.category)])].map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="">Any status</option>
                        {Object.entries(statuses).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--tx-muted)' }}>
                        {totals.entries} entr{totals.entries === 1 ? 'y' : 'ies'} · {tidy(totals.quantity)} items
                        {totals.value > 0 && ` · ₹${tidy(totals.value)}`}
                    </span>
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Category</th>
                            <th>Serial / Code</th>
                            <th style={{ textAlign: 'right' }}>Qty</th>
                            <th>Location</th>
                            <th>With</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Cost</th>
                            {canManage && <th></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.length === 0 && (
                            <tr>
                                <td colSpan={canManage ? 9 : 8} className="empty-row">
                                    {assets.length === 0
                                        ? 'Nothing in the asset register yet.'
                                        : 'No asset matches these filters.'}
                                </td>
                            </tr>
                        )}
                        {visible.map((a) => (
                            <tr key={a.id}>
                                <td className="font-medium">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        {a.name}
                                        <RecencyBadge createdAt={a.created_at} updatedAt={a.updated_at} changes={a.last_changes} />
                                    </span>
                                    {a.notes && (
                                        <div className="prod-detail" style={{ color: 'var(--tx-muted)' }}>{a.notes}</div>
                                    )}
                                </td>
                                <td>{a.category}</td>
                                <td>{a.code || <span className="text-muted">—</span>}</td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {tidy(num(a.quantity))} {a.unit}
                                </td>
                                <td>{a.location || <span className="text-muted">—</span>}</td>
                                <td>{a.assigned_to || <span className="text-muted">—</span>}</td>
                                <td>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '1px 8px',
                                        borderRadius: 10,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background: STATUS_COLOR[a.status]?.bg ?? '#f1f5f9',
                                        color: STATUS_COLOR[a.status]?.fg ?? '#475569',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {statuses[a.status] ?? a.status}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {a.purchase_cost != null ? `₹${tidy(num(a.purchase_cost))}` : <span className="text-muted">—</span>}
                                </td>
                                {canManage && (
                                    <td className="action-cell">
                                        <button className="btn-icon" onClick={() => openEdit(a)} title="Edit">✏️</button>
                                        <button className="btn-icon btn-danger-icon" onClick={() => remove(a)} title="Remove">🗑️</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalPortal>
                    <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editing ? 'Edit Asset' : 'Add Asset'}</h2>
                                <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                            </div>
                            <form onSubmit={submit} className="modal-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Name *</label>
                                        <input
                                            type="text"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="Dell Latitude 5420"
                                            required
                                        />
                                        {errors.name && <span className="field-error">{errors.name}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Category *</label>
                                        <input
                                            type="text"
                                            list="asset-categories"
                                            value={data.category}
                                            onChange={(e) => setData('category', e.target.value)}
                                            placeholder="Laptop / Computer"
                                            required
                                        />
                                        <datalist id="asset-categories">
                                            {[...new Set([...categories, ...assets.map((a) => a.category)])].map((c) => (
                                                <option key={c} value={c} />
                                            ))}
                                        </datalist>
                                        {errors.category && <span className="field-error">{errors.category}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Serial no / Asset code</label>
                                        <input
                                            type="text"
                                            value={data.code}
                                            onChange={(e) => setData('code', e.target.value)}
                                            placeholder="Serial, IMEI, chassis no…"
                                        />
                                        {errors.code && <span className="field-error">{errors.code}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Status *</label>
                                        <select value={data.status} onChange={(e) => setData('status', e.target.value)}>
                                            {Object.entries(statuses).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                        {errors.status && <span className="field-error">{errors.status}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Quantity *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={data.quantity}
                                            onChange={(e) => setData('quantity', e.target.value)}
                                            required
                                        />
                                        {errors.quantity && <span className="field-error">{errors.quantity}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Unit *</label>
                                        <input
                                            type="text"
                                            value={data.unit}
                                            onChange={(e) => setData('unit', e.target.value)}
                                            placeholder="pcs"
                                            required
                                        />
                                        {errors.unit && <span className="field-error">{errors.unit}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Location</label>
                                        <input
                                            type="text"
                                            value={data.location}
                                            onChange={(e) => setData('location', e.target.value)}
                                            placeholder="Office / Factory / Godown"
                                        />
                                        {errors.location && <span className="field-error">{errors.location}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>With whom</label>
                                        <input
                                            type="text"
                                            value={data.assigned_to}
                                            onChange={(e) => setData('assigned_to', e.target.value)}
                                            placeholder="Person holding it"
                                        />
                                        {errors.assigned_to && <span className="field-error">{errors.assigned_to}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Purchase date</label>
                                        <input
                                            type="date"
                                            value={data.purchase_date}
                                            onChange={(e) => setData('purchase_date', e.target.value)}
                                        />
                                        {errors.purchase_date && <span className="field-error">{errors.purchase_date}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label>Purchase cost (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={data.purchase_cost}
                                            onChange={(e) => setData('purchase_cost', e.target.value)}
                                        />
                                        {errors.purchase_cost && <span className="field-error">{errors.purchase_cost}</span>}
                                    </div>

                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Notes</label>
                                        <textarea
                                            rows={2}
                                            value={data.notes}
                                            onChange={(e) => setData('notes', e.target.value)}
                                            placeholder="Condition, warranty, anything worth remembering…"
                                        />
                                        {errors.notes && <span className="field-error">{errors.notes}</span>}
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <button type="submit" className="btn-primary" disabled={processing}>
                                        {processing ? 'Saving…' : editing ? 'Update' : 'Add Asset'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </>
    );
}
