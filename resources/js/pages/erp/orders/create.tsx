import { store } from '@/routes/orders';
import { Head, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

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
    gst_no?: string | null;
    pan_no?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    product_rates: ProductRate[];
};

type Props = {
    pageTitle: string;
    salesUsers: SalesUser[];
    transports: TransportOption[];
    couriers: TransportOption[];
    parties: Party[];
    currentUser: { id: number; name: string };
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

function getBoxQty(packingSize: string): number | null {
    return BOX_SIZES[normalizeSize(packingSize)] ?? null;
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

export default function OrdersCreate({ salesUsers, transports, couriers, parties, currentUser }: Props) {
    const [rows, setRows] = useState<ProductRow[]>([createRow()]);
    const [showPan, setShowPan] = useState(false);
    const [showAadhaar, setShowAadhaar] = useState(false);
    const [partySearch, setPartySearch] = useState('');
    const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
    const partyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (partyRef.current && !partyRef.current.contains(e.target as Node)) {
                setPartyDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const form = useForm<OrderFormData>({
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

    const brandOptions = useMemo(
        () => [...new Set(partyRates.map((r) => r.our_brand))].sort(),
        [partyRates],
    );

    const totals = useMemo(() => {
        const subtotal = rows.reduce((acc, row) => acc + toNumber(row.quantity) * toNumber(row.rate), 0);
        const gstTotal = rows.reduce((acc, row) => {
            const lineAmount = toNumber(row.quantity) * toNumber(row.rate);
            return acc + (lineAmount * toNumber(row.gst_percent)) / 100;
        }, 0);
        const freight = toNumber(form.data.freight_amount);
        const courier = toNumber(form.data.courier_amount);
        const roundOff = toNumber(form.data.round_off);
        return { subtotal, gstTotal, total: subtotal + gstTotal + freight + courier + roundOff };
    }, [rows, form.data.freight_amount, form.data.courier_amount, form.data.round_off]);

    const updateRow = (index: number, field: keyof ProductRow, value: string) => {
        setRows((current) =>
            current.map((row, idx) => {
                if (idx !== index) return row;
                let updated = { ...row, [field]: value };

                if (field === 'our_brand') {
                    const match = partyRates.find(
                        (r) => r.our_brand.toLowerCase() === value.toLowerCase(),
                    );
                    if (match) updated.party_brand = match.party_brand ?? '';
                    if (row.our_brand !== value) { updated.packing_size = ''; updated.rate = ''; }
                } else if (field === 'packing_size') {
                    const match = partyRates.find(
                        (r) =>
                            r.our_brand.toLowerCase() === row.our_brand.toLowerCase() &&
                            r.packing_size.toLowerCase() === value.toLowerCase(),
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
        form.setData({
            ...form.data,
            party_id: partyId,
            company_name: party.name,
            gst_no: party.gst_no ?? '',
            pan_no: party.pan_no ?? '',
            phone: party.phone ?? form.data.phone,
            delivery_address: party.address ?? form.data.delivery_address,
            destination: party.city ? (party.state ? `${party.city}, ${party.state}` : party.city) : form.data.destination,
        });
        if (party.pan_no) setShowPan(true);
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
        form.post(store(), { forceFormData: true, preserveScroll: true });
    };

    const transportOptions = form.data.transport_type === 'courier' ? couriers : transports;

    return (
        <>
            <Head title="New Order" />
            <div id="view-order-create" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>New Order</h1>
                        <p>Capture customer requirements and generate a new order.</p>
                    </div>
                </div>

                <form onSubmit={submit}>
                    {form.hasErrors && (
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
                                <label>Transport / Courier</label>
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
                                <label>Destination *</label>
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
                                <label>Delivery Address *</label>
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
                                        <label>Upload PAN Card * (PDF, JPG, PNG)</label>
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
                                        <th>Our Brand</th>
                                        <th>Party Brand</th>
                                        <th>Packing</th>
                                        <th>Qty</th>
                                        <th>Rate</th>
                                        <th>GST %</th>
                                        <th>Type</th>
                                        <th>Shape</th>
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
                                        const pcsPerBox = getBoxQty(row.packing_size);
                                        const boxes = pcsPerBox && qty > 0 ? qty / pcsPerBox : null;
                                        const boxesExact = boxes !== null && Number.isInteger(boxes);

                                        return (
                                            <tr key={`row-${index}`}>
                                                <td>
                                                    <input
                                                        type="text"
                                                        list={`brands-${index}`}
                                                        value={row.our_brand}
                                                        onChange={(e) => updateRow(index, 'our_brand', e.target.value)}
                                                        placeholder="Brand"
                                                    />
                                                    <datalist id={`brands-${index}`}>
                                                        {brandOptions.map((b) => <option key={b} value={b} />)}
                                                    </datalist>
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
                                                        {(sizeOptions.length > 0 ? sizeOptions : partyRates).map((r) => (
                                                            <option key={r.packing_size} value={r.packing_size} />
                                                        ))}
                                                    </datalist>
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
                                                                ? `✓ ${boxes} box${boxes !== 1 ? 'es' : ''}`
                                                                : `${boxes.toFixed(2)} boxes (${pcsPerBox} pcs/box)`}
                                                        </div>
                                                    )}
                                                </td>
                                                <td><input type="number" value={row.rate} onChange={(e) => updateRow(index, 'rate', e.target.value)} min="0" step="0.01" /></td>
                                                <td><input type="number" value={row.gst_percent} onChange={(e) => updateRow(index, 'gst_percent', e.target.value)} min="0" step="0.01" /></td>
                                                <td><input type="text" value={row.type} onChange={(e) => updateRow(index, 'type', e.target.value)} placeholder="Liquid" /></td>
                                                <td><input type="text" value={row.shape} onChange={(e) => updateRow(index, 'shape', e.target.value)} placeholder="Bottle" /></td>
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

                    {/* ── Charges & Notes ── */}
                    <div className="form-card">
                        <div className="form-card-title">Charges &amp; Notes</div>
                        <div className="form-grid three">
                            <div className="form-group">
                                <label>Freight</label>
                                <input type="number" value={form.data.freight_amount} onChange={(e) => form.setData('freight_amount', e.target.value)} min="0" step="0.01" />
                            </div>
                            {form.data.transport_type !== 'courier' && (
                                <div className="form-group">
                                    <label>Courier</label>
                                    <input type="number" value={form.data.courier_amount} onChange={(e) => form.setData('courier_amount', e.target.value)} min="0" step="0.01" />
                                </div>
                            )}
                            <div className="form-group">
                                <label>Round Off</label>
                                <input type="number" value={form.data.round_off} onChange={(e) => form.setData('round_off', e.target.value)} step="0.01" />
                            </div>
                        </div>
                        <div className="form-group" style={{ marginTop: '12px' }}>
                            <label>Notes</label>
                            <textarea
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                                placeholder="Add any notes for production"
                            />
                        </div>
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
                        <div className="form-grid three">
                            <div className="form-group">
                                <label>Subtotal</label>
                                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--tx-head)' }}>{totals.subtotal.toFixed(2)}</div>
                            </div>
                            <div className="form-group">
                                <label>GST Total</label>
                                <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--tx-head)' }}>{totals.gstTotal.toFixed(2)}</div>
                            </div>
                            <div className="form-group">
                                <label>Grand Total</label>
                                <div style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent)' }}>{totals.total.toFixed(2)}</div>
                            </div>
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
                            {form.processing ? 'Saving…' : 'Save Order'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
