import {
    destroy as productDestroy,
    store as productStore,
    update as productUpdate,
} from '@/routes/settings/products';
import {
    destroy as transportDestroy,
    store as transportStore,
    update as transportUpdate,
} from '@/routes/settings/transports';
import {
    destroy as packingSizeDestroy,
    store as packingSizeStore,
    update as packingSizeUpdate,
} from '@/routes/settings/packing-sizes';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

type Product = {
    id: number;
    name: string;
    hsn_code?: string | null;
    gst_percent: string | number;
    category?: string | null;
    description?: string | null;
    is_active: boolean;
};

type TransportEntry = {
    id: number;
    name: string;
    type: 'transport' | 'courier';
    is_active: boolean;
};

type PackingSizeEntry = {
    id: number;
    name: string;
    multiplier: string | number;
    pieces_per_box: number | null;
    pack_unit: string | null;
};

type AlertSettings = {
    alert_enabled: string;
    alert_provider: string;
    alert_phone_numbers: string;
    alert_twilio_sid: string;
    alert_twilio_token: string;
    alert_twilio_from: string;
    alert_twilio_channel: string;
    alert_msg91_authkey: string;
    alert_msg91_sender: string;
    alert_msg91_template_id: string;
    alert_cooldown_hours: string;
};

type Props = {
    products: Product[];
    transports: TransportEntry[];
    alertSettings: AlertSettings;
    packingSizes: PackingSizeEntry[];
};

type ProductForm = {
    name: string;
    hsn_code: string;
    gst_percent: string;
    category: string;
    description: string;
    is_active: boolean;
};

type TransportForm = {
    name: string;
    type: 'transport' | 'courier';
};

type PackingSizeForm = {
    name: string;
    multiplier: string;
    pieces_per_box: string;
    pack_unit: string;
};

const GST_OPTIONS = ['0', '5', '12', '18', '28'];

export default function SettingsIndex({ products, transports, alertSettings, packingSizes }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    const [transportModalOpen, setTransportModalOpen] = useState(false);
    const [editingTransport, setEditingTransport] = useState<TransportEntry | null>(null);
    const [transportTab, setTransportTab] = useState<'transport' | 'courier'>('transport');

    const [packingSizeModalOpen, setPackingSizeModalOpen] = useState(false);
    const [editingPackingSize, setEditingPackingSize] = useState<PackingSizeEntry | null>(null);

    const [alertSaving, setAlertSaving] = useState(false);
    const [alertTesting, setAlertTesting] = useState(false);
    const [alertTestResult, setAlertTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
    const [alert, setAlert] = useState<AlertSettings>({
        alert_enabled:           alertSettings.alert_enabled ?? '0',
        alert_provider:          alertSettings.alert_provider || 'twilio',
        alert_phone_numbers:     alertSettings.alert_phone_numbers ?? '',
        alert_twilio_sid:        alertSettings.alert_twilio_sid ?? '',
        alert_twilio_token:      alertSettings.alert_twilio_token ?? '',
        alert_twilio_from:       alertSettings.alert_twilio_from ?? '',
        alert_twilio_channel:    alertSettings.alert_twilio_channel || 'whatsapp',
        alert_msg91_authkey:     alertSettings.alert_msg91_authkey ?? '',
        alert_msg91_sender:      alertSettings.alert_msg91_sender ?? '',
        alert_msg91_template_id: alertSettings.alert_msg91_template_id ?? '',
        alert_cooldown_hours:    alertSettings.alert_cooldown_hours || '6',
    });

    const saveAlertSettings = () => {
        setAlertSaving(true);
        router.post('/erp/settings/alert', { ...alert }, {
            preserveScroll: true,
            onFinish: () => setAlertSaving(false),
        });
    };

    const testAlert = async () => {
        setAlertTesting(true);
        setAlertTestResult(null);
        try {
            const res = await fetch('/erp/settings/alert/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                    'Accept': 'application/json',
                },
            });
            const data = await res.json();
            setAlertTestResult(data);
        } catch (e: unknown) {
            setAlertTestResult({ ok: false, detail: String(e) });
        } finally {
            setAlertTesting(false);
        }
    };

    const form = useForm<ProductForm>({
        name: '',
        hsn_code: '',
        gst_percent: '18',
        category: '',
        description: '',
        is_active: true,
    });

    const transportForm = useForm<TransportForm>({
        name: '',
        type: 'transport',
    });

    const packingSizeForm = useForm<PackingSizeForm>({
        name: '',
        multiplier: '1',
        pieces_per_box: '',
        pack_unit: 'box',
    });

    // ── Product handlers ──────────────────────────────────────────────────
    const openNew = () => {
        form.reset();
        form.clearErrors();
        setEditingProduct(null);
        setModalOpen(true);
    };

    const openEdit = (p: Product) => {
        form.setData({
            name: p.name,
            hsn_code: p.hsn_code ?? '',
            gst_percent: String(p.gst_percent),
            category: p.category ?? '',
            description: p.description ?? '',
            is_active: p.is_active,
        });
        form.clearErrors();
        setEditingProduct(p);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        form.reset();
        setEditingProduct(null);
    };

    const save = () => {
        if (editingProduct) {
            form.patch(productUpdate(editingProduct.id).url, { preserveScroll: true, onSuccess: closeModal });
        } else {
            form.post(productStore().url, { preserveScroll: true, onSuccess: closeModal });
        }
    };

    const deleteProduct = (p: Product) => {
        if (!confirm(`Delete "${p.name}"?`)) return;
        form.delete(productDestroy(p.id).url, { preserveScroll: true });
    };

    // ── Transport handlers ────────────────────────────────────────────────
    const openNewTransport = (type: 'transport' | 'courier') => {
        transportForm.setData({ name: '', type });
        transportForm.clearErrors();
        setEditingTransport(null);
        setTransportModalOpen(true);
    };

    const openEditTransport = (t: TransportEntry) => {
        transportForm.setData({ name: t.name, type: t.type });
        transportForm.clearErrors();
        setEditingTransport(t);
        setTransportModalOpen(true);
    };

    const closeTransportModal = () => {
        setTransportModalOpen(false);
        transportForm.reset();
        setEditingTransport(null);
    };

    const saveTransport = () => {
        if (editingTransport) {
            transportForm.patch(transportUpdate(editingTransport.id).url, { preserveScroll: true, onSuccess: closeTransportModal });
        } else {
            transportForm.post(transportStore().url, { preserveScroll: true, onSuccess: closeTransportModal });
        }
    };

    const deleteTransport = (t: TransportEntry) => {
        if (!confirm(`Delete "${t.name}"?`)) return;
        transportForm.delete(transportDestroy(t.id).url, { preserveScroll: true });
    };

    const filteredTransports = transports.filter((t) => t.type === transportTab);

    // ── Packing size handlers ─────────────────────────────────────────────
    const openNewPackingSize = () => {
        packingSizeForm.setData({ name: '', multiplier: '1', pieces_per_box: '', pack_unit: 'box' });
        packingSizeForm.clearErrors();
        setEditingPackingSize(null);
        setPackingSizeModalOpen(true);
    };

    const openEditPackingSize = (p: PackingSizeEntry) => {
        packingSizeForm.setData({ name: p.name, multiplier: String(p.multiplier), pieces_per_box: p.pieces_per_box != null ? String(p.pieces_per_box) : '', pack_unit: p.pack_unit ?? 'box' });
        packingSizeForm.clearErrors();
        setEditingPackingSize(p);
        setPackingSizeModalOpen(true);
    };

    const closePackingSizeModal = () => {
        setPackingSizeModalOpen(false);
        packingSizeForm.reset();
        setEditingPackingSize(null);
    };

    const savePackingSize = () => {
        if (editingPackingSize) {
            packingSizeForm.patch(packingSizeUpdate(editingPackingSize.id).url, { preserveScroll: true, onSuccess: closePackingSizeModal });
        } else {
            packingSizeForm.post(packingSizeStore().url, { preserveScroll: true, onSuccess: closePackingSizeModal });
        }
    };

    const deletePackingSize = (p: PackingSizeEntry) => {
        if (!confirm(`Delete "${p.name}"?`)) return;
        packingSizeForm.delete(packingSizeDestroy(p.id).url, { preserveScroll: true });
    };

    return (
        <>
            <Head title="Settings" />
            <div id="view-settings" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>Settings</h1>
                        <p>Manage product catalog, brand rates, transports and more</p>
                    </div>
                    <button className="btn primary" onClick={openNew}>
                        ＋ Add Product
                    </button>
                </div>

                {/* Products */}
                <div className="card">
                    <div className="card-title">
                        🌿 Product Catalog
                        <span className="ct-badge">{products.length} products</span>
                    </div>

                    {products.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">🌿</div>
                            <p>No products yet. Add your first agrochemical product.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th>HSN Code</th>
                                        <th>GST %</th>
                                        <th>Category</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((p) => (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="prod-name">{p.name}</div>
                                                {p.description && <div className="prod-detail">{p.description}</div>}
                                            </td>
                                            <td>{p.hsn_code ?? '—'}</td>
                                            <td>{p.gst_percent}%</td>
                                            <td>{p.category ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${p.is_active ? 'teal' : 'gray'}`}>
                                                    {p.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn sm" onClick={() => openEdit(p)}>Edit</button>
                                                    <button className="btn danger-xs" onClick={() => deleteProduct(p)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>



                {/* Transports & Couriers */}
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="card-title" style={{ marginBottom: '12px' }}>
                        🚛 Transports &amp; Couriers
                        <span className="ct-badge">{transports.length} entries</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className={`pill${transportTab === 'transport' ? ' active' : ''}`} onClick={() => setTransportTab('transport')}>
                                🚛 Transport ({transports.filter((t) => t.type === 'transport').length})
                            </button>
                            <button className={`pill${transportTab === 'courier' ? ' active' : ''}`} onClick={() => setTransportTab('courier')}>
                                📦 Courier ({transports.filter((t) => t.type === 'courier').length})
                            </button>
                        </div>
                        <button className="btn primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={() => openNewTransport(transportTab)}>
                            ＋ Add {transportTab === 'courier' ? 'Courier' : 'Transport'}
                        </button>
                    </div>

                    {filteredTransports.length === 0 ? (
                        <div className="empty-state" style={{ padding: '28px 20px' }}>
                            <div className="icon">{transportTab === 'courier' ? '📦' : '🚛'}</div>
                            <p>No {transportTab === 'courier' ? 'couriers' : 'transports'} added yet.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransports.map((t) => (
                                        <tr key={t.id}>
                                            <td><div className="prod-name">{t.name}</div></td>
                                            <td>
                                                <span className={`badge ${t.type === 'courier' ? 'sky' : 'teal'}`}>
                                                    {t.type === 'courier' ? '📦 Courier' : '🚛 Transport'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn sm" onClick={() => openEditTransport(t)}>Rename</button>
                                                    <button className="btn danger-xs" onClick={() => deleteTransport(t)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Packing Sizes */}
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="card-title" style={{ marginBottom: '12px' }}>
                        📐 Packing Sizes
                        <span className="ct-badge">{packingSizes.length} sizes</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
                        Define every packing size used in orders and how many inventory units (kg / L / pcs) one unit of that size consumes.
                        These appear in the packing-size dropdown on the New Order page and drive automatic stock deduction.
                    </p>
                    <div style={{ marginBottom: '14px' }}>
                        <button className="btn primary" style={{ padding: '6px 14px', fontSize: '12px' }} onClick={openNewPackingSize}>
                            ＋ Add Packing Size
                        </button>
                    </div>

                    {packingSizes.length === 0 ? (
                        <div className="empty-state" style={{ padding: '28px 20px' }}>
                            <div className="icon">📐</div>
                            <p>No packing sizes added yet.</p>
                        </div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Packing Size</th>
                                        <th>Stock Multiplier</th>
                                        <th>Pcs / Pack</th>
                                        <th>Pack Unit</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {packingSizes.map((p) => (
                                        <tr key={p.id}>
                                            <td><div className="prod-name">{p.name}</div></td>
                                            <td>{p.multiplier}</td>
                                            <td>{p.pieces_per_box ?? '—'}</td>
                                            <td style={{ textTransform: 'capitalize' }}>{p.pack_unit ?? 'Box'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="btn sm" onClick={() => openEditPackingSize(p)}>Edit</button>
                                                    <button className="btn danger-xs" onClick={() => deletePackingSize(p)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Low Stock Alert Settings */}
                <div className="card" style={{ marginTop: '16px' }}>
                    <div className="card-title" style={{ marginBottom: '12px' }}>
                        🔔 Low Stock Alerts
                        <span className={`ct-badge ${alert.alert_enabled === '1' ? 'teal' : ''}`}>
                            {alert.alert_enabled === '1' ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '18px' }}>
                        Automatically send WhatsApp or SMS when a material's stock drops below its minimum level.
                    </p>

                    <div className="form-grid" style={{ maxWidth: '640px' }}>
                        {/* Enable toggle */}
                        <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label style={{ margin: 0, fontWeight: 600 }}>Enable Alerts</label>
                            <button
                                type="button"
                                className={`pill${alert.alert_enabled === '1' ? ' active' : ''}`}
                                style={{ fontSize: '13px' }}
                                onClick={() => setAlert(a => ({ ...a, alert_enabled: a.alert_enabled === '1' ? '0' : '1' }))}
                            >
                                {alert.alert_enabled === '1' ? '✅ On' : '⬜ Off'}
                            </button>
                        </div>

                        {/* Provider */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label>Provider</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <button type="button" className={`pill${alert.alert_provider === 'twilio' ? ' active' : ''}`}
                                    onClick={() => setAlert(a => ({ ...a, alert_provider: 'twilio' }))}>
                                    📱 Twilio (WhatsApp / SMS)
                                </button>
                                <button type="button" className={`pill${alert.alert_provider === 'msg91' ? ' active' : ''}`}
                                    onClick={() => setAlert(a => ({ ...a, alert_provider: 'msg91' }))}>
                                    📨 MSG91 (SMS — India)
                                </button>
                            </div>
                        </div>

                        {/* Phone numbers */}
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                            <label>Phone Number(s)</label>
                            <input
                                type="text"
                                value={alert.alert_phone_numbers}
                                onChange={e => setAlert(a => ({ ...a, alert_phone_numbers: e.target.value }))}
                                placeholder="e.g. 9876543210, 9123456789  (comma separated)"
                            />
                            <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>10-digit Indian numbers are accepted. Country code optional.</small>
                        </div>

                        {/* Cooldown */}
                        <div className="form-group">
                            <label>Alert Cooldown (hours)</label>
                            <input
                                type="number"
                                min={1} max={168}
                                value={alert.alert_cooldown_hours}
                                onChange={e => setAlert(a => ({ ...a, alert_cooldown_hours: e.target.value }))}
                                placeholder="6"
                                style={{ maxWidth: '120px' }}
                            />
                            <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Minimum hours between repeat alerts for the same material.</small>
                        </div>

                        {/* ── Twilio fields ── */}
                        {alert.alert_provider === 'twilio' && (<>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    💡 <strong>Twilio setup:</strong> Create a free account at twilio.com, get your Account SID and Auth Token from the Console. For WhatsApp, use the Sandbox number <code>+14155238886</code> (send "join &lt;keyword&gt;" to activate). For production WhatsApp, register a WhatsApp Business number.
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Account SID</label>
                                <input type="text" value={alert.alert_twilio_sid}
                                    onChange={e => setAlert(a => ({ ...a, alert_twilio_sid: e.target.value }))}
                                    placeholder="ACxxxxxxxxxxxx" />
                            </div>
                            <div className="form-group">
                                <label>Auth Token</label>
                                <input type="password" value={alert.alert_twilio_token}
                                    onChange={e => setAlert(a => ({ ...a, alert_twilio_token: e.target.value }))}
                                    placeholder="Your auth token" />
                            </div>
                            <div className="form-group">
                                <label>From Number</label>
                                <input type="text" value={alert.alert_twilio_from}
                                    onChange={e => setAlert(a => ({ ...a, alert_twilio_from: e.target.value }))}
                                    placeholder="+14155238886" />
                                <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>For WhatsApp sandbox: +14155238886</small>
                            </div>
                            <div className="form-group">
                                <label>Channel</label>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    {(['whatsapp', 'sms', 'both'] as const).map(ch => (
                                        <button key={ch} type="button" className={`pill${alert.alert_twilio_channel === ch ? ' active' : ''}`}
                                            onClick={() => setAlert(a => ({ ...a, alert_twilio_channel: ch }))}>
                                            {ch === 'whatsapp' ? '💬 WhatsApp' : ch === 'sms' ? '📩 SMS' : '🔀 Both'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>)}

                        {/* ── MSG91 fields ── */}
                        {alert.alert_provider === 'msg91' && (<>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    💡 <strong>MSG91 setup:</strong> Register at msg91.com, go to API &gt; Auth Key to get your key. For transactional SMS in India, you need a DLT-registered sender ID and template ID. Use route 4 for transactional messages.
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Auth Key</label>
                                <input type="password" value={alert.alert_msg91_authkey}
                                    onChange={e => setAlert(a => ({ ...a, alert_msg91_authkey: e.target.value }))}
                                    placeholder="Your MSG91 auth key" />
                            </div>
                            <div className="form-group">
                                <label>Sender ID</label>
                                <input type="text" value={alert.alert_msg91_sender}
                                    onChange={e => setAlert(a => ({ ...a, alert_msg91_sender: e.target.value }))}
                                    placeholder="UNICRP (6 chars)" maxLength={6} />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>DLT Template ID <small style={{ color: 'var(--text-secondary)' }}>(optional)</small></label>
                                <input type="text" value={alert.alert_msg91_template_id}
                                    onChange={e => setAlert(a => ({ ...a, alert_msg91_template_id: e.target.value }))}
                                    placeholder="Template ID from DLT portal" />
                            </div>
                        </>)}

                        {/* Actions */}
                        <div className="form-group" style={{ gridColumn: '1/-1', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                            <button className="btn primary" onClick={saveAlertSettings} disabled={alertSaving}>
                                {alertSaving ? 'Saving…' : '💾 Save Alert Settings'}
                            </button>
                            <button className="btn" onClick={testAlert} disabled={alertTesting}>
                                {alertTesting ? 'Sending…' : '🧪 Send Test Alert'}
                            </button>
                            {alertTestResult && (
                                <span style={{
                                    fontSize: '13px',
                                    color: alertTestResult.ok ? 'var(--color-success, #16a34a)' : 'var(--color-danger, #dc2626)',
                                    background: alertTestResult.ok ? '#f0fdf4' : '#fef2f2',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: `1px solid ${alertTestResult.ok ? '#bbf7d0' : '#fecaca'}`,
                                }}>
                                    {alertTestResult.ok ? '✅ ' : '❌ '}{alertTestResult.detail}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Product Modal */}
            <div className={`modal-overlay${modalOpen ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '500px' }}>
                    <div className="modal-header">
                        <h2>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
                        <button className="modal-close" onClick={closeModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Product Name *</label>
                                <input type="text" value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="e.g. Imidacloprid 17.8% SL" />
                                {form.errors.name && <span className="field-error">{form.errors.name}</span>}
                            </div>
                            <div className="form-group">
                                <label>HSN Code</label>
                                <input type="text" value={form.data.hsn_code} onChange={(e) => form.setData('hsn_code', e.target.value)} placeholder="e.g. 3808" />
                            </div>
                            <div className="form-group">
                                <label>GST % *</label>
                                <select value={form.data.gst_percent} onChange={(e) => form.setData('gst_percent', e.target.value)}>
                                    {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Category</label>
                                <input type="text" value={form.data.category} onChange={(e) => form.setData('category', e.target.value)} placeholder="e.g. Insecticide, Fungicide" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                <label>Description</label>
                                <textarea value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} placeholder="Optional notes" rows={2} />
                            </div>
                            {editingProduct && (
                                <div className="form-group">
                                    <label>Status</label>
                                    <select value={form.data.is_active ? 'active' : 'inactive'} onChange={(e) => form.setData('is_active', e.target.value === 'active')}>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closeModal}>Cancel</button>
                        <button className="btn primary" onClick={save} disabled={form.processing}>
                            {editingProduct ? 'Update' : 'Add Product'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Transport / Courier Modal */}
            <div className={`modal-overlay${transportModalOpen ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '420px' }}>
                    <div className="modal-header">
                        <h2>{editingTransport ? 'Rename' : 'Add'} {transportForm.data.type === 'courier' ? 'Courier' : 'Transport'}</h2>
                        <button className="modal-close" onClick={closeTransportModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Type</label>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                <button type="button" className={`pill${transportForm.data.type === 'transport' ? ' active' : ''}`} onClick={() => transportForm.setData('type', 'transport')}>🚛 Transport</button>
                                <button type="button" className={`pill${transportForm.data.type === 'courier' ? ' active' : ''}`} onClick={() => transportForm.setData('type', 'courier')}>📦 Courier</button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={transportForm.data.name}
                                onChange={(e) => transportForm.setData('name', e.target.value)}
                                placeholder={transportForm.data.type === 'courier' ? 'e.g. DTDC, Blue Dart' : 'e.g. Sri Logistics'}
                                autoFocus
                            />
                            {transportForm.errors.name && <span className="field-error">{transportForm.errors.name}</span>}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closeTransportModal}>Cancel</button>
                        <button className="btn primary" onClick={saveTransport} disabled={transportForm.processing}>
                            {editingTransport ? 'Save Changes' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Packing Size Modal */}
            <div className={`modal-overlay${packingSizeModalOpen ? ' open' : ''}`}>
                <div className="modal" style={{ maxWidth: '420px' }}>
                    <div className="modal-header">
                        <h2>{editingPackingSize ? 'Edit' : 'Add'} Packing Size</h2>
                        <button className="modal-close" onClick={closePackingSizeModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group" style={{ marginBottom: '14px' }}>
                            <label>Packing Size *</label>
                            <input
                                type="text"
                                value={packingSizeForm.data.name}
                                onChange={(e) => packingSizeForm.setData('name', e.target.value)}
                                placeholder="e.g. 25kg, 500ml, 1ltr"
                                autoFocus
                            />
                            {packingSizeForm.errors.name && <span className="field-error">{packingSizeForm.errors.name}</span>}
                        </div>
                        <div className="form-group">
                            <label>Stock Multiplier *</label>
                            <input
                                type="number"
                                value={packingSizeForm.data.multiplier}
                                onChange={(e) => packingSizeForm.setData('multiplier', e.target.value)}
                                step="0.001" min="0.001"
                                placeholder="e.g. 25"
                            />
                            <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                Inventory units deducted per unit ordered (e.g. "25kg" → 25).
                            </small>
                            {packingSizeForm.errors.multiplier && <span className="field-error">{packingSizeForm.errors.multiplier}</span>}
                        </div>
                        <div className="form-group">
                            <label>Pieces per Box / Bag / Carba</label>
                            <input
                                type="number"
                                value={packingSizeForm.data.pieces_per_box}
                                onChange={(e) => packingSizeForm.setData('pieces_per_box', e.target.value)}
                                step="1" min="1"
                                placeholder="e.g. 20"
                            />
                            <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                Used to auto-calculate box count on the order form (e.g. "500ml" → 20 pcs/box). Leave blank to use the default.
                            </small>
                            {packingSizeForm.errors.pieces_per_box && <span className="field-error">{packingSizeForm.errors.pieces_per_box}</span>}
                        </div>
                        <div className="form-group" style={{ marginTop: '14px' }}>
                            <label>Pack Unit</label>
                            <select
                                value={packingSizeForm.data.pack_unit}
                                onChange={(e) => packingSizeForm.setData('pack_unit', e.target.value)}
                            >
                                <option value="box">Box</option>
                                <option value="bag">Bag</option>
                                <option value="carba">Carba</option>
                            </select>
                            <small style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                How this size is packed — shown on the order form (e.g. 25kg → Bag, 20ltr → Carba).
                            </small>
                            {packingSizeForm.errors.pack_unit && <span className="field-error">{packingSizeForm.errors.pack_unit}</span>}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closePackingSizeModal}>Cancel</button>
                        <button className="btn primary" onClick={savePackingSize} disabled={packingSizeForm.processing}>
                            {editingPackingSize ? 'Save Changes' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
