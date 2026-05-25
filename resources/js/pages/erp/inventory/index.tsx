import {
    store as matStore,
    transactions as matTransaction,
    update as matUpdate,
} from '@/routes/inventory/materials';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

type RawMaterial = {
    id: number;
    name: string;
    unit: string;
    category?: string | null;
    stock_qty: string | number;
    min_stock: string | number;
    cost_per_unit: string | number;
    supplier?: string | null;
    notes?: string | null;
    is_active: boolean;
    transactions_count?: number;
};

type Transaction = {
    id: number;
    raw_material_id: number;
    type: 'purchase' | 'issue' | 'adjustment' | 'return';
    qty: string | number;
    cost_per_unit?: string | number | null;
    reference?: string | null;
    notes?: string | null;
    created_at: string;
    raw_material?: { id: number; name: string; unit: string } | null;
    user?: { id: number; name: string } | null;
};

type Props = {
    materials: RawMaterial[];
    recentTransactions: Transaction[];
};

type MaterialForm = {
    name: string;
    unit: string;
    category: string;
    min_stock: string;
    cost_per_unit: string;
    supplier: string;
    notes: string;
    is_active: boolean;
};

type TxnForm = {
    type: string;
    qty: string;
    cost_per_unit: string;
    reference: string;
    notes: string;
};

const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'bags', 'drums', 'bottles'];

const TXN_TYPE_CLASS: Record<string, string> = {
    purchase: 'badge teal',
    issue: 'badge amber',
    adjustment: 'badge sky',
    return: 'badge gray',
};

const formatQty = (v: string | number) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const formatAmt = (v: string | number) => '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function InventoryIndex({ materials, recentTransactions }: Props) {
    const [tab, setTab] = useState<'materials' | 'log'>('materials');
    const [matModal, setMatModal] = useState(false);
    const [txnModal, setTxnModal] = useState(false);
    const [editingMat, setEditingMat] = useState<RawMaterial | null>(null);
    const [txnTarget, setTxnTarget] = useState<RawMaterial | null>(null);

    const matForm = useForm<MaterialForm>({
        name: '', unit: 'kg', category: '', min_stock: '0',
        cost_per_unit: '0', supplier: '', notes: '', is_active: true,
    });

    const txnForm = useForm<TxnForm>({
        type: 'purchase', qty: '', cost_per_unit: '', reference: '', notes: '',
    });

    const openNewMat = () => {
        matForm.reset();
        matForm.clearErrors();
        setEditingMat(null);
        setMatModal(true);
    };

    const openEditMat = (m: RawMaterial) => {
        matForm.setData({
            name: m.name, unit: m.unit, category: m.category ?? '',
            min_stock: String(m.min_stock), cost_per_unit: String(m.cost_per_unit),
            supplier: m.supplier ?? '', notes: m.notes ?? '', is_active: m.is_active,
        });
        matForm.clearErrors();
        setEditingMat(m);
        setMatModal(true);
    };

    const saveMat = () => {
        if (editingMat) {
            matForm.patch(matUpdate(editingMat.id).url, {
                preserveScroll: true,
                onSuccess: () => { setMatModal(false); matForm.reset(); setEditingMat(null); },
            });
        } else {
            matForm.post(matStore().url, {
                preserveScroll: true,
                onSuccess: () => { setMatModal(false); matForm.reset(); },
            });
        }
    };

    const openTxn = (m: RawMaterial) => {
        txnForm.reset();
        txnForm.clearErrors();
        setTxnTarget(m);
        setTxnModal(true);
    };

    const saveTxn = () => {
        if (!txnTarget) return;
        txnForm.post(matTransaction(txnTarget.id).url, {
            preserveScroll: true,
            onSuccess: () => { setTxnModal(false); txnForm.reset(); setTxnTarget(null); },
        });
    };

    const lowStockCount = materials.filter(
        (m) => Number(m.stock_qty) <= Number(m.min_stock) && m.is_active,
    ).length;

    return (
        <>
            <Head title="Inventory" />
            <div id="view-inventory" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Inventory</h1>
                        <p>Manage raw material stock and transactions</p>
                    </div>
                    <button className="btn primary" onClick={openNewMat}>
                        ＋ Add Material
                    </button>
                </div>

                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    <div className="stat-card c-green">
                        <div className="stat-icon si-green">🗄️</div>
                        <div className="stat-val">{materials.filter((m) => m.is_active).length}</div>
                        <div className="stat-label">Active Materials</div>
                    </div>
                    <div className="stat-card c-amber">
                        <div className="stat-icon si-amber">⚠️</div>
                        <div className="stat-val">{lowStockCount}</div>
                        <div className="stat-label">Low Stock</div>
                        <div className="stat-sub" style={{ color: lowStockCount > 0 ? 'var(--warning)' : undefined }}>
                            {lowStockCount > 0 ? 'Needs reorder' : 'All good'}
                        </div>
                    </div>
                    <div className="stat-card c-sky">
                        <div className="stat-icon si-sky">📋</div>
                        <div className="stat-val">{recentTransactions.length}</div>
                        <div className="stat-label">Recent Txns</div>
                        <div className="stat-sub neu">Last 30</div>
                    </div>
                </div>

                <div className="filter-bar">
                    <h2>Inventory</h2>
                    <button
                        type="button"
                        className={`pill${tab === 'materials' ? ' active' : ''}`}
                        onClick={() => setTab('materials')}
                    >
                        Materials
                    </button>
                    <button
                        type="button"
                        className={`pill${tab === 'log' ? ' active' : ''}`}
                        onClick={() => setTab('log')}
                    >
                        Transaction Log
                    </button>
                </div>

                {tab === 'materials' && (
                    <div className="card">
                        <div className="card-title">
                            Raw Materials
                            <span className="ct-badge">{materials.length}</span>
                        </div>
                        {materials.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon">🗄️</div>
                                <p>No materials yet.</p>
                            </div>
                        ) : (
                            <div className="prod-wrap">
                                <table className="prod-table">
                                    <thead>
                                        <tr>
                                            <th>Material</th>
                                            <th>Unit</th>
                                            <th>Stock</th>
                                            <th>Min Stock</th>
                                            <th>Cost / Unit</th>
                                            <th>Supplier</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materials.map((m) => {
                                            const isLow = Number(m.stock_qty) <= Number(m.min_stock);
                                            return (
                                                <tr key={m.id}>
                                                    <td>
                                                        <div className="prod-name">{m.name}</div>
                                                        {m.category && (
                                                            <div className="prod-detail">{m.category}</div>
                                                        )}
                                                    </td>
                                                    <td>{m.unit}</td>
                                                    <td>
                                                        <span
                                                            style={{
                                                                fontWeight: 700,
                                                                color: isLow ? 'var(--danger)' : 'var(--accent)',
                                                            }}
                                                        >
                                                            {formatQty(m.stock_qty)}
                                                        </span>
                                                        {isLow && (
                                                            <span
                                                                style={{
                                                                    marginLeft: '5px',
                                                                    fontSize: '11px',
                                                                    color: 'var(--danger)',
                                                                }}
                                                            >
                                                                ⚠️ Low
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{formatQty(m.min_stock)}</td>
                                                    <td>{formatAmt(m.cost_per_unit)}</td>
                                                    <td>{m.supplier ?? '—'}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <button
                                                                className="btn sm primary"
                                                                onClick={() => openTxn(m)}
                                                                title="Add stock transaction"
                                                            >
                                                                + Stock
                                                            </button>
                                                            <button
                                                                className="btn sm"
                                                                onClick={() => openEditMat(m)}
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'log' && (
                    <div className="card">
                        <div className="card-title">
                            Transaction Log
                            <span className="ct-badge">Last 30</span>
                        </div>
                        {recentTransactions.length === 0 ? (
                            <div className="empty-state">
                                <div className="icon">📋</div>
                                <p>No transactions yet.</p>
                            </div>
                        ) : (
                            <div className="prod-wrap">
                                <table className="prod-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Material</th>
                                            <th>Type</th>
                                            <th>Qty</th>
                                            <th>Reference</th>
                                            <th>By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {recentTransactions.map((t) => (
                                            <tr key={t.id}>
                                                <td>
                                                    {new Date(t.created_at).toLocaleDateString('en-IN', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                    })}
                                                </td>
                                                <td>
                                                    <div className="prod-name">
                                                        {t.raw_material?.name ?? '—'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={TXN_TYPE_CLASS[t.type] ?? 'badge gray'}>
                                                        {t.type.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span
                                                        style={{
                                                            fontWeight: 700,
                                                            color: t.type === 'purchase' || t.type === 'return'
                                                                ? 'var(--accent)'
                                                                : 'var(--danger)',
                                                        }}
                                                    >
                                                        {t.type === 'purchase' || t.type === 'return' ? '+' : '-'}
                                                        {formatQty(t.qty)} {t.raw_material?.unit}
                                                    </span>
                                                </td>
                                                <td>{t.reference ?? t.notes ?? '—'}</td>
                                                <td>{t.user?.name ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Material modal */}
            <div className={`modal-overlay${matModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '520px' }}>
                    <div className="modal-header">
                        <h2>{editingMat ? 'Edit Material' : 'Add Raw Material'}</h2>
                        <button className="modal-close" onClick={() => setMatModal(false)}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={matForm.data.name}
                                    onChange={(e) => matForm.setData('name', e.target.value)}
                                    placeholder="e.g. Imidacloprid Technical"
                                />
                            </div>
                            <div className="form-group">
                                <label>Unit *</label>
                                <select
                                    value={matForm.data.unit}
                                    onChange={(e) => matForm.setData('unit', e.target.value)}
                                >
                                    {UNITS.map((u) => <option key={u}>{u}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <input
                                    type="text"
                                    value={matForm.data.category}
                                    onChange={(e) => matForm.setData('category', e.target.value)}
                                    placeholder="e.g. Active Ingredient"
                                />
                            </div>
                            <div className="form-group">
                                <label>Min Stock ({matForm.data.unit})</label>
                                <input
                                    type="number"
                                    value={matForm.data.min_stock}
                                    onChange={(e) => matForm.setData('min_stock', e.target.value)}
                                    min="0" step="0.001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Cost / Unit (₹)</label>
                                <input
                                    type="number"
                                    value={matForm.data.cost_per_unit}
                                    onChange={(e) => matForm.setData('cost_per_unit', e.target.value)}
                                    min="0" step="0.01"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Supplier</label>
                                <input
                                    type="text"
                                    value={matForm.data.supplier}
                                    onChange={(e) => matForm.setData('supplier', e.target.value)}
                                    placeholder="Supplier name"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setMatModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveMat} disabled={matForm.processing}>
                            {editingMat ? 'Update' : 'Add Material'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Transaction modal */}
            <div className={`modal-overlay${txnModal ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '460px' }}>
                    <div className="modal-header">
                        <h2>Stock Transaction — {txnTarget?.name}</h2>
                        <button className="modal-close" onClick={() => setTxnModal(false)}>✕</button>
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
                            Current Stock:{' '}
                            <strong>
                                {formatQty(txnTarget?.stock_qty ?? 0)} {txnTarget?.unit}
                            </strong>
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Transaction Type *</label>
                                <select
                                    value={txnForm.data.type}
                                    onChange={(e) => txnForm.setData('type', e.target.value)}
                                >
                                    <option value="purchase">📥 Purchase (add)</option>
                                    <option value="issue">📤 Issue (deduct)</option>
                                    <option value="return">↩ Return (add)</option>
                                    <option value="adjustment">⚖️ Adjustment</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Quantity ({txnTarget?.unit}) *</label>
                                <input
                                    type="number"
                                    value={txnForm.data.qty}
                                    onChange={(e) => txnForm.setData('qty', e.target.value)}
                                    placeholder="0.000"
                                    step="0.001"
                                    min="0.001"
                                />
                                {txnForm.errors.qty && (
                                    <div className="form-error">{txnForm.errors.qty}</div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Cost / Unit (₹)</label>
                                <input
                                    type="number"
                                    value={txnForm.data.cost_per_unit}
                                    onChange={(e) => txnForm.setData('cost_per_unit', e.target.value)}
                                    placeholder="Optional, updates master"
                                    step="0.01" min="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>Reference / Bill No</label>
                                <input
                                    type="text"
                                    value={txnForm.data.reference}
                                    onChange={(e) => txnForm.setData('reference', e.target.value)}
                                    placeholder="e.g. PO-001"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Notes</label>
                                <textarea
                                    value={txnForm.data.notes}
                                    onChange={(e) => txnForm.setData('notes', e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setTxnModal(false)}>Cancel</button>
                        <button className="btn primary" onClick={saveTxn} disabled={txnForm.processing}>
                            Save Transaction
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
