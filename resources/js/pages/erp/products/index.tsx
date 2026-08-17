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
    finished_good_id: number | null;
    company?: Company | null;
    finished_good?: { id: number; name: string } | null;
};

type ChildProduct = { id: number; company_id: number; name: string };

type PageProps = {
    products: Product[];
    unicropProducts: UnicropProduct[];
    companies: Company[];
    childProducts: Record<string, ChildProduct[]>;
    flash?: { success?: string; error?: string };
};

const defaultForm = {
    company_id: '' as string | number,
    name: '',
    finished_good_id: '' as string | number,
};

export default function ProductsIndex() {
    const { products, unicropProducts, companies, childProducts, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [search, setSearch] = useState('');

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        if (selectedCompanyId) setData('company_id', selectedCompanyId);
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (p: Product) => {
        setEditing(p);
        setData({
            company_id: p.company?.id ?? '',
            name: p.name,
            finished_good_id: p.finished_good_id ?? '',
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

    const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    // Products filtered by selected company + search
    const filtered = products.filter((p) => {
        if (selectedCompanyId && p.company?.id !== selectedCompanyId) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q)
            || (p.finished_good?.name ?? '').toLowerCase().includes(q);
    });

    // Product count per company
    const countFor = (companyId: number) => products.filter(p => p.company?.id === companyId).length;

    // If no company selected, show company list
    if (!selectedCompanyId) {
        return (
            <>
                <div className="page-header">
                    <h1 className="page-title">Product Mappings</h1>
                </div>

                {flash?.success && <div className="alert-success">{flash.success}</div>}
                {flash?.error && <div className="alert-error">{flash.error}</div>}

                {companies.length === 0 ? (
                    <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                        No child companies found. Add companies first.
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
                                    transition: 'border-color 0.15s, transform 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d9488')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border, #334155)')}
                            >
                                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🏢</div>
                                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '6px' }}>{c.name}</div>
                                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                                    {countFor(c.id)} product{countFor(c.id) !== 1 ? 's' : ''} linked
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        );
    }

    // Company selected — show its product mappings
    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                        onClick={() => { setSelectedCompanyId(null); setSearch(''); }}
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '14px' }}
                    >← Back</button>
                    <h1 className="page-title">{selectedCompany?.name} — Products</h1>
                </div>
                <button className="btn-primary" onClick={openAdd}>+ Add Mapping</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <div className="card-toolbar">
                    <input
                        type="search"
                        className="search-input"
                        placeholder="Search product name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Unicrop Product</th>
                            <th>Child Product Name</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={3} className="empty-row">No product mappings for this company.</td></tr>
                        )}
                        {filtered.map((p) => (
                            <tr key={p.id}>
                                <td>
                                    {p.finished_good ? (
                                        <span className="badge badge-green">{p.finished_good.name}</span>
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
                            <h2>{editing ? 'Edit Mapping' : `Add Mapping — ${selectedCompany?.name}`}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
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
                                    value={data.finished_good_id}
                                    onChange={(v) => setData('finished_good_id', v)}
                                    placeholder="Search Unicrop product..."
                                />
                                {errors.finished_good_id && <span className="field-error">{errors.finished_good_id}</span>}
                            </div>

                            <div className="form-group">
                                <label>Child Product *</label>
                                {(() => {
                                    const cid = String(data.company_id || selectedCompanyId || '');
                                    const opts = childProducts[cid] ?? childProducts[Number(cid)] ?? [];
                                    return opts.length === 0 ? (
                                        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>
                                            No finished goods found for this company.
                                        </p>
                                    ) : (
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '— Select child product —' },
                                                ...opts.map((p) => ({ value: p.name, label: p.name })),
                                            ]}
                                            value={data.name}
                                            onChange={(v) => setData('name', String(v))}
                                            placeholder="Search child product..."
                                        />
                                    );
                                })()}
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
