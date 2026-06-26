import { store, update } from '@/routes/orders';
import { Head, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type SalesUser = { id: number; name: string };
type TransportOption = { id: number; name: string };
type ProductRate = {
    our_brand: string;
    party_brand: string | null;
    packing_size: string;
    rate: string | number;
    gst_percent: string | number;
};

type Party = {
    id: number;
    name: string;
    customer_name?: string | null;
    gst_no?: string | null;
    pan_no?: string | null;
    pan_card_url?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    default_transport_type?: 'transport' | 'courier' | null;
    default_transport_id?: number | null;
    destination?: string | null;
    outstanding_due?: number | null;
    product_rates: ProductRate[];
};

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    mrp: string | null;
    photo_url: string;
    bottle_jar: string | null;
    cap_color: string | null;
};

type EditingOrderItem = {
    our_brand: string | null;
    party_brand: string | null;
    packing_size: string | null;
    quantity: string;
    rate: string;
    gst_percent: string;
    type: string | null;
    shape: string | null;
    cap_color: string | null;
};

type EditingOrder = {
    id: number;
    order_number: string;
    party_id: number | null;
    company_name: string;
    customer_name: string;
    gst_no: string | null;
    pan_no: string | null;
    aadhaar_no: string | null;
    sales_user_id: number | null;
    order_date: string | null;
    transport_type: 'transport' | 'courier';
    transport_name: string | null;
    destination: string | null;
    delivery_address: string | null;
    phone: string | null;
    priority: 'normal' | 'high' | 'urgent';
    notes: string | null;
    freight_amount: string;
    courier_amount: string;
    round_off: string;
    items: EditingOrderItem[];
};

type FinishGoodBrand = { name: string; group: string | null; shape: string | null; stock: number | null; unit: string };

type Props = {
    pageTitle: string;
    salesUsers: SalesUser[];
    transports: TransportOption[];
    couriers: TransportOption[];
    parties: Party[];
    currentUser: { id: number; name: string };
    productPhotos: ProductPhoto[];
    finishGoodBrands: FinishGoodBrand[];
    packingSizes: { name: string; multiplier: string | number; pieces_per_box: number | null; pack_unit: string | null }[];
    editingOrder?: EditingOrder | null;
};

// Pieces per box by normalized packing size
const BOX_SIZES: Record<string, number> = {
    '5ltr': 2,   '5kg': 2,
    '1ltr': 10,  '1kg': 10,
    '500ml': 20, '500gm': 20,
    '250ml': 40, '250gm': 40,
    '100ml': 50, '100gm': 50,
    '50ml': 100, '50gm': 100,
    '20ml': 300, '20gm': 300,
    '10ml': 600, '10gm': 600,
    '5ml': 600,  '5gm': 600,
    // Carba large containers
    '10ltr': 1, '20ltr': 1, '50ltr': 1, '200ltr': 1,
    // Bags
    '10kg': 1, '25kg': 1, '50kg': 1,
};

function normalizeSize(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '')
        .replace(/litre|liter|litres|liters/g, 'ltr')
        .replace(/kilogram|kilograms|kgs\b/g, 'kg')
        .replace(/gram|grams\b/g, 'gm')
        .replace(/millilitre|milliliter|millilitres|milliliters|mls\b/g, 'ml');
}

function getBoxQty(packingSize: string, overrides: Record<string, number>): number | null {
    const key = normalizeSize(packingSize);
    return overrides[key] ?? BOX_SIZES[key] ?? null;
}

// Pack unit (box / bag / carba) by normalized packing size, when admin hasn't set one
const DEFAULT_PACK_UNITS: Record<string, string> = {
    '10kg': 'bag', '25kg': 'bag', '50kg': 'bag',
    '10ltr': 'carba', '20ltr': 'carba', '50ltr': 'carba', '200ltr': 'carba',
};

function getPackUnit(packingSize: string, overrides: Record<string, string>): string {
    const key = normalizeSize(packingSize);
    return overrides[key] ?? DEFAULT_PACK_UNITS[key] ?? 'box';
}

function pluralizeUnit(unit: string, count: number): string {
    if (count === 1) return unit;
    if (unit === 'box') return 'boxes';
    if (unit === 'bag') return 'bags';
    return unit;
}

type ProductRow = {
    our_brand: string;
    party_brand: string;
    packing_size: string;
    quantity: string;
    rate: string;
    gst_percent: string;
    type: string;
    shape: string;
    cap_color: string;
};

type OrderFormData = {
    party_id: string;
    company_name: string;
    customer_name: string;
    gst_no: string;
    pan_no: string;
    aadhaar_no: string;
    sales_user_id: string;
    order_date: string;
    transport_type: 'transport' | 'courier';
    transport_name: string;
    destination: string;
    delivery_address: string;
    phone: string;
    priority: 'normal' | 'high' | 'urgent';
    notes: string;
    freight_amount: string;
    courier_amount: string;
    round_off: string;
    attachments: File[] | null;
    pan_file: File | null;
    aadhaar_file: File | null;
    save_as_draft: boolean;
};

const createRow = (): ProductRow => ({
    our_brand: '',
    party_brand: '',
    packing_size: '',
    quantity: '',
    rate: '',
    gst_percent: '18',
    type: '',
    shape: '',
    cap_color: '',
});

const toNumber = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const todayDate = () => new Date().toISOString().split('T')[0];

export default function OrdersCreate({ salesUsers, transports, couriers, parties, currentUser, productPhotos, finishGoodBrands, packingSizes, editingOrder }: Props) {
    const isEditing = !!editingOrder;

    const [rows, setRows] = useState<ProductRow[]>(() => {
        if (editingOrder?.items?.length) {
            return editingOrder.items.map((item) => ({
                our_brand:    item.our_brand    ?? '',
                party_brand:  item.party_brand  ?? '',
                packing_size: item.packing_size ?? '',
                quantity:     item.quantity     ?? '',
                rate:         item.rate         ?? '',
                gst_percent:  item.gst_percent  ?? '18',
                type:         item.type         ?? '',
                shape:        item.shape        ?? '',
                cap_color:    item.cap_color    ?? '',
            }));
        }
        return [createRow()];
    });
    const [showPan, setShowPan]       = useState(!!editingOrder?.pan_no);
    const [showAadhaar, setShowAadhaar] = useState(!!editingOrder?.aadhaar_no);
    const [partySearch, setPartySearch] = useState(() => {
        if (editingOrder?.party_id) {
            return parties.find((p) => p.id === editingOrder.party_id)?.name ?? editingOrder.company_name ?? '';
        }
        return '';
    });
    const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
    const partyRef = useRef<HTMLDivElement>(null);
    const [openBrandRow, setOpenBrandRow] = useState<number | null>(null);
    const [brandSearch, setBrandSearch] = useState('');
    const [brandDropPos, setBrandDropPos] = useState({ top: 0, left: 0, width: 0 });
    const brandInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (partyRef.current && !partyRef.current.contains(e.target as Node)) {
                setPartyDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const form = useForm<OrderFormData>(editingOrder ? {
        party_id:        editingOrder.party_id ? String(editingOrder.party_id) : '',
        company_name:    editingOrder.company_name    ?? '',
        customer_name:   editingOrder.customer_name   ?? '',
        gst_no:          editingOrder.gst_no          ?? '',
        pan_no:          editingOrder.pan_no          ?? '',
        aadhaar_no:      editingOrder.aadhaar_no      ?? '',
        sales_user_id:   editingOrder.sales_user_id   ? String(editingOrder.sales_user_id) : String(currentUser.id),
        order_date:      editingOrder.order_date      ?? todayDate(),
        transport_type:  editingOrder.transport_type  ?? 'transport',
        transport_name:  editingOrder.transport_name  ?? '',
        destination:     editingOrder.destination     ?? '',
        delivery_address:editingOrder.delivery_address?? '',
        phone:           editingOrder.phone           ?? '',
        priority:        editingOrder.priority        ?? 'normal',
        notes:           editingOrder.notes           ?? '',
        freight_amount:  editingOrder.freight_amount  ?? '0',
        courier_amount:  editingOrder.courier_amount  ?? '0',
        round_off:       editingOrder.round_off       ?? '0',
        attachments:     null,
        pan_file:        null,
        aadhaar_file:    null,
        save_as_draft:   false,
    } : {
        party_id: '',
        company_name: '',
        customer_name: '',
        gst_no: '',
        pan_no: '',
        aadhaar_no: '',
        sales_user_id: String(currentUser.id),
        order_date: todayDate(),
        transport_type: 'transport',
        transport_name: '',
        destination: '',
        delivery_address: '',
        phone: '',
        priority: 'normal',
        notes: '',
        freight_amount: '0',
        courier_amount: '0',
        round_off: '0',
        attachments: null,
        pan_file: null,
        aadhaar_file: null,
        save_as_draft: false,
    });

    const pcsPerBoxOverrides = useMemo(() => {
        const map: Record<string, number> = {};
        packingSizes.forEach((p) => {
            if (p.pieces_per_box) {
                map[normalizeSize(p.name)] = p.pieces_per_box;
            }
        });
        return map;
    }, [packingSizes]);

    const packUnitOverrides = useMemo(() => {
        const map: Record<string, string> = {};
        packingSizes.forEach((p) => {
            if (p.pack_unit) {
                map[normalizeSize(p.name)] = p.pack_unit;
            }
        });
        return map;
    }, [packingSizes]);

    const filteredParties = useMemo(
        () =>
            partySearch.trim()
                ? parties.filter((p) => p.name.toLowerCase().includes(partySearch.toLowerCase()))
                : parties,
        [partySearch, parties],
    );

    // Rates from the currently selected party
    const partyRates = useMemo(() => {
        if (!form.data.party_id) return [];
        return parties.find((p) => String(p.id) === form.data.party_id)?.product_rates ?? [];
    }, [form.data.party_id, parties]);

    const selectedParty = useMemo(
        () => parties.find((p) => String(p.id) === form.data.party_id),
        [form.data.party_id, parties],
    );

    // Ref so updateRow always sees the latest partyRates (avoids stale closure)
    const partyRatesRef = useRef(partyRates);
    useEffect(() => { partyRatesRef.current = partyRates; }, [partyRates]);

    const partyIdRef = useRef(form.data.party_id);
    useEffect(() => { partyIdRef.current = form.data.party_id; }, [form.data.party_id]);

    const brandOptions = useMemo(
        () => [...new Set(partyRates.map((r) => r.our_brand))].sort(),
        [partyRates],
    );

    type BrandItem = { name: string; shape: string | null; stock: number | null; unit: string };

    const groupedBrands = useMemo(() => {
        const q = brandSearch.toLowerCase().trim();
        const src = q
            ? finishGoodBrands.filter((b) =>
                b.name.toLowerCase().includes(q) ||
                (b.shape ?? '').toLowerCase().includes(q)
              )
            : finishGoodBrands;
        const map = new Map<string, BrandItem[]>();
        for (const b of src) {
            const g = b.group ?? '';
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push({ name: b.name, shape: b.shape ?? null, stock: b.stock, unit: b.unit });
        }
        const out: { group: string; brands: BrandItem[] }[] = [];
        map.forEach((brands, group) => out.push({ group, brands }));
        return out;
    }, [finishGoodBrands, brandSearch]);

    type PhotoInfo = { url: string; mrp: string | null };

    // Photo lookup maps
    const photoMap = useMemo(() => {
        const ob     = new Map<string, PhotoInfo>();
        const obAny  = new Map<string, PhotoInfo>();
        const pb     = new Map<string, PhotoInfo>();
        const pbAny  = new Map<string, PhotoInfo>();

        for (const p of productPhotos) {
            const b = p.our_brand.toLowerCase();
            const s = (p.packing_size ?? '').toLowerCase();
            const info: PhotoInfo = { url: p.photo_url, mrp: p.mrp ?? null };

            if (p.party_id === null) {
                ob.set(`${b}|${s}`, info);
                if (!obAny.has(b)) obAny.set(b, info);
            } else if (p.party_brand) {
                const pb_ = p.party_brand.toLowerCase();
                pb.set(`${p.party_id}|${pb_}|${s}`, info);
                const anyKey = `${p.party_id}|${pb_}`;
                if (!pbAny.has(anyKey)) pbAny.set(anyKey, info);
            }
        }
        return { ob, obAny, pb, pbAny };
    }, [productPhotos]);

    const getRowPhoto = (row: ProductRow): PhotoInfo | null => {
        if (!row.our_brand) return null;
        const s = row.packing_size.toLowerCase();

        if (form.data.party_id && row.party_brand) {
            const pid = form.data.party_id;
            const pb_ = row.party_brand.toLowerCase();
            const info =
                photoMap.pb.get(`${pid}|${pb_}|${s}`) ??
                photoMap.pb.get(`${pid}|${pb_}|`) ??
                photoMap.pbAny.get(`${pid}|${pb_}`);
            if (info) return info;
        }

        const b = row.our_brand.toLowerCase();
        return (
            photoMap.ob.get(`${b}|${s}`) ??
            photoMap.ob.get(`${b}|`) ??
            photoMap.obAny.get(b) ??
            null
        );
    };

    const totals = useMemo(() => {
        const subtotal = rows.reduce((acc, row) => acc + toNumber(row.quantity) * toNumber(row.rate), 0);
        const gstTotal = rows.reduce((acc, row) => {
            const lineAmount = toNumber(row.quantity) * toNumber(row.rate);
            return acc + (lineAmount * toNumber(row.gst_percent)) / 100;
        }, 0);
        const freight = toNumber(form.data.freight_amount);
        const courier = toNumber(form.data.courier_amount);
        const rawTotal = subtotal + gstTotal + freight + courier;
        const roundOff = parseFloat((Math.round(rawTotal) - rawTotal).toFixed(2));
        return { subtotal, gstTotal, freight, courier, roundOff, total: rawTotal + roundOff };
    }, [rows, form.data.freight_amount, form.data.courier_amount]);

    useEffect(() => {
        form.setData('round_off', String(totals.roundOff));
    }, [totals.roundOff]);

    // When party changes, re-apply auto-fill for all rows that have our_brand set
    useEffect(() => {
        if (partyRates.length === 0) return;
        setRows((current) =>
            current.map((row) => {
                if (!row.our_brand) return row;
                const v = row.our_brand.trim().toLowerCase();
                const matches = partyRates.filter((r) => r.our_brand.trim().toLowerCase() === v);
                if (matches.length === 1) {
                    return {
                        ...row,
                        party_brand:  matches[0].party_brand  ?? row.party_brand,
                        packing_size: matches[0].packing_size ?? row.packing_size,
                        rate:         String(matches[0].rate),
                        gst_percent:  String(matches[0].gst_percent),
                    };
                } else if (matches.length > 1) {
                    return { ...row, party_brand: matches[0].party_brand ?? row.party_brand };
                }
                return row;
            }),
        );
    }, [partyRates]);

    const updateRow = (index: number, field: keyof ProductRow, value: string) => {
        setRows((current) =>
            current.map((row, idx) => {
                if (idx !== index) return row;
                let updated = { ...row, [field]: value };

                const rates = partyRatesRef.current;
                const partyId = partyIdRef.current;
                if (field === 'our_brand') {
                    const v = value.trim().toLowerCase();

                    // Product changed — clear all product-dependent details so
                    // stale values from the previous brand never stick around.
                    if (row.our_brand !== value) {
                        updated.party_brand  = '';
                        updated.packing_size = '';
                        updated.rate         = '';
                        updated.gst_percent  = '18';
                        updated.shape        = '';
                        updated.cap_color    = '';
                    }

                    const matches = rates.filter(
                        (r) => r.our_brand.trim().toLowerCase() === v,
                    );
                    if (matches.length >= 1) {
                        updated.party_brand  = matches[0].party_brand  ?? '';
                        updated.packing_size = matches[0].packing_size ?? '';
                        updated.rate         = String(matches[0].rate);
                        updated.gst_percent  = String(matches[0].gst_percent);
                    } else {
                        // No product_rates match — try product gallery link for party_brand + bottle/cap
                        if (partyId) {
                            const photo = productPhotos.find(
                                (p) => p.party_id !== null &&
                                    String(p.party_id) === partyId &&
                                    p.our_brand.trim().toLowerCase() === v,
                            );
                            if (photo?.party_brand) updated.party_brand = photo.party_brand;
                            if (photo?.bottle_jar)  updated.shape = photo.bottle_jar;
                            if (photo?.cap_color)   updated.cap_color = photo.cap_color;
                        } else {
                            // No party — still try to get bottle/cap from generic photo (party_id null)
                            const photo = productPhotos.find(
                                (p) => p.party_id === null && p.our_brand.trim().toLowerCase() === v,
                            );
                            if (photo?.bottle_jar) updated.shape = photo.bottle_jar;
                            if (photo?.cap_color)  updated.cap_color = photo.cap_color;
                        }
                    }
                    // Also fill bottle/cap from product_rates match (photo link overrides if present)
                    if (matches.length >= 1 && partyId) {
                        const photo = productPhotos.find(
                            (p) => p.party_id !== null &&
                                String(p.party_id) === partyId &&
                                p.our_brand.trim().toLowerCase() === value.trim().toLowerCase(),
                        );
                        if (photo?.bottle_jar) updated.shape = photo.bottle_jar;
                        if (photo?.cap_color)  updated.cap_color = photo.cap_color;
                    }
                } else if (field === 'packing_size') {
                    const match = rates.find(
                        (r) =>
                            r.our_brand.trim().toLowerCase() === row.our_brand.trim().toLowerCase() &&
                            r.packing_size.trim().toLowerCase() === value.trim().toLowerCase(),
                    );
                    if (match) { updated.rate = String(match.rate); updated.gst_percent = String(match.gst_percent); }
                }

                return updated;
            }),
        );
    };
    const addRow = () => setRows((current) => [...current, createRow()]);
    const removeRow = (index: number) => {
        setRows((current) => current.length > 1 ? current.filter((_, idx) => idx !== index) : current);
    };

    const handlePartySelect = (partyId: string) => {
        if (!partyId) {
            form.setData('party_id', '');
            setPartySearch('');
            setPartyDropdownOpen(false);
            return;
        }
        const party = parties.find((p) => String(p.id) === partyId);
        if (!party) return;
        const transportType = party.default_transport_type ?? form.data.transport_type;
        const transportList = transportType === 'courier' ? couriers : transports;
        const transportName = party.default_transport_id
            ? (transportList.find((t) => t.id === party.default_transport_id)?.name ?? form.data.transport_name)
            : form.data.transport_name;

        form.setData({
            ...form.data,
            party_id: partyId,
            company_name: party.name,
            customer_name: party.customer_name || party.name,
            gst_no: party.gst_no ?? '',
            pan_no: party.pan_no ?? '',
            phone: party.phone ?? form.data.phone,
            delivery_address: party.address ?? form.data.delivery_address,
            destination: party.destination || (party.city ? (party.state ? `${party.city}, ${party.state}` : party.city) : form.data.destination),
            transport_type: transportType,
            transport_name: transportName,
        });
        if (party.pan_no || party.pan_card_url) setShowPan(true);
        setPartySearch(party.name);
        setPartyDropdownOpen(false);
    };

    const clearPartySearch = () => {
        setPartySearch('');
        form.setData('party_id', '');
        setPartyDropdownOpen(false);
    };

    const setTransportType = (type: 'transport' | 'courier') => {
        form.setData({ ...form.data, transport_type: type, transport_name: '' });
    };

    const togglePan = (checked: boolean) => {
        setShowPan(checked);
        if (!checked) form.setData({ ...form.data, pan_no: '', pan_file: null });
    };

    const toggleAadhaar = (checked: boolean) => {
        setShowAadhaar(checked);
        if (!checked) form.setData({ ...form.data, aadhaar_no: '', aadhaar_file: null });
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            sales_user_id: data.sales_user_id || null,
            pan_no: showPan ? data.pan_no : null,
            aadhaar_no: showAadhaar ? data.aadhaar_no : null,
            pan_file: showPan ? data.pan_file : null,
            aadhaar_file: showAadhaar ? data.aadhaar_file : null,
            items: rows.map((row) => ({
                ...row,
                quantity: toNumber(row.quantity),
                rate: toNumber(row.rate),
                gst_percent: toNumber(row.gst_percent),
            })),
        }));
        if (isEditing) {
            form.patch(update(editingOrder!.id).url, { forceFormData: true, preserveScroll: true });
        } else {
            form.post(store().url, { forceFormData: true, preserveScroll: true });
        }
    };

    const transportOptions = form.data.transport_type === 'courier' ? couriers : transports;

    const partyPanCardUrl = useMemo(
        () => parties.find((p) => String(p.id) === form.data.party_id)?.pan_card_url ?? null,
        [parties, form.data.party_id],
    );

    return (
        <>
            <Head title={isEditing ? `Edit ${editingOrder!.order_number}` : 'New Order'} />
            <div id="view-order-create" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>{isEditing ? `Edit ${editingOrder!.order_number}` : 'New Order'}</h1>
                        <p>Capture customer requirements and generate a new order.</p>
                    </div>
                </div>

                <form onSubmit={submit}>
                    {form.errors.order_error && (
                        <div className="form-msg error" style={{ marginBottom: '12px' }}>
                            {form.errors.order_error}
                        </div>
                    )}
                    {form.hasErrors && !form.errors.order_error && (
                        <div className="form-msg error" style={{ marginBottom: '12px' }}>
                            Please fix the highlighted fields.
                        </div>
                    )}

                    {/* ── Order Details ── */}
                    <div className="form-card">
                        <div className="form-card-title">Order Details</div>

                        {/* Party selector */}
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Load from Party</label>
                            <div className="party-search-wrap" ref={partyRef}>
                                <input
                                    type="text"
                                    className="party-search-input"
                                    placeholder="Search party name…"
                                    value={partySearch}
                                    autoComplete="off"
                                    onChange={(e) => {
                                        setPartySearch(e.target.value);
                                        setPartyDropdownOpen(true);
                                    }}
                                    onFocus={() => setPartyDropdownOpen(true)}
                                />
                                {partySearch && (
                                    <button type="button" className="party-search-clear" onClick={clearPartySearch}>✕</button>
                                )}
                                {partyDropdownOpen && (
                                    <div className="party-dropdown">
                                        {filteredParties.length > 0 ? (
                                            filteredParties.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className={`party-dropdown-item${String(p.id) === form.data.party_id ? ' selected' : ''}`}
                                                    onMouseDown={() => handlePartySelect(String(p.id))}
                                                >
                                                    {p.name}
                                                    {p.city && <span className="party-dropdown-sub">{p.city}{p.state ? `, ${p.state}` : ''}</span>}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="party-dropdown-empty">No parties found</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!!selectedParty?.outstanding_due && selectedParty.outstanding_due > 0 && (
                                <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fef3c7', border: '1px solid #fcd34d', fontSize: 13 }}>
                                    ⚠️ <strong>{selectedParty.name}</strong> has ₹{selectedParty.outstanding_due.toLocaleString('en-IN')} due from earlier orders.
                                </div>
                            )}
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label>Company Name *</label>
                                <input
                                    type="text"
                                    className={form.errors.company_name ? 'error' : ''}
                                    value={form.data.company_name}
                                    onChange={(e) => form.setData('company_name', e.target.value)}
                                    placeholder="e.g. Sri Agro Labs"
                                />
                                {form.errors.company_name && <span className="field-error">{form.errors.company_name}</span>}
                            </div>
                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input
                                    type="text"
                                    className={form.errors.customer_name ? 'error' : ''}
                                    value={form.data.customer_name}
                                    onChange={(e) => form.setData('customer_name', e.target.value)}
                                    placeholder="Contact person"
                                />
                                {form.errors.customer_name && <span className="field-error">{form.errors.customer_name}</span>}
                            </div>
                            <div className="form-group">
                                <label>GST Number</label>
                                <input
                                    type="text"
                                    value={form.data.gst_no}
                                    onChange={(e) => form.setData('gst_no', e.target.value.toUpperCase())}
                                    placeholder="e.g. 24AABCU9603R1ZX"
                                    maxLength={20}
                                />
                                {form.errors.gst_no && <span className="field-error">{form.errors.gst_no}</span>}
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="Contact number"
                                />
                            </div>
                            <div className="form-group">
                                <label>Sales Person</label>
                                <select
                                    value={form.data.sales_user_id}
                                    onChange={(e) => form.setData('sales_user_id', e.target.value)}
                                >
                                    <option value="">Select</option>
                                    {salesUsers.map((user) => (
                                        <option key={user.id} value={user.id}>{user.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Order Date *</label>
                                <input
                                    type="date"
                                    className={form.errors.order_date ? 'error' : ''}
                                    value={form.data.order_date}
                                    onChange={(e) => form.setData('order_date', e.target.value)}
                                />
                                {form.errors.order_date && <span className="field-error">{form.errors.order_date}</span>}
                            </div>

                            {/* Transport / Courier */}
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Transport / Courier <span style={{ color: '#94a3b8', fontWeight: 400 }}>(required before confirming)</span></label>
                                <div style={{ display: 'flex', gap: '8px', margin: '4px 0 8px' }}>
                                    <button
                                        type="button"
                                        className={`pill${form.data.transport_type === 'transport' ? ' active' : ''}`}
                                        onClick={() => setTransportType('transport')}
                                    >
                                        🚛 Transport
                                    </button>
                                    <button
                                        type="button"
                                        className={`pill${form.data.transport_type === 'courier' ? ' active' : ''}`}
                                        onClick={() => setTransportType('courier')}
                                    >
                                        📦 Courier
                                    </button>
                                </div>
                                <select
                                    className={form.errors.transport_name ? 'error' : ''}
                                    value={form.data.transport_name}
                                    onChange={(e) => form.setData('transport_name', e.target.value)}
                                >
                                    <option value="">
                                        — Select {form.data.transport_type === 'courier' ? 'courier' : 'transport'} —
                                    </option>
                                    {transportOptions.map((opt) => (
                                        <option key={opt.id} value={opt.name}>{opt.name}</option>
                                    ))}
                                </select>
                                {form.errors.transport_name && (
                                    <span className="field-error">{form.errors.transport_name}</span>
                                )}
                            </div>

                            {form.data.transport_type === 'courier' && (
                                <div className="form-group">
                                    <label>Courier Charge *</label>
                                    <input
                                        type="number"
                                        className={form.errors.courier_amount ? 'error' : ''}
                                        value={form.data.courier_amount}
                                        onChange={(e) => form.setData('courier_amount', e.target.value)}
                                        min="0.01"
                                        step="0.01"
                                        placeholder="Enter courier charge"
                                    />
                                    {form.errors.courier_amount && <span className="field-error">{form.errors.courier_amount}</span>}
                                </div>
                            )}

                            <div className="form-group">
                                <label>Destination <span style={{ color: '#94a3b8', fontWeight: 400 }}>(required before confirming)</span></label>
                                <input
                                    type="text"
                                    className={form.errors.destination ? 'error' : ''}
                                    value={form.data.destination}
                                    onChange={(e) => form.setData('destination', e.target.value)}
                                    placeholder="City / District"
                                />
                                {form.errors.destination && <span className="field-error">{form.errors.destination}</span>}
                            </div>
                            <div className="form-group">
                                <label>Delivery Address <span style={{ color: '#94a3b8', fontWeight: 400 }}>(required before confirming)</span></label>
                                <input
                                    type="text"
                                    className={form.errors.delivery_address ? 'error' : ''}
                                    value={form.data.delivery_address}
                                    onChange={(e) => form.setData('delivery_address', e.target.value)}
                                    placeholder="Address"
                                />
                                {form.errors.delivery_address && <span className="field-error">{form.errors.delivery_address}</span>}
                            </div>
                            <div className="form-group">
                                <label>Priority</label>
                                <select
                                    value={form.data.priority}
                                    onChange={(e) => form.setData('priority', e.target.value as 'normal' | 'high' | 'urgent')}
                                >
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── KYC Documents ── */}
                    <div className="form-card">
                        <div className="form-card-title">🪪 KYC Documents</div>

                        {/* PAN Card */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}>
                                <input
                                    type="checkbox"
                                    checked={showPan}
                                    onChange={(e) => togglePan(e.target.checked)}
                                />
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>Include PAN Card details</span>
                            </label>
                            {showPan && (
                                <div className="form-grid" style={{ marginLeft: '24px' }}>
                                    <div className="form-group">
                                        <label>PAN Number *</label>
                                        <input
                                            type="text"
                                            className={form.errors.pan_no ? 'error' : ''}
                                            value={form.data.pan_no}
                                            onChange={(e) => form.setData('pan_no', e.target.value.toUpperCase())}
                                            placeholder="e.g. ABCDE1234F"
                                            maxLength={10}
                                        />
                                        {form.errors.pan_no && <span className="field-error">{form.errors.pan_no}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            Upload PAN Card{partyPanCardUrl ? '' : ' *'} (PDF, JPG, PNG)
                                        </label>
                                        {partyPanCardUrl && (
                                            <div style={{ fontSize: '12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ color: 'var(--green, #16a34a)', fontWeight: 600 }}>✓ PAN card on file from party profile</span>
                                                <a href={partyPanCardUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--tx-sub)', textDecoration: 'underline' }}>View</a>
                                                <span style={{ color: 'var(--tx-muted)' }}>— upload below to use a different one</span>
                                            </div>
                                        )}
                                        <input
                                            type="file"
                                            className={form.errors.pan_file ? 'error' : ''}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => form.setData('pan_file', e.target.files?.[0] ?? null)}
                                        />
                                        {form.errors.pan_file && <span className="field-error">{form.errors.pan_file}</span>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Aadhaar Card */}
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px' }}>
                                <input
                                    type="checkbox"
                                    checked={showAadhaar}
                                    onChange={(e) => toggleAadhaar(e.target.checked)}
                                />
                                <span style={{ fontWeight: 600, fontSize: '13px' }}>Include Aadhaar Card details</span>
                            </label>
                            {showAadhaar && (
                                <div className="form-grid" style={{ marginLeft: '24px' }}>
                                    <div className="form-group">
                                        <label>Aadhaar Number *</label>
                                        <input
                                            type="text"
                                            className={form.errors.aadhaar_no ? 'error' : ''}
                                            value={form.data.aadhaar_no}
                                            onChange={(e) => form.setData('aadhaar_no', e.target.value.replace(/\D/g, '').slice(0, 12))}
                                            placeholder="12-digit Aadhaar number"
                                            maxLength={12}
                                        />
                                        {form.errors.aadhaar_no && <span className="field-error">{form.errors.aadhaar_no}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label>Upload Aadhaar Card * (PDF, JPG, PNG)</label>
                                        <input
                                            type="file"
                                            className={form.errors.aadhaar_file ? 'error' : ''}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={(e) => form.setData('aadhaar_file', e.target.files?.[0] ?? null)}
                                        />
                                        {form.errors.aadhaar_file && <span className="field-error">{form.errors.aadhaar_file}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Products ── */}
                    <div className="form-card">
                        <div className="form-card-title">Products</div>
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '52px' }}></th>
                                        <th>Our Brand</th>
                                        <th>Party Brand</th>
                                        <th>Packing</th>
                                        <th>Qty</th>
                                        <th>Rate</th>
                                        <th>GST %</th>
                                        <th>Bottle/Jar</th>
                                        <th>Cap Color</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => {
                                        const sizeOptions = partyRates.filter(
                                            (r) => r.our_brand.toLowerCase() === row.our_brand.toLowerCase(),
                                        );
                                        const qty = toNumber(row.quantity);
                                        const pcsPerBox = getBoxQty(row.packing_size, pcsPerBoxOverrides);
                                        const packUnit = getPackUnit(row.packing_size, packUnitOverrides);
                                        const boxes = pcsPerBox && qty > 0 ? qty / pcsPerBox : null;
                                        const boxesExact = boxes !== null && Number.isInteger(boxes);

                                        const rowPhoto = getRowPhoto(row);

                                        // Selling-rate guard: the matched product rate is the standard
                                        // selling rate. Warn (red) if the entered rate is below it.
                                        const matchedRate = (row.packing_size
                                            ? sizeOptions.find((r) => r.packing_size === row.packing_size)
                                            : undefined) ?? sizeOptions[0];
                                        const sellingRate = matchedRate ? toNumber(String(matchedRate.rate)) : null;
                                        const enteredRate = toNumber(row.rate);
                                        const belowSelling = sellingRate != null && sellingRate > 0 && enteredRate > 0 && enteredRate < sellingRate;

                                        return (
                                            <tr key={`row-${index}`}>
                                                <td style={{ textAlign: 'center', padding: '4px' }}>
                                                    {rowPhoto ? (
                                                        <div style={{ display: 'inline-block', textAlign: 'center' }}>
                                                            <img
                                                                src={rowPhoto.url}
                                                                alt=""
                                                                style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', display: 'block' }}
                                                            />
                                                            {rowPhoto.mrp && (
                                                                <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '2px', fontWeight: 600 }}>{rowPhoto.mrp}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div style={{ width: '44px', height: '44px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'var(--tx-muted)' }}>
                                                            📷
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <input
                                                        ref={(el) => { brandInputRefs.current[index] = el; }}
                                                        type="text"
                                                        value={openBrandRow === index ? brandSearch : row.our_brand}
                                                        placeholder="Brand"
                                                        onFocus={() => {
                                                            const el = brandInputRefs.current[index];
                                                            if (el) {
                                                                const r = el.getBoundingClientRect();
                                                                setBrandDropPos({ top: r.bottom, left: r.left, width: r.width });
                                                            }
                                                            setOpenBrandRow(index);
                                                            setBrandSearch('');
                                                        }}
                                                        onChange={(e) => setBrandSearch(e.target.value)}
                                                        onBlur={() => setTimeout(() => setOpenBrandRow(null), 160)}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={row.party_brand}
                                                        onChange={(e) => updateRow(index, 'party_brand', e.target.value)}
                                                        placeholder="Customer brand"
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        list={`sizes-${index}`}
                                                        value={row.packing_size}
                                                        onChange={(e) => updateRow(index, 'packing_size', e.target.value)}
                                                        placeholder="500ml"
                                                    />
                                                    <datalist id={`sizes-${index}`}>
                                                        {[...new Set([
                                                            ...(sizeOptions.length > 0 ? sizeOptions : partyRates).map((r) => r.packing_size),
                                                            ...packingSizes.map((p) => p.name),
                                                        ])].map((size) => (
                                                            <option key={size} value={size} />
                                                        ))}
                                                    </datalist>
                                                    {rowPhoto?.mrp && (
                                                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                                                            MRP: {rowPhoto.mrp}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={row.quantity}
                                                        onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    {boxes !== null && (
                                                        <div className={`box-count${boxesExact ? ' ok' : ' warn'}`}>
                                                            {boxesExact
                                                                ? `✓ ${boxes} ${pluralizeUnit(packUnit, boxes)}`
                                                                : `${boxes.toFixed(2)} ${pluralizeUnit(packUnit, 2)} (${pcsPerBox} pcs/${packUnit})`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={row.rate}
                                                        onChange={(e) => updateRow(index, 'rate', e.target.value)}
                                                        min="0"
                                                        step="0.01"
                                                        title={belowSelling ? `Below selling rate ₹${sellingRate}` : undefined}
                                                        style={belowSelling ? { border: '2px solid #dc2626', background: '#fef2f2', color: '#b91c1c', fontWeight: 700 } : undefined}
                                                    />
                                                    {belowSelling && (
                                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                                            ⚠ Below selling ₹{sellingRate}
                                                        </div>
                                                    )}
                                                </td>
                                                <td><input type="number" value={row.gst_percent} onChange={(e) => updateRow(index, 'gst_percent', e.target.value)} min="0" step="0.01" /></td>
                                                <td>
                                                    <input type="text" value={row.shape} onChange={(e) => updateRow(index, 'shape', e.target.value)} placeholder="Bottle/Jar" />
                                                </td>
                                                <td><input type="text" value={row.cap_color} onChange={(e) => updateRow(index, 'cap_color', e.target.value)} placeholder="Green" /></td>
                                                <td>
                                                    <button type="button" className="btn danger-xs" onClick={() => removeRow(index)}>✕</button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <button type="button" className="add-row-btn" onClick={addRow}>＋ Add Row</button>
                    </div>

                    {/* ── Attachments ── */}
                    <div className="form-card">
                        <div className="form-card-title">Attachments</div>
                        <div className="form-group">
                            <label>Upload Files (max 3)</label>
                            <input type="file" multiple onChange={(e) => form.setData('attachments', e.target.files ? Array.from(e.target.files) : null)} />
                        </div>
                    </div>

                    {/* ── Order Summary ── */}
                    <div className="form-card">
                        <div className="form-card-title">Order Summary</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '4px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--tx-sub)' }}>
                                <span>Subtotal</span>
                                <span style={{ fontWeight: 500, color: 'var(--tx-head)' }}>₹{totals.subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--tx-sub)' }}>
                                <span>GST Total</span>
                                <span style={{ fontWeight: 500, color: 'var(--tx-head)' }}>₹{totals.gstTotal.toFixed(2)}</span>
                            </div>
                            {totals.freight !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--tx-sub)' }}>
                                    <span>Freight</span>
                                    <span style={{ fontWeight: 500, color: 'var(--tx-head)' }}>₹{totals.freight.toFixed(2)}</span>
                                </div>
                            )}
                            {totals.courier !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--tx-sub)' }}>
                                    <span>Courier Charge</span>
                                    <span style={{ fontWeight: 500, color: 'var(--tx-head)' }}>₹{totals.courier.toFixed(2)}</span>
                                </div>
                            )}
                            {totals.roundOff !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--tx-sub)' }}>
                                    <span>Round Off</span>
                                    <span style={{ fontWeight: 500, color: 'var(--tx-head)' }}>{totals.roundOff >= 0 ? '+' : ''}₹{totals.roundOff.toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ borderTop: '2px solid var(--border)', marginTop: '6px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: '15px', color: 'var(--tx-head)' }}>Grand Total</span>
                                <span style={{ fontWeight: 700, fontSize: '20px', color: 'var(--accent)' }}>₹{totals.total.toFixed(2)}</span>
                            </div>
                            {!!selectedParty?.outstanding_due && selectedParty.outstanding_due > 0 && (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#b45309' }}>
                                        <span>Previous Due ({selectedParty.name})</span>
                                        <span style={{ fontWeight: 500 }}>₹{selectedParty.outstanding_due.toFixed(2)}</span>
                                    </div>
                                    <div style={{ borderTop: '2px dashed #fcd34d', marginTop: '6px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: '15px', color: '#b45309' }}>Total Incl. Previous Due</span>
                                        <span style={{ fontWeight: 700, fontSize: '20px', color: '#b45309' }}>
                                            ₹{(totals.total + selectedParty.outstanding_due).toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={form.data.save_as_draft}
                                onChange={(e) => form.setData('save_as_draft', e.target.checked)}
                            />
                            Save as draft
                        </label>
                        <button type="submit" className="btn primary" disabled={form.processing}>
                            {form.processing ? 'Saving…' : isEditing ? 'Save Changes' : 'Submit Order'}
                        </button>
                    </div>
                </form>
            </div>

            {openBrandRow !== null && createPortal(
                <div
                    onMouseDown={(e) => e.preventDefault()}
                    style={{
                        position: 'fixed',
                        top: brandDropPos.top + 2,
                        left: brandDropPos.left,
                        minWidth: Math.max(220, brandDropPos.width),
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                        zIndex: 99999,
                        maxHeight: '260px',
                        overflowY: 'auto',
                    }}
                >
                    {groupedBrands.length === 0 ? (
                        <div style={{ padding: '10px 14px', fontSize: '13px', color: '#6b7280' }}>No brands found</div>
                    ) : groupedBrands.map(({ group, brands }) => (
                        <div key={group}>
                            {group && (
                                <div style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                                    {group}
                                </div>
                            )}
                            {brands.map(({ name, shape, stock, unit }) => (
                                <div
                                    key={`${name}|${shape ?? ''}`}
                                    onMouseDown={() => {
                                        updateRow(openBrandRow!, 'our_brand', name);
                                        if (shape) updateRow(openBrandRow!, 'shape', shape);
                                        setOpenBrandRow(null);
                                    }}
                                    style={{ padding: '7px 14px', fontSize: '13px', cursor: 'pointer', color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                                >
                                    <span>
                                        {name}
                                        {shape && (
                                            <span style={{ marginLeft: '6px', fontSize: '12px', color: '#6b7280' }}>— {shape}</span>
                                        )}
                                    </span>
                                    {stock !== null && (
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '1px 7px',
                                            borderRadius: '10px',
                                            background: stock <= 0 ? '#fee2e2' : stock < 50 ? '#fef9c3' : '#dcfce7',
                                            color: stock <= 0 ? '#dc2626' : stock < 50 ? '#854d0e' : '#15803d',
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                        }}>
                                            {stock <= 0 ? 'Out' : `${stock}${unit ? ` ${unit}` : ''}`}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}
