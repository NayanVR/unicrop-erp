import { store as galleryStore, destroy as galleryDestroy } from '@/routes/design/gallery';
import { store as foldersStore } from '@/routes/design/gallery/folders';
import { router, useForm, usePage } from '@inertiajs/react';
import { useMemo, useRef, useState } from 'react';

function SearchableSelect({
    value, onChange, options, placeholder, hasError,
}: {
    value: string;
    onChange: (val: string) => void;
    options: string[];
    placeholder?: string;
    hasError?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const filtered = query
        ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
        : options;

    const handleBlur = () => {
        setTimeout(() => {
            if (!containerRef.current?.contains(document.activeElement)) {
                setOpen(false);
                setQuery('');
            }
        }, 150);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative' }}>
            <input
                type="text"
                className={hasError ? 'error' : ''}
                value={open ? query : value}
                placeholder={value ? value : placeholder}
                onFocus={() => { setOpen(true); setQuery(''); }}
                onBlur={handleBlur}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
            />
            {open && (
                <div style={{
                    position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
                    background: 'var(--bg-card, #fff)', border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: '6px', maxHeight: '220px', overflowY: 'auto', zIndex: 1000,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                }}>
                    {filtered.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--tx-muted)' }}>
                            No results
                        </div>
                    ) : filtered.map((opt) => (
                        <div
                            key={opt}
                            onMouseDown={() => { onChange(opt); setOpen(false); setQuery(''); }}
                            style={{
                                padding: '8px 12px', cursor: 'pointer', fontSize: '13px',
                                background: opt === value ? 'var(--bg-active, #f0fdf4)' : '',
                                fontWeight: opt === value ? 600 : 400,
                            }}
                            onMouseEnter={(e) => { if (opt !== value) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #f9fafb)'; }}
                            onMouseLeave={(e) => { if (opt !== value) (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    mrp: string | null;
    photo_url: string;
    uploaded_by: string | null;
    updated_by: string | null;
    updated_at: string | null;
};

type PageProps = {
    photos: Photo[];
    folders: Folder[];
    parties: Party[];
    ourBrands: string[];
    allCategories: string[];
    partyRates: PartyRate[];
    packingSizes: string[];
    flash?: { success?: string; error?: string };
};

type UploadForm   = { party_id: string; our_brand: string; party_brand: string; photo: File | null };
type FolderForm   = { party_id: string };

// null = folder list, 'our-brand' = Our Brand, number = party_id
type ActiveFolder = null | 'our-brand' | number;

export default function DesignGallery() {
    const { photos, folders, parties, ourBrands, allCategories, partyRates, packingSizes, flash } =
        usePage<PageProps>().props;

    const [activeFolder,  setActiveFolder]  = useState<ActiveFolder>(null);
    const [showUpload,    setShowUpload]    = useState(false);
    const [showCreate,    setShowCreate]    = useState(false);
    const [lightbox,      setLightbox]      = useState<Photo | null>(null);
    const [deletingId,    setDeletingId]    = useState<number | null>(null);
    const [folderSearch,  setFolderSearch]  = useState('');
    const [photoSearch,   setPhotoSearch]   = useState('');

    const uploadForm = useForm<UploadForm>({
        party_id: '', our_brand: '', party_brand: '', photo: null,
    });
    const [sizeRows, setSizeRows] = useState<{ packing_size: string; mrp: string }[]>([{ packing_size: '', mrp: '' }]);
    const folderForm = useForm<FolderForm>({ party_id: '' });
    const fileRef    = useRef<HTMLInputElement | null>(null);

    const [editingPhoto,   setEditingPhoto]   = useState<Photo | null>(null);
    const [editForm,       setEditForm]       = useState({ our_brand: '', party_brand: '', packing_size: '', mrp: '' });
    const [editFile,       setEditFile]       = useState<File | null>(null);
    const [editProcessing, setEditProcessing] = useState(false);
    const editFileRef = useRef<HTMLInputElement | null>(null);

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

    const folderQuery = folderSearch.toLowerCase().trim();
    const filteredFolders = folderQuery
        ? folders.filter((f) => f.party_name.toLowerCase().includes(folderQuery))
        : folders;
    const showOurBrand = !folderQuery || 'our brand'.includes(folderQuery);

    // Cross-folder photo search — only active when there's a query
    const crossFolderPhotos = folderQuery
        ? photos.filter((p) =>
            p.our_brand.toLowerCase().includes(folderQuery) ||
            (p.party_brand ?? '').toLowerCase().includes(folderQuery) ||
            (p.packing_size ?? '').toLowerCase().includes(folderQuery),
          )
        : [];

    const folderLabelFor = (photo: Photo): string =>
        photo.party_id === null
            ? 'Our Brand'
            : (folders.find((f) => f.party_id === photo.party_id)?.party_name ?? 'Unknown');

    const photoQuery = photoSearch.toLowerCase().trim();
    const filteredPhotos = photoQuery
        ? displayedPhotos.filter((p) =>
            p.our_brand.toLowerCase().includes(photoQuery) ||
            (p.party_brand ?? '').toLowerCase().includes(photoQuery) ||
            (p.packing_size ?? '').toLowerCase().includes(photoQuery),
          )
        : displayedPhotos;

    // ── Handlers ─────────────────────────────────────────────────────────────

    const openUpload = (partyId?: number) => {
        uploadForm.reset();
        uploadForm.clearErrors();
        setSizeRows([{ packing_size: '', mrp: '' }]);
        if (partyId) uploadForm.setData('party_id', String(partyId));
        setShowUpload(true);
    };

    const openFolderUpload = () => {
        if (activeFolder === 'our-brand' || activeFolder === null) return openUpload();
        openUpload(activeFolder as number);
    };

    const goToFolder = (folder: ActiveFolder) => {
        setActiveFolder(folder);
        setPhotoSearch('');
    };

    const submitUpload = (e: React.FormEvent) => {
        e.preventDefault();
        const fd = new FormData();
        if (uploadForm.data.party_id) fd.append('party_id', uploadForm.data.party_id);
        fd.append('our_brand', uploadForm.data.our_brand);
        if (uploadForm.data.party_brand) fd.append('party_brand', uploadForm.data.party_brand);
        if (uploadForm.data.photo) fd.append('photo', uploadForm.data.photo);
        sizeRows.forEach((row, i) => {
            fd.append(`sizes[${i}][packing_size]`, row.packing_size);
            fd.append(`sizes[${i}][mrp]`, row.mrp);
        });
        router.post(galleryStore().url, fd as any, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setShowUpload(false);
                uploadForm.reset();
                setSizeRows([{ packing_size: '', mrp: '' }]);
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
        if (!confirm('Delete this product?')) return;
        setDeletingId(photo.id);
        router.delete(galleryDestroy(photo.id).url, {
            preserveScroll: true,
            onFinish: () => setDeletingId(null),
        });
    };

    const openEdit = (photo: Photo) => {
        setEditForm({
            our_brand:    photo.our_brand,
            party_brand:  photo.party_brand ?? '',
            packing_size: photo.packing_size ?? '',
            mrp:          photo.mrp ?? '',
        });
        setEditFile(null);
        setEditingPhoto(photo);
        setLightbox(null);
    };

    const submitEdit = () => {
        if (!editingPhoto) return;
        const fd = new FormData();
        fd.append('_method', 'PATCH');
        fd.append('our_brand',    editForm.our_brand);
        fd.append('party_brand',  editForm.party_brand);
        fd.append('packing_size', editForm.packing_size);
        fd.append('mrp',          editForm.mrp);
        if (editFile) fd.append('photo', editFile);
        setEditProcessing(true);
        router.post(`/design/gallery/${editingPhoto.id}`, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setEditingPhoto(null);
                setEditFile(null);
                if (editFileRef.current) editFileRef.current.value = '';
                setEditProcessing(false);
            },
            onError: () => setEditProcessing(false),
        });
    };

    // ── Folder list view ──────────────────────────────────────────────────────
    if (activeFolder === null) {
        return (
            <div id="view-design-gallery" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Product Gallery</h1>
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

                {/* Search bar */}
                <div style={{ marginBottom: '18px' }}>
                    <input
                        type="search"
                        placeholder="Search folders…"
                        value={folderSearch}
                        onChange={(e) => setFolderSearch(e.target.value)}
                        style={{ width: '100%', maxWidth: '340px' }}
                    />
                </div>

                {/* Folder grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '16px',
                }}>
                    {/* Our Brand — always present unless filtered out */}
                    {showOurBrand && (
                        <FolderCard
                            label="Our Brand"
                            icon="🌿"
                            count={ourBrandPhotos.length}
                            onClick={() => goToFolder('our-brand')}
                            onUpload={() => openUpload()}
                        />
                    )}

                    {/* Created party folders */}
                    {filteredFolders.map((folder) => (
                        <FolderCard
                            key={folder.id}
                            label={folder.party_name}
                            icon="🏢"
                            count={partyPhotoMap.get(folder.party_id)?.length ?? 0}
                            onClick={() => goToFolder(folder.party_id)}
                            onUpload={() => openUpload(folder.party_id)}
                        />
                    ))}

                    {/* No results from search */}
                    {folderQuery && !showOurBrand && filteredFolders.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '32px 0', color: 'var(--tx-muted)', fontSize: '14px' }}>
                            No folders match "{folderSearch}"
                        </div>
                    )}

                    {/* Empty state when no party folders exist */}
                    {!folderQuery && folders.length === 0 && (
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

                {/* Cross-folder photo results */}
                {crossFolderPhotos.length > 0 && (
                    <div style={{ marginTop: '28px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tx-muted)', marginBottom: '12px' }}>
                            📷 Products matching "{folderSearch}" — {crossFolderPhotos.length} result{crossFolderPhotos.length !== 1 ? 's' : ''}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '14px',
                        }}>
                            {crossFolderPhotos.map((photo) => (
                                <div
                                    key={photo.id}
                                    style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-paper)', cursor: 'pointer' }}
                                    onClick={() => setLightbox(photo)}
                                >
                                    <div style={{ width: '100%', paddingBottom: '80%', position: 'relative' }}>
                                        <img
                                            src={photo.photo_url}
                                            alt={photo.party_brand ?? photo.our_brand}
                                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#fff', padding: '6px' }}
                                        />
                                    </div>
                                    <div style={{ padding: '8px 10px 10px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--tx-head)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {photo.party_brand ?? photo.our_brand}
                                        </div>
                                        {photo.party_brand && (
                                            <div style={{ fontSize: '11px', color: 'var(--tx-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {photo.our_brand}
                                            </div>
                                        )}
                                        {photo.packing_size && (
                                            <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>{photo.packing_size}{photo.mrp ? ` · MRP ${photo.mrp}` : ''}</div>
                                        )}
                                        {!photo.packing_size && photo.mrp && (
                                            <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>MRP {photo.mrp}</div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); goToFolder(photo.party_id ?? 'our-brand'); }}
                                            style={{ marginTop: '5px', fontSize: '11px', color: 'var(--tx-sub)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}
                                        >
                                            📁 {folderLabelFor(photo)}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

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
                        allCategories={allCategories}
                        brandSuggestions={brandSuggestions}
                        sizeSuggestions={sizeSuggestions}
                        sizeRows={sizeRows}
                        onSizeRowChange={(i, f, v) => setSizeRows((r) => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row))}
                        onAddSizeRow={() => setSizeRows((r) => [...r, { packing_size: '', mrp: '' }])}
                        onRemoveSizeRow={(i) => setSizeRows((r) => r.filter((_, idx) => idx !== i))}
                        onClose={() => { setShowUpload(false); uploadForm.reset(); setSizeRows([{ packing_size: '', mrp: '' }]); }}
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
                            onClick={() => { setActiveFolder(null); setPhotoSearch(''); }}
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
                        {photoQuery
                            ? `${filteredPhotos.length} of ${displayedPhotos.length} photo${displayedPhotos.length !== 1 ? 's' : ''}`
                            : `${displayedPhotos.length} photo${displayedPhotos.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <button type="button" className="btn primary" onClick={openFolderUpload}>
                    ＋ Upload Photo
                </button>
            </div>

            <FlashBar flash={flash} />

            {/* Search bar */}
            {displayedPhotos.length > 0 && (
                <div style={{ marginBottom: '18px' }}>
                    <input
                        type="search"
                        placeholder="Search products by brand or size…"
                        value={photoSearch}
                        onChange={(e) => setPhotoSearch(e.target.value)}
                        style={{ width: '100%', maxWidth: '340px' }}
                    />
                </div>
            )}

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
                ) : filteredPhotos.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 0' }}>
                        <div className="icon">🔍</div>
                        <p>No products match "{photoSearch}"</p>
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '16px',
                    }}>
                        {filteredPhotos.map((photo) => (
                            <PhotoCard
                                key={photo.id}
                                photo={photo}
                                deleting={deletingId === photo.id}
                                onView={() => setLightbox(photo)}
                                onEdit={() => openEdit(photo)}
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
                                <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                                    {lightbox.uploaded_by && <>Uploaded by {lightbox.uploaded_by}</>}
                                    {lightbox.updated_by && (
                                        <span style={{ marginLeft: lightbox.uploaded_by ? '10px' : 0 }}>
                                            · Edited by {lightbox.updated_by}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    type="button"
                                    className="btn secondary"
                                    style={{ fontSize: '12px', padding: '4px 12px' }}
                                    onClick={() => openEdit(lightbox)}
                                >
                                    ✎ Edit
                                </button>
                                <button type="button" className="modal-close" onClick={() => setLightbox(null)}>✕</button>
                            </div>
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
                    allCategories={allCategories}
                    brandSuggestions={brandSuggestions}
                    sizeSuggestions={sizeSuggestions}
                    sizeRows={sizeRows}
                    onSizeRowChange={(i, f, v) => setSizeRows((r) => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row))}
                    onAddSizeRow={() => setSizeRows((r) => [...r, { packing_size: '', mrp: '' }])}
                    onRemoveSizeRow={(i) => setSizeRows((r) => r.filter((_, idx) => idx !== i))}
                    onClose={() => { setShowUpload(false); uploadForm.reset(); setSizeRows([{ packing_size: '', mrp: '' }]); }}
                    onSubmit={submitUpload}
                />
            )}

            {/* Edit modal */}
            {editingPhoto && (
                <div className="modal-overlay open" onClick={() => setEditingPhoto(null)}>
                    <div className="modal" style={{ width: '460px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">✎ Edit Product</h2>
                            <button type="button" className="modal-close" onClick={() => setEditingPhoto(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            {/* Current photo preview */}
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <img
                                    src={editingPhoto.photo_url}
                                    alt=""
                                    style={{ maxHeight: '120px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '6px' }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '14px' }}>
                                <label>Our Brand / Product Name *</label>
                                <SearchableSelect
                                    value={editForm.our_brand}
                                    onChange={(val) => setEditForm((p) => ({ ...p, our_brand: val }))}
                                    options={ourBrands}
                                    placeholder="Search product…"
                                />
                            </div>

                            {editingPhoto.party_id && (
                                <div className="form-group" style={{ marginBottom: '14px' }}>
                                    <label>Party Brand / Product Name</label>
                                    <input
                                        type="text"
                                        value={editForm.party_brand}
                                        onChange={(e) => setEditForm((p) => ({ ...p, party_brand: e.target.value }))}
                                        placeholder="Customer's label name"
                                    />
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                    <label>Packing Size</label>
                                    <input
                                        type="text"
                                        value={editForm.packing_size}
                                        onChange={(e) => setEditForm((p) => ({ ...p, packing_size: e.target.value }))}
                                        placeholder="e.g. 500ml, 1ltr"
                                    />
                                </div>
                                <div className="form-group" style={{ width: '130px', marginBottom: 0 }}>
                                    <label>MRP</label>
                                    <input
                                        type="text"
                                        value={editForm.mrp}
                                        onChange={(e) => setEditForm((p) => ({ ...p, mrp: e.target.value }))}
                                        placeholder="e.g. ₹120"
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Replace Product Image (JPG, PNG, WEBP — max 8 MB)</label>
                                <input
                                    ref={editFileRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(e) => setEditFile(e.target.files?.[0] ?? null)}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                                    Leave empty to keep the current image.
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn secondary" onClick={() => setEditingPhoto(null)}>Cancel</button>
                            <button
                                type="button"
                                className="btn primary"
                                onClick={submitEdit}
                                disabled={editProcessing || !editForm.our_brand.trim()}
                            >
                                {editProcessing ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
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

function PhotoCard({ photo, deleting, onView, onEdit, onDelete }: {
    photo: Photo; deleting: boolean;
    onView: () => void; onEdit: () => void; onDelete: () => void;
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
                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                    {photo.updated_by
                        ? <>Edited by {photo.updated_by}</>
                        : photo.uploaded_by
                          ? <>By {photo.uploaded_by}</>
                          : null}
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '5px' }}>
                    <button
                        type="button"
                        style={{ fontSize: '11px', color: 'var(--tx-sub)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                        onClick={onEdit}
                    >
                        ✎ Edit
                    </button>
                    <button
                        type="button"
                        style={{ fontSize: '11px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                        disabled={deleting}
                        onClick={onDelete}
                    >
                        {deleting ? 'Deleting…' : '✕ Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function UploadModal({ form, fileRef, folders, ourBrands, allCategories, brandSuggestions, sizeSuggestions,
    sizeRows, onSizeRowChange, onAddSizeRow, onRemoveSizeRow, onClose, onSubmit }: {
    form: ReturnType<typeof useForm<UploadForm>>;
    fileRef: React.RefObject<HTMLInputElement | null>;
    folders: Folder[];
    ourBrands: string[];
    allCategories: string[];
    brandSuggestions: string[];
    sizeSuggestions: string[];
    sizeRows: { packing_size: string; mrp: string }[];
    onSizeRowChange: (index: number, field: 'packing_size' | 'mrp', value: string) => void;
    onAddSizeRow: () => void;
    onRemoveSizeRow: (index: number) => void;
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

                        {/* Our brand / product name — BOM names only */}
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Our Brand / Product Name *</label>
                            <SearchableSelect
                                value={form.data.our_brand}
                                onChange={(val) => form.setData('our_brand', val)}
                                options={ourBrands}
                                placeholder="Search product…"
                                hasError={!!form.errors.our_brand}
                            />
                            {form.errors.our_brand && (
                                <span className="field-error">{form.errors.our_brand}</span>
                            )}
                            {ourBrands.length === 0 && (
                                <div style={{ marginTop: '6px', fontSize: '11px', color: '#b45309', background: '#fef3c7', padding: '6px 10px', borderRadius: '6px' }}>
                                    No products found. DB categories: {allCategories.length === 0 ? '(none)' : allCategories.join(', ')}
                                </div>
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

                        {/* Packing Sizes + MRP (dynamic rows) */}
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Packing Size & MRP</label>
                            <datalist id="upload-packing-sizes">
                                {sizeSuggestions.map((s) => <option key={s} value={s} />)}
                            </datalist>
                            {sizeRows.map((row, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        list="upload-packing-sizes"
                                        value={row.packing_size}
                                        onChange={(e) => onSizeRowChange(i, 'packing_size', e.target.value)}
                                        placeholder="500ml, 1ltr…"
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="text"
                                        value={row.mrp}
                                        onChange={(e) => onSizeRowChange(i, 'mrp', e.target.value)}
                                        placeholder="MRP ₹120"
                                        style={{ width: '110px' }}
                                    />
                                    {sizeRows.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveSizeRow(i)}
                                            style={{ flexShrink: 0, background: 'none', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: 'var(--tx-muted)', fontSize: '14px', lineHeight: 1 }}
                                        >×</button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={onAddSizeRow}
                                style={{ marginTop: '4px', fontSize: '12px', color: 'var(--primary, #16a34a)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                            >＋ Add Size</button>
                        </div>

                        {/* Photo file */}
                        <div className="form-group">
                            <label>Product Image * (JPG, PNG, WEBP — max 8 MB)</label>
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
