import {
    store as bomStore,
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

const BATCH_UNITS = ['kg', 'L', 'g', 'mL', 'pcs'];

const formatQty = (v: string | number) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

export default function BomIndex({ boms, products, materials }: Props) {
    const [createModal, setCreateModal] = useState(false);

    const form = useForm<BomFormData>({
        name: '',
        product_id: '',
        packing_size: '',
        batch_size: '1',
        batch_unit: 'kg',
        notes: '',
        is_active: true,
        items: [],
    });

    const openNew = () => {
        form.reset();
        form.clearErrors();
        setCreateModal(true);
    };

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
        form.post(bomStore().url, {
            preserveScroll: true,
            onSuccess: () => { setCreateModal(false); form.reset(); },
        });
    };

    const calcBomCost = (bom: Bom) =>
        bom.items.reduce((sum, item) => {
            const mat = materials.find((m) => m.id === item.raw_material_id);
            return sum + (mat ? Number(item.qty_per_batch) * Number(mat.cost_per_unit) : 0);
        }, 0);

    const canRun = (bom: Bom) =>
        bom.items.every((item) => {
            const mat = materials.find((m) => m.id === item.raw_material_id);
            return mat && Number(mat.stock_qty) >= Number(item.qty_per_batch);
        });

    return (
        <>
            <Head title="Bill of Materials" />
            <div id="view-bom" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Bill of Materials</h1>
                        <p>Define product formulations and run production batches</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                        ＋ New BOM
                    </button>
                </div>

                {boms.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">⚗️</div>
                        <p>No BOMs yet. Create one to define a product formulation.</p>
                    </div>
                ) : (
                    boms.map((bom) => {
                        const estimatedCost = calcBomCost(bom);
                        const runnable = canRun(bom);

                        return (
                            <div key={bom.id} className="order-card">
                                <div
                                    className="order-card-header"
                                    onClick={() => router.visit(`/bom/${bom.id}/detail`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') router.visit(`/bom/${bom.id}/detail`);
                                    }}
                                >
                                    <div className="o-id">⚗️</div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{bom.name}</div>
                                        <div className="o-customer">
                                            {bom.product?.name ?? 'No product linked'}
                                            {bom.packing_size ? ` · ${bom.packing_size}` : ''}
                                        </div>
                                    </div>
                                    <div className="o-meta">
                                        <div>Batch: {formatQty(bom.batch_size)} {bom.batch_unit}</div>
                                        <div>{bom.items.length} ingredients · ₹{estimatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / batch</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span className={`badge ${runnable ? 'teal' : 'amber'}`}>
                                            {runnable ? '✓ Stock OK' : '⚠️ Low Stock'}
                                        </span>
                                        <span className={`badge ${bom.is_active ? 'teal' : 'gray'}`}>
                                            {bom.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* New BOM modal */}
            <div className={`modal-overlay${createModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>New BOM</h2>
                        <button className="modal-close" onClick={() => setCreateModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>BOM Name *</label>
                                <input
                                    type="text"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="e.g. Imidacloprid 17.8% SL - 1L"
                                />
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
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)' }}>
                                    ⚗️ Ingredients
                                </div>
                                <button type="button" className="btn sm" onClick={addItem}>+ Add Ingredient</button>
                            </div>

                            {form.data.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No ingredients added yet.
                                </div>
                            ) : (
                                form.data.items.map((item, idx) => (
                                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                        <select value={item.raw_material_id} onChange={(e) => updateItem(idx, 'raw_material_id', e.target.value)}>
                                            <option value="">— Select material —</option>
                                            {materials.map((m) => (
                                                <option key={m.id} value={m.id}>{m.name} ({formatQty(m.stock_qty)} {m.unit})</option>
                                            ))}
                                        </select>
                                        <input type="number" placeholder="Qty" value={item.qty_per_batch} onChange={(e) => updateItem(idx, 'qty_per_batch', e.target.value)} step="0.001" min="0" />
                                        <input type="text" placeholder="Unit" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} />
                                        <button type="button" className="btn danger-xs" onClick={() => removeItem(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setCreateModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveBom} disabled={form.processing}>Create BOM</button>
                    </div>
                </div>
            </div>
        </>
    );
}
