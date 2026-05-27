import { store as galleryStore, destroy as galleryDestroy } from '@/routes/design/gallery';
import { store as foldersStore } from '@/routes/design/gallery/folders';
import { router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';

type Party  = { id: number; name: string };
type Folder = { id: number; party_id: number; party_name: string };
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
    folders: Folder[];
    parties: Party[];
    ourBrands: string[];
    partyRates: PartyRate[];
    packingSizes: string[];
    flash?: { success?: string; error?: string };
};

type UploadForm   = { party_id: string; our_brand: string; party_brand: string; packing_size: string; photo: File | null };
type FolderForm   = { party_id: string };

// null = folder list, 'our-brand' = Our Brand, number = party_id
type ActiveFolder = null | 'our-brand' | number;

export default function DesignGallery() {
    const { photos, folders, parties, ourBrands, partyRates, packingSizes, flash } =
        usePage<PageProps>().props;

    const [activeFolder, setActiveFolder] = useState<ActiveFolder>(null);
    const [showUpload,   setShowUpload]   = useState(false);
    const [showCreate,   setShowCreate]   = useState(false);
    const [lightbox,     setLightbox]     = useState<Photo | null>(null);
    const [deletingId,   setDeletingId]   = useState<number | null>(null);

    const uploadForm = useForm<UploadForm>({
        party_id: '', our_brand: '', party_brand: '', packing_size: '', photo: null,
    });
    const folderForm = useForm<FolderForm>({ party_id: '' });
    const fileRef    = useRef<HTMLInputElement | null>(null);

    // ── Derived data ─────────────────────────────────────────────────────────

    const ourBrandPhotos = useMemo(
        () => photos.filter((p) => p.party_id === null),
        [photos],
    );

    const partyPhotoMap = useMemo(() => {
        const map = new Map<number, Photo[]>();
        for (const ph of photos) {
            if (ph.party_id !== null) {
                if (!map.has(ph.party_id)) map.set(ph.party_id, []);
                map.get(ph.party_id)!.push(ph);
            }
        }
        return map;
    }, [photos]);

    // Parties that don't yet have a folder created
    const availableParties = useMemo(() => {
        const taken = new Set(folders.map((f) => f.party_id));
        return parties.filter((p) => !taken.has(p.id));
    }, [folders, parties]);

    const brandSuggestions = useMemo(() => {
        if (!uploadForm.data.party_id) return [];
        return partyRates
            .filter((r) => String(r.party_id) === uploadForm.data.party_id)
            .map((r) => r.party_brand)
            .filter(Boolean);
    }, [uploadForm.data.party_id, partyRates]);

    const sizeSuggestions = useMemo(() => {
        if (!uploadForm.data.our_brand) return packingSizes;
        return partyRates
            .filter((r) => r.our_brand.toLowerCase() === uploadForm.data.our_brand.toLowerCase())
            .map((r) => r.packing_size)
            .filter(Boolean);
    }, [uploadForm.data.our_brand, partyRates, packingSizes]);

    const displayedPhotos: Photo[] =
        activeFolder === null
            ? []
            : activeFolder === 'our-brand'
              ? ourBrandPhotos
              : (partyPhotoMap.get(activeFolder as number) ?? []);

    const activeFolderLabel =
        activeFolder === null
            ? ''
            : activeFolder === 'our-brand'
              ? 'Our Brand'
              : (folders.find((f) => f.party_id === activeFolder)?.party_name ?? '');

    // ── Handlers ─────────────────────────────────────────────────────────────

    const openUpload = (partyId?: number) => {
        uploadForm.reset();
        uploadForm.clearErrors();
        if (partyId) uploadForm.setData('party_id', String(partyId));
        setShowUpload(true);
    };

    const openFolderUpload = () => {
        if (activeFolder === 'our-brand' || activeFolder === null) return openUpload();
        openUpload(activeFolder as number);
    };

    const submitUpload = (e: React.FormEvent) => {
        e.preventDefault();
        uploadForm.post(galleryStore().url, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setShowUpload(false);
                uploadForm.reset();
                if (fileRef.current) fileRef.current.value = '';
            },
        });
    };

    const submitCreateFolder = (e: React.FormEvent) => {
        e.preventDefault();
        const partyId = Number(folderForm.data.party_id);
        folderForm.post(foldersStore().url, {
            preserveScroll: true,
            onSuccess: () => {
                setShowCreate(false);
                folderForm.reset();
                if (partyId) setActiveFolder(partyId);
            },
            onError: () => {
                // errors are shown inline via folderForm.errors
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

    // ── Folder list view ──────────────────────────────────────────────────────
    if (activeFolder === null) {
        return (
            <div id="view-design-gallery" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Photo Gallery</h1>
                        <p>Organize brand photos in party folders</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            className="btn secondary"
                            onClick={() => setShowCreate(true)}
                        >
                            📁 New Folder
                        </button>
                        <button type="button" className="btn primary" onClick={() => openUpload()}>
                            ＋ Upload Photo
                        </button>
                    </div>
                </div>

                <FlashBar flash={flash} />

                {/* Folder grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '16px',
                }}>
                    {/* Our Brand — always present */}
                    <FolderCard
                        label="Our Brand"
                        icon="🌿"
                        count={ourBrandPhotos.length}
                        onClick={() => setActiveFolder('our-brand')}
                        onUpload={() => openUpload()}
                    />

                    {/* Created party folders */}
                    {folders.map((folder) => (
                        <FolderCard
                            key={folder.id}
                            label={folder.party_name}
                            icon="🏢"
                            count={partyPhotoMap.get(folder.party_id)?.length ?? 0}
                            onClick={() => setActiveFolder(folder.party_id)}
                            onUpload={() => openUpload(folder.party_id)}
                        />
                    ))}

                    {/* Empty state when no party folders exist */}
                    {folders.length === 0 && (
                        <div
                            style={{
                                border: '2px dashed var(--border)',
                                borderRadius: '12px',
                                padding: '32px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--tx-muted)',
                                cursor: 'pointer',
                            }}
                            onClick={() => setShowCreate(true)}
                        >
                            <span style={{ fontSize: '32px' }}>📁</span>
                            <span style={{ fontSize: '13px', fontWeight: 500 }}>Create Party Folder</span>
                        </div>
                    )}
                </div>

                {/* Create Folder modal */}
                {showCreate && (
                    <div className="modal-overlay open" onClick={() => setShowCreate(false)}>
                        <div className="modal" style={{ width: '400px' }} onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">📁 Create Party Folder</h2>
                                <button type="button" className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
                            </div>
                            {availableParties.length === 0 ? (
                                <div className="modal-body" style={{ textAlign: 'center', padding: '24px 20px' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>📁</div>
                                    <p style={{ color: 'var(--tx-head)', fontWeight: 600, marginBottom: '6px' }}>
                                        {parties.length === 0
                                            ? 'No active parties found'
                                            : 'All parties already have folders'}
                                    </p>
                                    <p style={{ color: 'var(--tx-muted)', fontSize: '13px' }}>
                                        {parties.length === 0
                                            ? 'Add active parties from the Parties section first.'
                                            : 'Every active party already has a folder. Upload photos directly into each folder.'}
                                    </p>
                                    <div className="modal-footer" style={{ justifyContent: 'center', borderTop: 'none' }}>
                                        <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>Close</button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={submitCreateFolder}>
                                    <div className="modal-body">
                                        <div className="form-group">
                                            <label>Select Party *</label>
                                            <select
                                                value={folderForm.data.party_id}
                                                onChange={(e) => folderForm.setData('party_id', e.target.value)}
                                                className={folderForm.errors.party_id ? 'error' : ''}
                                            >
                                                <option value="">— Choose a party —</option>
                                                {availableParties.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            {folderForm.errors.party_id && (
                                                <span className="field-error">{folderForm.errors.party_id}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                                        <button
                                            type="submit"
                                            className="btn primary"
                                            disabled={folderForm.processing || !folderForm.data.party_id}
                                        >
                                            {folderForm.processing ? 'Creating…' : 'Create Folder'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* Upload modal (no pre-selected party) */}
                {showUpload && (
                    <UploadModal
                        form={uploadForm}
                        fileRef={fileRef}
                        folders={folders}
                        ourBrands={ourBrands}
                        brandSuggestions={brandSuggestions}
                        sizeSuggestions={sizeSuggestions}
                        onClose={() => { setShowUpload(false); uploadForm.reset(); }}
                        onSubmit={submitUpload}
                    />
                )}
            </div>
        );
    }

    // ── Folder contents view ──────────────────────────────────────────────────
    return (
        <div id="view-design-gallery" className="view active">
            <div className="page-header">
                <div className="page-header-left">
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setActiveFolder(null)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--tx-sub)', fontSize: '13px', padding: 0,
                                display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                        >
                            ← All Folders
                        </button>
                        <span style={{ color: 'var(--tx-muted)', fontSize: '13px' }}>/</span>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--tx-head)' }}>
                            {activeFolder === 'our-brand' ? '🌿' : '🏢'} {activeFolderLabel}
                        </span>
                    </div>
                    <h1 style={{ margin: 0 }}>{activeFolderLabel}</h1>
                    <p style={{ margin: '2px 0 0' }}>
                        {displayedPhotos.length} photo{displayedPhotos.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button type="button" className="btn primary" onClick={openFolderUpload}>
                    ＋ Upload Photo
                </button>
            </div>

            <FlashBar flash={flash} />

            {/* Photo grid */}
            <div className="card">
                {displayedPhotos.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 0' }}>
                        <div className="icon">📷</div>
                        <p>No photos yet. Upload the first one!</p>
                        <button
                            type="button"
                            className="btn primary"
                            style={{ marginTop: '8px' }}
                            onClick={openFolderUpload}
                        >
                            Upload Photo
                        </button>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '16px',
                    }}>
                        {displayedPhotos.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                deleting={deletingId === photo.id}
                                onView={() => setLightbox(photo)}
                                onDelete={() => handleDelete(photo)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Lightbox */}
            {lightbox && (
                <div
                    className="modal-overlay open"
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
                                    <span style={{ fontSize: '13px', color: 'var(--tx-muted)', marginLeft: '8px' }}>
                                        {lightbox.packing_size}
                                    </span>
                                )}
                                {lightbox.party_brand && (
                                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginTop: '2px' }}>
                                        Our brand: {lightbox.our_brand}
                                    </div>
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

            {/* Upload modal */}
            {showUpload && (
                <UploadModal
                    form={uploadForm}
                    fileRef={fileRef}
                    folders={folders}
                    ourBrands={ourBrands}
                    brandSuggestions={brandSuggestions}
                    sizeSuggestions={sizeSuggestions}
                    onClose={() => { setShowUpload(false); uploadForm.reset(); }}
                    onSubmit={submitUpload}
                />
            )}
        </div>
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FlashBar({ flash }: { flash?: { success?: string; error?: string } }) {
    if (!flash?.success && !flash?.error) return null;
    return (
        <>
            {flash.success && (
                <div className="alert-success" style={{ marginBottom: '14px' }}>{flash.success}</div>
            )}
            {flash.error && (
                <div className="alert-error" style={{ marginBottom: '14px' }}>{flash.error}</div>
            )}
        </>
    );
}

function FolderCard({
    label, icon, count, onClick, onUpload,
}: {
    label: string; icon: string; count: number;
    onClick: () => void; onUpload: () => void;
}) {
    return (
        <div
            style={{
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-paper)',
                overflow: 'hidden',
                cursor: 'pointer',
            }}
            onClick={onClick}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
        >
            <div style={{
                height: '100px',
                background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-paper) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                borderBottom: '1px solid var(--border)',
            }}>
                {icon}
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--tx-head)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--tx-muted)', marginBottom: '10px' }}>
                    {count} photo{count !== 1 ? 's' : ''}
                </div>
                <button
                    type="button"
                    className="btn secondary"
                    style={{ fontSize: '11px', padding: '3px 10px', width: '100%' }}
                    onClick={(e) => { e.stopPropagation(); onUpload(); }}
                >
                    ＋ Upload
                </button>
            </div>
        </div>
    );
}

function PhotoCard({ photo, deleting, onView, onDelete }: {
    photo: Photo; deleting: boolean;
    onView: () => void; onDelete: () => void;
}) {
    const productName = photo.party_brand ?? photo.our_brand;
    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-paper)' }}>
            <div
                style={{ width: '100%', paddingBottom: '100%', position: 'relative', cursor: 'pointer' }}
                onClick={onView}
            >
                <img
                    src={photo.photo_url}
                    alt={productName}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#fff', padding: '8px' }}
                />
            </div>
            <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--tx-head)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {productName}
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
                    style={{ marginTop: '6px', fontSize: '11px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                    disabled={deleting}
                    onClick={onDelete}
                >
                    {deleting ? 'Deleting…' : '✕ Delete'}
                </button>
            </div>
        </div>
    );
}

function UploadModal({ form, fileRef, folders, ourBrands, brandSuggestions, sizeSuggestions, onClose, onSubmit }: {
    form: ReturnType<typeof useForm<UploadForm>>;
    fileRef: React.RefObject<HTMLInputElement | null>;
    folders: Folder[];
    ourBrands: string[];
    brandSuggestions: string[];
    sizeSuggestions: string[];
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
}) {
    return (
        <div className="modal-overlay open" onClick={onClose}>
            <div className="modal" style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Upload Photo</h2>
                    <button type="button" className="modal-close" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={onSubmit}>
                    <div className="modal-body">
                        {/* Folder / party */}
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Folder</label>
                            <select
                                value={form.data.party_id}
                                onChange={(e) => form.setData({ ...form.data, party_id: e.target.value, party_brand: '' })}
                            >
                                <option value="">🌿 Our Brand</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.party_id}>🏢 {f.party_name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Our brand / product name */}
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Our Brand / Product Name *</label>
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
                            {form.errors.our_brand && (
                                <span className="field-error">{form.errors.our_brand}</span>
                            )}
                        </div>

                        {/* Party brand name (only when a party folder is selected) */}
                        {form.data.party_id && (
                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label>Party Brand / Product Name</label>
                                <input
                                    type="text"
                                    list="gallery-party-brands"
                                    className={form.errors.party_brand ? 'error' : ''}
                                    value={form.data.party_brand}
                                    onChange={(e) => form.setData('party_brand', e.target.value)}
                                    placeholder="Customer's label name"
                                />
                                <datalist id="gallery-party-brands">
                                    {brandSuggestions.map((b) => <option key={b} value={b} />)}
                                </datalist>
                                {form.errors.party_brand && (
                                    <span className="field-error">{form.errors.party_brand}</span>
                                )}
                            </div>
                        )}

                        {/* Packing size */}
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

                        {/* Photo file */}
                        <div className="form-group">
                            <label>Photo * (JPG, PNG, WEBP — max 8 MB)</label>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className={form.errors.photo ? 'error' : ''}
                                onChange={(e) => form.setData('photo', e.target.files?.[0] ?? null)}
                            />
                            {form.errors.photo && (
                                <span className="field-error">{form.errors.photo}</span>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn primary" disabled={form.processing}>
                            {form.processing ? 'Uploading…' : 'Upload Photo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
