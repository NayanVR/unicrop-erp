import {
    destroy as bomDestroy,
    run as bomRun,
    update as bomUpdate,
} from '@/routes/bom';
import { Head, router, useForm } from '@inertiajs/react';
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
    bom: Bom;
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

export default function BomShow({ bom, products, materials }: Props) {
    const [editModal, setEditModal] = useState(false);
    const [runModal, setRunModal] = useState(false);

    const form = useForm<BomFormData>({
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

    const runForm = useForm<RunFormData>({ batch_count: '1', notes: '' });

    const addItem = () => {
        form.setData('items', [
            ...form.data.items,
            { raw_material_id: '', qty_per_batch: '', unit: '' },
        ]);
    };

    const removeItem = (idx: number) => {
        form.setData('items', form.data.items.filter((_, i) => i !== idx));
    };

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
        form.patch(bomUpdate(bom.id).url, {
            preserveScroll: true,
            onSuccess: () => setEditModal(false),
        });
    };

    const deleteBom = () => {
        if (!confirm(`Delete BOM "${bom.name}"? This cannot be undone.`)) return;
        router.delete(bomDestroy(bom.id).url, {
            onSuccess: () => router.visit('/bom'),
        });
    };

    const submitRun = () => {
        runForm.post(bomRun(bom.id).url, {
            preserveScroll: true,
            onSuccess: () => { setRunModal(false); runForm.reset(); },
        });
    };

    const calcCost = (batches = 1) =>
        bom.items.reduce((sum, item) => {
            const mat = item.raw_material;
            return sum + (mat ? Number(item.qty_per_batch) * Number(mat.cost_per_unit) * batches : 0);
        }, 0);

    const canRun = (batches = 1) =>
        bom.items.every((item) => {
            const mat = item.raw_material;
            return mat && Number(mat.stock_qty) >= Number(item.qty_per_batch) * batches;
        });

    const runnable = canRun(Number(runForm.data.batch_count) || 1);

    return (
        <>
            <Head title={bom.name} />
            <div id="view-bom-show" className="view active">
                {/* Back + header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button className="btn sm" onClick={() => router.visit('/bom')} style={{ flexShrink: 0 }}>
                        ← Back
                    </button>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>⚗️ {bom.name}</h1>
                        {bom.product && (
                            <div style={{ fontSize: 13, color: 'var(--tx-sub)', marginTop: 2 }}>
                                {bom.product.name}{bom.packing_size ? ` · ${bom.packing_size}` : ''}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                            className={`btn${canRun(1) ? ' primary' : ''}`}
                            onClick={() => setRunModal(true)}
                            title={canRun(1) ? 'Run production batch' : 'Insufficient stock for 1 batch'}
                        >
                            {canRun(1) ? '▶ Run Production' : '⚠️ Insufficient Stock'}
                        </button>
                        <button className="btn" onClick={() => setEditModal(true)}>Edit BOM</button>
                        <button className="btn danger-xs" onClick={deleteBom}>Delete</button>
                    </div>
                </div>

                {/* Summary cards */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    {[
                        { label: 'Batch Size', value: `${formatQty(bom.batch_size)} ${bom.batch_unit}` },
                        { label: 'Ingredients', value: String(bom.items.length) },
                        { label: 'Est. Cost / Batch', value: `₹${calcCost(1).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
                        { label: 'Status', value: bom.is_active ? 'Active' : 'Inactive' },
                    ].map((c) => (
                        <div key={c.label} style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 18px', minWidth: 140 }}>
                            <div style={{ fontSize: 11, color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{c.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{c.value}</div>
                        </div>
                    ))}
                </div>

                {/* Ingredients table */}
                <div className="prod-wrap">
                    <table className="prod-table">
                        <thead>
                            <tr>
                                <th>Ingredient</th>
                                <th>Qty / Batch</th>
                                <th>Unit</th>
                                <th>Current Stock</th>
                                <th>Cost / Batch</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {bom.items.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tx-faint)', padding: '24px' }}>No ingredients added.</td></tr>
                            ) : bom.items.map((item, idx) => {
                                const mat = item.raw_material;
                                const needed = Number(item.qty_per_batch);
                                const inStock = mat ? Number(mat.stock_qty) : 0;
                                const sufficient = inStock >= needed;
                                const cost = mat ? needed * Number(mat.cost_per_unit) : 0;
                                return (
                                    <tr key={idx}>
                                        <td><div className="prod-name">{mat?.name ?? `Material #${item.raw_material_id}`}</div></td>
                                        <td>{formatQty(item.qty_per_batch)}</td>
                                        <td>{item.unit ?? mat?.unit ?? '—'}</td>
                                        <td>
                                            <span style={{ color: sufficient ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
                                                {mat ? `${formatQty(mat.stock_qty)} ${mat.unit}` : '—'}
                                            </span>
                                        </td>
                                        <td>₹{cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                        <td><span className={`badge ${sufficient ? 'teal' : 'amber'}`}>{sufficient ? '✓ OK' : '⚠️ Low'}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {bom.notes && (
                    <div style={{ marginTop: 16, fontSize: 13, color: 'var(--tx-muted)', padding: '10px 14px', background: 'var(--bg-paper)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        📝 {bom.notes}
                    </div>
                )}
            </div>

            {/* Edit modal */}
            <div className={`modal-overlay${editModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>Edit BOM</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>BOM Name *</label>
                                <input type="text" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Linked Product</label>
                                <select value={form.data.product_id} onChange={(e) => form.setData('product_id', e.target.value)}>
                                    <option value="">— None —</option>
                                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Packing Size</label>
                                <input type="text" value={form.data.packing_size} onChange={(e) => form.setData('packing_size', e.target.value)} placeholder="e.g. 1L, 500mL" />
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
                                <label>Notes</label>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} />
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
                        <button className="btn primary" onClick={saveBom} disabled={form.processing}>Update BOM</button>
                    </div>
                </div>
            </div>

            {/* Run production modal */}
            <div className={`modal-overlay${runModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: 420 }}>
                    <div className="modal-header">
                        <h2>Run Production — {bom.name}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-paper)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                            Batch size: <strong>{formatQty(bom.batch_size)} {bom.batch_unit}</strong><br />
                            Est. cost per batch: <strong>₹{calcCost(1).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        {!runnable && (
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
                        <button className="btn primary" onClick={submitRun} disabled={runForm.processing || !runnable}>
                            ▶ Run {runForm.data.batch_count} Batch(es)
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
