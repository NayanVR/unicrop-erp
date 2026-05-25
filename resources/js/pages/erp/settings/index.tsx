import {
    destroy as productDestroy,
    store as productStore,
    update as productUpdate,
} from '@/routes/settings/products';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

type Product = {
    id: number;
    name: string;
    hsn_code?: string | null;
    gst_percent: string | number;
    category?: string | null;
    description?: string | null;
    is_active: boolean;
};

type Props = {
    products: Product[];
};

type ProductForm = {
    name: string;
    hsn_code: string;
    gst_percent: string;
    category: string;
    description: string;
    is_active: boolean;
};

const GST_OPTIONS = ['0', '5', '12', '18', '28'];

export default function SettingsIndex({ products }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const form = useForm<ProductForm>({
        name: '',
        hsn_code: '',
        gst_percent: '18',
        category: '',
        description: '',
        is_active: true,
    });

    const openNew = () => {
        form.reset();
        form.clearErrors();
        setEditingProduct(null);
        setModalOpen(true);
    };

    const openEdit = (p: Product) => {
        form.setData({
            name: p.name,
            hsn_code: p.hsn_code ?? '',
            gst_percent: String(p.gst_percent),
            category: p.category ?? '',
            description: p.description ?? '',
            is_active: p.is_active,
        });
        form.clearErrors();
        setEditingProduct(p);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        form.reset();
        setEditingProduct(null);
    };

    const save = () => {
        if (editingProduct) {
            form.patch(productUpdate(editingProduct.id).url, {
                preserveScroll: true,
                onSuccess: closeModal,
            });
        } else {
            form.post(productStore().url, {
                preserveScroll: true,
                onSuccess: closeModal,
            });
        }
    };

    const deleteProduct = (p: Product) => {
        if (!confirm(`Delete "${p.name}"?`)) return;
        form.delete(productDestroy(p.id).url, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Settings" />
            <div id="view-settings" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Settings</h1>
                        <p>Manage product catalog, HSN codes, and GST rates</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                        ＋ Add Product
                    </button>
                </div>

                <div className="card">
                    <div className="card-title">
                        🌿 Product Catalog
                        <span className="ct-badge">{products.length} products</span>
                    </div>

                    {products.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🌿</div>
                            <p>No products yet. Add your first agrochemical product.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th>HSN Code</th>
                                        <th>GST %</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((p) => (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="prod-name">{p.name}</div>
                                                {p.description && (
                                                    <div className="prod-detail">{p.description}</div>
                                                )}
                                            </td>
                                            <td>{p.hsn_code ?? '—'}</td>
                                            <td>{p.gst_percent}%</td>
                                            <td>{p.category ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${p.is_active ? 'teal' : 'gray'}`}>
                                                    {p.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        className="btn sm"
                                                        onClick={() => openEdit(p)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="btn danger-xs"
                                                        onClick={() => deleteProduct(p)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <div className={`modal-overlay${modalOpen ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '500px' }}>
                    <div className="modal-header">
                        <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                        <button className="modal-close" onClick={closeModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Product Name *</label>
                                <input
                                    type="text"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="e.g. Imidacloprid 17.8% SL"
                                />
                                {form.errors.name && (
                                    <div className="form-error">{form.errors.name}</div>
                                )}
                            </div>
                            <div className="form-group">
                                <label>HSN Code</label>
                                <input
                                    type="text"
                                    value={form.data.hsn_code}
                                    onChange={(e) => form.setData('hsn_code', e.target.value)}
                                    placeholder="e.g. 3808"
                                />
                            </div>
                            <div className="form-group">
                                <label>GST % *</label>
                                <select
                                    value={form.data.gst_percent}
                                    onChange={(e) => form.setData('gst_percent', e.target.value)}
                                >
                                    {GST_OPTIONS.map((g) => (
                                        <option key={g} value={g}>{g}%</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Category</label>
                                <input
                                    type="text"
                                    value={form.data.category}
                                    onChange={(e) => form.setData('category', e.target.value)}
                                    placeholder="e.g. Insecticide, Fungicide"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Description</label>
                                <textarea
                                    value={form.data.description}
                                    onChange={(e) => form.setData('description', e.target.value)}
                                    placeholder="Optional notes"
                                    rows={2}
                                />
                            </div>
                            {editingProduct && (
                                <div className="form-group">
                                    <label>Status</label>
                                    <select
                                        value={form.data.is_active ? 'active' : 'inactive'}
                                        onChange={(e) =>
                                            form.setData('is_active', e.target.value === 'active')
                                        }
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closeModal}>Cancel</button>
                        <button
                            className="btn primary"
                            onClick={save}
                            disabled={form.processing}
                        >
                            {editingProduct ? 'Update' : 'Add Product'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
