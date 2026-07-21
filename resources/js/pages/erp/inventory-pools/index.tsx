
import {
    destroy as poolDestroy,
    link as poolLink,
    store as poolStore,
    unlink as poolUnlink,
    update as poolUpdate,
} from '@/routes/inventory-pools';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Pool = {
    id: number;
    name: string;
    stock_qty: string | number;
    unit: string;
    notes: string | null;
    links_count: number;
};

type Link = {
    id: number;
    product: { id: number; name: string; company_id: number; company: { id: number; name: string } } | null;
    inventory_pool: { id: number; name: string } | null;
};

type Product = {
    id: number;
    name: string;
    company_id: number;
    company: { id: number; name: string };
};

type Company = { id: number; name: string };

type PageProps = {
    pools: Pool[];
    links: Link[];
    products: Product[];
    companies: Company[];
    flash?: { success?: string; error?: string };
};

const defaultPoolForm = { name: '', stock_qty: '0', unit: 'L', notes: '' };
const defaultLinkForm = { product_id: '', inventory_pool_id: '' };

export default function InventoryPoolsIndex() {
    const { pools, links, products, companies, flash } = usePage<PageProps>().props;

    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [showPoolModal, setShowPoolModal] = useState(false);
    const [editingPool, setEditingPool] = useState<Pool | null>(null);

    const poolForm = useForm(defaultPoolForm);
    const linkForm = useForm(defaultLinkForm);

    const openAddPool = () => { poolForm.reset(); setEditingPool(null); setShowPoolModal(true); };
    const openEditPool = (pool: Pool) => {
        setEditingPool(pool);
        poolForm.setData({ name: pool.name, stock_qty: pool.stock_qty.toString(), unit: pool.unit, notes: pool.notes ?? '' });
        setShowPoolModal(true);
    };

    const submitPool = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPool) {
            poolForm.patch(poolUpdate(editingPool.id).url, { onSuccess: () => { setShowPoolModal(false); poolForm.reset(); } });
        } else {
            poolForm.post(poolStore().url, { onSuccess: () => { setShowPoolModal(false); poolForm.reset(); } });
        }
    };

    const deletePool = (pool: Pool) => {
        if (!confirm(`Delete inventory pool "${pool.name}"? Linked products will be unlinked.`)) return;
        router.delete(poolDestroy(pool.id).url);
    };

    const submitLink = (e: React.FormEvent) => {
        e.preventDefault();
        linkForm.post(poolLink().url, { onSuccess: () => linkForm.reset() });
    };

    const removeLink = (link: Link) => {
        if (!confirm('Unlink this product from its shared inventory pool?')) return;
        router.delete(poolUnlink(link.id).url);
    };

    // links for selected company
    const companyLinks = selectedCompanyId
        ? links.filter((l) => l.product?.company_id === selectedCompanyId)
        : [];

    // unlinked products for selected company
    const companyUnlinkedProducts = selectedCompanyId
        ? products.filter((p) => p.company_id === selectedCompanyId)
        : [];

    // linked product count per company
    const linkedCountFor = (cid: number) => links.filter((l) => l.product?.company_id === cid).length;
    const unlinkedCountFor = (cid: number) => products.filter((p) => p.company_id === cid).length;

    const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

    // ── Company cards view ────────────────────────────────────────────────────
    if (!selectedCompanyId) {
        return (
            <>
                <div className="page-header">
                    <div className="page-header-left">
                        <h1 className="page-title">Inventory Pools</h1>
                        <p style={{ color: 'var(--tx-muted)', fontSize: 13, margin: 0 }}>Select a company to view or manage pool links</p>
                    </div>
                    <button className="btn primary" onClick={openAddPool}>＋ Add Pool</button>
                </div>

                {flash?.success && <div className="alert-success">{flash.success}</div>}
                {flash?.error && <div className="alert-error">{flash.error}</div>}

                {/* Pool summary cards */}
                {pools.length > 0 && (
                    <div className="stats-grid" style={{ marginBottom: 20 }}>
                        {pools.map((pool) => (
                            <div key={pool.id} className="stat-card">
                                <div className="stat-value">{Number(pool.stock_qty).toFixed(2)} <span style={{ fontSize: 13, fontWeight: 400 }}>{pool.unit}</span></div>
                                <div className="stat-label">{pool.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--tx-muted)', marginTop: 2 }}>{pool.links_count} linked</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Company cards */}
                {companies.length === 0 ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-muted)' }}>
                        No companies with products found.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                        {companies.map((c) => {
                            const linked = linkedCountFor(c.id);
                            const unlinked = unlinkedCountFor(c.id);
                            return (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedCompanyId(c.id)}
                                    style={{
                                        background: 'var(--bg-card)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 12,
                                        padding: '24px 20px',
                                        cursor: 'pointer',
                                        transition: 'border-color 0.15s, transform 0.1s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0d9488')}
                                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                                >
                                    <div style={{ fontSize: 32, marginBottom: 10 }}>🏢</div>
                                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{c.name}</div>
                                    <div style={{ fontSize: 13, color: 'var(--tx-muted)' }}>
                                        {linked} linked · {unlinked} unlinked
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pools management table */}
                <div className="card" style={{ marginTop: 24 }}>
                    <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h2>All Pools</h2>
                    </div>
                    <table className="prod-table">
                        <thead>
                            <tr>
                                <th>Pool Name</th>
                                <th>Stock</th>
                                <th>Unit</th>
                                <th>Linked Products</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pools.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--tx-muted)' }}>No pools yet.</td></tr>
                            )}
                            {pools.map((pool) => (
                                <tr key={pool.id}>
                                    <td className="font-medium">{pool.name}</td>
                                    <td>{Number(pool.stock_qty).toFixed(3)}</td>
                                    <td>{pool.unit}</td>
                                    <td>{pool.links_count}</td>
                                    <td>{pool.notes ?? '—'}</td>
                                    <td>
                                        <button className="btn-icon" onClick={() => openEditPool(pool)} title="Edit">✏️</button>
                                        <button className="btn-icon btn-danger-icon" onClick={() => deletePool(pool)} title="Delete">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {showPoolModal && <PoolModal poolForm={poolForm} editingPool={editingPool} onClose={() => setShowPoolModal(false)} onSubmit={submitPool} />}
            </>
        );
    }

    // ── Company detail view ───────────────────────────────────────────────────
    return (
        <>
            <div className="page-header">
                <div className="page-header-left">
                    <button
                        onClick={() => setSelectedCompanyId(null)}
                        className="btn-secondary"
                        style={{ marginBottom: 8 }}
                    >← Back</button>
                    <h1 className="page-title">{selectedCompany?.name} — Pool Links</h1>
                </div>
                <button className="btn primary" onClick={openAddPool}>＋ Add Pool</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            {/* Link a product */}
            {companyUnlinkedProducts.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header"><h2>Link Product to Pool</h2></div>
                    <form onSubmit={submitLink} className="form-row" style={{ padding: '1rem', alignItems: 'flex-end' }}>
                        <div className="form-group">
                            <label>Product</label>
                            <select value={linkForm.data.product_id} onChange={(e) => linkForm.setData('product_id', e.target.value)} required>
                                <option value="">— Select product —</option>
                                {companyUnlinkedProducts.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Inventory Pool</label>
                            <select value={linkForm.data.inventory_pool_id} onChange={(e) => linkForm.setData('inventory_pool_id', e.target.value)} required>
                                <option value="">— Select pool —</option>
                                {pools.map((pool) => (
                                    <option key={pool.id} value={pool.id}>{pool.name} ({Number(pool.stock_qty).toFixed(2)} {pool.unit})</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn primary" disabled={linkForm.processing}>Link</button>
                    </form>
                </div>
            )}

            {/* Active links for this company */}
            <div className="card">
                <div className="card-header"><h2>Active Links</h2></div>
                <table className="prod-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Pool</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companyLinks.length === 0 ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--tx-muted)' }}>No products linked yet.</td></tr>
                        ) : companyLinks.map((link) => {
                            const pool = pools.find((p) => p.id === link.inventory_pool?.id);
                            return (
                                <tr key={link.id}>
                                    <td><span className="prod-name">{link.product?.name ?? '—'}</span></td>
                                    <td><span className="badge purple">{link.inventory_pool?.name ?? '—'}</span></td>
                                    <td>{pool ? `${Number(pool.stock_qty).toFixed(2)} ${pool.unit}` : '—'}</td>
                                    <td>
                                        <button className="btn-icon btn-danger-icon" onClick={() => removeLink(link)} title="Unlink">🗑️</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {showPoolModal && <PoolModal poolForm={poolForm} editingPool={editingPool} onClose={() => setShowPoolModal(false)} onSubmit={submitPool} />}
        </>
    );
}

function PoolModal({ poolForm, editingPool, onClose, onSubmit }: {
    poolForm: ReturnType<typeof useForm<typeof defaultPoolForm>>;
    editingPool: Pool | null;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <ModalPortal>
            <div className="modal-overlay open" onClick={onClose}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2>{editingPool ? 'Edit Pool' : 'Add Pool'}</h2>
                        <button className="modal-close" onClick={onClose}>✕</button>
                    </div>
                    <form onSubmit={onSubmit} className="modal-form">
                        <div className="form-group">
                            <label>Name *</label>
                            <input value={poolForm.data.name} onChange={(e) => poolForm.setData('name', e.target.value)} required />
                            {poolForm.errors.name && <span className="field-error">{poolForm.errors.name}</span>}
                        </div>
                        <div className="form-row">
                            {!editingPool && (
                                <div className="form-group">
                                    <label>Initial Stock Qty *</label>
                                    <input type="number" step="0.001" min="0" value={poolForm.data.stock_qty} onChange={(e) => poolForm.setData('stock_qty', e.target.value)} required />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Unit *</label>
                                <input value={poolForm.data.unit} onChange={(e) => poolForm.setData('unit', e.target.value)} required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <textarea value={poolForm.data.notes} onChange={(e) => poolForm.setData('notes', e.target.value)} />
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                            <button type="submit" className="btn-primary" disabled={poolForm.processing}>
                                {poolForm.processing ? 'Saving…' : editingPool ? 'Update' : 'Add Pool'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </ModalPortal>
    );
}
