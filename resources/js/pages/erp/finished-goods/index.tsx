import ErpLayout from '@/layouts/erp-layout';
import {
    destroy as finishedGoodsDestroy,
    store as finishedGoodsStore,
    update as finishedGoodsUpdate,
} from '@/routes/finished-goods';
import { router, useForm, usePage } from '@inertiajs/react';
import { Fragment, useMemo, useState } from 'react';

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
    source: 'production' | 'manual' | 'filling';
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
    source: 'manual' as 'production' | 'manual' | 'filling',
};

// Parse packing size to liters for sorting (e.g. "500ml" -> 0.5, "5ltr" -> 5)
function packingToLiters(size: string | null | undefined): number {
    if (!size) return -1;
    const s = size.toLowerCase().trim();
    const num = parseFloat(s);
    if (isNaN(num)) return -1;
    if (s.includes('ml')) return num / 1000;
    if (s.includes('l')) return num;
    return num;
}

export default function FinishedGoodsIndex() {
    const { goods, products, boms, stats, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<FinishedGood | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'production' | 'manual' | 'filling'>('all');
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [expandedSizes, setExpandedSizes] = useState<Set<string>>(new Set());

    const toggleProduct = (key: string) =>
        setExpandedProducts((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    const toggleSize = (key: string) =>
        setExpandedSizes((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });

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
        if (search) {
            const q = search.toLowerCase();
            const hit = g.name.toLowerCase().includes(q)
                || (g.batch_ref ?? '').toLowerCase().includes(q)
                || (g.packing_size ?? '').toLowerCase().includes(q)
                || (g.product?.name ?? '').toLowerCase().includes(q);
            if (!hit) return false;
        }
        return true;
    });

    // Group: Product -> Packing size (+unit) -> individual entries
    type SizeGroup = { sizeKey: string; size: string; unit: string; qty: number; entries: FinishedGood[] };
    type ProductGroup = { key: string; productName: string; totalEntries: number; sizes: SizeGroup[] };

    const productGroups = useMemo<ProductGroup[]>(() => {
        const byProduct = new Map<string, FinishedGood[]>();
        for (const g of filtered) {
            const key = g.product?.name ?? g.name;
            if (!byProduct.has(key)) byProduct.set(key, []);
            byProduct.get(key)!.push(g);
        }
        const groups: ProductGroup[] = [];
        for (const [key, entries] of byProduct) {
            const bySize = new Map<string, SizeGroup>();
            for (const g of entries) {
                const size = g.packing_size ?? '—';
                const sizeKey = `${key}|${size}|${g.unit}`;
                if (!bySize.has(sizeKey)) bySize.set(sizeKey, { sizeKey, size, unit: g.unit, qty: 0, entries: [] });
                const sg = bySize.get(sizeKey)!;
                sg.qty += Number(g.quantity);
                sg.entries.push(g);
            }
            const sizes = [...bySize.values()].sort((a, b) => packingToLiters(b.size) - packingToLiters(a.size));
            groups.push({ key, productName: key, totalEntries: entries.length, sizes });
        }
        return groups.sort((a, b) => a.productName.localeCompare(b.productName));
    }, [filtered]);

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
                        placeholder="Search product, size or batch ref..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="filter-tabs">
                        {(['all', 'production', 'filling', 'manual'] as const).map((f) => (
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
                            <th style={{ width: 32 }}></th>
                            <th>Product / Packing</th>
                            <th>Batch Ref</th>
                            <th>Quantity</th>
                            <th>Source</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {productGroups.length === 0 && (
                            <tr><td colSpan={7} className="empty-row">No entries found.</td></tr>
                        )}
                        {productGroups.map((pg) => {
                            const open = expandedProducts.has(pg.key);
                            return (
                                <Fragment key={pg.key}>
                                    {/* Product row */}
                                    <tr
                                        style={{ cursor: 'pointer', background: 'var(--bg-paper, #f8fafc)', fontWeight: 600 }}
                                        onClick={() => toggleProduct(pg.key)}
                                    >
                                        <td style={{ textAlign: 'center' }}>{open ? '▼' : '▶'}</td>
                                        <td className="font-medium">
                                            📦 {pg.productName}
                                            <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>
                                                {pg.sizes.length} size{pg.sizes.length !== 1 ? 's' : ''}
                                            </span>
                                        </td>
                                        <td>—</td>
                                        <td style={{ color: 'var(--tx-muted)', fontWeight: 400, fontSize: 12 }}>
                                            {pg.totalEntries} batch{pg.totalEntries !== 1 ? 'es' : ''}
                                        </td>
                                        <td colSpan={3}></td>
                                    </tr>

                                    {/* Size rows + entries */}
                                    {open && pg.sizes.map((sg) => {
                                        const sizeOpen = expandedSizes.has(sg.sizeKey);
                                        return (
                                            <Fragment key={sg.sizeKey}>
                                                <tr
                                                    style={{ cursor: 'pointer', background: 'var(--bg-subtle, #fcfdff)' }}
                                                    onClick={() => toggleSize(sg.sizeKey)}
                                                >
                                                    <td></td>
                                                    <td style={{ paddingLeft: 28 }}>
                                                        <span style={{ color: 'var(--tx-muted)' }}>{sizeOpen ? '▾' : '▸'}</span>{' '}
                                                        <strong style={{ color: '#1d4ed8' }}>{sg.size}</strong>
                                                        <span style={{ marginLeft: 8, color: 'var(--tx-muted)', fontSize: 12 }}>
                                                            {sg.entries.length} batch{sg.entries.length !== 1 ? 'es' : ''}
                                                        </span>
                                                    </td>
                                                    <td>—</td>
                                                    <td style={{ fontWeight: 700 }}>{Number(sg.qty).toFixed(3)} {sg.unit}</td>
                                                    <td colSpan={3}></td>
                                                </tr>

                                                {/* Individual batch entries */}
                                                {sizeOpen && sg.entries.map((g) => (
                                                    <tr key={g.id}>
                                                        <td></td>
                                                        <td style={{ paddingLeft: 52, color: 'var(--tx-sub)', fontSize: 13 }}>{g.name}</td>
                                                        <td><code>{g.batch_ref ?? '—'}</code></td>
                                                        <td>{Number(g.quantity).toFixed(3)} {g.unit}</td>
                                                        <td>
                                                            <span className={`badge ${g.source === 'production' ? 'badge-teal' : g.source === 'filling' ? 'badge-blue' : 'badge-gray'}`}>
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
                                            </Fragment>
                                        );
                                    })}
                                </Fragment>
                            );
                        })}
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
                                    <select value={data.source} onChange={(e) => setData('source', e.target.value as 'production' | 'manual' | 'filling')}>
                                        <option value="manual">Manual</option>
                                        <option value="production">Production</option>
                                        <option value="filling">Filling</option>
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
