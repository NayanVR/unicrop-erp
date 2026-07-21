
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
    const [search, setSearch] = useState('');

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
        if (!confirm(`Delete pool "${pool.name}"?`)) return;
        router.delete(poolDestroy(pool.id).url);
    };

    const submitLink = (e: React.FormEvent) => {
        e.preventDefault();
        linkForm.post(poolLink().url, { onSuccess: () => linkForm.reset() });
    };
    const removeLink = (link: Link) => {
        if (!confirm('Unlink this product?')) return;
        router.delete(poolUnlink(link.id).url);
    };

    const selectedCompany = companies.find((c) => c.id === selectedCompanyId);
    const linkedCountFor = (cid: number) => links.filter((l) => l.product?.company_id === cid).length;

    const companyLinks = selectedCompanyId
        ? links.filter((l) => l.product?.company_id === selectedCompanyId)
        : [];
    const companyUnlinked = selectedCompanyId
        ? products.filter((p) => p.company_id === selectedCompanyId)
        : [];
    const filteredLinks = companyLinks.filter((l) =>
        !search || (l.product?.name ?? '').toLowerCase().includes(search.toLowerCase())
    );

    // ── Company cards ─────────────────────────────────────────────────────────
    if (!selectedCompanyId) {
        return (
            <>
                <div className="page-header">
                    <h1 className="page-title">Shared Inventory Pools</h1>
                    <button className="btn-primary" onClick={openAddPool}>+ Add Pool</button>
                </div>

                {flash?.success && <div className="alert-success">{flash.success}</div>}
                {flash?.error && <div className="alert-error">{flash.error}</div>}

                {companies.length === 0 ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                        No companies with products found.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                        {companies.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedCompanyId(c.id)}
                                style={{
                                    background: 'var(--card-bg, #1e293b)',
                                    border: '1px solid var(--border, #334155)',
                                    borderRadius: '12px',
                                    padding: '24px 20px',
                                    cursor: 'pointer',
                                    transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#0d9488')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border, #334155)')}
                            >
                                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏢</div>
                                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>{c.name}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                                    {linkedCountFor(c.id)} product{linkedCountFor(c.id) !== 1 ? 's' : ''} linked
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showPoolModal && (
                    <PoolModal poolForm={poolForm} editingPool={editingPool} onClose={() => setShowPoolModal(false)} onSubmit={submitPool} />
                )}
            </>
        );
    }

    // ── Company detail ────────────────────────────────────────────────────────
    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => { setSelectedCompanyId(null); setSearch(''); linkForm.reset(); }}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '14px' }}
                    >← Back</button>
                    <h1 className="page-title">{selectedCompany?.name} — Pool Links</h1>
                </div>
                <button className="btn-primary" onClick={openAddPool}>+ Add Pool</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search product name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {companyUnlinked.length > 0 && (
                        <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowPoolModal(false)}>
                            {/* Link form inline below */}
                        </button>
                    )}
                </div>

                {/* Link form */}
                {companyUnlinked.length > 0 && (
                    <form onSubmit={submitLink} className="form-row" style={{ padding: '0 16px 16px', alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Product</label>
                            <select value={linkForm.data.product_id} onChange={(e) => linkForm.setData('product_id', e.target.value)} required>
                                <option value="">— Select unlinked product —</option>
                                {companyUnlinked.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Inventory Pool</label>
                            <select value={linkForm.data.inventory_pool_id} onChange={(e) => linkForm.setData('inventory_pool_id', e.target.value)} required>
                                <option value="">— Select pool —</option>
                                {pools.map((pool) => (
                                    <option key={pool.id} value={pool.id}>{pool.name} ({Number(pool.stock_qty).toFixed(2)} {pool.unit})</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" className="btn-primary" disabled={linkForm.processing}>Link</button>
                    </form>
                )}

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Pool</th>
                            <th>Stock</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLinks.length === 0 && (
                            <tr><td colSpan={4} className="empty-row">No products linked to a pool for this company.</td></tr>
                        )}
                        {filteredLinks.map((link) => {
                            const pool = pools.find((p) => p.id === link.inventory_pool?.id);
                            return (
                                <tr key={link.id}>
                                    <td className="font-medium">{link.product?.name ?? '—'}</td>
                                    <td>
                                        <span className="badge badge-green">{link.inventory_pool?.name ?? '—'}</span>
                                    </td>
                                    <td>{pool ? `${Number(pool.stock_qty).toFixed(2)} ${pool.unit}` : '—'}</td>
                                    <td className="action-cell">
                                        <button className="btn-icon btn-danger-icon" onClick={() => removeLink(link)} title="Unlink">🗑️</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pools management */}
            <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2>Manage Pools</h2>
                </div>
                <table className="data-table">
                    <thead>
                        <tr><th>Pool</th><th>Stock</th><th>Unit</th><th>Links</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {pools.length === 0 && (
                            <tr><td colSpan={5} className="empty-row">No pools yet.</td></tr>
                        )}
                        {pools.map((pool) => (
                            <tr key={pool.id}>
                                <td className="font-medium">{pool.name}</td>
                                <td>{Number(pool.stock_qty).toFixed(3)}</td>
                                <td>{pool.unit}</td>
                                <td>{pool.links_count}</td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEditPool(pool)}>✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deletePool(pool)}>🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showPoolModal && (
                <PoolModal poolForm={poolForm} editingPool={editingPool} onClose={() => setShowPoolModal(false)} onSubmit={submitPool} />
            )}
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
