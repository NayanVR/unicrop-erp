import ErpLayout from '@/layouts/erp-layout';
import {
    destroy as finishedGoodsDestroy,
    store as finishedGoodsStore,
    update as finishedGoodsUpdate,
} from '@/routes/finished-goods';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type Product = { id: number; name: string };
type Bom = { id: number; name: string; packing_size: string | null; batch_size: number; batch_unit: string };

type FinishedGood = {
    id: number;
    product_id: number | null;
    bom_id: number | null;
    created_by: number | null;
    name: string;
    packing_size: string | null;
    batch_ref: string | null;
    quantity: number;
    unit: string;
    notes: string | null;
    source: 'production' | 'manual';
    created_at: string;
    product: Product | null;
    bom: Bom | null;
    creator: { id: number; name: string } | null;
};

type Stats = {
    total_batches: number;
    total_quantity: number;
    production_batches: number;
    manual_entries: number;
};

type PageProps = {
    goods: FinishedGood[];
    products: Product[];
    boms: Bom[];
    stats: Stats;
    flash?: { success?: string; error?: string };
};

const defaultForm = {
    product_id: '',
    bom_id: '',
    name: '',
    packing_size: '',
    batch_ref: '',
    quantity: '',
    unit: 'L',
    notes: '',
    source: 'manual' as 'production' | 'manual',
};

export default function FinishedGoodsIndex() {
    const { goods, products, boms, stats, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<FinishedGood | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'production' | 'manual'>('all');

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (g: FinishedGood) => {
        setEditing(g);
        setData({
            product_id: g.product_id?.toString() ?? '',
            bom_id: g.bom_id?.toString() ?? '',
            name: g.name,
            packing_size: g.packing_size ?? '',
            batch_ref: g.batch_ref ?? '',
            quantity: g.quantity.toString(),
            unit: g.unit,
            notes: g.notes ?? '',
            source: g.source,
        });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(finishedGoodsUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(finishedGoodsStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deleteGood = (g: FinishedGood) => {
        if (!confirm(`Delete entry "${g.name}"?`)) return;
        router.delete(finishedGoodsDestroy(g.id).url);
    };

    const filtered = goods.filter((g) => {
        if (filter !== 'all' && g.source !== filter) return false;
        if (search && !g.name.toLowerCase().includes(search.toLowerCase()) && !(g.batch_ref ?? '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <ErpLayout>
            <div className="page-header">
                <h1 className="page-title">Finished Goods</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Entry</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-value">{stats.total_batches}</div>
                    <div className="stat-label">Total Batches</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{Number(stats.total_quantity).toFixed(1)}</div>
                    <div className="stat-label">Total Quantity</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.production_batches}</div>
                    <div className="stat-label">From Production</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.manual_entries}</div>
                    <div className="stat-label">Manual Entries</div>
                </div>
            </div>

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search name or batch ref..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="filter-tabs">
                        {(['all', 'production', 'manual'] as const).map((f) => (
                            <button
                                key={f}
                                className={`filter-tab${filter === f ? ' active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Product</th>
                            <th>Packing</th>
                            <th>Batch Ref</th>
                            <th>Quantity</th>
                            <th>Source</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={8} className="empty-row">No entries found.</td></tr>
                        )}
                        {filtered.map((g) => (
                            <tr key={g.id}>
                                <td className="font-medium">{g.name}</td>
                                <td>{g.product?.name ?? '—'}</td>
                                <td>{g.packing_size ?? '—'}</td>
                                <td><code>{g.batch_ref ?? '—'}</code></td>
                                <td>{Number(g.quantity).toFixed(3)} {g.unit}</td>
                                <td>
                                    <span className={`badge ${g.source === 'production' ? 'badge-teal' : 'badge-gray'}`}>
                                        {g.source}
                                    </span>
                                </td>
                                <td className="text-muted">{new Date(g.created_at).toLocaleDateString('en-IN')}</td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEdit(g)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteGood(g)} title="Delete">🗑️</button>
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
                            <h2>{editing ? 'Edit Entry' : 'Add Finished Good'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    {errors.name && <span className="field-error">{errors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Source *</label>
                                    <select value={data.source} onChange={(e) => setData('source', e.target.value as 'production' | 'manual')}>
                                        <option value="manual">Manual</option>
                                        <option value="production">Production</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Product</label>
                                    <select value={data.product_id} onChange={(e) => setData('product_id', e.target.value)}>
                                        <option value="">— Select product —</option>
                                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>BOM</label>
                                    <select value={data.bom_id} onChange={(e) => setData('bom_id', e.target.value)}>
                                        <option value="">— Select BOM —</option>
                                        {boms.map((b) => <option key={b.id} value={b.id}>{b.name} {b.packing_size ? `(${b.packing_size})` : ''}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Packing Size</label>
                                    <input value={data.packing_size} onChange={(e) => setData('packing_size', e.target.value)} placeholder="e.g. 1L, 500ml" />
                                </div>
                                <div className="form-group">
                                    <label>Batch Reference</label>
                                    <input value={data.batch_ref} onChange={(e) => setData('batch_ref', e.target.value)} placeholder="e.g. B2405-01" />
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
                                        {['L', 'mL', 'kg', 'g', 'pcs', 'bags', 'bottles'].map((u) => (
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
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Add Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
