import ErpLayout from '@/layouts/erp-layout';
import {
    destroy as partyDestroy,
    store as partyStore,
    update as partyUpdate,
} from '@/routes/parties';
import { destroy as docDestroy, upload as docUpload } from '@/routes/parties/documents';
import { store as productPhotoStore } from '@/routes/parties/product-photo';
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

type PartyPhoto = {
    id: number;
    party_id: number;
    our_brand: string;
    party_brand: string | null;
    photo_url: string;
};

type ProductGroup = {
    our_brand: string;
    party_brand: string | null;
    photoUrl: string | null;
    sizes: PartyProduct[];
};

type Transport = { id: number; name: string };

type Party = {
    id: number;
    name: string;
    customer_name: string | null;
    type: 'customer' | 'supplier' | 'both';
    gst_no: string | null;
    pan_no: string | null;
    pan_card_url: string | null;
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
    partyPhotos: PartyPhoto[];
    stats: Stats;
    transports: Transport[];
    couriers: Transport[];
    defaultFilter?: 'all' | 'customer' | 'supplier' | 'both';
    pageTitle?: string;
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
    customer_name: '',
    type: 'customer' as 'customer' | 'supplier' | 'both',
    gst_no: '',
    pan_no: '',
    pan_card_file: null as File | null,
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

export default function PartiesIndex() {
    const { parties, partyPhotos, stats, transports, couriers, defaultFilter, pageTitle, flash } = usePage<PageProps>().props;

    // ── Party modal state ──────────────────────────────────────────────────
    const [showModal,   setShowModal]   = useState(false);
    const [editing,     setEditing]     = useState<Party | null>(null);

    // ── Document modal state ───────────────────────────────────────────────
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [showDocModal,  setShowDocModal]  = useState(false);

    // ── Product modal state ────────────────────────────────────────────────
    const [showProductModal, setShowProductModal] = useState(false);
    const [editingProduct,   setEditingProduct]   = useState<PartyProduct | null>(null);
    const [showAddProduct,   setShowAddProduct]   = useState(false);
    const [addingSizeFor,    setAddingSizeFor]     = useState<ProductGroup | null>(null);
    const [uploadingFor,     setUploadingFor]      = useState<ProductGroup | null>(null);
    const [lightboxUrl,      setLightboxUrl]       = useState<string | null>(null);

    // ── Filters ────────────────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'customer' | 'supplier' | 'both'>(defaultFilter ?? 'all');

    // ── Refs ───────────────────────────────────────────────────────────────
    const docFileRef    = useRef<HTMLInputElement>(null);
    const photoFileRef  = useRef<HTMLInputElement>(null);
    const panFileRef    = useRef<HTMLInputElement>(null);

    // ── Forms ──────────────────────────────────────────────────────────────
    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultPartyForm);

    const docForm = useForm({ type: 'other', label: '', file: null as File | null });

    const productForm = useForm({
        our_brand: '', party_brand: '', packing_size: '', rate: '', gst_percent: '18',
    });

    const addSizeForm = useForm({
        our_brand: '', party_brand: '', packing_size: '', rate: '', gst_percent: '18',
    });

    const photoForm = useForm({ photo: null as File | null });

    // ── Computed ───────────────────────────────────────────────────────────
    const allBrands = useMemo(
        () => [...new Set(parties.flatMap((p) => p.product_rates.map((r) => r.our_brand)))].sort(),
        [parties],
    );

    const currentPartyProducts = useMemo(
        () => parties.find((p) => p.id === selectedParty?.id)?.product_rates ?? [],
        [parties, selectedParty],
    );

    const photoLookup = useMemo(() => {
        const map = new Map<string, string>();
        for (const ph of partyPhotos) {
            const key = `${ph.party_id}|${ph.our_brand.toLowerCase()}|${(ph.party_brand ?? '').toLowerCase()}`;
            map.set(key, ph.photo_url);
        }
        return map;
    }, [partyPhotos]);

    const productGroups = useMemo((): ProductGroup[] => {
        if (!selectedParty) return [];
        const map = new Map<string, ProductGroup>();
        for (const pr of currentPartyProducts) {
            const key = `${pr.our_brand.toLowerCase()}|${(pr.party_brand ?? '').toLowerCase()}`;
            if (!map.has(key)) {
                const photoKey = `${selectedParty.id}|${pr.our_brand.toLowerCase()}|${(pr.party_brand ?? '').toLowerCase()}`;
                map.set(key, {
                    our_brand: pr.our_brand,
                    party_brand: pr.party_brand,
                    photoUrl: photoLookup.get(photoKey) ?? null,
                    sizes: [],
                });
            }
            map.get(key)!.sizes.push(pr);
        }
        return [...map.values()];
    }, [currentPartyProducts, photoLookup, selectedParty]);

    const filtered = useMemo(
        () => parties.filter((p) => {
            if (filter !== 'all' && p.type !== filter) return false;
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        }),
        [parties, filter, search],
    );

    // ── Party CRUD ─────────────────────────────────────────────────────────
    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
        if (panFileRef.current) panFileRef.current.value = '';
    };

    const openEdit = (p: Party) => {
        setEditing(p);
        setData({ name: p.name, customer_name: p.customer_name ?? '', type: p.type, gst_no: p.gst_no ?? '', pan_no: p.pan_no ?? '', phone: p.phone ?? '', email: p.email ?? '', address: p.address ?? '', city: p.city ?? '', state: p.state ?? '', pincode: p.pincode ?? '', notes: p.notes ?? '', default_transport_type: p.default_transport_type ?? '', default_transport_id: p.default_transport_id ?? '' });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const opts = {
            forceFormData: true,
            onSuccess: () => {
                setShowModal(false);
                reset();
                if (panFileRef.current) panFileRef.current.value = '';
            },
        };
        if (editing) {
            patch(partyUpdate(editing.id).url, opts);
        } else {
            post(partyStore().url, opts);
        }
    };

    const deleteParty = (p: Party) => {
        if (!confirm(`Delete party "${p.name}"? All documents and product rates will also be removed.`)) return;
        router.delete(partyDestroy(p.id).url);
    };

    // ── Documents ──────────────────────────────────────────────────────────
    const openDocs = (p: Party) => { setSelectedParty(p); setShowDocModal(true); };

    const submitDoc = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedParty || !docForm.data.file) return;
        const fd = new FormData();
        fd.append('type', docForm.data.type);
        if (docForm.data.label) fd.append('label', docForm.data.label);
        fd.append('file', docForm.data.file);
        router.post(docUpload(selectedParty.id).url, fd, {
            onSuccess: () => { docForm.reset(); if (docFileRef.current) docFileRef.current.value = ''; },
        });
    };

    const deleteDoc = (doc: Document) => {
        if (!confirm(`Remove document "${doc.original_name}"?`)) return;
        router.delete(docDestroy(doc.id).url);
    };

    // ── Product modal helpers ──────────────────────────────────────────────
    const openProducts = (p: Party) => {
        setSelectedParty(p);
        setEditingProduct(null);
        setShowAddProduct(false);
        setAddingSizeFor(null);
        setUploadingFor(null);
        productForm.reset();
        setShowProductModal(true);
    };

    const closeProducts = () => {
        setShowProductModal(false);
        setEditingProduct(null);
        setShowAddProduct(false);
        setAddingSizeFor(null);
        setUploadingFor(null);
        productForm.reset();
        addSizeForm.reset();
        photoForm.reset();
    };

    // ── Add / edit product rate ────────────────────────────────────────────
    const startEditProduct = (pr: PartyProduct) => {
        setEditingProduct(pr);
        setShowAddProduct(true);
        setAddingSizeFor(null);
        productForm.setData({
            our_brand: pr.our_brand, party_brand: pr.party_brand ?? '',
            packing_size: pr.packing_size, rate: String(pr.rate), gst_percent: String(pr.gst_percent),
        });
    };

    const cancelEditProduct = () => {
        setEditingProduct(null);
        setShowAddProduct(false);
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
                onSuccess: () => { productForm.reset(); productForm.clearErrors(); setShowAddProduct(false); },
            });
        }
    };

    const deleteProduct = (pr: PartyProduct) => {
        if (!confirm(`Delete size "${pr.packing_size}" for "${pr.our_brand}"?`)) return;
        router.delete(rateDestroy(pr.id).url, { preserveScroll: true });
    };

    // ── Add size to existing brand ─────────────────────────────────────────
    const openAddSize = (group: ProductGroup) => {
        addSizeForm.setData({ our_brand: group.our_brand, party_brand: group.party_brand ?? '', packing_size: '', rate: '', gst_percent: '18' });
        addSizeForm.clearErrors();
        setAddingSizeFor(group);
        setUploadingFor(null);
        setShowAddProduct(false);
        setEditingProduct(null);
    };

    const submitAddSize = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedParty) return;
        addSizeForm.post(rateStore(selectedParty.id).url, {
            preserveScroll: true,
            onSuccess: () => { addSizeForm.reset(); setAddingSizeFor(null); },
        });
    };

    // ── Photo upload for brand card ────────────────────────────────────────
    const openPhotoUpload = (group: ProductGroup) => {
        photoForm.reset();
        photoForm.clearErrors();
        if (photoFileRef.current) photoFileRef.current.value = '';
        setUploadingFor(group);
        setAddingSizeFor(null);
    };

    const submitProductPhoto = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedParty || !uploadingFor || !photoForm.data.photo) return;
        const fd = new FormData();
        fd.append('photo', photoForm.data.photo);
        fd.append('our_brand', uploadingFor.our_brand);
        if (uploadingFor.party_brand) fd.append('party_brand', uploadingFor.party_brand);
        router.post(productPhotoStore(selectedParty.id).url, fd, {
            preserveScroll: true,
            onSuccess: () => {
                setUploadingFor(null);
                photoForm.reset();
                if (photoFileRef.current) photoFileRef.current.value = '';
            },
        });
    };

    // ──────────────────────────────────────────────────────────────────────
    return (
        <ErpLayout>
            <div className="page-header">
                <h1 className="page-title">{pageTitle ?? 'Parties'}</h1>
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
                                <th>Name</th><th>Type</th><th>GST No.</th><th>Phone</th>
                                <th>City / State</th><th>Products</th><th>Docs</th><th>Status</th><th>Actions</th>
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

            {/* ── Add/Edit Party Modal ─────────────────────────────────────── */}
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
                                    <label>Company Name *</label>
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
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label>Customer Name</label>
                                    <input value={data.customer_name} onChange={(e) => setData('customer_name', e.target.value)} placeholder="Contact person name" />
                                </div>
                                <div className="form-group"><label>Phone</label><input value={data.phone} onChange={(e) => setData('phone', e.target.value)} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>GST No.</label><input value={data.gst_no} onChange={(e) => setData('gst_no', e.target.value)} placeholder="22AAAAA0000A1Z5" /></div>
                                <div className="form-group"><label>PAN No.</label><input value={data.pan_no} onChange={(e) => setData('pan_no', e.target.value)} placeholder="AAAAA0000A" /></div>
                            </div>
                            <div className="form-group">
                                <label>PAN Card File (PDF, JPG, PNG — max 5 MB)</label>
                                {editing?.pan_card_url && (
                                    <div style={{ fontSize: '12px', color: 'var(--tx-sub)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: 'var(--green, #16a34a)', fontWeight: 600 }}>✓ File on record</span>
                                        <a href={editing.pan_card_url} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-sub)', textDecoration: 'underline' }}>View current</a>
                                        <span style={{ color: 'var(--tx-muted)' }}>— upload below to replace</span>
                                    </div>
                                )}
                                <input
                                    ref={panFileRef}
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={(e) => setData('pan_card_file', e.target.files?.[0] ?? null)}
                                />
                                {errors.pan_card_file && <span className="field-error">{errors.pan_card_file}</span>}
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
                                    <select value={data.default_transport_type} onChange={(e) => setData({ ...data, default_transport_type: e.target.value as '' | 'transport' | 'courier', default_transport_id: '' })} style={{ width: '130px', flexShrink: 0 }}>
                                        <option value="">— Type —</option>
                                        <option value="transport">🚛 Transport</option>
                                        <option value="courier">📦 Courier</option>
                                    </select>
                                    <select value={data.default_transport_id} onChange={(e) => setData('default_transport_id', e.target.value ? Number(e.target.value) : '')} disabled={!data.default_transport_type} style={{ flex: 1 }}>
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

            {/* ── Products Modal ────────────────────────────────────────────── */}
            {showProductModal && selectedParty && (
                <div className="modal-overlay open" onClick={closeProducts}>
                    <div className="modal modal-xl" style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📦 Products — {selectedParty.name}</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {!showAddProduct && !editingProduct && (
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        style={{ fontSize: '13px', padding: '6px 12px' }}
                                        onClick={() => { setShowAddProduct(true); setAddingSizeFor(null); setUploadingFor(null); productForm.reset(); }}
                                    >
                                        ＋ Add Product
                                    </button>
                                )}
                                <button className="modal-close" onClick={closeProducts}>✕</button>
                            </div>
                        </div>

                        <div className="modal-form" style={{ overflowY: 'auto', flex: 1 }}>

                            {/* Add / Edit product form */}
                            {(showAddProduct || editingProduct) && (
                                <form onSubmit={submitProduct} style={{ background: 'var(--bg-paper)', borderRadius: '8px', padding: '14px', marginBottom: '16px', border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tx-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                                        {editingProduct
                                            ? `✏️ Editing size — ${editingProduct.our_brand} / ${editingProduct.packing_size}`
                                            : '＋ New Product'}
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
                                                disabled={!!editingProduct}
                                            />
                                            <datalist id="all-brands-list">
                                                {allBrands.map((b) => <option key={b} value={b} />)}
                                            </datalist>
                                            {productForm.errors.our_brand && <span className="field-error">{productForm.errors.our_brand}</span>}
                                        </div>
                                        <div className="form-group" style={{ flex: '1 1 160px' }}>
                                            <label>Party Brand</label>
                                            <input
                                                type="text"
                                                value={productForm.data.party_brand}
                                                onChange={(e) => productForm.setData('party_brand', e.target.value)}
                                                placeholder="Customer-facing name"
                                                disabled={!!editingProduct}
                                            />
                                        </div>
                                        <div className="form-group" style={{ flex: '1 1 110px' }}>
                                            <label>Packing Size *</label>
                                            <input
                                                type="text"
                                                value={productForm.data.packing_size}
                                                onChange={(e) => productForm.setData('packing_size', e.target.value)}
                                                placeholder="500ml, 1ltr…"
                                                required
                                            />
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
                                                <button type="button" className="btn-secondary" onClick={cancelEditProduct} style={{ padding: '8px 12px', fontSize: '13px' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            )}

                            {/* Brand cards */}
                            {productGroups.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--tx-muted)' }}>
                                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>📦</div>
                                    <p>No products yet. Click "＋ Add Product" to get started.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {productGroups.map((group) => {
                                        const groupKey = `${group.our_brand}|${group.party_brand ?? ''}`;
                                        const isAddingSize = addingSizeFor?.our_brand === group.our_brand && addingSizeFor?.party_brand === group.party_brand;
                                        const isUploading  = uploadingFor?.our_brand  === group.our_brand && uploadingFor?.party_brand  === group.party_brand;
                                        const displayName  = group.party_brand ?? group.our_brand;

                                        return (
                                            <div key={groupKey} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-card)' }}>

                                                {/* Card header: photo + brand info */}
                                                <div style={{ display: 'flex', gap: '14px', padding: '14px 16px', background: 'var(--bg-paper)', alignItems: 'flex-start' }}>
                                                    {/* Photo thumbnail */}
                                                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                        {group.photoUrl ? (
                                                            <img
                                                                src={group.photoUrl}
                                                                alt={displayName}
                                                                style={{ width: '72px', height: '72px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)', background: '#fff', padding: '4px', cursor: 'pointer' }}
                                                                onClick={() => setLightboxUrl(group.photoUrl)}
                                                            />
                                                        ) : (
                                                            <div style={{ width: '72px', height: '72px', borderRadius: '8px', border: '2px dashed var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: 'var(--tx-muted)' }}>
                                                                📷
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                                            onClick={() => isUploading ? setUploadingFor(null) : openPhotoUpload(group)}
                                                        >
                                                            {group.photoUrl ? '🔄 Change' : '📷 Upload'}
                                                        </button>
                                                    </div>

                                                    {/* Brand info */}
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--tx-head)', marginBottom: '2px' }}>
                                                            {displayName}
                                                        </div>
                                                        {group.party_brand && (
                                                            <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginBottom: '4px' }}>
                                                                Our brand: {group.our_brand}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>
                                                            {group.sizes.length} size{group.sizes.length !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Inline photo upload */}
                                                {isUploading && (
                                                    <form onSubmit={submitProductPhoto} style={{ padding: '10px 16px', background: 'var(--bg-paper)', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-head)', whiteSpace: 'nowrap' }}>
                                                            📷 {group.photoUrl ? 'Replace photo:' : 'Upload photo:'}
                                                        </span>
                                                        <input
                                                            ref={photoFileRef}
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            style={{ flex: 1, fontSize: '13px' }}
                                                            onChange={(e) => photoForm.setData('photo', e.target.files?.[0] ?? null)}
                                                        />
                                                        <button type="submit" className="btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }} disabled={!photoForm.data.photo}>
                                                            Save
                                                        </button>
                                                        <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '5px 10px' }} onClick={() => { setUploadingFor(null); photoForm.reset(); }}>
                                                            ✕
                                                        </button>
                                                    </form>
                                                )}

                                                {/* Sizes table */}
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)', fontSize: '12px' }}>Packing Size</th>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)', fontSize: '12px' }}>Rate</th>
                                                            <th style={{ padding: '8px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--tx-muted)', fontSize: '12px' }}>GST</th>
                                                            <th style={{ padding: '8px 16px', width: '90px' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {group.sizes.map((sz) => (
                                                            <tr key={sz.id} style={{ borderTop: '1px solid var(--border)', background: editingProduct?.id === sz.id ? 'var(--accent-lt)' : undefined }}>
                                                                <td style={{ padding: '8px 16px' }}>
                                                                    <span className="badge badge-blue">{sz.packing_size}</span>
                                                                </td>
                                                                <td style={{ padding: '8px 16px', fontWeight: 600 }}>₹{Number(sz.rate).toFixed(2)}</td>
                                                                <td style={{ padding: '8px 16px', color: 'var(--tx-muted)' }}>{sz.gst_percent}%</td>
                                                                <td style={{ padding: '8px 16px' }}>
                                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                                        <button className="btn-xs btn-secondary" onClick={() => startEditProduct(sz)}>Edit</button>
                                                                        <button
                                                                            className="btn-icon btn-danger-icon"
                                                                            style={{ width: '26px', height: '26px', fontSize: '12px' }}
                                                                            onClick={() => deleteProduct(sz)}
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>

                                                {/* Inline add-size form */}
                                                {isAddingSize ? (
                                                    <form onSubmit={submitAddSize} style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-paper)' }}>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                            <div className="form-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
                                                                <label style={{ fontSize: '11px' }}>Size *</label>
                                                                <input
                                                                    type="text"
                                                                    value={addSizeForm.data.packing_size}
                                                                    onChange={(e) => addSizeForm.setData('packing_size', e.target.value)}
                                                                    placeholder="500ml"
                                                                    required
                                                                    className={addSizeForm.errors.packing_size ? 'error' : ''}
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ flex: '1 1 90px', marginBottom: 0 }}>
                                                                <label style={{ fontSize: '11px' }}>Rate (₹) *</label>
                                                                <input
                                                                    type="number"
                                                                    value={addSizeForm.data.rate}
                                                                    onChange={(e) => addSizeForm.setData('rate', e.target.value)}
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    required
                                                                    className={addSizeForm.errors.rate ? 'error' : ''}
                                                                />
                                                            </div>
                                                            <div className="form-group" style={{ width: '70px', marginBottom: 0 }}>
                                                                <label style={{ fontSize: '11px' }}>GST %</label>
                                                                <select value={addSizeForm.data.gst_percent} onChange={(e) => addSizeForm.setData('gst_percent', e.target.value)}>
                                                                    {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                                                </select>
                                                            </div>
                                                            <button type="submit" className="btn-primary" style={{ fontSize: '12px', padding: '7px 14px', marginBottom: 0 }} disabled={addSizeForm.processing}>
                                                                Add
                                                            </button>
                                                            <button type="button" className="btn-secondary" style={{ fontSize: '12px', padding: '7px 10px', marginBottom: 0 }} onClick={() => setAddingSizeFor(null)}>
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </form>
                                                ) : (
                                                    <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
                                                        <button
                                                            type="button"
                                                            style={{ fontSize: '12px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                                                            onClick={() => openAddSize(group)}
                                                        >
                                                            ＋ Add Size
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Lightbox ─────────────────────────────────────────────────── */}
            {lightboxUrl && (
                <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setLightboxUrl(null)}>
                    <div style={{ maxWidth: '600px', width: '90vw', background: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
                            <button type="button" className="modal-close" onClick={() => setLightboxUrl(null)}>✕</button>
                        </div>
                        <img src={lightboxUrl} alt="" style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#fff', padding: '20px' }} />
                    </div>
                </div>
            )}

            {/* ── Documents Modal ───────────────────────────────────────────── */}
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
                                    <input ref={docFileRef} type="file" onChange={(e) => docForm.setData('file', e.target.files?.[0] ?? null)} required />
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
