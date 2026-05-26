import {
    destroy as productDestroy,
    store as productStore,
    update as productUpdate,
} from '@/routes/settings/products';
import {
    destroy as transportDestroy,
    store as transportStore,
    update as transportUpdate,
} from '@/routes/settings/transports';
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

type TransportEntry = {
    id: number;
    name: string;
    type: 'transport' | 'courier';
    is_active: boolean;
};

type Props = {
    products: Product[];
    transports: TransportEntry[];
};

type ProductForm = {
    name: string;
    hsn_code: string;
    gst_percent: string;
    category: string;
    description: string;
    is_active: boolean;
};

type TransportForm = {
    name: string;
    type: 'transport' | 'courier';
};

const GST_OPTIONS = ['0', '5', '12', '18', '28'];

export default function SettingsIndex({ products, transports }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [editingTransport, setEditingTransport] = useState<TransportEntry | null>(null);
    const [transportTab, setTransportTab] = useState<'transport' | 'courier'>('transport');

    const form = useForm<ProductForm>({
        name: '',
        hsn_code: '',
        gst_percent: '18',
        category: '',
        description: '',
        is_active: true,
    });

    const transportForm = useForm<TransportForm>({
        name: '',
        type: 'transport',
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

    // Transport/Courier handlers
    const openNewTransport = (type: 'transport' | 'courier') => {
        transportForm.setData({ name: '', type });
        transportForm.clearErrors();
        setEditingTransport(null);
        setTransportModalOpen(true);
    };

    const openEditTransport = (t: TransportEntry) => {
        transportForm.setData({ name: t.name, type: t.type });
        transportForm.clearErrors();
        setEditingTransport(t);
        setTransportModalOpen(true);
    };

    const closeTransportModal = () => {
        setTransportModalOpen(false);
        transportForm.reset();
        setEditingTransport(null);
    };

    const saveTransport = () => {
        if (editingTransport) {
            transportForm.patch(transportUpdate(editingTransport.id).url, {
                preserveScroll: true,
                onSuccess: closeTransportModal,
            });
        } else {
            transportForm.post(transportStore().url, {
                preserveScroll: true,
                onSuccess: closeTransportModal,
            });
        }
    };

    const deleteTransport = (t: TransportEntry) => {
        if (!confirm(`Delete "${t.name}"?`)) return;
        transportForm.delete(transportDestroy(t.id).url, { preserveScroll: true });
    };

    const filteredTransports = transports.filter((t) => t.type === transportTab);

    return (
        <>
            <Head title="Settings" />
            <div id="view-settings" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Settings</h1>
                        <p>Manage product catalog, transports, couriers and more</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                        ＋ Add Product
                    </button>
                </div>

                {/* Products */}
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

                {/* Transports & Couriers */}
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="card-title" style={{ marginBottom: '12px' }}>
                        🚛 Transports &amp; Couriers
                        <span className="ct-badge">{transports.length} entries</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                className={`pill${transportTab === 'transport' ? ' active' : ''}`}
                                onClick={() => setTransportTab('transport')}
                            >
                                🚛 Transport ({transports.filter(t => t.type === 'transport').length})
                            </button>
                            <button
                                className={`pill${transportTab === 'courier' ? ' active' : ''}`}
                                onClick={() => setTransportTab('courier')}
                            >
                                📦 Courier ({transports.filter(t => t.type === 'courier').length})
                            </button>
                        </div>
                        <button
                            className="btn primary"
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                            onClick={() => openNewTransport(transportTab)}
                        >
                            ＋ Add {transportTab === 'courier' ? 'Courier' : 'Transport'}
                        </button>
                    </div>

                    {filteredTransports.length === 0 ? (
                        <div className="empty-state" style={{ padding: '28px 20px' }}>
                            <div className="icon">{transportTab === 'courier' ? '📦' : '🚛'}</div>
                            <p>No {transportTab === 'courier' ? 'couriers' : 'transports'} added yet.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransports.map((t) => (
                                        <tr key={t.id}>
                                            <td>
                                                <div className="prod-name">{t.name}</div>
                                            </td>
                                            <td>
                                                <span className={`badge ${t.type === 'courier' ? 'sky' : 'teal'}`}>
                                                    {t.type === 'courier' ? '📦 Courier' : '🚛 Transport'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        className="btn sm"
                                                        onClick={() => openEditTransport(t)}
                                                    >
                                                        Rename
                                                    </button>
                                                    <button
                                                        className="btn danger-xs"
                                                        onClick={() => deleteTransport(t)}
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

            {/* Product Modal */}
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
                                    <span className="field-error">{form.errors.name}</span>
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

            {/* Transport / Courier Modal */}
            <div className={`modal-overlay${transportModalOpen ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '420px' }}>
                    <div className="modal-header">
                        <h2>
                            {editingTransport ? 'Rename' : 'Add'}{' '}
                            {transportForm.data.type === 'courier' ? 'Courier' : 'Transport'}
                        </h2>
                        <button className="modal-close" onClick={closeTransportModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Type</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button
                                    type="button"
                                    className={`pill${transportForm.data.type === 'transport' ? ' active' : ''}`}
                                    onClick={() => transportForm.setData('type', 'transport')}
                                >
                                    🚛 Transport
                                </button>
                                <button
                                    type="button"
                                    className={`pill${transportForm.data.type === 'courier' ? ' active' : ''}`}
                                    onClick={() => transportForm.setData('type', 'courier')}
                                >
                                    📦 Courier
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={transportForm.data.name}
                                onChange={(e) => transportForm.setData('name', e.target.value)}
                                placeholder={
                                    transportForm.data.type === 'courier'
                                        ? 'e.g. DTDC, Blue Dart'
                                        : 'e.g. Sri Logistics'
                                }
                                autoFocus
                            />
                            {transportForm.errors.name && (
                                <span className="field-error">{transportForm.errors.name}</span>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closeTransportModal}>Cancel</button>
                        <button
                            className="btn primary"
                            onClick={saveTransport}
                            disabled={transportForm.processing}
                        >
                            {editingTransport ? 'Save Changes' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
