import ErpLayout from '@/layouts/erp-layout';
import {
    destroy as partyDestroy,
    store as partyStore,
    update as partyUpdate,
} from '@/routes/parties';
import { destroy as docDestroy, upload as docUpload } from '@/routes/parties/documents';
import {
    destroy as rateDestroy,
    store as rateStore,
    update as rateUpdate,
} from '@/routes/parties/product-rates';
import { router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';

type Document = {
    id: number;
    type: string;
    label: string | null;
    original_name: string;
    size: number | null;
    created_at: string;
};

type PartyProduct = {
    id: number;
    our_brand: string;
    party_brand: string | null;
    packing_size: string;
    rate: string | number;
    gst_percent: string | number;
};

type Transport = { id: number; name: string };

type Party = {
    id: number;
    name: string;
    type: 'customer' | 'supplier' | 'both';
    gst_no: string | null;
    pan_no: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    notes: string | null;
    is_active: boolean;
    default_transport_type: 'transport' | 'courier' | null;
    default_transport_id: number | null;
    documents_count: number;
    product_rates: PartyProduct[];
    created_at: string;
};

type Stats = { total: number; customers: number; suppliers: number; active: number };

type PageProps = {
    parties: Party[];
    stats: Stats;
    transports: Transport[];
    couriers: Transport[];
    flash?: { success?: string; error?: string };
};

const TYPE_COLORS: Record<string, string> = {
    customer: 'badge-teal',
    supplier: 'badge-blue',
    both: 'badge-yellow',
};

const GST_OPTIONS = ['0', '5', '12', '18', '28'];

const defaultPartyForm = {
    name: '',
    type: 'customer' as 'customer' | 'supplier' | 'both',
    gst_no: '',
    pan_no: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    notes: '',
    default_transport_type: '' as '' | 'transport' | 'courier',
    default_transport_id: '' as '' | number,
};

const defaultProductForm = {
    our_brand: '',
    party_brand: '',
    packing_size: '',
    rate: '',
    gst_percent: '18',
};

export default function PartiesIndex() {
    const { parties, stats, transports, couriers, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Party | null>(null);
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [showDocModal, setShowDocModal] = useState(false);
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<PartyProduct | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'customer' | 'supplier' | 'both'>('all');
    const fileRef = useRef<HTMLInputElement>(null);

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultPartyForm);
    const docForm = useForm({ type: 'other', label: '', file: null as File | null });
    const productForm = useForm(defaultProductForm);

    // All known brand names across all parties (for datalist suggestions)
    const allBrands = useMemo(
        () => [...new Set(parties.flatMap((p) => p.product_rates.map((r) => r.our_brand)))].sort(),
        [parties],
    );

    // Current party's products (kept in sync via usePage)
    const currentPartyProducts = useMemo(
        () => parties.find((p) => p.id === selectedParty?.id)?.product_rates ?? [],
        [parties, selectedParty],
    );

    // ── Party CRUD ────────────────────────────────────────────────────────
    const openAdd = () => { reset(); setEditing(null); setShowModal(true); };

    const openEdit = (p: Party) => {
        setEditing(p);
        setData({ name: p.name, type: p.type, gst_no: p.gst_no ?? '', pan_no: p.pan_no ?? '', phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '', city: p.city ?? '', state: p.state ?? '', pincode: p.pincode ?? '', notes: p.notes ?? '', default_transport_type: p.default_transport_type ?? '', default_transport_id: p.default_transport_id ?? '' });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(partyUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(partyStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deleteParty = (p: Party) => {
        if (!confirm(`Delete party "${p.name}"? All documents and product rates will also be removed.`)) return;
        router.delete(partyDestroy(p.id).url);
    };

    // ── Documents ─────────────────────────────────────────────────────────
    const openDocs = (p: Party) => { setSelectedParty(p); setShowDocModal(true); };

    const submitDoc = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedParty || !docForm.data.file) return;
        const fd = new FormData();
        fd.append('type', docForm.data.type);
        if (docForm.data.label) fd.append('label', docForm.data.label);
        fd.append('file', docForm.data.file);
        router.post(docUpload(selectedParty.id).url, fd, {
            onSuccess: () => { docForm.reset(); if (fileRef.current) fileRef.current.value = ''; },
        });
    };

    const deleteDoc = (doc: Document) => {
        if (!confirm(`Remove document "${doc.original_name}"?`)) return;
        router.delete(docDestroy(doc.id).url);
    };

    // ── Product Rates ─────────────────────────────────────────────────────
    const openProducts = (p: Party) => {
        setSelectedParty(p);
        setEditingProduct(null);
        productForm.reset();
        setShowProductModal(true);
    };

    const startEditProduct = (pr: PartyProduct) => {
        setEditingProduct(pr);
        productForm.setData({
            our_brand: pr.our_brand,
            party_brand: pr.party_brand ?? '',
            packing_size: pr.packing_size,
            rate: String(pr.rate),
            gst_percent: String(pr.gst_percent),
        });
    };

    const cancelEditProduct = () => {
        setEditingProduct(null);
        productForm.reset();
        productForm.clearErrors();
    };

    const submitProduct = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedParty) return;
        if (editingProduct) {
            productForm.patch(rateUpdate(editingProduct.id).url, {
                preserveScroll: true,
                onSuccess: cancelEditProduct,
            });
        } else {
            productForm.post(rateStore(selectedParty.id).url, {
                preserveScroll: true,
                onSuccess: () => { productForm.reset(); productForm.clearErrors(); },
            });
        }
    };

    const deleteProduct = (pr: PartyProduct) => {
        if (!confirm(`Delete rate for "${pr.our_brand} – ${pr.packing_size}"?`)) return;
        router.delete(rateDestroy(pr.id).url, { preserveScroll: true });
    };

    // ── Filtering ─────────────────────────────────────────────────────────
    const filtered = parties.filter((p) => {
        if (filter !== 'all' && p.type !== filter) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    return (
        <ErpLayout>
            <div className="page-header">
                <h1 className="page-title">Parties</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Party</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="stats-grid">
                <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
                <div className="stat-card"><div className="stat-value">{stats.customers}</div><div className="stat-label">Customers</div></div>
                <div className="stat-card"><div className="stat-value">{stats.suppliers}</div><div className="stat-label">Suppliers</div></div>
                <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label">Active</div></div>
            </div>

            <div className="card">
                <div className="card-toolbar">
                    <input className="search-input" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="filter-tabs">
                        {(['all', 'customer', 'supplier', 'both'] as const).map((f) => (
                            <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '860px' }}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>GST No.</th>
                            <th>Phone</th>
                            <th>City / State</th>
                            <th>Products</th>
                            <th>Docs</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr><td colSpan={9} className="empty-row">No parties found.</td></tr>
                        )}
                        {filtered.map((p) => (
                            <tr key={p.id}>
                                <td className="font-medium">{p.name}</td>
                                <td><span className={`badge ${TYPE_COLORS[p.type]}`}>{p.type}</span></td>
                                <td className="text-muted"><code>{p.gst_no ?? '—'}</code></td>
                                <td className="text-muted">{p.phone ?? '—'}</td>
                                <td className="text-muted">{[p.city, p.state].filter(Boolean).join(', ') || '—'}</td>
                                <td>
                                    <button className="btn-xs btn-teal" onClick={() => openProducts(p)}>
                                        📦 {p.product_rates.length}
                                    </button>
                                </td>
                                <td>
                                    <button className="btn-xs btn-secondary" onClick={() => openDocs(p)}>
                                        📄 {p.documents_count}
                                    </button>
                                </td>
                                <td>
                                    <span className={`badge ${p.is_active ? 'badge-teal' : 'badge-gray'}`}>
                                        {p.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteParty(p)} title="Delete">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </div>

            {/* ── Add/Edit Party Modal ── */}
            {showModal && (
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Party' : 'Add Party'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Name *</label>
                                    <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                    {errors.name && <span className="field-error">{errors.name}</span>}
                                </div>
                                <div className="form-group">
                                    <label>Type *</label>
                                    <select value={data.type} onChange={(e) => setData('type', e.target.value as typeof data.type)}>
                                        <option value="customer">Customer</option>
                                        <option value="supplier">Supplier</option>
                                        <option value="both">Both</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>GST No.</label><input value={data.gst_no} onChange={(e) => setData('gst_no', e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
                                <div className="form-group"><label>PAN No.</label><input value={data.pan_no} onChange={(e) => setData('pan_no', e.target.value)} placeholder="AAAAA0000A" /></div>
                                <div className="form-group"><label>Phone</label><input value={data.phone} onChange={(e) => setData('phone', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Email</label><input type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} /></div>
                                <div className="form-group" style={{ flex: 2 }}><label>Address</label><input value={data.address} onChange={(e) => setData('address', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>City</label><input value={data.city} onChange={(e) => setData('city', e.target.value)} /></div>
                                <div className="form-group"><label>State</label><input value={data.state} onChange={(e) => setData('state', e.target.value)} /></div>
                                <div className="form-group"><label>Pincode</label><input value={data.pincode} onChange={(e) => setData('pincode', e.target.value)} /></div>
                            </div>
                            <div className="form-group"><label>Notes</label><textarea value={data.notes} onChange={(e) => setData('notes', e.target.value)} rows={2} /></div>
                            <div className="form-group">
                                <label>Default Transport</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        value={data.default_transport_type}
                                        onChange={(e) => setData({ ...data, default_transport_type: e.target.value as '' | 'transport' | 'courier', default_transport_id: '' })}
                                        style={{ width: '130px', flexShrink: 0 }}
                                    >
                                        <option value="">— Type —</option>
                                        <option value="transport">🚛 Transport</option>
                                        <option value="courier">📦 Courier</option>
                                    </select>
                                    <select
                                        value={data.default_transport_id}
                                        onChange={(e) => setData('default_transport_id', e.target.value ? Number(e.target.value) : '')}
                                        disabled={!data.default_transport_type}
                                        style={{ flex: 1 }}
                                    >
                                        <option value="">— Select —</option>
                                        {(data.default_transport_type === 'courier' ? couriers : transports).map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>{processing ? 'Saving…' : editing ? 'Update' : 'Add Party'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Product Rates Modal ── */}
            {showProductModal && selectedParty && (
                <div className="modal-overlay open" onClick={() => { setShowProductModal(false); cancelEditProduct(); }}>
                    <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📦 Products — {selectedParty.name}</h2>
                            <button className="modal-close" onClick={() => { setShowProductModal(false); cancelEditProduct(); }}>✕</button>
                        </div>
                        <div className="modal-form">
                            {/* Add / Edit form */}
                            <form onSubmit={submitProduct} style={{ background: 'var(--bg-paper)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                    {editingProduct ? `✏️ Editing — ${editingProduct.our_brand} / ${editingProduct.packing_size}` : '＋ Add Product Rate'}
                                </div>
                                <div className="form-row" style={{ flexWrap: 'wrap', gap: '10px' }}>
                                    <div className="form-group" style={{ flex: '1 1 160px' }}>
                                        <label>Our Brand *</label>
                                        <input
                                            type="text"
                                            list="all-brands-list"
                                            value={productForm.data.our_brand}
                                            onChange={(e) => productForm.setData('our_brand', e.target.value)}
                                            placeholder="Our brand name"
                                            required
                                        />
                                        <datalist id="all-brands-list">
                                            {allBrands.map((b) => <option key={b} value={b} />)}
                                        </datalist>
                                        {productForm.errors.our_brand && <span className="field-error">{productForm.errors.our_brand}</span>}
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 160px' }}>
                                        <label>Party Brand</label>
                                        <input type="text" value={productForm.data.party_brand} onChange={(e) => productForm.setData('party_brand', e.target.value)} placeholder="Customer-facing name" />
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 110px' }}>
                                        <label>Packing Size *</label>
                                        <input type="text" value={productForm.data.packing_size} onChange={(e) => productForm.setData('packing_size', e.target.value)} placeholder="500ml, 1ltr…" required />
                                        {productForm.errors.packing_size && <span className="field-error">{productForm.errors.packing_size}</span>}
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 100px' }}>
                                        <label>Rate (₹) *</label>
                                        <input type="number" value={productForm.data.rate} onChange={(e) => productForm.setData('rate', e.target.value)} min="0" step="0.01" placeholder="0.00" required />
                                        {productForm.errors.rate && <span className="field-error">{productForm.errors.rate}</span>}
                                    </div>
                                    <div className="form-group" style={{ flex: '1 1 80px' }}>
                                        <label>GST %</label>
                                        <select value={productForm.data.gst_percent} onChange={(e) => productForm.setData('gst_percent', e.target.value)}>
                                            {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
                                        <label>&nbsp;</label>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button type="submit" className="btn-primary" disabled={productForm.processing} style={{ padding: '8px 14px', fontSize: '13px' }}>
                                                {productForm.processing ? '…' : editingProduct ? 'Update' : 'Save'}
                                            </button>
                                            {editingProduct && (
                                                <button type="button" className="btn-secondary" onClick={cancelEditProduct} style={{ padding: '8px 12px', fontSize: '13px' }}>
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </form>

                            {/* Products table */}
                            {currentPartyProducts.length === 0 ? (
                                <p className="text-muted" style={{ textAlign: 'center', padding: '20px' }}>No products added yet for this party.</p>
                            ) : (
                                <div className="prod-wrap">
                                    <table className="prod-table">
                                        <thead>
                                            <tr>
                                                <th>Our Brand</th>
                                                <th>Party Brand</th>
                                                <th>Packing Size</th>
                                                <th>Rate (₹)</th>
                                                <th>GST %</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentPartyProducts.map((pr) => (
                                                <tr key={pr.id} style={editingProduct?.id === pr.id ? { background: 'var(--accent-lt)' } : undefined}>
                                                    <td className="font-medium">{pr.our_brand}</td>
                                                    <td className="text-muted">{pr.party_brand ?? '—'}</td>
                                                    <td><span className="badge badge-blue">{pr.packing_size}</span></td>
                                                    <td style={{ fontWeight: 600 }}>₹{Number(pr.rate).toFixed(2)}</td>
                                                    <td>{pr.gst_percent}%</td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button className="btn-xs btn-secondary" onClick={() => startEditProduct(pr)}>Edit</button>
                                                            <button className="btn-icon btn-danger-icon" style={{ width: '26px', height: '26px', fontSize: '12px' }} onClick={() => deleteProduct(pr)}>🗑️</button>
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
                </div>
            )}

            {/* ── Documents Modal ── */}
            {showDocModal && selectedParty && (
                <div className="modal-overlay open" onClick={() => setShowDocModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Documents — {selectedParty.name}</h2>
                            <button className="modal-close" onClick={() => setShowDocModal(false)}>✕</button>
                        </div>
                        <div className="modal-form">
                            <form onSubmit={submitDoc}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Document Type</label>
                                        <select value={docForm.data.type} onChange={(e) => docForm.setData('type', e.target.value)}>
                                            <option value="gst_certificate">GST Certificate</option>
                                            <option value="pan_card">PAN Card</option>
                                            <option value="agreement">Agreement</option>
                                            <option value="invoice">Invoice</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Label</label>
                                        <input value={docForm.data.label} onChange={(e) => docForm.setData('label', e.target.value)} placeholder="Optional description" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>File *</label>
                                    <input ref={fileRef} type="file" onChange={(e) => docForm.setData('file', e.target.files?.[0] ?? null)} required />
                                </div>
                                <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
                                    <button type="submit" className="btn-primary" disabled={docForm.processing || !docForm.data.file}>
                                        {docForm.processing ? 'Uploading…' : '⬆ Upload'}
                                    </button>
                                </div>
                            </form>
                            <hr className="divider" />
                            {(parties.find((p) => p.id === selectedParty.id)?.documents_count ?? 0) === 0 ? (
                                <p className="text-muted">No documents uploaded yet.</p>
                            ) : (
                                <p className="text-muted text-sm">Documents list will appear after upload. Reload to refresh.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </ErpLayout>
    );
}
