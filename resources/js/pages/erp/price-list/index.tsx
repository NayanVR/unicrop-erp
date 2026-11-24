import {
    destroy as plDestroy,
    importMethod as plImport,
    settings as plSettings,
    store as plStore,
    update as plUpdate,
} from '@/routes/price-list';
import { router, useForm, usePage } from '@inertiajs/react';
import { Fragment, useMemo, useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Packing = {
    id?: number;
    packing: string;
    mrp: number | null;
    rate: number;
    qty_per_box: number | null;
};

type Item = {
    id: number;
    name: string;
    description: string | null;
    section: string;
    gst_percent: number;
    is_bulk: boolean;
    is_active: boolean;
    sort_order: number;
    packings: Packing[];
};

type Settings = Record<string, string>;

type PageProps = {
    items: Item[];
    settings: Settings;
    canEdit: boolean;
    importable: number;
    flash?: { success?: string; error?: string };
};

/** Blank row the editor starts each new packing from. */
const blankPacking = (): PackingDraft => ({ packing: '', mrp: '', rate: '', qty_per_box: '' });

type PackingDraft = { packing: string; mrp: string; rate: string; qty_per_box: string };

const emptyItem = {
    name: '',
    description: '',
    section: 'Bio Stimulant Product Price List',
    gst_percent: '18',
    is_bulk: false,
    is_active: true,
    sort_order: '0',
    packings: [blankPacking()],
};

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const money = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const SETTING_FIELDS: { key: string; label: string; rows?: number }[] = [
    { key: 'price_list_title', label: 'Title on the cover and each table' },
    { key: 'price_list_tagline', label: 'Line above the title' },
    { key: 'price_list_strapline', label: 'Strapline under the title', rows: 2 },
    { key: 'price_list_ribbon', label: 'Category ribbon' },
    { key: 'price_list_email', label: 'E-mail' },
    { key: 'price_list_phone', label: 'Phone numbers' },
    { key: 'price_list_plants', label: 'Manufacturing plants block', rows: 5 },
    { key: 'price_list_website', label: 'Website in the footer' },
];

export default function PriceListIndex() {
    const { items, settings, canEdit, importable, flash } = usePage<PageProps>().props;

    const [search, setSearch] = useState('');
    const [customer, setCustomer] = useState('');
    const [excluded, setExcluded] = useState<Set<number>>(new Set());
    const [editing, setEditing] = useState<Item | null>(null);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const itemForm = useForm<typeof emptyItem>({ ...emptyItem });
    const settingsForm = useForm<Settings>(
        Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, settings[f.key] ?? ''])) as Settings,
    );

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;

        return items.filter((i) =>
            [i.name, i.description, i.section].some((f) => (f ?? '').toLowerCase().includes(q)),
        );
    }, [items, search]);

    const groups = useMemo(() => {
        const map = new Map<string, Item[]>();
        for (const i of visible) {
            const key = i.is_bulk ? `${i.section} (Bulk)` : i.section;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(i);
        }
        return [...map.entries()];
    }, [visible]);

    const printable = items.filter((i) => i.is_active && i.packings.length > 0);
    const included = printable.filter((i) => !excluded.has(i.id));

    const toggle = (id: number) =>
        setExcluded((cur) => {
            const next = new Set(cur);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const setAllVisible = (on: boolean) =>
        setExcluded((cur) => {
            const next = new Set(cur);
            visible.forEach((i) => (on ? next.delete(i.id) : next.add(i.id)));
            return next;
        });

    const downloadPdf = () => {
        const params = new URLSearchParams();
        if (customer.trim()) params.set('for', customer.trim());
        if (excluded.size > 0) params.set('only', included.map((i) => i.id).join(','));

        const query = params.toString();
        window.open(`/price-list/pdf${query ? `?${query}` : ''}`, '_blank');
    };

    const openAdd = () => {
        itemForm.setData({ ...emptyItem, packings: [blankPacking()] });
        itemForm.clearErrors();
        setEditing(null);
        setShowItemModal(true);
    };

    const openEdit = (item: Item) => {
        itemForm.clearErrors();
        itemForm.setData({
            name: item.name,
            description: item.description ?? '',
            section: item.section,
            gst_percent: String(item.gst_percent),
            is_bulk: item.is_bulk,
            is_active: item.is_active,
            sort_order: String(item.sort_order),
            packings: item.packings.length
                ? item.packings.map((p) => ({
                      packing: p.packing,
                      mrp: p.mrp != null ? String(p.mrp) : '',
                      rate: String(p.rate),
                      qty_per_box: p.qty_per_box != null ? String(p.qty_per_box) : '',
                  }))
                : [blankPacking()],
        });
        setEditing(item);
        setShowItemModal(true);
    };

    const submitItem = (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            ...itemForm.data,
            gst_percent: Number(itemForm.data.gst_percent || 0),
            sort_order: Number(itemForm.data.sort_order || 0),
            packings: itemForm.data.packings
                .filter((p) => p.packing.trim() !== '' && p.rate.trim() !== '')
                .map((p) => ({
                    packing: p.packing.trim(),
                    mrp: numOrNull(p.mrp),
                    rate: Number(p.rate),
                    qty_per_box: numOrNull(p.qty_per_box),
                })),
        };

        const done = { onSuccess: () => setShowItemModal(false) };

        if (editing) {
            router.patch(plUpdate(editing.id).url, payload, done);
        } else {
            router.post(plStore().url, payload, done);
        }
    };

    const removeItem = (item: Item) => {
        if (!confirm(`Remove "${item.name}" from the price list?`)) return;
        router.delete(plDestroy(item.id).url, { preserveScroll: true });
    };

    const updatePacking = (index: number, field: keyof PackingDraft, value: string) =>
        itemForm.setData(
            'packings',
            itemForm.data.packings.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
        );

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Price List</h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canEdit && importable > 0 && (
                        <button
                            className="btn-secondary"
                            onClick={() => router.post(plImport().url, {}, { preserveScroll: true })}
                            title="Create a draft row for every priced product sales can see"
                        >
                            ↧ Bring in {importable} product{importable === 1 ? '' : 's'}
                        </button>
                    )}
                    {canEdit && (
                        <button className="btn-secondary" onClick={() => setShowSettings((v) => !v)}>
                            {showSettings ? 'Close cover' : 'Cover & contact'}
                        </button>
                    )}
                    {canEdit && <button className="btn-secondary" onClick={openAdd}>+ Add Product</button>}
                    <button className="btn-primary" onClick={downloadPdf} disabled={included.length === 0}>
                        ⬇ Download PDF
                    </button>
                </div>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            {canEdit && showSettings && (
                <form
                    className="card"
                    style={{ padding: 16, marginBottom: 16 }}
                    onSubmit={(e) => {
                        e.preventDefault();
                        settingsForm.post(plSettings().url, { onSuccess: () => setShowSettings(false) });
                    }}
                >
                    <div className="form-grid">
                        {SETTING_FIELDS.map((f) => (
                            <div
                                key={f.key}
                                className="form-group"
                                style={f.rows ? { gridColumn: '1 / -1' } : undefined}
                            >
                                <label>{f.label}</label>
                                {f.rows ? (
                                    <textarea
                                        rows={f.rows}
                                        value={settingsForm.data[f.key] ?? ''}
                                        onChange={(e) => settingsForm.setData(f.key, e.target.value)}
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={settingsForm.data[f.key] ?? ''}
                                        onChange={(e) => settingsForm.setData(f.key, e.target.value)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <button type="submit" className="btn-primary" disabled={settingsForm.processing}>
                        {settingsForm.processing ? 'Saving…' : 'Save cover'}
                    </button>
                </form>
            )}

            <div className="card">
                <div className="card-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="search"
                        className="search-input"
                        placeholder="Search product or section…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <input
                        type="text"
                        value={customer}
                        onChange={(e) => setCustomer(e.target.value)}
                        placeholder="Prepared for (customer name)"
                        style={{ minWidth: 220 }}
                    />
                    <button type="button" className="btn-secondary" onClick={() => setAllVisible(true)}>Select all</button>
                    <button type="button" className="btn-secondary" onClick={() => setAllVisible(false)}>Clear</button>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--tx-muted)' }}>
                        {included.length} of {printable.length} on the PDF
                    </span>
                </div>

                {items.length === 0 ? (
                    <div className="empty-state" style={{ padding: 32, textAlign: 'center', color: 'var(--tx-muted)' }}>
                        The price list is empty.
                        {canEdit
                            ? ' Use “Bring in products” to start from the priced products sales can already see, then fill in each one’s packings and MRP.'
                            : ' An admin has not set it up yet.'}
                    </div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 44 }}></th>
                                <th>Product</th>
                                <th>Packing · MRP · Rate · Qty/Box</th>
                                <th style={{ width: 70, textAlign: 'right' }}>GST %</th>
                                {canEdit && <th style={{ width: 90 }}></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {groups.length === 0 && (
                                <tr><td colSpan={canEdit ? 5 : 4} className="empty-row">Nothing matches that search.</td></tr>
                            )}
                            {groups.map(([section, rows]) => (
                                <Fragment key={section}>
                                    <tr>
                                        <td colSpan={canEdit ? 5 : 4} style={{ background: 'var(--bg-paper)', fontWeight: 700, fontSize: 12 }}>
                                            {section}
                                        </td>
                                    </tr>
                                    {rows.map((item) => {
                                        const printableRow = item.is_active && item.packings.length > 0;

                                        return (
                                            <tr key={item.id} style={{ opacity: excluded.has(item.id) || !printableRow ? 0.45 : 1 }}>
                                                <td style={{ textAlign: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={printableRow && !excluded.has(item.id)}
                                                        disabled={!printableRow}
                                                        onChange={() => toggle(item.id)}
                                                    />
                                                </td>
                                                <td className="font-medium">
                                                    {item.name}
                                                    {item.description && (
                                                        <div className="prod-detail" style={{ color: 'var(--tx-muted)' }}>
                                                            {item.description}
                                                        </div>
                                                    )}
                                                    {!item.is_active && <span className="text-muted"> · hidden</span>}
                                                </td>
                                                <td style={{ fontSize: 12, lineHeight: 1.7 }}>
                                                    {item.packings.length === 0 ? (
                                                        <span className="text-muted">No packings yet — not printed</span>
                                                    ) : (
                                                        item.packings.map((p, i) => (
                                                            <div key={p.id ?? i}>
                                                                <strong>{p.packing}</strong>
                                                                {p.mrp != null && ` · MRP ₹${money(p.mrp)}`}
                                                                {` · ₹${money(p.rate)}`}
                                                                {p.qty_per_box != null && ` · ${p.qty_per_box}/box`}
                                                            </div>
                                                        ))
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{item.gst_percent}%</td>
                                                {canEdit && (
                                                    <td className="action-cell">
                                                        <button className="btn-icon" onClick={() => openEdit(item)} title="Edit">✏️</button>
                                                        <button className="btn-icon btn-danger-icon" onClick={() => removeItem(item)} title="Remove">🗑️</button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {showItemModal && (
                <ModalPortal>
                    <div className="modal-overlay open" onClick={() => setShowItemModal(false)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>{editing ? 'Edit Product' : 'Add Product'}</h2>
                                <button className="modal-close" onClick={() => setShowItemModal(false)}>✕</button>
                            </div>
                            <form onSubmit={submitItem} className="modal-form">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Product name *</label>
                                        <input
                                            type="text"
                                            value={itemForm.data.name}
                                            onChange={(e) => itemForm.setData('name', e.target.value)}
                                            placeholder="Ribophyll"
                                            required
                                        />
                                        {itemForm.errors.name && <span className="field-error">{itemForm.errors.name}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Description under the name</label>
                                        <input
                                            type="text"
                                            value={itemForm.data.description}
                                            onChange={(e) => itemForm.setData('description', e.target.value)}
                                            placeholder="Humic Acid 6% Liquid"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Section *</label>
                                        <input
                                            type="text"
                                            value={itemForm.data.section}
                                            onChange={(e) => itemForm.setData('section', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>GST % *</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={itemForm.data.gst_percent}
                                            onChange={(e) => itemForm.setData('gst_percent', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Order on the page</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={itemForm.data.sort_order}
                                            onChange={(e) => itemForm.setData('sort_order', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={itemForm.data.is_bulk}
                                                onChange={(e) => itemForm.setData('is_bulk', e.target.checked)}
                                            />
                                            Bulk table (no MRP / box columns)
                                        </label>
                                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={itemForm.data.is_active}
                                                onChange={(e) => itemForm.setData('is_active', e.target.checked)}
                                            />
                                            Show on the price list
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginTop: 6 }}>
                                    <label>Packings</label>
                                    <table className="data-table" style={{ fontSize: 13 }}>
                                        <thead>
                                            <tr>
                                                <th>Packing *</th>
                                                <th>M.R.P.</th>
                                                <th>Rate *</th>
                                                <th>Qty per box</th>
                                                <th style={{ width: 40 }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {itemForm.data.packings.map((p, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={p.packing}
                                                            onChange={(e) => updatePacking(i, 'packing', e.target.value)}
                                                            placeholder="100 ml"
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={p.mrp}
                                                            onChange={(e) => updatePacking(i, 'mrp', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={p.rate}
                                                            onChange={(e) => updatePacking(i, 'rate', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={p.qty_per_box}
                                                            onChange={(e) => updatePacking(i, 'qty_per_box', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="btn-icon btn-danger-icon"
                                                            onClick={() =>
                                                                itemForm.setData(
                                                                    'packings',
                                                                    itemForm.data.packings.filter((_, j) => j !== i),
                                                                )
                                                            }
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ marginTop: 8 }}
                                        onClick={() => itemForm.setData('packings', [...itemForm.data.packings, blankPacking()])}
                                    >
                                        + Add packing
                                    </button>
                                </div>

                                <div className="modal-actions">
                                    <button type="button" className="btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
                                    <button type="submit" className="btn-primary">{editing ? 'Update' : 'Add Product'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </>
    );
}
