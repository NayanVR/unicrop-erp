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
    parent_product_id: number | null;
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
    parent?: { id: number; name: string; our_brand: string; packing_size: string } | null;
};

type ParentProduct = { id: number; label: string; name: string; our_brand: string; packing_size: string };

type PageProps = {
    products: Product[];
    rawMaterials: RawMaterial[];
    finishedGoods: FinishedGood[];
    parentProducts: ParentProduct[];
    flash?: { success?: string; error?: string };
};

const defaultForm = {
    raw_material_id: '',
    finished_good_id: '',
    parent_product_id: '' as string | number,
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
    const { products, rawMaterials, finishedGoods, parentProducts, flash } = usePage<PageProps>().props;
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
            parent_product_id: p.parent_product_id ?? '',
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
                            {parentProducts.length > 0 && <th>Parent Product (Unicrop)</th>}
                            <th>{parentProducts.length === 0 ? 'Product Name' : 'Child Product'}</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={parentProducts.length > 0 ? 4 : 3} className="empty-row">No products found.</td></tr>
                        )}
                        {filtered.map((p) => (
                            <tr key={p.id}>
                                {parentProducts.length > 0 && (
                                    <td>
                                        {p.parent ? (
                                            <span className="badge badge-green">
                                                {p.parent.name}{p.parent.packing_size ? ` (${p.parent.packing_size})` : ''}
                                            </span>
                                        ) : <span className="text-muted">—</span>}
                                    </td>
                                )}
                                <td className="font-medium">{p.name}</td>
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
                            {parentProducts.length === 0 ? (
                                /* Unicrop (mother company) — just a product name */
                                <div className="form-group">
                                    <label>Product Name *</label>
                                    <input
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        placeholder="Enter product name"
                                        required
                                    />
                                    {errors.name && <span className="field-error">{errors.name}</span>}
                                </div>
                            ) : (
                                /* Child company — link to a Unicrop (parent) product */
                                <>
                                    <div className="form-group">
                                        <label>Parent Product (Unicrop) *</label>
                                        <SearchableSelect
                                            options={[{ value: '', label: '— Select Unicrop product —' }, ...parentProducts.map((p) => ({ value: p.id, label: p.label }))]}
                                            value={data.parent_product_id}
                                            onChange={(v) => setData('parent_product_id', v)}
                                            placeholder="Search Unicrop product..."
                                        />
                                        {errors.parent_product_id && <span className="field-error">{errors.parent_product_id}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Child Product Name *</label>
                                        <input
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            placeholder="This company's product name"
                                            required
                                        />
                                        {errors.name && <span className="field-error">{errors.name}</span>}
                                    </div>
                                </>
                            )}
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
