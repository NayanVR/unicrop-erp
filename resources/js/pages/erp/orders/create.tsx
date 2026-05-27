import { store } from '@/routes/orders';
import { Head, useForm } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type SalesUser = {
    id: number;
    name: string;
};

type TransportOption = {
    id: number;
    name: string;
};

type Props = {
    pageTitle: string;
    salesUsers: SalesUser[];
    transports: TransportOption[];
    couriers: TransportOption[];
    currentUser: { id: number; name: string };
};

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
    company_name: string;
    customer_name: string;
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

export default function OrdersCreate({ salesUsers, transports, couriers, currentUser }: Props) {
    const [rows, setRows] = useState<ProductRow[]>([createRow()]);

    const form = useForm<OrderFormData>({
        company_name: '',
        customer_name: '',
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
        save_as_draft: false,
    });

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
        setRows((current) => current.map((row, idx) => idx === index ? { ...row, [field]: value } : row));
    };

    const addRow = () => setRows((current) => [...current, createRow()]);

    const removeRow = (index: number) => {
        setRows((current) => current.length > 1 ? current.filter((_, idx) => idx !== index) : current);
    };

    const handleAttachments = (files: FileList | null) => {
        form.setData('attachments', files ? Array.from(files) : null);
    };

    const setTransportType = (type: 'transport' | 'courier') => {
        form.setData({ ...form.data, transport_type: type, transport_name: '' });
    };

    const submit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            sales_user_id: data.sales_user_id || null,
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

                    <div className="form-card">
                        <div className="form-card-title">Order Details</div>
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
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    placeholder="Contact number"
                                />
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
                                    {rows.map((row, index) => (
                                        <tr key={`row-${index}`}>
                                            <td><input type="text" value={row.our_brand} onChange={(e) => updateRow(index, 'our_brand', e.target.value)} placeholder="Brand" /></td>
                                            <td><input type="text" value={row.party_brand} onChange={(e) => updateRow(index, 'party_brand', e.target.value)} placeholder="Customer brand" /></td>
                                            <td><input type="text" value={row.packing_size} onChange={(e) => updateRow(index, 'packing_size', e.target.value)} placeholder="500 ml" /></td>
                                            <td><input type="number" value={row.quantity} onChange={(e) => updateRow(index, 'quantity', e.target.value)} min="0" step="0.01" /></td>
                                            <td><input type="number" value={row.rate} onChange={(e) => updateRow(index, 'rate', e.target.value)} min="0" step="0.01" /></td>
                                            <td><input type="number" value={row.gst_percent} onChange={(e) => updateRow(index, 'gst_percent', e.target.value)} min="0" step="0.01" /></td>
                                            <td><input type="text" value={row.type} onChange={(e) => updateRow(index, 'type', e.target.value)} placeholder="Liquid" /></td>
                                            <td><input type="text" value={row.shape} onChange={(e) => updateRow(index, 'shape', e.target.value)} placeholder="Bottle" /></td>
                                            <td><input type="text" value={row.cap_color} onChange={(e) => updateRow(index, 'cap_color', e.target.value)} placeholder="Green" /></td>
                                            <td>
                                                <button type="button" className="btn danger-xs" onClick={() => removeRow(index)}>✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <button type="button" className="add-row-btn" onClick={addRow}>＋ Add Row</button>
                    </div>

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

                    <div className="form-card">
                        <div className="form-card-title">Attachments</div>
                        <div className="form-group">
                            <label>Upload Files (max 3)</label>
                            <input type="file" multiple onChange={(e) => handleAttachments(e.target.files)} />
                        </div>
                    </div>

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
