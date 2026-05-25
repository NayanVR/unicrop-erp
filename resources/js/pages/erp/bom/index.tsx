import {
    destroy as bomDestroy,
    run as bomRun,
    store as bomStore,
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

export default function BomIndex({ boms, products, materials }: Props) {
    const [openBom, setOpenBom] = useState<number | null>(null);
    const [editModal, setEditModal] = useState(false);
    const [runModal, setRunModal] = useState(false);
    const [editingBom, setEditingBom] = useState<Bom | null>(null);
    const [runTarget, setRunTarget] = useState<Bom | null>(null);

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

    const runForm = useForm<RunFormData>({ batch_count: '1', notes: '' });

    const openNew = () => {
        form.reset();
        form.clearErrors();
        setEditingBom(null);
        setEditModal(true);
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
        form.clearErrors();
        setEditingBom(bom);
        setEditModal(true);
    };

    const addItem = () => {
        form.setData('items', [
            ...form.data.items,
            { raw_material_id: '', qty_per_batch: '', unit: '' },
        ]);
    };

    const removeItem = (idx: number) => {
        form.setData(
            'items',
            form.data.items.filter((_, i) => i !== idx),
        );
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
        runForm.reset();
        setRunTarget(bom);
        setRunModal(true);
    };

    const submitRun = () => {
        if (!runTarget) return;
        runForm.post(bomRun(runTarget.id).url, {
            preserveScroll: true,
            onSuccess: () => { setRunModal(false); runForm.reset(); setRunTarget(null); },
        });
    };

    const calcBomCost = (bom: Bom, batches = 1) => {
        return bom.items.reduce((sum, item) => {
            const mat = materials.find((m) => m.id === item.raw_material_id);
            return sum + (mat ? Number(item.qty_per_batch) * Number(mat.cost_per_unit) * batches : 0);
        }, 0);
    };

    const canRun = (bom: Bom, batches = 1) => {
        return bom.items.every((item) => {
            const mat = materials.find((m) => m.id === item.raw_material_id);
            return mat && Number(mat.stock_qty) >= Number(item.qty_per_batch) * batches;
        });
    };

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
                        const isOpen = openBom === bom.id;
                        const estimatedCost = calcBomCost(bom);
                        const runnable = canRun(bom);

                        return (
                            <div
                                key={bom.id}
                                className={`order-card${isOpen ? ' open' : ''}`}
                            >
                                <div
                                    className="order-card-header"
                                    onClick={() => setOpenBom(isOpen ? null : bom.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') setOpenBom(isOpen ? null : bom.id);
                                    }}
                                >
                                    <div className="o-id">⚗️</div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{bom.name}</div>
                                        <div className="o-customer">
                                            {bom.product?.name ?? 'No product linked'}{' '}
                                            {bom.packing_size ? `· ${bom.packing_size}` : ''}
                                        </div>
                                    </div>
                                    <div className="o-meta">
                                        <div>
                                            Batch: {formatQty(bom.batch_size)} {bom.batch_unit}
                                        </div>
                                        <div>{bom.items.length} ingredients</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <span className={`badge ${bom.is_active ? 'teal' : 'gray'}`}>
                                            {bom.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: '10px',
                                            marginBottom: '14px',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <button
                                            className={`btn sm${runnable ? ' primary' : ''}`}
                                            onClick={() => openRun(bom)}
                                            disabled={!runnable}
                                            title={runnable ? 'Run production batch' : 'Insufficient stock'}
                                        >
                                            {runnable ? '▶ Run Production' : '⚠️ Insufficient Stock'}
                                        </button>
                                        <button className="btn sm" onClick={() => openEdit(bom)}>
                                            Edit BOM
                                        </button>
                                        <button className="btn danger-xs" onClick={() => deleteBom(bom)}>
                                            Delete
                                        </button>
                                        <span
                                            style={{
                                                marginLeft: 'auto',
                                                fontSize: '13px',
                                                color: 'var(--tx-muted)',
                                                alignSelf: 'center',
                                            }}
                                        >
                                            Est. cost: ₹
                                            {estimatedCost.toLocaleString('en-IN', {
                                                minimumFractionDigits: 2,
                                            })}{' '}
                                            / batch
                                        </span>
                                    </div>

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
                                                {bom.items.map((item, idx) => {
                                                    const mat = item.raw_material;
                                                    const needed = Number(item.qty_per_batch);
                                                    const inStock = mat ? Number(mat.stock_qty) : 0;
                                                    const sufficient = inStock >= needed;
                                                    const cost = mat
                                                        ? needed * Number(mat.cost_per_unit)
                                                        : 0;
                                                    return (
                                                        <tr key={idx}>
                                                            <td>
                                                                <div className="prod-name">
                                                                    {mat?.name ?? `Material #${item.raw_material_id}`}
                                                                </div>
                                                            </td>
                                                            <td>{formatQty(item.qty_per_batch)}</td>
                                                            <td>{item.unit ?? mat?.unit ?? '—'}</td>
                                                            <td>
                                                                <span
                                                                    style={{
                                                                        color: sufficient
                                                                            ? 'var(--accent)'
                                                                            : 'var(--danger)',
                                                                        fontWeight: 600,
                                                                    }}
                                                                >
                                                                    {mat ? formatQty(mat.stock_qty) : '—'}{' '}
                                                                    {mat?.unit}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                ₹
                                                                {cost.toLocaleString('en-IN', {
                                                                    minimumFractionDigits: 2,
                                                                })}
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={`badge ${sufficient ? 'teal' : 'amber'}`}
                                                                >
                                                                    {sufficient ? '✓ OK' : '⚠️ Low'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {bom.notes && (
                                        <div
                                            style={{
                                                marginTop: '10px',
                                                fontSize: '13px',
                                                color: 'var(--tx-muted)',
                                                padding: '8px 12px',
                                                background: 'var(--bg-paper)',
                                                borderRadius: 'var(--radius-sm)',
                                            }}
                                        >
                                            📝 {bom.notes}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* BOM create/edit modal */}
            <div className={`modal-overlay${editModal ? ' open' : ''}`}>
                <div
                    className="modal"
                    style={{ maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
                >
                    <div className="modal-header">
                        <h2>{editingBom ? 'Edit BOM' : 'New BOM'}</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
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
                                <select
                                    value={form.data.product_id}
                                    onChange={(e) => form.setData('product_id', e.target.value)}
                                >
                                    <option value="">— None —</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Packing Size</label>
                                <input
                                    type="text"
                                    value={form.data.packing_size}
                                    onChange={(e) => form.setData('packing_size', e.target.value)}
                                    placeholder="e.g. 1L, 500mL"
                                />
                            </div>
                            <div className="form-group">
                                <label>Batch Size *</label>
                                <input
                                    type="number"
                                    value={form.data.batch_size}
                                    onChange={(e) => form.setData('batch_size', e.target.value)}
                                    step="0.001" min="0.001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Batch Unit *</label>
                                <select
                                    value={form.data.batch_unit}
                                    onChange={(e) => form.setData('batch_unit', e.target.value)}
                                >
                                    {BATCH_UNITS.map((u) => <option key={u}>{u}</option>)}
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

                        <div style={{ marginTop: '16px' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '10px',
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '.5px',
                                        color: 'var(--tx-muted)',
                                    }}
                                >
                                    ⚗️ Ingredients
                                </div>
                                <button type="button" className="btn sm" onClick={addItem}>
                                    + Add Ingredient
                                </button>
                            </div>

                            {form.data.items.length === 0 ? (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '16px',
                                        color: 'var(--tx-faint)',
                                        fontSize: '13px',
                                        border: '1px dashed var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                    }}
                                >
                                    No ingredients added yet.
                                </div>
                            ) : (
                                form.data.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 100px 80px 32px',
                                            gap: '8px',
                                            marginBottom: '8px',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <select
                                            value={item.raw_material_id}
                                            onChange={(e) =>
                                                updateItem(idx, 'raw_material_id', e.target.value)
                                            }
                                        >
                                            <option value="">— Select material —</option>
                                            {materials.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} ({formatQty(m.stock_qty)} {m.unit})
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.qty_per_batch}
                                            onChange={(e) =>
                                                updateItem(idx, 'qty_per_batch', e.target.value)
                                            }
                                            step="0.001" min="0"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Unit"
                                            value={item.unit}
                                            onChange={(e) =>
                                                updateItem(idx, 'unit', e.target.value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            className="btn danger-xs"
                                            onClick={() => removeItem(idx)}
                                            style={{ padding: '0 8px', height: '32px' }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
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

            {/* Run production modal */}
            <div className={`modal-overlay${runModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '420px' }}>
                    <div className="modal-header">
                        <h2>Run Production — {runTarget?.name}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div
                            style={{
                                marginBottom: '14px',
                                padding: '10px 12px',
                                background: 'var(--bg-paper)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '13px',
                            }}
                        >
                            Batch size: <strong>{formatQty(runTarget?.batch_size ?? 0)} {runTarget?.batch_unit}</strong><br />
                            Est. cost per batch:{' '}
                            <strong>
                                ₹{runTarget
                                    ? calcBomCost(runTarget, 1).toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                      })
                                    : '0.00'}
                            </strong>
                        </div>
                        {runTarget && !canRun(runTarget, Number(runForm.data.batch_count) || 1) && (
                            <div
                                style={{
                                    marginBottom: '12px',
                                    padding: '8px 12px',
                                    background: 'var(--danger-lt)',
                                    border: '1px solid var(--danger)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px',
                                    color: 'var(--danger)',
                                }}
                            >
                                ⚠️ Insufficient stock for {runForm.data.batch_count} batch(es).
                            </div>
                        )}
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Number of Batches *</label>
                                <input
                                    type="number"
                                    value={runForm.data.batch_count}
                                    onChange={(e) => runForm.setData('batch_count', e.target.value)}
                                    min="0.001" step="0.001"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea
                                    value={runForm.data.notes}
                                    onChange={(e) => runForm.setData('notes', e.target.value)}
                                    rows={2}
                                    placeholder="Batch notes, lot number, etc."
                                />
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
