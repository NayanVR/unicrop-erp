import { destroy as galleryDestroy, store as galleryStore } from '@/routes/design/gallery';
import { router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';

type Party = { id: number; name: string };
type PartyRate = { party_id: number | null; our_brand: string; party_brand: string; packing_size: string };

type Photo = {
    id: number;
    party_id: number | null;
    party_name: string | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    photo_url: string;
};

type PageProps = {
    photos: Photo[];
    parties: Party[];
    ourBrands: string[];
    partyRates: PartyRate[];
    packingSizes: string[];
    flash?: { success?: string; error?: string };
};

type UploadForm = {
    party_id: string;
    our_brand: string;
    party_brand: string;
    packing_size: string;
    photo: File | null;
};

export default function DesignGallery() {
    const { photos, parties, ourBrands, partyRates, packingSizes, flash } = usePage<PageProps>().props;

    const [activeTab, setActiveTab] = useState<'our-brand' | number>('our-brand');
    const [showModal, setShowModal] = useState(false);
    const [lightbox, setLightbox] = useState<Photo | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const form = useForm<UploadForm>({
        party_id: '',
        our_brand: '',
        party_brand: '',
        packing_size: '',
        photo: null,
    });

    const fileRef = useRef<HTMLInputElement>(null);

    // Parties that have at least one photo
    const partiesWithPhotos = useMemo(() => {
        const ids = new Set(photos.filter((p) => p.party_id !== null).map((p) => p.party_id));
        return parties.filter((p) => ids.has(p.id));
    }, [photos, parties]);

    // Our brand photo list (party_id = null)
    const ourBrandPhotos = useMemo(() => photos.filter((p) => p.party_id === null), [photos]);

    // Party brand photos grouped by party
    const partyPhotos = useMemo(() => {
        const map = new Map<number, Photo[]>();
        for (const ph of photos) {
            if (ph.party_id !== null) {
                if (!map.has(ph.party_id)) map.set(ph.party_id, []);
                map.get(ph.party_id)!.push(ph);
            }
        }
        return map;
    }, [photos]);

    const displayedPhotos: Photo[] =
        activeTab === 'our-brand'
            ? ourBrandPhotos
            : (partyPhotos.get(activeTab as number) ?? []);

    // Party brand name suggestions for selected party
    const brandSuggestions = useMemo(() => {
        if (!form.data.party_id) return [];
        return partyRates
            .filter((r) => String(r.party_id) === form.data.party_id)
            .map((r) => r.party_brand)
            .filter(Boolean);
    }, [form.data.party_id, partyRates]);

    const sizeSuggestions = useMemo(() => {
        if (!form.data.our_brand) return packingSizes;
        return partyRates
            .filter((r) => r.our_brand.toLowerCase() === form.data.our_brand.toLowerCase())
            .map((r) => r.packing_size)
            .filter(Boolean);
    }, [form.data.our_brand, partyRates, packingSizes]);

    const openUpload = (partyId?: number) => {
        form.reset();
        if (partyId) form.setData('party_id', String(partyId));
        setShowModal(true);
    };

    const submitUpload = (e: React.FormEvent) => {
        e.preventDefault();
        form.transform((data) => ({ ...data }));
        form.post(galleryStore().url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setShowModal(false);
                form.reset();
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    const handleDelete = (photo: Photo) => {
        if (!confirm('Delete this photo?')) return;
        setDeletingId(photo.id);
        router.delete(galleryDestroy(photo.id).url, {
            preserveScroll: true,
            onFinish: () => setDeletingId(null),
        });
    };

    const activeTabLabel =
        activeTab === 'our-brand'
            ? 'Our Brand'
            : (parties.find((p) => p.id === activeTab)?.name ?? '');

    return (
        <div id="view-design-gallery" className="view active">
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Photo Gallery</h1>
                    <p>Brand and label photos organized by party</p>
                </div>
                <button
                    type="button"
                    className="btn primary"
                    onClick={() => openUpload(activeTab !== 'our-brand' ? (activeTab as number) : undefined)}
                >
                    ＋ Upload Photo
                </button>
            </div>

            {flash?.success && <div className="alert-success" style={{ marginBottom: '12px' }}>{flash.success}</div>}
            {flash?.error && <div className="alert-error" style={{ marginBottom: '12px' }}>{flash.error}</div>}

            {/* ── Tabs ── */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button
                    type="button"
                    className={`pill${activeTab === 'our-brand' ? ' active' : ''}`}
                    onClick={() => setActiveTab('our-brand')}
                >
                    🌿 Our Brand ({ourBrandPhotos.length})
                </button>
                {partiesWithPhotos.map((party) => (
                    <button
                        key={party.id}
                        type="button"
                        className={`pill${activeTab === party.id ? ' active' : ''}`}
                        onClick={() => setActiveTab(party.id)}
                    >
                        🏢 {party.name} ({partyPhotos.get(party.id)?.length ?? 0})
                    </button>
                ))}
                {parties
                    .filter((p) => !partiesWithPhotos.find((x) => x.id === p.id))
                    .map((party) => (
                        <button
                            key={party.id}
                            type="button"
                            className={`pill${activeTab === party.id ? ' active' : ''}`}
                            onClick={() => setActiveTab(party.id)}
                        >
                            🏢 {party.name} (0)
                        </button>
                    ))}
            </div>

            {/* ── Gallery Grid ── */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div className="card-title" style={{ marginBottom: 0 }}>
                        {activeTab === 'our-brand' ? '🌿 Our Brand Photos' : `🏢 ${activeTabLabel} — Party Brand Photos`}
                    </div>
                    <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: '12px' }}
                        onClick={() => openUpload(activeTab !== 'our-brand' ? (activeTab as number) : undefined)}
                    >
                        ＋ Upload
                    </button>
                </div>

                {displayedPhotos.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 0' }}>
                        <div className="icon">📷</div>
                        <p>No photos yet for {activeTabLabel}.</p>
                        <button
                            type="button"
                            className="btn primary"
                            style={{ marginTop: '8px' }}
                            onClick={() => openUpload(activeTab !== 'our-brand' ? (activeTab as number) : undefined)}
                        >
                            Upload First Photo
                        </button>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '16px',
                    }}>
                        {displayedPhotos.map((photo) => (
                            <div
                                key={photo.id}
                                style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    overflow: 'hidden',
                                    background: 'var(--bg-paper)',
                                    position: 'relative',
                                }}
                            >
                                {/* Photo */}
                                <div
                                    style={{ width: '100%', paddingBottom: '100%', position: 'relative', cursor: 'pointer' }}
                                    onClick={() => setLightbox(photo)}
                                >
                                    <img
                                        src={photo.photo_url}
                                        alt={`${photo.party_brand ?? photo.our_brand} ${photo.packing_size ?? ''}`}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            background: '#fff',
                                            padding: '8px',
                                        }}
                                    />
                                </div>

                                {/* Info */}
                                <div style={{ padding: '8px 10px 10px' }}>
                                    <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--tx-head)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {photo.party_brand ?? photo.our_brand}
                                    </div>
                                    {photo.party_brand && (
                                        <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginBottom: '2px' }}>
                                            Our brand: {photo.our_brand}
                                        </div>
                                    )}
                                    {photo.packing_size && (
                                        <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{photo.packing_size}</div>
                                    )}
                                    <button
                                        type="button"
                                        style={{
                                            marginTop: '6px',
                                            fontSize: '11px',
                                            color: 'var(--danger)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 0,
                                            fontFamily: 'inherit',
                                        }}
                                        disabled={deletingId === photo.id}
                                        onClick={() => handleDelete(photo)}
                                    >
                                        {deletingId === photo.id ? 'Deleting…' : '✕ Delete'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Lightbox ── */}
            {lightbox && (
                <div
                    className="modal-overlay"
                    onClick={() => setLightbox(null)}
                    style={{ zIndex: 9999 }}
                >
                    <div
                        style={{ maxWidth: '700px', width: '90vw', maxHeight: '90vh', background: 'var(--bg-card)', borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--tx-head)' }}>
                                    {lightbox.party_brand ?? lightbox.our_brand}
                                </span>
                                {lightbox.packing_size && (
                                    <span style={{ fontSize: '13px', color: 'var(--tx-muted)', marginLeft: '8px' }}>{lightbox.packing_size}</span>
                                )}
                                {lightbox.party_name && (
                                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '2px' }}>Party: {lightbox.party_name}</div>
                                )}
                            </div>
                            <button type="button" className="modal-close" onClick={() => setLightbox(null)}>✕</button>
                        </div>
                        <img
                            src={lightbox.photo_url}
                            alt=""
                            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', padding: '20px', background: '#fff' }}
                        />
                    </div>
                </div>
            )}

            {/* ── Upload Modal ── */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Upload Photo</h2>
                            <button type="button" className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submitUpload}>
                            <div className="modal-body">
                                {/* Brand type: if party_id is empty → Our Brand; if set → Party Brand */}
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Photo Type</label>
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                        <button
                                            type="button"
                                            className={`pill${!form.data.party_id ? ' active' : ''}`}
                                            onClick={() => form.setData({ ...form.data, party_id: '', party_brand: '' })}
                                        >
                                            🌿 Our Brand
                                        </button>
                                        <button
                                            type="button"
                                            className={`pill${form.data.party_id ? ' active' : ''}`}
                                            onClick={() => { /* pills handled by party select below */ }}
                                        >
                                            🏢 Party Brand
                                        </button>
                                    </div>
                                </div>

                                {/* Party selection */}
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Party {form.data.party_id ? '*' : '(leave blank for Our Brand)'}</label>
                                    <select
                                        value={form.data.party_id}
                                        onChange={(e) => form.setData({ ...form.data, party_id: e.target.value, party_brand: '' })}
                                    >
                                        <option value="">— Our Brand (no party) —</option>
                                        {parties.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Our Brand */}
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Our Brand *</label>
                                    <input
                                        type="text"
                                        list="gallery-our-brands"
                                        className={form.errors.our_brand ? 'error' : ''}
                                        value={form.data.our_brand}
                                        onChange={(e) => form.setData('our_brand', e.target.value)}
                                        placeholder="e.g. Unicrop Neem Oil"
                                    />
                                    <datalist id="gallery-our-brands">
                                        {ourBrands.map((b) => <option key={b} value={b} />)}
                                    </datalist>
                                    {form.errors.our_brand && <span className="field-error">{form.errors.our_brand}</span>}
                                </div>

                                {/* Party Brand (only when party is selected) */}
                                {form.data.party_id && (
                                    <div className="form-group" style={{ marginBottom: '14px' }}>
                                        <label>Party Brand Name</label>
                                        <input
                                            type="text"
                                            list="gallery-party-brands"
                                            value={form.data.party_brand}
                                            onChange={(e) => form.setData('party_brand', e.target.value)}
                                            placeholder="Customer's brand label name"
                                        />
                                        <datalist id="gallery-party-brands">
                                            {brandSuggestions.map((b) => <option key={b} value={b} />)}
                                        </datalist>
                                    </div>
                                )}

                                {/* Packing Size */}
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Packing Size</label>
                                    <input
                                        type="text"
                                        list="gallery-packing-sizes"
                                        value={form.data.packing_size}
                                        onChange={(e) => form.setData('packing_size', e.target.value)}
                                        placeholder="e.g. 500ml, 1ltr"
                                    />
                                    <datalist id="gallery-packing-sizes">
                                        {sizeSuggestions.map((s) => <option key={s} value={s} />)}
                                    </datalist>
                                </div>

                                {/* Photo */}
                                <div className="form-group">
                                    <label>Photo * (JPG, PNG, WEBP — max 8MB)</label>
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className={form.errors.photo ? 'error' : ''}
                                        onChange={(e) => form.setData('photo', e.target.files?.[0] ?? null)}
                                    />
                                    {form.errors.photo && <span className="field-error">{form.errors.photo}</span>}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn primary" disabled={form.processing}>
                                    {form.processing ? 'Uploading…' : 'Upload Photo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
