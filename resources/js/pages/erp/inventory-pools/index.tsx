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

type PageProps = {
    pools: Pool[];
    links: Link[];
    products: Product[];
    flash?: { success?: string; error?: string };
};

const defaultPoolForm = { name: '', stock_qty: '0', unit: 'L', notes: '' };
const defaultLinkForm = { product_id: '', inventory_pool_id: '' };

export default function InventoryPoolsIndex() {
    const { pools, links, products, flash } = usePage<PageProps>().props;
    const [showPoolModal, setShowPoolModal] = useState(false);
    const [editingPool, setEditingPool] = useState<Pool | null>(null);

    const poolForm = useForm(defaultPoolForm);
    const linkForm = useForm(defaultLinkForm);

    const openAddPool = () => {
        poolForm.reset();
        setEditingPool(null);
        setShowPoolModal(true);
    };

    const openEditPool = (pool: Pool) => {
        setEditingPool(pool);
        poolForm.setData({
            name: pool.name,
            stock_qty: pool.stock_qty.toString(),
            unit: pool.unit,
            notes: pool.notes ?? '',
        });
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

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Shared Inventory Pools</h1>
                <button className="btn-primary" onClick={openAddPool}>+ Add Pool</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <table className="data-table">
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
                            <tr><td colSpan={6} className="empty-row">No inventory pools yet.</td></tr>
                        )}
                        {pools.map((pool) => (
                            <tr key={pool.id}>
                                <td className="font-medium">{pool.name}</td>
                                <td>{Number(pool.stock_qty).toFixed(3)}</td>
                                <td>{pool.unit}</td>
                                <td>{pool.links_count}</td>
                                <td>{pool.notes ?? '—'}</td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEditPool(pool)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deletePool(pool)} title="Delete">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <h2>Link a Product to a Pool</h2>
                </div>
                <form onSubmit={submitLink} className="form-row" style={{ padding: '1rem', alignItems: 'flex-end' }}>
                    <div className="form-group">
                        <label>Product</label>
                        <select
                            value={linkForm.data.product_id}
                            onChange={(e) => linkForm.setData('product_id', e.target.value)}
                            required
                        >
                            <option value="">— Select unlinked product —</option>
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>{p.name} ({p.company.name})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Inventory Pool</label>
                        <select
                            value={linkForm.data.inventory_pool_id}
                            onChange={(e) => linkForm.setData('inventory_pool_id', e.target.value)}
                            required
                        >
                            <option value="">— Select pool —</option>
                            {pools.map((pool) => (
                                <option key={pool.id} value={pool.id}>{pool.name}</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="btn-primary" disabled={linkForm.processing}>Link</button>
                </form>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <h2>Active Links</h2>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Company</th>
                            <th>Pool</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {links.length === 0 && (
                            <tr><td colSpan={4} className="empty-row">No products linked yet.</td></tr>
                        )}
                        {links.map((link) => (
                            <tr key={link.id}>
                                <td>{link.product?.name ?? '—'}</td>
                                <td>{link.product?.company?.name ?? '—'}</td>
                                <td>{link.inventory_pool?.name ?? '—'}</td>
                                <td className="action-cell">
                                    <button className="btn-icon btn-danger-icon" onClick={() => removeLink(link)} title="Unlink">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showPoolModal && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setShowPoolModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingPool ? 'Edit Pool' : 'Add Pool'}</h2>
                            <button className="modal-close" onClick={() => setShowPoolModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submitPool} className="modal-form">
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
                                <button type="button" className="btn-secondary" onClick={() => setShowPoolModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={poolForm.processing}>
                                    {poolForm.processing ? 'Saving…' : editingPool ? 'Update' : 'Add Pool'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </ModalPortal>
            )}
        </>
    );
}
