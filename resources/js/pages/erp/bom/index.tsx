import {
    destroy as bomDestroy,
    run as bomRun,
    store as bomStore,
    update as bomUpdate,
} from '@/routes/bom';
import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type RawMaterial = {
    id: number;
    name: string;
    unit: string;
    stock_qty: string | number;
    cost_per_unit: string | number;
};

type BomItem = {
    id?: number;
    raw_material_id: number;
    qty_per_batch: string | number;
    unit?: string | null;
    raw_material?: RawMaterial | null;
};

type Bom = {
    id: number;
    name: string;
    packing_size?: string | null;
    batch_size: string | number;
    batch_unit: string;
    notes?: string | null;
    is_active: boolean;
    product?: { id: number; name: string } | null;
    items: BomItem[];
};

type Product = { id: number; name: string };

type Props = {
    boms: Bom[];
    products: Product[];
    materials: RawMaterial[];
};

type BomFormData = {
    name: string;
    product_id: string;
    packing_size: string;
    batch_size: string;
    batch_unit: string;
    notes: string;
    is_active: boolean;
    items: { raw_material_id: string; qty_per_batch: string; unit: string }[];
};

type RunFormData = { batch_count: string; notes: string };

const BATCH_UNITS = ['kg', 'L', 'g', 'mL', 'pcs'];

const formatQty = (v: string | number) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

function bomType(unit: string): 'liquid' | 'powder' | 'other' {
    if (['L', 'mL'].includes(unit)) return 'liquid';
    if (['kg', 'g'].includes(unit)) return 'powder';
    return 'other';
}

const TYPE_CONFIG = {
    liquid: { label: 'LIQUID', color: '#2563eb', bg: '#eff6ff', border: '#2563eb' },
    powder: { label: 'POWDER', color: '#d97706', bg: '#fffbeb', border: '#d97706' },
    other:  { label: 'OTHER',  color: '#6b7280', bg: '#f9fafb', border: '#9ca3af' },
};

export default function BomIndex({ boms, products, materials }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const canSeeCost = auth.user?.role === 'admin' || auth.user?.cost_access === true;

    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'liquid' | 'powder' | 'other'>('all');
    const [editModal, setEditModal]   = useState(false);
    const [runModal, setRunModal]     = useState(false);
    const [editingBom, setEditingBom] = useState<Bom | null>(null);
    const [runTarget, setRunTarget]   = useState<Bom | null>(null);

    const form = useForm<BomFormData>({
        name: '', product_id: '', packing_size: '', batch_size: '1',
        batch_unit: 'kg', notes: '', is_active: true, items: [],
    });
    const runForm = useForm<RunFormData>({ batch_count: '1', notes: '' });

    const openNew = () => {
        form.reset(); form.clearErrors(); setEditingBom(null); setEditModal(true);
    };

    const openEdit = (bom: Bom) => {
        form.setData({
            name: bom.name,
            product_id: bom.product?.id ? String(bom.product.id) : '',
            packing_size: bom.packing_size ?? '',
            batch_size: String(bom.batch_size),
            batch_unit: bom.batch_unit,
            notes: bom.notes ?? '',
            is_active: bom.is_active,
            items: bom.items.map((i) => ({
                raw_material_id: String(i.raw_material_id),
                qty_per_batch: String(i.qty_per_batch),
                unit: i.unit ?? '',
            })),
        });
        form.clearErrors(); setEditingBom(bom); setEditModal(true);
    };

    const addItem = () => form.setData('items', [...form.data.items, { raw_material_id: '', qty_per_batch: '', unit: '' }]);

    const removeItem = (idx: number) => form.setData('items', form.data.items.filter((_, i) => i !== idx));

    const updateItem = (idx: number, field: string, value: string) => {
        const items = [...form.data.items];
        items[idx] = { ...items[idx], [field]: value };
        if (field === 'raw_material_id') {
            const mat = materials.find((m) => m.id === Number(value));
            if (mat) items[idx].unit = mat.unit;
        }
        form.setData('items', items);
    };

    const saveBom = () => {
        if (editingBom) {
            form.patch(bomUpdate(editingBom.id).url, {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); setEditingBom(null); },
            });
        } else {
            form.post(bomStore().url, {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); },
            });
        }
    };

    const deleteBom = (bom: Bom) => {
        if (!confirm(`Delete BOM "${bom.name}"?`)) return;
        router.delete(bomDestroy(bom.id).url, { preserveScroll: true });
    };

    const openRun = (bom: Bom) => {
        runForm.reset(); setRunTarget(bom); setRunModal(true);
    };

    const submitRun = () => {
        if (!runTarget) return;
        runForm.post(bomRun(runTarget.id).url, {
            preserveScroll: true,
            onSuccess: () => { setRunModal(false); runForm.reset(); setRunTarget(null); },
        });
    };

    const calcCost = (bom: Bom, batches = 1) =>
        bom.items.reduce((sum, item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            return sum + (mat ? Number(item.qty_per_batch) * Number(mat.cost_per_unit) * batches : 0);
        }, 0);

    const canRun = (bom: Bom, batches = 1) =>
        bom.items.every((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            return mat && Number(mat.stock_qty) >= Number(item.qty_per_batch) * batches;
        });

    const printBom = (bom: Bom) => {
        const type = bomType(bom.batch_unit);
        const cfg  = TYPE_CONFIG[type];
        const rows = bom.items.map((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            return `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #eee">${mat?.name ?? `Material #${item.raw_material_id}`}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:700">${formatQty(item.qty_per_batch)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${item.unit ?? mat?.unit ?? ''}</td>
            </tr>`;
        }).join('');
        const win = window.open('', '_blank', 'width=600,height=700');
        if (!win) return;
        win.document.write(`<html><head><title>${bom.name}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px;} @media print{button{display:none}}</style>
        </head><body>
        <button onclick="window.print()" style="margin-bottom:16px;padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer">🖨 Print</button>
        <div style="border-left:4px solid ${cfg.border};padding-left:14px;margin-bottom:16px">
            <h2 style="margin:0 0 4px">${bom.name}</h2>
            <span style="background:${cfg.bg};color:${cfg.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.5px">${cfg.label}</span>
            <span style="margin-left:8px;font-size:13px;color:#666">Yield: ${formatQty(bom.batch_size)} ${bom.batch_unit}${bom.packing_size ? ' · ' + bom.packing_size : ''}</span>
        </div>
        ${bom.notes ? `<p style="color:#666;font-size:13px;margin-bottom:14px">${bom.notes}</p>` : ''}
        <table style="width:100%;border-collapse:collapse">
            <thead><tr style="background:#f3f4f6">
                <th style="padding:8px 10px;text-align:left">Ingredient</th>
                <th style="padding:8px 10px;text-align:right">Qty</th>
                <th style="padding:8px 10px;text-align:left">Unit</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;font-size:12px;color:#999">Est. cost / batch: ₹${calcCost(bom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </body></html>`);
        win.document.close();
    };

    const filtered = boms.filter((b) => {
        if (typeFilter !== 'all' && bomType(b.batch_unit) !== typeFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            return b.name.toLowerCase().includes(q)
                || (b.product?.name ?? '').toLowerCase().includes(q)
                || b.items.some((i) => (i.raw_material?.name ?? '').toLowerCase().includes(q));
        }
        return true;
    });

    return (
        <>
            <Head title="Bill of Materials" />
            <div id="view-bom" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Bill of Materials</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tx-sub)' }}>Define raw material recipes for liquid &amp; powder products</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>+ Add New BOM</button>
                </div>

                {/* Search + filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Search BOMs..."
                        style={{ width: 220 }}
                    />
                    <div className="filter-bar" style={{ margin: 0 }}>
                        {(['all', 'liquid', 'powder', 'other'] as const).map((t) => (
                            <button
                                key={t}
                                className={`pill${typeFilter === t ? ' active' : ''}`}
                                onClick={() => setTypeFilter(t)}
                                style={{ fontWeight: typeFilter === t ? 600 : 400 }}
                            >
                                {t === 'all' ? '🔬 All' : t === 'liquid' ? '💧 Liquid' : t === 'powder' ? '🌿 Powder' : '📦 Other'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cards grid */}
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">⚗️</div>
                        <p>{boms.length === 0 ? 'No BOMs yet. Create one to define a product formulation.' : 'No BOMs match the current filter.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {filtered.map((bom) => {
                            const type = bomType(bom.batch_unit);
                            const cfg  = TYPE_CONFIG[type];
                            const runnable = canRun(bom);
                            return (
                                <div
                                    key={bom.id}
                                    style={{
                                        background: '#fff',
                                        border: '1px solid var(--border)',
                                        borderLeft: `4px solid ${cfg.border}`,
                                        borderRadius: 10,
                                        padding: '16px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                    }}
                                >
                                    {/* Top row: name + yield */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{bom.name}</div>
                                        <span style={{ flexShrink: 0, background: '#f3f4f6', color: '#374151', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                            Yield: {formatQty(bom.batch_size)} {bom.batch_unit}
                                        </span>
                                    </div>

                                    {/* Type + product badge */}
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, letterSpacing: '.5px' }}>
                                            {type === 'liquid' ? '💧' : type === 'powder' ? '🌿' : '📦'} {cfg.label}
                                        </span>
                                        {bom.product && (
                                            <span style={{ fontSize: 12, color: 'var(--tx-sub)' }}>{bom.product.name}{bom.packing_size ? ` · ${bom.packing_size}` : ''}</span>
                                        )}
                                        {!bom.is_active && (
                                            <span className="badge gray" style={{ fontSize: 11 }}>Inactive</span>
                                        )}
                                    </div>

                                    {/* Description / notes */}
                                    {bom.notes && (
                                        <div style={{ fontSize: 13, color: 'var(--tx-sub)' }}>{bom.notes}</div>
                                    )}

                                    {/* Ingredients */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {bom.items.map((item, idx) => {
                                            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
                                            const needed = Number(item.qty_per_batch);
                                            const inStock = mat ? Number(mat.stock_qty) : 0;
                                            const sufficient = inStock >= needed;
                                            const unit = item.unit ?? mat?.unit ?? '';
                                            return (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
                                                    <span style={{ color: sufficient ? 'var(--tx-body)' : 'var(--danger)', flex: 1 }}>
                                                        {mat?.name ?? `Material #${item.raw_material_id}`}
                                                    </span>
                                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        {formatQty(needed)}{' '}
                                                        <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>{unit}</span>
                                                    </span>
                                                    <span style={{
                                                        fontSize: 11, whiteSpace: 'nowrap',
                                                        color: sufficient ? '#059669' : '#dc2626',
                                                        background: sufficient ? '#d1fae5' : '#fee2e2',
                                                        padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                                    }}>
                                                        Stock: {mat ? `${formatQty(inStock)} ${unit}` : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {bom.items.length === 0 && (
                                            <div style={{ fontSize: 13, color: 'var(--tx-faint)' }}>No ingredients added.</div>
                                        )}
                                    </div>

                                    {/* Cost info — admin / cost_access only */}
                                    {canSeeCost && (
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                                            {[
                                                { label: `Per ${bom.batch_unit}`, value: `₹${Number(bom.batch_size) > 0 ? (calcCost(bom) / Number(bom.batch_size)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}` },
                                                { label: `Total batch (${formatQty(bom.batch_size)} ${bom.batch_unit})`, value: `₹${calcCost(bom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                                            ].map((c) => (
                                                <div key={c.label} style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                                                    <span style={{ color: 'var(--tx-muted)' }}>{c.label}: </span>
                                                    <strong>{c.value}</strong>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
                                        <button className="btn sm" onClick={() => openEdit(bom)} style={{ fontSize: 12 }}>✏ Edit</button>
                                        <button
                                            className={`btn sm${runnable ? ' primary' : ''}`}
                                            onClick={() => openRun(bom)}
                                            disabled={!runnable}
                                            style={{ fontSize: 12 }}
                                            title={runnable ? '' : 'Insufficient stock'}
                                        >
                                            {runnable ? '▶ Production Run' : '⚠️ Low Stock'}
                                        </button>
                                        <button className="btn sm" onClick={() => printBom(bom)} style={{ fontSize: 12 }}>🖨 Print</button>
                                        <button className="btn danger-xs" onClick={() => deleteBom(bom)} style={{ marginLeft: 'auto', fontSize: 12 }}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Create / Edit BOM modal ─────────────────────────────────── */}
            <div className={`modal-overlay${editModal ? ' open' : ''}`} onClick={() => setEditModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>{editingBom ? 'Edit BOM' : 'New BOM'}</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>BOM Name *</label>
                                <input type="text" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="e.g. Imidacloprid 17.8% SL - 1L" />
                                {form.errors.name && <div className="form-error">{form.errors.name}</div>}
                            </div>
                            <div className="form-group">
                                <label>Batch Size *</label>
                                <input type="number" value={form.data.batch_size} onChange={(e) => form.setData('batch_size', e.target.value)} step="0.001" min="0.001" />
                            </div>
                            <div className="form-group">
                                <label>Batch Unit *</label>
                                <select value={form.data.batch_unit} onChange={(e) => form.setData('batch_unit', e.target.value)}>
                                    {BATCH_UNITS.map((u) => <option key={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Description / Notes</label>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} placeholder="Short description of this formulation" />
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)' }}>⚗️ Ingredients</div>
                                <button type="button" className="btn sm" onClick={addItem}>+ Add Ingredient</button>
                            </div>
                            {form.data.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No ingredients added yet.
                                </div>
                            ) : form.data.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                    <select value={item.raw_material_id} onChange={(e) => updateItem(idx, 'raw_material_id', e.target.value)}>
                                        <option value="">— Select material —</option>
                                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({formatQty(m.stock_qty)} {m.unit})</option>)}
                                    </select>
                                    <input type="number" placeholder="Qty" value={item.qty_per_batch} onChange={(e) => updateItem(idx, 'qty_per_batch', e.target.value)} step="0.001" min="0" />
                                    <input type="text" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                    <button type="button" className="btn danger-xs" onClick={() => removeItem(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setEditModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveBom} disabled={form.processing}>
                            {editingBom ? 'Update BOM' : 'Create BOM'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Run production modal ─────────────────────────────────────── */}
            <div className={`modal-overlay${runModal ? ' open' : ''}`} onClick={() => setRunModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <h2>Run Production — {runTarget?.name}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-paper)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                            Batch size: <strong>{formatQty(runTarget?.batch_size ?? 0)} {runTarget?.batch_unit}</strong><br />
                            Est. cost / batch: <strong>₹{runTarget ? calcCost(runTarget).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</strong>
                        </div>
                        {runTarget && !canRun(runTarget, Number(runForm.data.batch_count) || 1) && (
                            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-lt)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--danger)' }}>
                                ⚠️ Insufficient stock for {runForm.data.batch_count} batch(es).
                            </div>
                        )}
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Number of Batches *</label>
                                <input type="number" value={runForm.data.batch_count} onChange={(e) => runForm.setData('batch_count', e.target.value)} min="0.001" step="0.001" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea value={runForm.data.notes} onChange={(e) => runForm.setData('notes', e.target.value)} rows={2} placeholder="Batch notes, lot number, etc." />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setRunModal(false)}>Cancel</button>
                        <button
                            className="btn primary"
                            onClick={submitRun}
                            disabled={runForm.processing || (runTarget ? !canRun(runTarget, Number(runForm.data.batch_count) || 1) : true)}
                        >
                            ▶ Run {runForm.data.batch_count} Batch(es)
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
