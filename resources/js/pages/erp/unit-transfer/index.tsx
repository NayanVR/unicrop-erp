import ErpLayout from '@/layouts/erp-layout';
import {
    destroy as transferDestroy,
    status as transferStatus,
    store as transferStore,
} from '@/routes/unit-transfer';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Transfer = {
    id: number;
    created_by: number | null;
    from_unit: string;
    to_unit: string;
    item_type: 'raw_material' | 'finished_good' | 'other';
    item_name: string;
    quantity: number;
    unit: string;
    notes: string | null;
    status: 'loading' | 'in-transit' | 'unloaded' | 'cancelled';
    transferred_at: string | null;
    created_at: string;
    creator: { id: number; name: string } | null;
};

type Stats = { total: number; loading: number; in_transit: number; unloaded: number };

type PageProps = {
    transfers: Transfer[];
    stats: Stats;
    flash?: { success?: string; error?: string };
};

const STATUS_COLORS: Record<string, string> = {
    loading: 'badge-yellow',
    'in-transit': 'badge-blue',
    unloaded: 'badge-teal',
    cancelled: 'badge-gray',
};

const NEXT_STATUS: Record<string, string> = {
    loading: 'in-transit',
    'in-transit': 'unloaded',
};

const defaultForm = {
    from_unit: '',
    to_unit: '',
    item_type: 'raw_material' as 'raw_material' | 'finished_good' | 'other',
    item_name: '',
    quantity: '',
    unit: 'kg',
    notes: '',
};

export default function UnitTransferIndex() {
    const { transfers, stats, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'loading' | 'in-transit' | 'unloaded' | 'cancelled'>('all');

    const { data, setData, post, processing, reset, errors } = useForm(defaultForm);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post(transferStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
    };

    const advance = (t: Transfer) => {
        const next = NEXT_STATUS[t.status];
        if (!next) return;
        router.patch(transferStatus(t.id).url, { status: next });
    };

    const cancel = (t: Transfer) => {
        if (!confirm('Cancel this transfer?')) return;
        router.patch(transferStatus(t.id).url, { status: 'cancelled' });
    };

    const deleteTransfer = (t: Transfer) => {
        if (!confirm(`Delete transfer "${t.item_name}"?`)) return;
        router.delete(transferDestroy(t.id).url);
    };

    const filtered = transfers.filter((t) => {
        if (filter !== 'all' && t.status !== filter) return false;
        if (search) {
            const q = search.toLowerCase();
            if (!t.item_name.toLowerCase().includes(q) && !t.from_unit.toLowerCase().includes(q) && !t.to_unit.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    return (
        <ErpLayout>
            <div className="page-header">
                <h1 className="page-title">Unit Transfers</h1>
                <button className="btn-primary" onClick={() => { reset(); setShowModal(true); }}>+ New Transfer</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.loading}</div>
                    <div className="stat-label">Loading</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.in_transit}</div>
                    <div className="stat-label">In Transit</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.unloaded}</div>
                    <div className="stat-label">Unloaded</div>
                </div>
            </div>

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search item, from/to unit..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="filter-tabs">
                        {(['all', 'loading', 'in-transit', 'unloaded', 'cancelled'] as const).map((f) => (
                            <button
                                key={f}
                                className={`filter-tab${filter === f ? ' active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'in-transit' ? 'In Transit' : f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Type</th>
                            <th>From → To</th>
                            <th>Quantity</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="empty-row">No transfers found.</td></tr>
                        )}
                        {filtered.map((t) => (
                            <tr key={t.id}>
                                <td className="font-medium">{t.item_name}</td>
                                <td>
                                    <span className="badge badge-gray">{t.item_type.replace('_', ' ')}</span>
                                </td>
                                <td className="text-muted">{t.from_unit} → {t.to_unit}</td>
                                <td>{Number(t.quantity).toFixed(3)} {t.unit}</td>
                                <td>
                                    <span className={`badge ${STATUS_COLORS[t.status] ?? 'badge-gray'}`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="text-muted">
                                    {t.transferred_at
                                        ? new Date(t.transferred_at).toLocaleDateString('en-IN')
                                        : new Date(t.created_at).toLocaleDateString('en-IN')}
                                </td>
                                <td className="action-cell">
                                    {NEXT_STATUS[t.status] && (
                                        <button className="btn-xs btn-teal" onClick={() => advance(t)}>
                                            → {NEXT_STATUS[t.status]}
                                        </button>
                                    )}
                                    {t.status !== 'unloaded' && t.status !== 'cancelled' && (
                                        <button className="btn-xs btn-danger" onClick={() => cancel(t)}>Cancel</button>
                                    )}
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteTransfer(t)} title="Delete">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>New Transfer</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>From Unit *</label>
                                    <input value={data.from_unit} onChange={(e) => setData('from_unit', e.target.value)} placeholder="e.g. Warehouse A" required />
                                    {errors.from_unit && <span className="field-error">{errors.from_unit}</span>}
                                </div>
                                <div className="form-group">
                                    <label>To Unit *</label>
                                    <input value={data.to_unit} onChange={(e) => setData('to_unit', e.target.value)} placeholder="e.g. Factory Floor" required />
                                    {errors.to_unit && <span className="field-error">{errors.to_unit}</span>}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Item Type *</label>
                                    <select value={data.item_type} onChange={(e) => setData('item_type', e.target.value as typeof data.item_type)}>
                                        <option value="raw_material">Raw Material</option>
                                        <option value="finished_good">Finished Good</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Item Name *</label>
                                    <input value={data.item_name} onChange={(e) => setData('item_name', e.target.value)} required />
                                    {errors.item_name && <span className="field-error">{errors.item_name}</span>}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Quantity *</label>
                                    <input type="number" step="0.001" min="0" value={data.quantity} onChange={(e) => setData('quantity', e.target.value)} required />
                                    {errors.quantity && <span className="field-error">{errors.quantity}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select value={data.unit} onChange={(e) => setData('unit', e.target.value)}>
                                        {['kg', 'g', 'L', 'mL', 'pcs', 'bags', 'drums'].map((u) => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : 'Create Transfer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
