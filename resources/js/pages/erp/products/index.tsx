import {
    destroy as productsDestroy,
    store as productsStore,
    update as productsUpdate,
} from '@/routes/products';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';
import SearchableSelect from '@/components/searchable-select';

type RawMaterial = { id: number; name: string };
type FinishedGood = { id: number; name: string };

type Product = {
    id: number;
    raw_material_id: number | null;
    finished_good_id: number | null;
    name: string;
    our_brand: string | null;
    sku: string | null;
    hsn_code: string | null;
    gst_percent: string | number;
    category: string | null;
    packing_size: string | null;
    is_active: boolean;
    raw_material: RawMaterial | null;
    finished_good: FinishedGood | null;
};

type PageProps = {
    products: Product[];
    rawMaterials: RawMaterial[];
    finishedGoods: FinishedGood[];
    flash?: { success?: string; error?: string };
};

const defaultForm = {
    raw_material_id: '',
    finished_good_id: '',
    name: '',
    our_brand: '',
    sku: '',
    hsn_code: '',
    gst_percent: '18',
    category: '',
    packing_size: '',
    is_active: true,
};

export default function ProductsIndex() {
    const { products, rawMaterials, finishedGoods, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [search, setSearch] = useState('');

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (p: Product) => {
        setEditing(p);
        setData({
            raw_material_id: p.raw_material_id?.toString() ?? '',
            finished_good_id: p.finished_good_id?.toString() ?? '',
            name: p.name,
            our_brand: p.our_brand ?? '',
            sku: p.sku ?? '',
            hsn_code: p.hsn_code ?? '',
            gst_percent: p.gst_percent.toString(),
            category: p.category ?? '',
            packing_size: p.packing_size ?? '',
            is_active: p.is_active,
        });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(productsUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(productsStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deleteProduct = (p: Product) => {
        if (!confirm(`Delete product "${p.name}"?`)) return;
        router.delete(productsDestroy(p.id).url);
    };

    const filtered = products.filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q)
            || (p.our_brand ?? '').toLowerCase().includes(q)
            || (p.sku ?? '').toLowerCase().includes(q);
    });

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Products</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Product</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search name, brand or SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Brand</th>
                            <th>SKU</th>
                            <th>Packing Size</th>
                            <th>Linked To</th>
                            <th>GST %</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={8} className="empty-row">No products found.</td></tr>
                        )}
                        {filtered.map((p) => (
                            <tr key={p.id}>
                                <td className="font-medium">{p.name}</td>
                                <td>{p.our_brand ?? '—'}</td>
                                <td><code>{p.sku ?? '—'}</code></td>
                                <td>{p.packing_size ?? '—'}</td>
                                <td>
                                    {p.raw_material ? `Raw: ${p.raw_material.name}` : p.finished_good ? `FG: ${p.finished_good.name}` : '—'}
                                </td>
                                <td>{Number(p.gst_percent).toFixed(2)}%</td>
                                <td>
                                    <span className={`badge ${p.is_active ? 'badge-teal' : 'badge-gray'}`}>
                                        {p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteProduct(p)} title="Delete">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    {errors.name && <span className="field-error">{errors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Our Brand</label>
                                    <input value={data.our_brand} onChange={(e) => setData('our_brand', e.target.value)} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Linked Raw Material</label>
                                    <SearchableSelect
                                        options={[{ value: '', label: '— None —' }, ...rawMaterials.map((m) => ({ value: m.id, label: m.name }))]}
                                        value={data.raw_material_id}
                                        onChange={(v) => setData('raw_material_id', v)}
                                        placeholder="— Search raw material —"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Linked Finished Good</label>
                                    <SearchableSelect
                                        options={[{ value: '', label: '— None —' }, ...finishedGoods.map((g) => ({ value: g.id, label: g.name }))]}
                                        value={data.finished_good_id}
                                        onChange={(v) => setData('finished_good_id', v)}
                                        placeholder="— Search finished good —"
                                    />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>SKU</label>
                                    <input value={data.sku} onChange={(e) => setData('sku', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Packing Size</label>
                                    <input value={data.packing_size} onChange={(e) => setData('packing_size', e.target.value)} placeholder="e.g. 1L, 500ml" />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>HSN Code</label>
                                    <input value={data.hsn_code} onChange={(e) => setData('hsn_code', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>GST % *</label>
                                    <input type="number" step="0.01" min="0" max="100" value={data.gst_percent} onChange={(e) => setData('gst_percent', e.target.value)} required />
                                    {errors.gst_percent && <span className="field-error">{errors.gst_percent}</span>}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <input value={data.category} onChange={(e) => setData('category', e.target.value)} />
                            </div>
                            {editing && (
                                <div className="form-group">
                                    <label>
                                        <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} /> Active
                                    </label>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Add Product'}
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
