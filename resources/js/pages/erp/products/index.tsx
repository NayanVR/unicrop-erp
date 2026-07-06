import {
    destroy as productsDestroy,
    store as productsStore,
    update as productsUpdate,
} from '@/routes/products';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';
import SearchableSelect from '@/components/searchable-select';

type Company = { id: number; name: string };
type UnicropProduct = { id: number; name: string; packing_size: string | null };

type Product = {
    id: number;
    name: string;
    parent_product_id: number | null;
    company?: Company | null;
    parent?: { id: number; name: string; packing_size: string | null } | null;
};

type PageProps = {
    products: Product[];
    unicropProducts: UnicropProduct[];
    companies: Company[];
    flash?: { success?: string; error?: string };
};

const defaultForm = {
    company_id: '' as string | number,
    name: '',
    parent_product_id: '' as string | number,
};

export default function ProductsIndex() {
    const { products, unicropProducts, companies, flash } = usePage<PageProps>().props;
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
            company_id: p.company?.id ?? '',
            name: p.name,
            parent_product_id: p.parent_product_id ?? '',
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
        if (!confirm(`Delete mapping for "${p.name}"?`)) return;
        router.delete(productsDestroy(p.id).url);
    };

    const filtered = products.filter((p) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q)
            || (p.company?.name ?? '').toLowerCase().includes(q)
            || (p.parent?.name ?? '').toLowerCase().includes(q);
    });

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Product Mappings</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Mapping</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <div className="card-toolbar">
                    <input
                        className="search-input"
                        placeholder="Search company, product name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Company</th>
                            <th>Unicrop Product</th>
                            <th>Child Product Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={4} className="empty-row">No product mappings found.</td></tr>
                        )}
                        {filtered.map((p) => (
                            <tr key={p.id}>
                                <td>{p.company?.name ?? <span className="text-muted">—</span>}</td>
                                <td>
                                    {p.parent ? (
                                        <span className="badge badge-green">
                                            {p.parent.name}{p.parent.packing_size ? ` (${p.parent.packing_size})` : ''}
                                        </span>
                                    ) : <span className="text-muted">—</span>}
                                </td>
                                <td className="font-medium">{p.name}</td>
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
                            <h2>{editing ? 'Edit Mapping' : 'Add Product Mapping'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-group">
                                <label>Child Company *</label>
                                <select
                                    value={data.company_id}
                                    onChange={(e) => setData('company_id', e.target.value)}
                                    required
                                    disabled={!!editing}
                                >
                                    <option value="">— Select company —</option>
                                    {companies.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                {errors.company_id && <span className="field-error">{errors.company_id}</span>}
                            </div>

                            <div className="form-group">
                                <label>Unicrop Product *</label>
                                <SearchableSelect
                                    options={[
                                        { value: '', label: '— Select Unicrop product —' },
                                        ...unicropProducts.map((p) => ({
                                            value: p.id,
                                            label: p.packing_size ? `${p.name} (${p.packing_size})` : p.name,
                                        })),
                                    ]}
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
                                    placeholder="What this company calls the product"
                                    required
                                />
                                {errors.name && <span className="field-error">{errors.name}</span>}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Add Mapping'}
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
