import { advance as designAdvance, tracking as designTracking } from '@/routes/design';
import { confirm as ordersConfirm, create as ordersCreate, destroy as ordersDestroy, edit as ordersEdit, sendToDesign as ordersSendToDesign } from '@/routes/orders';
import { Head, Link, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';

function buildPhotoMap(photos: ProductPhoto[]) {
    const ob = new Map<string, string>();
    const pb = new Map<string, string>();
    for (const p of photos) {
        const size = (p.packing_size ?? '').toLowerCase();
        if (p.party_id === null) {
            ob.set(`${p.our_brand.toLowerCase()}|${size}`, p.photo_url);
            if (!p.packing_size) ob.set(`${p.our_brand.toLowerCase()}|`, p.photo_url);
        } else if (p.party_brand) {
            pb.set(`${p.party_id}|${p.party_brand.toLowerCase()}|${size}`, p.photo_url);
        }
    }
    return { ob, pb };
}

function getItemPhoto(
    item: OrderItem,
    partyId: number | null | undefined,
    map: { ob: Map<string, string>; pb: Map<string, string> },
): string | null {
    if (!item.our_brand) return null;
    const size = (item.packing_size ?? '').toLowerCase();
    if (partyId && item.party_brand) {
        const key = `${partyId}|${item.party_brand.toLowerCase()}|${size}`;
        const url = map.pb.get(key) ?? map.pb.get(`${partyId}|${item.party_brand.toLowerCase()}|`);
        if (url) return url;
    }
    return map.ob.get(`${item.our_brand.toLowerCase()}|${size}`)
        ?? map.ob.get(`${item.our_brand.toLowerCase()}|`)
        ?? null;
}

type OrderItem = {
    id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    quantity: string | number;
    rate: string | number;
    amount: string | number;
    gst_percent: string | number;
    gst_amount: string | number;
    status?: string | null;
    stage_log?: Array<{ from?: string; to?: string; name?: string | null; at?: string; revert?: boolean }> | null;
};

const lastStageActor = (item: OrderItem): string | null => {
    const log = item.stage_log;
    if (!log || log.length === 0) return null;
    return log[log.length - 1]?.name ?? null;
};

// Returns the name of the factory user who moved this item to `stage`
// (picks the most recent log entry whose `to` matches the stage).
const actorForStage = (item: OrderItem, stage: string): string | null => {
    const log = item.stage_log;
    if (!log) return null;
    for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].to === stage) return log[i].name ?? null;
    }
    return null;
};

type OrderDoc = {
    id: number;
    document_type: 'tax_invoice' | 'eway_bill';
    original_name: string;
    uploaded_at?: string | null;
};

type Order = {
    id: number;
    party_id?: number | null;
    order_number: string;
    company_name: string;
    customer_name: string;
    gst_no?: string | null;
    pan_no?: string | null;
    phone?: string | null;
    delivery_address?: string | null;
    transport_name?: string | null;
    transport_type?: string | null;
    destination?: string | null;
    freight_amount?: string | number | null;
    courier_amount?: string | number | null;
    round_off?: string | number | null;
    sales_user_id?: number | null;
    sales_user?: { id: number; name: string } | null;
    created_by?: number | null;
    order_date?: string | null;
    priority?: string | null;
    status?: string | null;
    urgent_approved?: boolean | null;
    subtotal?: string | number;
    gst_total?: string | number;
    total_amount?: string | number;
    confirmed_at?: string | null;
    confirmed_by_name?: string | null;
    created_by_name?: string | null;
    design_handlers?: string[];
    design_items?: DesignItem[];
    items: OrderItem[];
    docs?: OrderDoc[];
    eway_bill_not_required?: boolean;
};

type DesignItem = {
    id: number;
    order_item_id: number | null;
    status: string;
    order_qty: number | null;
    pcs_to_print: number | null;
    labels_received: number | null;
    skip_party_approval: boolean;
    assignee: string | null;
    stage_log: Array<{ stage: string; at: string; by?: string | null }> | null;
};

const DESIGN_STAGES = [
    { key: 'pending',          label: 'Pending Acceptance',  advanceLabel: '✓ Mark Accepted' },
    { key: 'accepted',         label: 'Accepted',            advanceLabel: '✓ Mark Design Ready' },
    { key: 'design-ready',     label: 'Design Ready',        advanceLabel: '✓ Party Approved' },
    { key: 'approved-party',   label: 'Party Approved',      advanceLabel: '✓ Sent to Print' },
    { key: 'sent-print',       label: 'Sent to Print',       advanceLabel: '✓ Mark Completed' },
    { key: 'completed',        label: 'Completed',           advanceLabel: '✓ Received at Factory' },
    { key: 'received-factory', label: 'Received at Factory', advanceLabel: '' },
];

const designStagesFor = (skip: boolean) =>
    skip ? DESIGN_STAGES.filter((s) => s.key !== 'approved-party') : DESIGN_STAGES;

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    photo_url: string;
};

type ConfirmTarget = { id: number; number: string; companyName: string };

type Props = {
    pageTitle: string;
    orders: Order[];
    currentUserId?: number | null;
    userRole?: string | null;
    productPhotos?: ProductPhoto[];
};

const PROD_STAGES = ['accepted', 'filling', 'labeling', 'ready', 'dispatched'];

const PROD_STAGE_LABELS: Record<string, string> = {
    accepted: 'Accepted',
    filling: 'Filling',
    labeling: 'Labeling',
    ready: 'Ready',
    dispatched: 'Dispatched',
};

// New / un-accepted items arrive as 'pending' (DB default) or null.
const normalizeStage = (status?: string | null) =>
    !status || status === 'pending' ? 'accepted' : status;

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
};

const formatAmount = (value?: string | number | null) =>
    Number(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusClassName = (status?: string | null) => {
    switch (status) {
        case 'submitted':  return 'badge sky';
        case 'confirmed':  return 'badge teal';
        case 'design':     return 'badge purple';
        case 'draft':      return 'badge amber';
        default:           return 'badge gray';
    }
};

const statusLabel = (status?: string | null) => {
    switch (status) {
        case 'design': return '🎨 DESIGN';
        default: return (status ?? 'draft').toUpperCase();
    }
};

const priorityClassName = (priority?: string | null) =>
    `badge priority-${priority ?? 'normal'}`;

export default function OrdersIndex({ orders, currentUserId, userRole, productPhotos = [] }: Props) {
    const isDesign      = userRole === 'design';
    const isAdmin       = userRole === 'admin';
    const isAccountant  = userRole === 'accountant';
    const isSales       = userRole === 'office';
    const canConfirm = userRole === 'admin' || userRole === 'office';

    const canEditOrder = (order: { status?: string | null; created_by?: number | null }) =>
        ['draft', 'submitted'].includes(order.status ?? '') &&
        (isAdmin || order.created_by === currentUserId);

    const canDeleteOrder = (order: { status?: string | null; created_by?: number | null }) => {
        if (isAdmin) return true;
        return ['draft', 'submitted'].includes(order.status ?? '') && order.created_by === currentUserId;
    };

    const [activeFilter, setActiveFilter] = useState<'all' | 'mine'>('all');
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
    const [confirmStep, setConfirmStep] = useState<'factory' | 'design'>('factory');
    const [submitting, setSubmitting] = useState(false);
    const [designNote, setDesignNote] = useState('');
    const [skipPartyApproval, setSkipPartyApproval] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
    const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
    const [uploadingDoc, setUploadingDoc] = useState<{ orderId: number; type: 'tax_invoice' | 'eway_bill' } | null>(null);

    // Tally integration state
    const [tallyUrl, setTallyUrl] = useState(() => localStorage.getItem('tallyUrl') ?? 'http://localhost:9000');
    const [tallyLedger, setTallyLedger] = useState(() => localStorage.getItem('tallyLedger') ?? 'Sales');
    const [tallyConfigOpen, setTallyConfigOpen] = useState(false);
    const [tallyConfigUrl, setTallyConfigUrl] = useState('');
    const [tallyConfigLedger, setTallyConfigLedger] = useState('');
    const [tallyStatus, setTallyStatus] = useState<'idle' | 'pushing' | 'success' | 'error'>('idle');
    const [tallyMessage, setTallyMessage] = useState('');

    // Per-item design workflow modals (design role)
    const [printModal, setPrintModal] = useState<{ id: number; orderQty: number; current: number | null } | null>(null);
    const [printValue, setPrintValue] = useState('');
    const [labelsModal, setLabelsModal] = useState<{ id: number; maxQty: number; current: number | null } | null>(null);
    const [labelsValue, setLabelsValue] = useState('');
    const [trackSaving, setTrackSaving] = useState(false);

    const photoMap = useMemo(() => buildPhotoMap(productPhotos), [productPhotos]);

    const visibleOrders = useMemo(() => {
        if (activeFilter === 'all') return orders;
        return orders.filter(
            (o) => o.created_by === currentUserId || o.sales_user_id === currentUserId,
        );
    }, [activeFilter, orders, currentUserId]);

    const toggleOrder = (id: number) =>
        setOpenOrders((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);

    const deleteOrder = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Delete order ${order.order_number} for ${order.company_name}?\n\nThis cannot be undone.`)) return;
        router.delete(ordersDestroy(order.id).url, { preserveScroll: true });
    };

    const openConfirm = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmStep('factory');
        setConfirmTarget({ id: order.id, number: order.order_number, companyName: order.company_name });
    };

    const closeConfirm = () => {
        if (submitting) return;
        setConfirmTarget(null);
        setConfirmStep('factory');
    };

    const advanceToDesign = () => {
        const order = orders.find((o) => o.id === confirmTarget?.id);
        setSelectedItemIds((order?.items ?? []).map((i) => i.id));
        setDesignNote('');
        setSkipPartyApproval(false);
        setSubmitting(false);
        setConfirmStep('design');
    };

    const doConfirmFactory = () => {
        if (!confirmTarget) return;
        setSubmitting(true);
        router.post(ordersConfirm(confirmTarget.id).url, {}, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: advanceToDesign,
            onError: () => setSubmitting(false),
        });
    };

    const toggleItem = (id: number) =>
        setSelectedItemIds((cur) =>
            cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        );

    const doSendToDesign = () => {
        if (!confirmTarget) return;
        setSubmitting(true);
        router.post(ordersSendToDesign(confirmTarget.id).url, {
            note: designNote,
            skip_party_approval: skipPartyApproval,
            item_ids: selectedItemIds,
        }, {
            preserveScroll: true,
            onFinish: () => { setSubmitting(false); setConfirmTarget(null); setConfirmStep('factory'); },
        });
    };

    // ── Per-item design workflow ──
    const advanceDesign = (designId: number) =>
        router.post(designAdvance(designId).url, {}, { preserveScroll: true });

    const openPrintModal = (di: DesignItem) => {
        const orderQty = di.order_qty ?? 0;
        const remaining = orderQty - (di.pcs_to_print ?? 0);
        setPrintModal({ id: di.id, orderQty, current: di.pcs_to_print });
        setPrintValue(String(remaining > 0 ? remaining : 0));
    };
    const submitPrint = () => {
        if (!printModal) return;
        const val = parseInt(printValue, 10);
        const remaining = printModal.orderQty - (printModal.current ?? 0);
        if (isNaN(val) || val <= 0 || val > remaining) return;
        setTrackSaving(true);
        router.patch(designTracking(printModal.id).url, {
            pcs_to_print: (printModal.current ?? 0) + val,
        }, {
            preserveScroll: true,
            onFinish: () => { setTrackSaving(false); setPrintModal(null); },
        });
    };

    const openLabelsModal = (di: DesignItem) => {
        const maxQty = di.pcs_to_print ?? (di.order_qty ?? 0);
        setLabelsModal({ id: di.id, maxQty, current: di.labels_received });
        setLabelsValue(String(di.labels_received ?? 0));
    };
    const submitLabels = () => {
        if (!labelsModal) return;
        const val = parseInt(labelsValue, 10);
        if (isNaN(val) || val < 0 || val > labelsModal.maxQty) return;
        setTrackSaving(true);
        router.patch(designTracking(labelsModal.id).url, {
            labels_received: val,
        }, {
            preserveScroll: true,
            onFinish: () => { setTrackSaving(false); setLabelsModal(null); },
        });
    };

    const designItemFor = (order: Order, itemId: number): DesignItem | undefined =>
        order.design_items?.find((d) => d.order_item_id === itemId);

    const uploadDoc = (orderId: number, type: 'tax_invoice' | 'eway_bill', file: File) => {
        setUploadingDoc({ orderId, type });
        router.post(`/orders/${orderId}/documents`, {
            file,
            document_type: type,
        } as Record<string, unknown>, {
            preserveScroll: true,
            forceFormData: true,
            onFinish: () => setUploadingDoc(null),
        });
    };

    const xmlEsc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const buildTallyXML = (order: Order): string => {
        const dateStr = order.order_date ? order.order_date.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const grandTotal = Number(order.total_amount ?? 0);
        const gstTotal = Number(order.gst_total ?? 0);
        const freightAmt = Number(order.freight_amount ?? 0);
        const courierAmt = Number(order.courier_amount ?? 0);

        const inventoryEntries = order.items.map((item) => {
            const stockName = xmlEsc([item.our_brand, item.packing_size].filter(Boolean).join(' '));
            const qty = Number(item.quantity);
            const amt = Number(item.amount);
            return `
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${stockName}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${Number(item.rate).toFixed(2)}/Nos</RATE>
            <AMOUNT>${amt.toFixed(2)}</AMOUNT>
            <ACTUALQTY>${qty} Nos</ACTUALQTY>
            <BILLEDQTY>${qty} Nos</BILLEDQTY>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${xmlEsc(tallyLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amt.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>`;
        }).join('');

        const freightEntry = freightAmt > 0 ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Freight Charges</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${freightAmt.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>` : '';

        const courierEntry = courierAmt > 0 ? `
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Courier Charges</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${courierAmt.toFixed(2)}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>` : '';

        return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${dateStr}</DATE>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${xmlEsc(order.order_number)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${xmlEsc(order.company_name)}</PARTYLEDGERNAME>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${xmlEsc(order.company_name)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${grandTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>${inventoryEntries}
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${gstTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>${freightEntry}${courierEntry}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
    };

    const downloadTallyXML = (order: Order) => {
        const xml = buildTallyXML(order);
        const blob = new Blob([xml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tally-${order.order_number}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const pushToTally = async (order: Order) => {
        const xml = buildTallyXML(order);
        setTallyStatus('pushing');
        setTallyMessage('');
        try {
            const res = await fetch(tallyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/xml' },
                body: xml,
            });
            const text = await res.text();
            if (!res.ok || text.includes('LINEERROR') || text.toLowerCase().includes('error')) {
                setTallyStatus('error');
                setTallyMessage('Tally returned an error. Try downloading the XML instead.');
            } else {
                setTallyStatus('success');
                setTallyMessage('Voucher imported into Tally!');
                setTimeout(() => setTallyStatus('idle'), 5000);
            }
        } catch {
            downloadTallyXML(order);
            setTallyStatus('error');
            setTallyMessage('Could not reach Tally directly — XML file downloaded instead.');
            setTimeout(() => setTallyStatus('idle'), 6000);
        }
    };

    return (
        <>
            <Head title="All Orders" />

            {/* ── Confirm modal: Step 1 Factory, Step 2 Design ────────── */}
            {confirmTarget && (() => {
                const targetOrder = orders.find((o) => o.id === confirmTarget.id);
                return (
                    <div className="modal-overlay open" onClick={closeConfirm}>
                        <div className="modal" onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: confirmStep === 'design' ? '520px' : '400px' }}>

                            {/* ── Step 1: Factory ── */}
                            {confirmStep === 'factory' && (
                                <>
                                    <div className="modal-header">
                                        <h2>🏭 Send to Factory</h2>
                                        <button className="modal-close" onClick={closeConfirm} disabled={submitting}>✕</button>
                                    </div>
                                    <div className="modal-form">
                                        <p style={{ color: 'var(--tx-muted)', fontSize: '12px', marginBottom: '6px' }}>Step 1 of 2</p>
                                        <p style={{ color: 'var(--tx-muted)', marginBottom: '20px', fontSize: '14px' }}>
                                            Confirm and send order <strong>{confirmTarget.number}</strong> to the
                                            <strong> Factory</strong> to start production?
                                        </p>
                                        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={closeConfirm} disabled={submitting}>
                                                Cancel
                                            </button>
                                            <button type="button" className="btn-primary" onClick={doConfirmFactory} disabled={submitting}>
                                                {submitting ? 'Sending…' : '✓ Send to Factory →'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── Step 2: Design ── */}
                            {confirmStep === 'design' && (
                                <>
                                    <div className="modal-header">
                                        <h2>🎨 Send to Design Team</h2>
                                        <button className="modal-close" onClick={closeConfirm} disabled={submitting}>✕</button>
                                    </div>
                                    <div className="modal-form">
                                        <p style={{ color: 'var(--tx-muted)', fontSize: '12px', marginBottom: '10px' }}>Step 2 of 2</p>

                                        {/* Order summary chip */}
                                        <div style={{ background: 'var(--accent-soft, #ede9fe)', color: 'var(--accent, #7c3aed)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', fontWeight: 500, marginBottom: '18px' }}>
                                            {confirmTarget.number} · {confirmTarget.companyName} · {targetOrder?.items.length ?? 0} product(s)
                                        </div>

                                        {/* Note */}
                                        <div className="form-group" style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-muted)', textTransform: 'uppercase' }}>
                                                Note for Design Team
                                            </label>
                                            <textarea
                                                value={designNote}
                                                onChange={(e) => setDesignNote(e.target.value)}
                                                placeholder="Any special design instructions…"
                                                rows={3}
                                                style={{ width: '100%', resize: 'vertical', marginTop: '6px' }}
                                                disabled={submitting}
                                            />
                                        </div>

                                        {/* Products with checkboxes */}
                                        <div style={{ marginBottom: '16px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--tx-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                                                Products
                                            </label>
                                            <table className="prod-table" style={{ fontSize: '13px' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '32px' }}></th>
                                                        <th>#</th>
                                                        <th>Our Brand</th>
                                                        <th>Party Brand</th>
                                                        <th>Packing</th>
                                                        <th>Qty</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(targetOrder?.items ?? []).map((item, idx) => (
                                                        <tr key={item.id} style={{ opacity: selectedItemIds.includes(item.id) ? 1 : 0.4 }}>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedItemIds.includes(item.id)}
                                                                    onChange={() => toggleItem(item.id)}
                                                                    disabled={submitting}
                                                                />
                                                            </td>
                                                            <td>{idx + 1}</td>
                                                            <td style={{ fontWeight: 600 }}>{item.our_brand ?? '—'}</td>
                                                            <td>{item.party_brand ?? '—'}</td>
                                                            <td>{item.packing_size ?? '—'}</td>
                                                            <td>{item.quantity}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Skip party approval */}
                                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'var(--bg-yellow, #fefce8)', border: '1px solid var(--border-yellow, #fde68a)', borderRadius: '8px', padding: '12px', cursor: 'pointer', marginBottom: '20px', fontSize: '13px' }}>
                                            <input
                                                type="checkbox"
                                                checked={skipPartyApproval}
                                                onChange={(e) => setSkipPartyApproval(e.target.checked)}
                                                disabled={submitting}
                                                style={{ marginTop: '2px', flexShrink: 0 }}
                                            />
                                            <span>
                                                <strong>⚡ Skip Party Approval</strong>
                                                {' — '}Moves directly to Sent to Print once Design Ready
                                            </span>
                                        </label>

                                        <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                            <button type="button" className="btn-secondary" onClick={closeConfirm} disabled={submitting}>
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="btn-primary"
                                                onClick={doSendToDesign}
                                                disabled={submitting || selectedItemIds.length === 0}
                                            >
                                                {submitting ? 'Sending…' : '🎨 Send to Design Team'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ── Send to Print modal (design role) ──────────────────── */}
            {printModal && (
                <div className="modal-overlay open" onClick={() => !trackSaving && setPrintModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2>🖨️ Send to Print</h2>
                            <button className="modal-close" onClick={() => setPrintModal(null)} disabled={trackSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Total Order Qty</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>{printModal.orderQty}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Already Sent</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-muted)' }}>{printModal.current ?? 0}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Remaining</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: '#059669' }}>{printModal.orderQty - (printModal.current ?? 0)}</div>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Pieces to Send Now</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={printModal.orderQty - (printModal.current ?? 0)}
                                    value={printValue}
                                    onChange={(e) => setPrintValue(e.target.value)}
                                    style={{ fontSize: '16px', fontWeight: 700 }}
                                    autoFocus
                                    disabled={trackSaving}
                                />
                                {parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0) && (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>
                                        Cannot exceed remaining quantity ({printModal.orderQty - (printModal.current ?? 0)})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setPrintModal(null)} disabled={trackSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitPrint}
                                    disabled={
                                        trackSaving ||
                                        !printValue ||
                                        parseInt(printValue, 10) <= 0 ||
                                        parseInt(printValue, 10) > printModal.orderQty - (printModal.current ?? 0)
                                    }
                                >
                                    {trackSaving ? 'Saving…' : '🖨️ Send to Print'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Labels Received modal (design role) ────────────────── */}
            {labelsModal && (
                <div className="modal-overlay open" onClick={() => !trackSaving && setLabelsModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '360px' }}>
                        <div className="modal-header">
                            <h2>🏷️ Labels Received</h2>
                            <button className="modal-close" onClick={() => setLabelsModal(null)} disabled={trackSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Printed / Expected</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tx-head)' }}>{labelsModal.maxQty}</div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Pending</label>
                                    <div style={{ fontWeight: 700, fontSize: '20px', color: '#dc2626' }}>{labelsModal.maxQty - (labelsModal.current ?? 0)}</div>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Total Labels Received</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={labelsModal.maxQty}
                                    value={labelsValue}
                                    onChange={(e) => setLabelsValue(e.target.value)}
                                    style={{ fontSize: '16px', fontWeight: 700 }}
                                    autoFocus
                                    disabled={trackSaving}
                                />
                                {parseInt(labelsValue, 10) > labelsModal.maxQty && (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>
                                        Cannot exceed pieces to print ({labelsModal.maxQty})
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setLabelsModal(null)} disabled={trackSaving}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={submitLabels}
                                    disabled={
                                        trackSaving ||
                                        labelsValue === '' ||
                                        parseInt(labelsValue, 10) < 0 ||
                                        parseInt(labelsValue, 10) > labelsModal.maxQty
                                    }
                                >
                                    {trackSaving ? 'Saving…' : '✓ Update Labels'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tally config modal ──────────────────────────────────── */}
            {tallyConfigOpen && (
                <div className="modal-overlay open" onClick={() => setTallyConfigOpen(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
                        <div className="modal-header">
                            <h2>⚙ Tally Settings</h2>
                            <button className="modal-close" onClick={() => setTallyConfigOpen(false)}>✕</button>
                        </div>
                        <div className="modal-form">
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Tally HTTP Server URL</label>
                                <input
                                    type="text"
                                    value={tallyConfigUrl}
                                    onChange={(e) => setTallyConfigUrl(e.target.value)}
                                    placeholder="http://localhost:9000"
                                />
                                <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                                    In Tally Prime: F1 → Account Info → Configure → TSS → Enable HTTP Port
                                </div>
                            </div>
                            <div className="form-group" style={{ marginBottom: '20px' }}>
                                <label>Sales Ledger Name (in Tally)</label>
                                <input
                                    type="text"
                                    value={tallyConfigLedger}
                                    onChange={(e) => setTallyConfigLedger(e.target.value)}
                                    placeholder="Sales"
                                />
                                <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '4px' }}>
                                    Must match exactly the ledger name in your Tally company
                                </div>
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setTallyConfigOpen(false)}>Cancel</button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => {
                                        const u = tallyConfigUrl.trim() || 'http://localhost:9000';
                                        const l = tallyConfigLedger.trim() || 'Sales';
                                        setTallyUrl(u);
                                        setTallyLedger(l);
                                        localStorage.setItem('tallyUrl', u);
                                        localStorage.setItem('tallyLedger', l);
                                        setTallyConfigOpen(false);
                                    }}
                                >
                                    ✓ Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div id="view-orders" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>{isDesign ? 'Design Orders' : 'All Orders'}</h1>
                        <p>
                            {isDesign
                                ? 'Orders assigned to the design team.'
                                : 'Track order status, production progress, and dispatch.'}
                        </p>
                    </div>
                    {canConfirm && (
                        <Link className="btn primary" href={ordersCreate()}>
                            ＋ New Order
                        </Link>
                    )}
                </div>

                {!isDesign && (
                    <div className="filter-bar">
                        <h2>Orders</h2>
                        <button
                            type="button"
                            className={`pill ${activeFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('all')}
                        >
                            All Orders
                        </button>
                        <button
                            type="button"
                            className={`pill ${activeFilter === 'mine' ? 'active' : ''}`}
                            onClick={() => setActiveFilter('mine')}
                        >
                            My Orders
                        </button>
                    </div>
                )}

                {visibleOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">📋</div>
                        <p>{isDesign ? 'No design orders yet.' : 'No orders yet.'}</p>
                    </div>
                ) : (() => {
                    const billingDone = (order: Order) => {
                        const hasTax  = (order.docs ?? []).some((d) => d.document_type === 'tax_invoice');
                        const hasEway = (order.docs ?? []).some((d) => d.document_type === 'eway_bill');
                        const ewayOk  = hasEway || !!order.eway_bill_not_required || Number(order.total_amount ?? 0) < 50000;
                        return hasTax && ewayOk;
                    };

                    const pendingOrders = isAccountant ? visibleOrders.filter((o) => !billingDone(o)) : [];
                    const doneOrders    = isAccountant ? visibleOrders.filter((o) =>  billingDone(o)) : [];
                    const orderGroups   = isAccountant
                        ? [
                            { label: `Pending (${pendingOrders.length})`, orders: pendingOrders, accent: '#b45309', bg: '#fef3c7', border: '#fcd34d' },
                            { label: `Done (${doneOrders.length})`,    orders: doneOrders,    accent: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
                          ]
                        : [{ label: null, orders: visibleOrders, accent: '', bg: '', border: '' }];

                    return orderGroups.map(({ label, orders, accent, bg, border }) => (
                        <div key={label ?? 'all'}>
                            {label && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '18px 0 10px', padding: '8px 14px', background: bg, border: `1px solid ${border}`, borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 700, fontSize: '13px', color: accent }}>{label}</span>
                                </div>
                            )}
                            {orders.length === 0 && label && (
                                <div style={{ color: 'var(--tx-muted)', fontSize: '13px', padding: '10px 4px' }}>No orders.</div>
                            )}
                            {orders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const totalItems = order.items.length;
                        const dispatchedItems = order.items.filter((i) => i.status === 'dispatched').length;
                        const progress = totalItems ? Math.round((dispatchedItems / totalItems) * 100) : 0;

                        return (
                            <div key={order.id} className={`order-card${isOpen ? ' open' : ''}`}>
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && toggleOrder(order.id)}
                                >
                                    <div className="o-id">{order.order_number}</div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{order.company_name}</div>
                                        <div className="o-customer">{order.customer_name}</div>
                                    </div>
                                    <div className="o-meta">
                                        <div>{formatDate(order.order_date)}</div>
                                        <div>{order.sales_user?.name ?? 'Unassigned'}</div>
                                    </div>
                                    {isAccountant && (() => {
                                        const hasTax   = (order.docs ?? []).some((d) => d.document_type === 'tax_invoice');
                                        const hasEway  = (order.docs ?? []).some((d) => d.document_type === 'eway_bill');
                                        const ewayOk   = hasEway || !!order.eway_bill_not_required || Number(order.total_amount ?? 0) < 50000;
                                        if (hasTax && ewayOk) {
                                            return <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '3px 8px', whiteSpace: 'nowrap' }}>✓ Done</span>;
                                        }
                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                                                {!hasTax  && <span style={{ fontSize: '10px', fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>🧾 Invoice Pending</span>}
                                                {!ewayOk  && <span style={{ fontSize: '10px', fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>📋 E-way Pending</span>}
                                            </div>
                                        );
                                    })()}
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    <div className="assignee-row">
                                        <label>Priority</label>
                                        <span className={priorityClassName(order.priority)}>
                                            {(order.priority ?? 'normal').toUpperCase()}
                                        </span>
                                        <label>Status</label>
                                        <span className={statusClassName(order.status)}>
                                            {statusLabel(order.status)}
                                        </span>

                                        {/* Confirm button — office/admin only, submitted orders only */}
                                        {canConfirm && order.status === 'submitted' && (
                                            <div className="confirm-btn">
                                                {order.priority === 'urgent' && order.urgent_approved !== true ? (
                                                    <span
                                                        className={`badge ${order.urgent_approved === false ? 'red' : 'orange'}`}
                                                        style={{ fontSize: '11px' }}
                                                        title={order.urgent_approved === false
                                                            ? 'Rejected by factory — please review'
                                                            : 'Waiting for factory approval'}
                                                    >
                                                        {order.urgent_approved === false ? '✕ Factory Rejected' : '⏳ Awaiting Factory'}
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        className="btn sm primary"
                                                        onClick={(e) => openConfirm(order, e)}
                                                    >
                                                        ✓ Confirm Order
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {order.status === 'confirmed' && (
                                            <div className="confirm-btn">
                                                <span className="badge teal" style={{ fontSize: '11px' }}>
                                                    ✓ Sent to Factory
                                                </span>
                                            </div>
                                        )}
                                        {order.status === 'design' && (
                                            <div className="confirm-btn">
                                                <span className="badge purple" style={{ fontSize: '11px' }}>
                                                    🎨 Design Team
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Edit / Delete — shown based on role and order status */}
                                    {!isDesign && (canEditOrder(order) || canDeleteOrder(order)) && (
                                        <div className="activity-row" style={{ gap: '6px' }}>
                                            {canEditOrder(order) && (
                                                <Link
                                                    href={ordersEdit(order.id).url}
                                                    className="btn sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    ✏️ Edit
                                                </Link>
                                            )}
                                            {canDeleteOrder(order) && (
                                                <button
                                                    type="button"
                                                    className="btn sm"
                                                    style={{ color: 'var(--red, #dc2626)', borderColor: 'var(--red, #dc2626)' }}
                                                    onClick={(e) => deleteOrder(order, e)}
                                                >
                                                    🗑 Delete
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Activity attribution — who did what */}
                                    {(order.created_by_name || order.confirmed_by_name || (order.design_handlers?.length ?? 0) > 0) && (
                                        <div className="activity-row">
                                            {order.created_by_name && (
                                                <span className="activity-chip">
                                                    📝 Created by <strong>{order.created_by_name}</strong>
                                                </span>
                                            )}
                                            {order.confirmed_by_name && (
                                                <span className="activity-chip">
                                                    ✓ Confirmed by <strong>{order.confirmed_by_name}</strong>
                                                    {order.confirmed_at ? ` · ${formatDate((order.confirmed_at ?? '').slice(0, 10))}` : ''}
                                                </span>
                                            )}
                                            {(order.design_handlers?.length ?? 0) > 0 && (
                                                <span className="activity-chip">
                                                    🎨 Design by <strong>{order.design_handlers!.join(', ')}</strong>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Documents row — visible to sales and other non-design roles ── */}
                                    {!isDesign && (order.docs ?? []).length > 0 && (
                                        <div className="activity-row" style={{ gap: '8px', flexWrap: 'wrap' }}>
                                            {(order.docs ?? []).map((doc) => (
                                                <a
                                                    key={doc.id}
                                                    href={`/orders/${order.id}/documents/${doc.id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="activity-chip"
                                                    style={{ textDecoration: 'none', color: '#1e40af', fontWeight: 600, border: '1px solid #bfdbfe', background: '#eff6ff' }}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {doc.document_type === 'tax_invoice' ? '🧾' : '📋'}{' '}
                                                    {doc.document_type === 'tax_invoice' ? 'Tax Invoice' : 'E-way Bill'}
                                                    {doc.uploaded_at ? ` · ${doc.uploaded_at}` : ''}
                                                </a>
                                            ))}
                                        </div>
                                    )}

                                    {/* ── Non-design: financial items table + summary ── */}
                                    {!isDesign && (
                                        <>
                                            {/* ── Billing details — accountant only, shown FIRST ── */}
                                            {isAccountant && (
                                                <div className="form-card" style={{ marginBottom: '12px', borderLeft: '3px solid #2563eb' }}>
                                                    <div className="form-card-title" style={{ color: '#1e40af' }}>🧾 Billing Details</div>

                                                    {/* Upload / manage documents — shown first */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: '8px' }}>
                                                            Documents
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                            {(['tax_invoice', 'eway_bill'] as const).map((dtype) => {
                                                                const existing    = (order.docs ?? []).find((d) => d.document_type === dtype);
                                                                const label       = dtype === 'tax_invoice' ? 'Tax Invoice' : 'E-way Bill';
                                                                const icon        = dtype === 'tax_invoice' ? '🧾' : '📋';
                                                                const isUploading = uploadingDoc?.orderId === order.id && uploadingDoc.type === dtype;
                                                                const autoExempt  = dtype === 'eway_bill' && Number(order.total_amount ?? 0) < 50000;
                                                                const ewayNoNeed  = dtype === 'eway_bill' && (!!order.eway_bill_not_required || autoExempt);
                                                                const bgColor     = existing ? '#f0fdf4' : ewayNoNeed ? '#f5f3ff' : 'var(--bg-paper)';
                                                                const borderColor = existing ? '#86efac' : ewayNoNeed ? '#c4b5fd' : 'var(--border)';
                                                                return (
                                                                    <div key={dtype} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '8px', padding: '8px 12px', minWidth: '180px' }}>
                                                                        <span style={{ fontSize: '16px' }}>{icon}</span>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-head)' }}>{label}</div>
                                                                            {existing ? (
                                                                                <div style={{ fontSize: '11px', color: '#16a34a' }}>Uploaded {existing.uploaded_at ?? ''}</div>
                                                                            ) : autoExempt ? (
                                                                                <div style={{ fontSize: '11px', color: '#7c3aed' }}>Not Required (below ₹50,000)</div>
                                                                            ) : ewayNoNeed ? (
                                                                                <div style={{ fontSize: '11px', color: '#7c3aed' }}>Not Required</div>
                                                                            ) : (
                                                                                <div style={{ fontSize: '11px', color: 'var(--tx-muted)' }}>Not uploaded</div>
                                                                            )}
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                                            {existing && (
                                                                                <>
                                                                                    <a
                                                                                        href={`/orders/${order.id}/documents/${existing.id}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="btn sm"
                                                                                        style={{ textDecoration: 'none', padding: '3px 8px', fontSize: '11px' }}
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        👁 View
                                                                                    </a>
                                                                                    <button
                                                                                        type="button"
                                                                                        className="btn sm"
                                                                                        style={{ padding: '3px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#dc2626' }}
                                                                                        disabled={isUploading}
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (!confirm(`Delete ${label}?`)) return;
                                                                                            router.delete(`/orders/${order.id}/documents/${existing.id}`, { preserveScroll: true });
                                                                                        }}
                                                                                    >
                                                                                        🗑
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                            {/* Manual "No Need" toggle — only when no file and not auto-exempt */}
                                                                            {dtype === 'eway_bill' && !existing && !autoExempt && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="btn sm"
                                                                                    style={{ padding: '3px 8px', fontSize: '11px', color: order.eway_bill_not_required ? '#7c3aed' : 'var(--tx-muted)', borderColor: order.eway_bill_not_required ? '#c4b5fd' : 'var(--border)', background: order.eway_bill_not_required ? '#f5f3ff' : undefined }}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        router.post(`/orders/${order.id}/eway-not-required`, { value: !order.eway_bill_not_required }, { preserveScroll: true });
                                                                                    }}
                                                                                >
                                                                                    {order.eway_bill_not_required ? '↩ Undo' : 'No Need'}
                                                                                </button>
                                                                            )}
                                                                            {/* Show upload unless manually marked No Need */}
                                                                            {!order.eway_bill_not_required && (
                                                                                <label
                                                                                    className="btn sm primary"
                                                                                    style={{ cursor: isUploading ? 'not-allowed' : 'pointer', padding: '3px 8px', fontSize: '11px', opacity: isUploading ? 0.6 : 1 }}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {isUploading ? '⏳' : existing ? '↻ Replace' : '⬆ Upload'}
                                                                                    <input
                                                                                        type="file"
                                                                                        accept="application/pdf"
                                                                                        style={{ display: 'none' }}
                                                                                        disabled={isUploading}
                                                                                        onChange={(e) => {
                                                                                            const file = e.target.files?.[0];
                                                                                            if (file) uploadDoc(order.id, dtype, file);
                                                                                            e.target.value = '';
                                                                                        }}
                                                                                    />
                                                                                </label>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Tally push actions */}
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                                                        <button
                                                            type="button"
                                                            className="btn sm primary"
                                                            onClick={() => pushToTally(order)}
                                                            disabled={tallyStatus === 'pushing'}
                                                            style={{ background: '#1e40af', borderColor: '#1e40af', color: '#fff' }}
                                                        >
                                                            {tallyStatus === 'pushing' ? '⏳ Pushing…' : '📤 Push to Tally'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn sm"
                                                            onClick={() => downloadTallyXML(order)}
                                                            title="Download Tally XML file"
                                                        >
                                                            ⬇ XML
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn sm"
                                                            onClick={() => {
                                                                setTallyConfigUrl(tallyUrl);
                                                                setTallyConfigLedger(tallyLedger);
                                                                setTallyConfigOpen(true);
                                                            }}
                                                            title={`Tally: ${tallyUrl} · Ledger: ${tallyLedger}`}
                                                            style={{ padding: '4px 10px', fontSize: '13px' }}
                                                        >
                                                            ⚙
                                                        </button>
                                                        {tallyStatus === 'success' && (
                                                            <span style={{ color: '#059669', fontSize: '12px', fontWeight: 600 }}>✓ {tallyMessage}</span>
                                                        )}
                                                        {tallyStatus === 'error' && (
                                                            <span style={{ color: '#dc2626', fontSize: '12px' }}>{tallyMessage}</span>
                                                        )}
                                                    </div>

                                                    {/* Party info */}
                                                    <div className="form-grid" style={{ marginBottom: '12px' }}>
                                                        <div className="form-group">
                                                            <label>Company</label>
                                                            <div>{order.company_name}</div>
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Customer</label>
                                                            <div>{order.customer_name}</div>
                                                        </div>
                                                        {order.gst_no && (
                                                            <div className="form-group">
                                                                <label>GSTIN</label>
                                                                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{order.gst_no}</div>
                                                            </div>
                                                        )}
                                                        {order.pan_no && (
                                                            <div className="form-group">
                                                                <label>PAN</label>
                                                                <div style={{ fontFamily: 'monospace' }}>{order.pan_no}</div>
                                                            </div>
                                                        )}
                                                        {order.phone && (
                                                            <div className="form-group">
                                                                <label>Phone</label>
                                                                <div>{order.phone}</div>
                                                            </div>
                                                        )}
                                                        {order.destination && (
                                                            <div className="form-group">
                                                                <label>Destination</label>
                                                                <div>{order.destination}</div>
                                                            </div>
                                                        )}
                                                        {order.delivery_address && (
                                                            <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                                                <label>Delivery Address</label>
                                                                <div style={{ whiteSpace: 'pre-line' }}>{order.delivery_address}</div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Transport */}
                                                    {(order.transport_name || order.transport_type) && (
                                                        <div className="form-grid" style={{ marginBottom: '12px' }}>
                                                            {order.transport_name && (
                                                                <div className="form-group">
                                                                    <label>Transport</label>
                                                                    <div>{order.transport_name}</div>
                                                                </div>
                                                            )}
                                                            {order.transport_type && (
                                                                <div className="form-group">
                                                                    <label>Transport Type</label>
                                                                    <div>{order.transport_type}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Products */}
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: '6px' }}>Products</div>
                                                        <div className="prod-wrap">
                                                            <table className="prod-table" style={{ fontSize: '12px' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>Our Brand</th>
                                                                        <th>Party Brand</th>
                                                                        <th>Packing</th>
                                                                        <th>Qty</th>
                                                                        <th>Rate</th>
                                                                        <th>GST %</th>
                                                                        <th>Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {order.items.map((item) => (
                                                                        <tr key={item.id}>
                                                                            <td><div className="prod-name" style={{ fontSize: '12px' }}>{item.our_brand ?? '—'}</div></td>
                                                                            <td><div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{item.party_brand ?? '—'}</div></td>
                                                                            <td>{item.packing_size ?? '—'}</td>
                                                                            <td>{item.quantity}</td>
                                                                            <td>₹{formatAmount(item.rate)}</td>
                                                                            <td>{item.gst_percent}%</td>
                                                                            <td>₹{formatAmount(item.amount)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Charges */}
                                                    <div className="form-grid three">
                                                        <div className="form-group">
                                                            <label>Subtotal</label>
                                                            <div style={{ fontWeight: 600 }}>₹{formatAmount(order.subtotal)}</div>
                                                        </div>
                                                        <div className="form-group">
                                                            <label>GST</label>
                                                            <div>₹{formatAmount(order.gst_total)}</div>
                                                        </div>
                                                        {Number(order.freight_amount ?? 0) > 0 && (
                                                            <div className="form-group">
                                                                <label>Freight</label>
                                                                <div>₹{formatAmount(order.freight_amount)}</div>
                                                            </div>
                                                        )}
                                                        {Number(order.courier_amount ?? 0) > 0 && (
                                                            <div className="form-group">
                                                                <label>Courier</label>
                                                                <div>₹{formatAmount(order.courier_amount)}</div>
                                                            </div>
                                                        )}
                                                        {Number(order.round_off ?? 0) !== 0 && (
                                                            <div className="form-group">
                                                                <label>Round Off</label>
                                                                <div>₹{formatAmount(order.round_off)}</div>
                                                            </div>
                                                        )}
                                                        <div className="form-group">
                                                            <label>Grand Total</label>
                                                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e40af' }}>₹{formatAmount(order.total_amount)}</div>
                                                        </div>
                                                    </div>

                                                </div>
                                            )}

                                            {!isAccountant && <div className="prod-wrap">
                                                <table className="prod-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '52px' }}></th>
                                                            <th>Product</th>
                                                            <th>Packing</th>
                                                            <th>Qty</th>
                                                            <th>Rate</th>
                                                            <th>GST %</th>
                                                            <th>Amount</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.items.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={8} style={{ textAlign: 'center', padding: '16px' }}>
                                                                    No items yet.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            order.items.map((item) => {
                                                                const photo = getItemPhoto(item, order.party_id, photoMap);
                                                                return (
                                                                    <tr key={item.id}>
                                                                        <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                                                                            {photo ? (
                                                                                <img
                                                                                    src={photo} alt=""
                                                                                    onClick={(e) => { e.stopPropagation(); setPhotoLightbox(photo); }}
                                                                                    style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', display: 'block', cursor: 'zoom-in' }}
                                                                                />
                                                                            ) : (
                                                                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--tx-muted)' }}>
                                                                                    📷
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                            <div className="prod-detail">{item.party_brand ?? '—'}</div>
                                                                        </td>
                                                                        <td>{item.packing_size ?? '—'}</td>
                                                                        <td>{item.quantity}</td>
                                                                        <td>{formatAmount(item.rate)}</td>
                                                                        <td>{item.gst_percent}</td>
                                                                        <td>{formatAmount(item.amount)}</td>
                                                                        <td>
                                                                            <span className={`badge s-${normalizeStage(item.status)}`}>
                                                                                {(!item.status || item.status === 'pending'
                                                                                    ? 'Awaiting Acceptance'
                                                                                    : (PROD_STAGE_LABELS[item.status] ?? item.status)
                                                                                ).toUpperCase()}
                                                                            </span>
                                                                            {lastStageActor(item) && (
                                                                                <div className="prod-detail" style={{ marginTop: '2px' }}>
                                                                                    by {lastStageActor(item)}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>}

                                            {/* Production pipeline — visible for confirmed/dispatched orders, not for accountants */}
                                            {!isAccountant && (order.status === 'confirmed' || order.status === 'dispatched') && order.items.length > 0 && (
                                                <div style={{ marginBottom: '14px' }}>
                                                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: '8px' }}>
                                                        Production Progress
                                                    </div>
                                                    <div style={{ overflowX: 'auto' }}>
                                                        <table className="prod-table" style={{ fontSize: '12px' }}>
                                                            <thead>
                                                                <tr>
                                                                    <th>Product</th>
                                                                    {PROD_STAGES.map((s) => (
                                                                        <th key={s} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                                            {PROD_STAGE_LABELS[s]}
                                                                        </th>
                                                                    ))}
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {order.items.map((item) => {
                                                                    const stageIdx = PROD_STAGES.indexOf(normalizeStage(item.status));
                                                                    const worker = lastStageActor(item);
                                                                    return (
                                                                        <tr key={item.id}>
                                                                            <td>
                                                                                <div className="prod-name" style={{ fontSize: '12px' }}>{item.our_brand ?? '—'}</div>
                                                                                {item.party_brand && <div className="prod-detail">{item.party_brand}</div>}
                                                                                {worker && (
                                                                                    <div style={{ fontSize: '11px', color: 'var(--tx-muted)', marginTop: '2px' }}>
                                                                                        👷 {worker}
                                                                                    </div>
                                                                                )}
                                                                            </td>
                                                                            {PROD_STAGES.map((s, i) => {
                                                                                const isPast = i < stageIdx;
                                                                                const isCurrent = i === stageIdx;
                                                                                const actor = actorForStage(item, s);
                                                                                return (
                                                                                    <td key={s} style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '6px' }}>
                                                                                        {isPast ? (
                                                                                            <span title={actor ? `by ${actor}` : undefined} style={{ color: '#059669', fontSize: '14px', cursor: actor ? 'help' : 'default' }}>✓</span>
                                                                                        ) : isCurrent ? (
                                                                                            <div>
                                                                                                <span className={`badge s-${s}`} style={{ fontSize: '10px' }}>●</span>
                                                                                                {actor && (
                                                                                                    <div style={{ fontSize: '10px', color: 'var(--tx-muted)', marginTop: '3px', whiteSpace: 'nowrap' }}>
                                                                                                        {actor}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span style={{ color: 'var(--tx-faint)', fontSize: '12px' }}>○</span>
                                                                                        )}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {!isAccountant && <div className="form-card" style={{ marginBottom: 0 }}>
                                                <div className="form-card-title">Order Summary</div>
                                                <div className="form-grid three">
                                                    <div className="form-group">
                                                        <label>Subtotal</label>
                                                        <div>{formatAmount(order.subtotal)}</div>
                                                    </div>
                                                    <div className="form-group">
                                                        <label>GST</label>
                                                        <div>{formatAmount(order.gst_total)}</div>
                                                    </div>
                                                    <div className="form-group">
                                                        <label>Total</label>
                                                        <div>{formatAmount(order.total_amount)}</div>
                                                    </div>
                                                </div>
                                                {!isAccountant && (
                                                    <div style={{ marginTop: '14px' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                            <span>Production Progress</span>
                                                            <span>{progress}%</span>
                                                        </div>
                                                        <div className="progress-bar">
                                                            <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>}

                                        </>
                                    )}

                                    {/* ── Design: per-item workflow (accept gate, print, labels, stages) ── */}
                                    {isDesign && (
                                        <div className="design-items-wrap">
                                            {order.items
                                                .map((item) => ({ item, di: designItemFor(order, item.id) }))
                                                .filter(({ di }) => di)
                                                .map(({ item, di }) => {
                                                    const d = di!;
                                                    const isUnlocked = d.status !== 'pending';
                                                    const orderQty = d.order_qty ?? Number(item.quantity) ?? 0;
                                                    const pcsPending = orderQty - (d.pcs_to_print ?? 0);
                                                    const labelMax = d.pcs_to_print ?? orderQty;
                                                    const labelPending = labelMax - (d.labels_received ?? 0);
                                                    const stages = designStagesFor(d.skip_party_approval);
                                                    const curIdx = stages.findIndex((s) => s.key === d.status);
                                                    const isDone = d.status === 'received-factory';
                                                    const photo = getItemPhoto(item, order.party_id, photoMap);

                                                    return (
                                                        <div key={d.id} className="design-item-block">
                                                            <div className="design-item-top">
                                                                {photo ? (
                                                                    <img
                                                                        src={photo} alt=""
                                                                        className="design-item-photo"
                                                                        onClick={(e) => { e.stopPropagation(); setPhotoLightbox(photo); }}
                                                                        style={{ cursor: 'zoom-in' }}
                                                                    />
                                                                ) : (
                                                                    <div className="design-item-photo placeholder">📷</div>
                                                                )}
                                                                <div className="design-item-info">
                                                                    <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                    <div className="prod-detail">{item.party_brand ?? '—'} · {item.packing_size ?? '—'}</div>
                                                                </div>
                                                                <div className="design-track">
                                                                    <div className="track-box">
                                                                        <span className="track-label">Order Qty</span>
                                                                        <span className="track-num">{orderQty || '—'}</span>
                                                                    </div>
                                                                    <div className="track-box">
                                                                        <span className="track-label" style={{ color: isUnlocked ? '#059669' : undefined }}>Pcs to Print</span>
                                                                        {isUnlocked ? (
                                                                            <button className="track-btn" onClick={() => openPrintModal(d)}>
                                                                                <span className="track-num green">{d.pcs_to_print ?? '—'}</span>
                                                                                <span className="track-sub">{pcsPending > 0 ? `${pcsPending} pending` : (d.pcs_to_print !== null ? '✓ done' : 'set')}</span>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="track-locked">🔒 locked</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="track-box">
                                                                        <span className="track-label" style={{ color: isUnlocked ? '#dc2626' : undefined }}>Labels Recv'd</span>
                                                                        {isUnlocked ? (
                                                                            <button className="track-btn" onClick={() => openLabelsModal(d)}>
                                                                                <span className="track-num red">{d.labels_received ?? '—'}</span>
                                                                                <span className="track-sub">{labelPending > 0 ? `${labelPending} pending` : (d.labels_received !== null ? '✓ all' : 'set')}</span>
                                                                            </button>
                                                                        ) : (
                                                                            <span className="track-locked">🔒 locked</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="design-stage-progress">
                                                                <div className="design-stage-title">Design Stage Progress</div>
                                                                {stages.map((s, i) => {
                                                                    const isPast = i < curIdx;
                                                                    const isCurrent = i === curIdx;
                                                                    const isFuture = i > curIdx;
                                                                    return (
                                                                        <div key={s.key} className={`design-stage-row${isCurrent ? ' current' : ''}${isPast ? ' past' : ''}${isFuture ? ' future' : ''}`}>
                                                                            <span className="stage-dot">{isPast ? '✓' : isCurrent ? '●' : '○'}</span>
                                                                            <span className="stage-row-label">{s.label}</span>
                                                                            {isCurrent && !isDone && (
                                                                                <button className={`btn sm${s.key === 'pending' ? ' primary' : ' teal'}`} onClick={() => advanceDesign(d.id)}>
                                                                                    {s.advanceLabel}
                                                                                </button>
                                                                            )}
                                                                            {(isFuture || (isCurrent && isDone)) && <span className="stage-row-dash">—</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            {order.items.every((item) => !designItemFor(order, item.id)) && (
                                                <div className="empty-row" style={{ padding: '16px', textAlign: 'center', color: 'var(--tx-muted)' }}>
                                                    No design items on this order yet.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                        </div>
                    ));
                })()}
            </div>

            {/* Photo lightbox */}
            {photoLightbox && (
                <div
                    className="modal-overlay open"
                    onClick={() => setPhotoLightbox(null)}
                    style={{ zIndex: 9999, background: 'rgba(0,0,0,0.75)' }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                    >
                        <img
                            src={photoLightbox}
                            alt=""
                            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '8px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
                        />
                        <button
                            type="button"
                            onClick={() => setPhotoLightbox(null)}
                            style={{ position: 'absolute', top: '-14px', right: '-14px', width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', fontWeight: 700 }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
