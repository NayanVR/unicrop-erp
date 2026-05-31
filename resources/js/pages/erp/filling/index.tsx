import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

type RawMaterial = {
    id: number;
    name: string;
    unit: string;
    stock_qty: string | number;
    cost_per_unit: string | number;
    category?: string | null;
};

type RecipeItem = {
    id?: number;
    raw_material_id: number;
    qty_per_unit: string | number;
    unit?: string | null;
    raw_material?: RawMaterial | null;
};

type Recipe = {
    id: number;
    output_raw_material_id: number | null;
    output_material?: RawMaterial | null;
    name: string;
    packing_size?: string | null;
    fill_quantity: string | number;
    notes?: string | null;
    is_active: boolean;
    items: RecipeItem[];
};

type FillingRunItem = { raw_material_id?: number; name: string; qty: number; unit: string };
type FillingRun = {
    id: number;
    our_brand: string;
    packing_size: string | null;
    quantity: number;
    user?: { id: number; name: string } | null;
    items: FillingRunItem[];
    created_at: string;
};

type Props = {
    recipes: Recipe[];
    materials: RawMaterial[];
    finishedGoodMaterials: RawMaterial[];
    fillingRuns: FillingRun[];
};

type RecipeFormData = {
    output_raw_material_id: string;
    packing_size: string;
    fill_quantity: string;
    notes: string;
    is_active: boolean;
    items: { raw_material_id: string; qty_per_unit: string; unit: string }[];
};

type RunFormData = { quantity: string; notes: string };

const formatQty = (v: string | number) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });

// Convert qty from one unit to another (weight: kg/g/mg; volume: L/ml)
function convertQty(qty: number, fromUnit: string, toUnit: string): number {
    const from = fromUnit.trim().toLowerCase();
    const to   = toUnit.trim().toLowerCase();
    if (from === to || !from || !to) return qty;

    const weightFactor: Record<string, number> = {
        kg: 1, kgs: 1, g: 1e-3, gm: 1e-3, gram: 1e-3, grams: 1e-3, mg: 1e-6, milligram: 1e-6, milligrams: 1e-6,
    };
    const volumeFactor: Record<string, number> = {
        l: 1, ltr: 1, liter: 1, litre: 1, liters: 1, litres: 1,
        ml: 1e-3, milliliter: 1e-3, millilitre: 1e-3, milliliters: 1e-3, millilitres: 1e-3,
    };

    if (weightFactor[from] !== undefined && weightFactor[to] !== undefined)
        return qty * (weightFactor[from] / weightFactor[to]);
    if (volumeFactor[from] !== undefined && volumeFactor[to] !== undefined)
        return qty * (volumeFactor[from] / volumeFactor[to]);

    return qty;
}

function normalizeUnitDisplay(unit: string): string {
    const u = unit.trim().toLowerCase();
    if (['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'].includes(u)) return 'ml';
    if (['l', 'ltr', 'liter', 'litre', 'liters', 'litres'].includes(u)) return 'L';
    if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return 'kg';
    if (['g', 'gm', 'gram', 'grams'].includes(u)) return 'gm';
    if (['mg', 'milligram', 'milligrams'].includes(u)) return 'mg';
    return unit;
}

export default function FillingIndex({ recipes, materials, finishedGoodMaterials, fillingRuns }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin    = auth.user?.role === 'admin';
    const canSeeCost = isAdmin || auth.user?.cost_access === true;
    const canManage  = isAdmin || (auth.user?.permissions ?? []).includes('filling');

    const [pageView, setPageView]   = useState<'recipes' | 'history'>('recipes');
    const [search, setSearch]       = useState('');
    const [histSearch, setHistSearch] = useState('');
    const [editModal, setEditModal] = useState(false);
    const [runModal, setRunModal]   = useState(false);
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [runTarget, setRunTarget] = useState<Recipe | null>(null);

    const form = useForm<RecipeFormData>({
        output_raw_material_id: '', packing_size: '', fill_quantity: '1', notes: '', is_active: true, items: [],
    });
    const runForm = useForm<RunFormData>({ quantity: '1', notes: '' });

    const openNew = () => {
        form.reset(); form.clearErrors(); setEditingRecipe(null); setEditModal(true);
    };

    const openEdit = (recipe: Recipe) => {
        form.setData({
            output_raw_material_id: recipe.output_raw_material_id ? String(recipe.output_raw_material_id) : '',
            packing_size: recipe.packing_size ?? '',
            fill_quantity: String(recipe.fill_quantity),
            notes: recipe.notes ?? '',
            is_active: recipe.is_active,
            items: recipe.items.map((i) => ({
                raw_material_id: String(i.raw_material_id),
                qty_per_unit: String(i.qty_per_unit),
                unit: i.unit ?? '',
            })),
        });
        form.clearErrors(); setEditingRecipe(recipe); setEditModal(true);
    };

    const addItem = () => form.setData('items', [...form.data.items, { raw_material_id: '', qty_per_unit: '', unit: '' }]);

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

    const saveRecipe = () => {
        if (editingRecipe) {
            form.patch(`/filling/${editingRecipe.id}`, {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); setEditingRecipe(null); },
            });
        } else {
            form.post('/filling', {
                preserveScroll: true,
                onSuccess: () => { setEditModal(false); form.reset(); },
            });
        }
    };

    const deleteRecipe = (recipe: Recipe) => {
        if (!confirm(`Delete filling product "${recipe.name}"?`)) return;
        router.delete(`/filling/${recipe.id}`, { preserveScroll: true });
    };

    const openRun = (recipe: Recipe) => {
        runForm.reset();
        runForm.setData('quantity', String(Math.round(Number(recipe.fill_quantity) || 1)));
        setRunTarget(recipe);
        setRunModal(true);
    };

    // Cost per 1 pc for a recipe
    const calcCostPerPc = (recipe: Recipe) =>
        recipe.items.reduce((sum, item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            if (!mat) return sum;
            const itemUnit = item.unit || mat.unit;
            const qtyInMatUnit = convertQty(Number(item.qty_per_unit), itemUnit, mat.unit);
            return sum + qtyInMatUnit * Number(mat.cost_per_unit);
        }, 0);

    // Can we run `qty` pcs given current stock?
    const canRun = (recipe: Recipe, qty: number) =>
        recipe.items.length > 0 && recipe.items.every((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            if (!mat) return false;
            const itemUnit = item.unit || mat.unit;
            const needed = convertQty(Number(item.qty_per_unit) * qty, itemUnit, mat.unit);
            return Number(mat.stock_qty) >= needed;
        });

    const submitRun = () => {
        if (!runTarget) return;
        const recipe = runTarget;
        const qty    = Number(runForm.data.quantity) || 1;
        const lines  = recipe.items.map((item) => {
            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
            const itemUnit = item.unit || mat?.unit || '';
            const need = Number(item.qty_per_unit) * qty;
            return `  • ${mat?.name ?? 'Material'}: ${formatQty(need)} ${normalizeUnitDisplay(itemUnit)}`;
        }).join('\n');
        const msg = `Run Filling — ${recipe.name}${recipe.packing_size ? ` ${recipe.packing_size}` : ''} × ${qty} pcs\n\nThis will deduct from inventory:\n${lines}\n\nProceed?`;
        if (!window.confirm(msg)) return;
        runForm.post(`/filling/${recipe.id}/run`, {
            preserveScroll: true,
            onSuccess: () => { setRunModal(false); runForm.reset(); setRunTarget(null); },
        });
    };

    const filtered = recipes.filter((r) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q)
            || (r.packing_size ?? '').toLowerCase().includes(q)
            || r.items.some((i) => (i.raw_material?.name ?? '').toLowerCase().includes(q));
    });

    return (
        <>
            <Head title="Filling" />
            <div id="view-filling" className="view active">

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>🧪 Filling</h1>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--tx-sub)' }}>Define filling recipes — materials needed per piece</p>
                    </div>
                    {pageView === 'recipes' && canManage && <button className="btn primary" onClick={openNew}>+ Add New Filling Product</button>}
                </div>

                {/* Tab switcher */}
                <div className="filter-bar" style={{ marginBottom: 20 }}>
                    <button className={`pill${pageView === 'recipes' ? ' active' : ''}`} onClick={() => setPageView('recipes')} style={{ fontWeight: pageView === 'recipes' ? 600 : 400 }}>🧪 Products ({recipes.length})</button>
                    <button className={`pill${pageView === 'history' ? ' active' : ''}`} onClick={() => setPageView('history')} style={{ fontWeight: pageView === 'history' ? 600 : 400 }}>📋 Run History ({fillingRuns.length})</button>
                </div>

                {/* ── Recipes view ─────────────────────────────────────────── */}
                {pageView === 'recipes' && <>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Search products..."
                        style={{ width: 220 }}
                    />
                </div>

                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🧪</div>
                        <p>{recipes.length === 0 ? 'No filling products yet. Create one to define a filling recipe.' : 'No products match your search.'}</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                        {filtered.map((recipe) => {
                            const qtyPreview = Math.round(Number(recipe.fill_quantity) || 1);
                            const runnable = canRun(recipe, qtyPreview);
                            return (
                                <div
                                    key={recipe.id}
                                    style={{
                                        background: '#fff',
                                        border: '1px solid var(--border)',
                                        borderLeft: '4px solid #2563eb',
                                        borderRadius: 10,
                                        padding: '16px 18px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 10,
                                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                    }}
                                >
                                    {/* Top row: name + packing size */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{recipe.name}</div>
                                        {recipe.packing_size && (
                                            <span style={{ flexShrink: 0, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                                                {recipe.packing_size}
                                            </span>
                                        )}
                                    </div>

                                    {/* Default fill qty + inactive badge */}
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: 12, color: 'var(--tx-sub)' }}>Default fill: <strong>{Math.round(Number(recipe.fill_quantity))} pcs</strong></span>
                                        {!recipe.is_active && <span className="badge gray" style={{ fontSize: 11 }}>Inactive</span>}
                                    </div>

                                    {recipe.notes && <div style={{ fontSize: 13, color: 'var(--tx-sub)' }}>{recipe.notes}</div>}

                                    {/* Materials (per pc) */}
                                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 2 }}>Materials per piece</div>
                                        {recipe.items.map((item, idx) => {
                                            const mat = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
                                            const matUnit  = mat?.unit ?? '';
                                            const itemUnit = item.unit || matUnit;
                                            const neededPerPc = mat ? convertQty(Number(item.qty_per_unit), itemUnit, matUnit) : Number(item.qty_per_unit);
                                            const inStock = mat ? Number(mat.stock_qty) : 0;
                                            const sufficient = inStock >= neededPerPc * qtyPreview;
                                            return (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, gap: 8 }}>
                                                    <span style={{ color: sufficient ? 'var(--tx-body)' : 'var(--danger)', flex: 1 }}>
                                                        {mat?.name ?? `Material #${item.raw_material_id}`}
                                                    </span>
                                                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        {formatQty(item.qty_per_unit)}{' '}
                                                        <span style={{ fontWeight: 400, color: 'var(--tx-muted)', fontSize: 12 }}>{normalizeUnitDisplay(itemUnit)}/pc</span>
                                                    </span>
                                                    <span style={{
                                                        fontSize: 11, whiteSpace: 'nowrap',
                                                        color: sufficient ? '#059669' : '#dc2626',
                                                        background: sufficient ? '#d1fae5' : '#fee2e2',
                                                        padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                                                    }}>
                                                        Stock: {mat ? `${formatQty(inStock)} ${normalizeUnitDisplay(matUnit)}` : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                        {recipe.items.length === 0 && (
                                            <div style={{ fontSize: 13, color: 'var(--tx-faint)' }}>No materials added.</div>
                                        )}
                                    </div>

                                    {/* Cost — admin / cost_access only */}
                                    {canSeeCost && recipe.items.length > 0 && (
                                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                                            <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12 }}>
                                                <span style={{ color: 'var(--tx-muted)' }}>Cost / pc: </span>
                                                <strong>₹{calcCostPerPc(recipe).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
                                        {canManage && <button className="btn sm" onClick={() => openEdit(recipe)} style={{ fontSize: 12 }}>✏ Edit</button>}
                                        <button
                                            className={`btn sm${runnable ? ' primary' : ''}`}
                                            onClick={() => openRun(recipe)}
                                            disabled={recipe.items.length === 0}
                                            style={{ fontSize: 12 }}
                                            title={recipe.items.length === 0 ? 'Add materials first' : ''}
                                        >
                                            ▶ Run Filling
                                        </button>
                                        {canManage && <button className="btn danger-xs" onClick={() => deleteRecipe(recipe)} style={{ marginLeft: 'auto', fontSize: 12 }}>Delete</button>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                </>}

                {/* ── Run History view ─────────────────────────────────────── */}
                {pageView === 'history' && (
                    <div>
                        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                            <input
                                type="search"
                                value={histSearch}
                                onChange={(e) => setHistSearch(e.target.value)}
                                placeholder="🔍 Search by product or size..."
                                style={{ width: 280 }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--tx-muted)' }}>{fillingRuns.length} run{fillingRuns.length !== 1 ? 's' : ''}</span>
                        </div>
                        {fillingRuns.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon">📋</div>
                                <p>No filling runs yet. Run a filling to start recording history.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-paper)', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Date &amp; Time</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Product</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Size</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Qty (pcs)</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Materials Used</th>
                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)' }}>By</th>
                                            {canManage && <th style={{ padding: '8px 12px' }}></th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fillingRuns
                                            .filter((r) => {
                                                if (!histSearch.trim()) return true;
                                                const q = histSearch.toLowerCase();
                                                return r.our_brand.toLowerCase().includes(q) || (r.packing_size ?? '').toLowerCase().includes(q);
                                            })
                                            .map((r) => (
                                                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--tx-muted)', fontSize: 12 }}>
                                                        {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.our_brand}</td>
                                                    <td style={{ padding: '8px 12px' }}>{r.packing_size ?? '—'}</td>
                                                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>{formatQty(Number(r.quantity))}</td>
                                                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--tx-sub)', maxWidth: 320 }}>
                                                        {(r.items ?? []).map((it) => `${it.name} (${formatQty(it.qty)} ${normalizeUnitDisplay(it.unit)})`).join(', ') || '—'}
                                                    </td>
                                                    <td style={{ padding: '8px 12px', color: 'var(--tx-muted)', fontSize: 12 }}>{r.user?.name ?? '—'}</td>
                                                    {canManage && (
                                                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                            <button className="btn sm danger" onClick={() => {
                                                                if (!confirm(`Delete this filling run?\n\n${r.our_brand} ${r.packing_size ?? ''} × ${r.quantity} pcs\n\nThis will restore the deducted materials to stock.`)) return;
                                                                router.delete(`/filling/runs/${r.id}`, { preserveScroll: true });
                                                            }}>Delete</button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Create / Edit recipe modal ───────────────────────────────── */}
            <div className={`modal-overlay${editModal ? ' open' : ''}`} onClick={() => setEditModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                    <div className="modal-header">
                        <h2>{editingRecipe ? 'Edit Filling Product' : 'New Filling Product'}</h2>
                        <button className="modal-close" onClick={() => setEditModal(false)}>✕</button>
                    </div>
                    <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Product Name *</label>
                                <select
                                    value={form.data.output_raw_material_id}
                                    onChange={(e) => form.setData('output_raw_material_id', e.target.value)}
                                >
                                    <option value="">— Select finished good —</option>
                                    {finishedGoodMaterials.map((m) => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                {form.errors.output_raw_material_id && <div className="form-error">{form.errors.output_raw_material_id}</div>}
                            </div>
                            <div className="form-group">
                                <label>Packing Size</label>
                                <input type="text" value={form.data.packing_size} onChange={(e) => form.setData('packing_size', e.target.value)} placeholder="e.g. 500ml, 1L" />
                            </div>
                            <div className="form-group">
                                <label>Default Fill Qty (pcs)</label>
                                <input type="number" value={form.data.fill_quantity} onChange={(e) => form.setData('fill_quantity', e.target.value)} step="1" min="1" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Description / Notes</label>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={2} placeholder="Short description of this filling recipe" />
                            </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)' }}>🧪 Materials per piece</div>
                                <button type="button" className="btn sm" onClick={addItem}>+ Add Material</button>
                            </div>
                            {form.data.items.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 16, color: 'var(--tx-faint)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                                    No materials added yet. Add fill liquid, bottle, label, box, etc.
                                </div>
                            ) : form.data.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                                    <select value={item.raw_material_id} onChange={(e) => updateItem(idx, 'raw_material_id', e.target.value)}>
                                        <option value="">— Select material —</option>
                                        {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({formatQty(m.stock_qty)} {m.unit})</option>)}
                                    </select>
                                    <input type="number" placeholder="Qty/pc" value={item.qty_per_unit} onChange={(e) => updateItem(idx, 'qty_per_unit', e.target.value)} step="0.001" min="0" />
                                    <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}>
                                        <option value="">— unit —</option>
                                        {['kg', 'gm', 'g', 'mg', 'L', 'ml', 'pcs', 'nos'].map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    <button type="button" className="btn danger-xs" onClick={() => removeItem(idx)} style={{ padding: '0 8px', height: 32 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setEditModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveRecipe} disabled={form.processing || !form.data.output_raw_material_id}>
                            {editingRecipe ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Run filling modal ────────────────────────────────────────── */}
            <div className={`modal-overlay${runModal ? ' open' : ''}`} onClick={() => setRunModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
                    <div className="modal-header">
                        <h2>Run Filling — {runTarget?.name}{runTarget?.packing_size ? ` ${runTarget.packing_size}` : ''}</h2>
                        <button className="modal-close" onClick={() => setRunModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Quantity to fill (pcs) *</label>
                                <input type="number" value={runForm.data.quantity} onChange={(e) => runForm.setData('quantity', e.target.value)} min="0.001" step="1" />
                            </div>
                        </div>

                        {/* Live material breakdown */}
                        {runTarget && runTarget.items.length > 0 && Number(runForm.data.quantity) > 0 && (() => {
                            const qty = Number(runForm.data.quantity);
                            return (
                                <div style={{ margin: '12px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <div style={{ padding: '7px 12px', background: 'var(--bg-paper)', fontSize: 12, fontWeight: 600, color: 'var(--tx-muted)', borderBottom: '1px solid var(--border)' }}>
                                        Materials required for this run
                                    </div>
                                    {runTarget.items.map((item, i) => {
                                        const mat      = item.raw_material ?? materials.find((m) => m.id === item.raw_material_id);
                                        const matUnit  = mat?.unit ?? '';
                                        const itemUnit = item.unit || matUnit;
                                        const needed   = Number(item.qty_per_unit) * qty;
                                        const neededInMatUnit = mat ? convertQty(needed, itemUnit, matUnit) : needed;
                                        const inStock  = mat ? Number(mat.stock_qty) : 0;
                                        const ok       = inStock >= neededInMatUnit;
                                        return (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: i < runTarget.items.length - 1 ? '1px solid var(--border)' : undefined, fontSize: 13, gap: 8 }}>
                                                <span style={{ flex: 1, color: ok ? 'var(--tx-body)' : '#dc2626' }}>{mat?.name ?? `Material #${item.raw_material_id}`}</span>
                                                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    {formatQty(needed)} {normalizeUnitDisplay(itemUnit)}
                                                    {!ok && <span style={{ marginLeft: 8, fontSize: 11, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 8 }}>⚠ short</span>}
                                                    {ok && <span style={{ marginLeft: 8, fontSize: 11, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 8 }}>✓</span>}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        <div className="form-grid" style={{ marginTop: 4 }}>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea value={runForm.data.notes} onChange={(e) => runForm.setData('notes', e.target.value)} rows={2} placeholder="Operator, lot notes, etc." />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setRunModal(false)}>Cancel</button>
                        <button
                            className="btn primary"
                            onClick={submitRun}
                            disabled={runForm.processing || (runTarget ? !canRun(runTarget, Number(runForm.data.quantity) || 1) : true)}
                        >
                            ▶ Run {runForm.data.quantity} pcs
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
