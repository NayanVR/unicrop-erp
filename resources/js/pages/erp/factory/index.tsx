import { labels as itemLabels, setStage as itemSetStage } from '@/routes/factory/items';
import { dispatch as orderDispatch, notes as orderNotes } from '@/routes/factory/orders';
import { approveUrgent as ordersApproveUrgent, rejectUrgent as ordersRejectUrgent } from '@/routes/orders';
import { Head, Link, router, usePage } from '@inertiajs/react';
import type { Auth } from '@/types/auth';
import { useEffect, useMemo, useRef, useState } from 'react';

type ProductPhotoSize = {
    packing_size?: string | null;
    mrp?: string | number | null;
};

type ProductPhoto = {
    id: number;
    party_id: number | null;
    our_brand: string;
    party_brand: string | null;
    packing_size: string | null;
    mrp: string | number | null;
    sizes: ProductPhotoSize[] | null;
    photo_url: string;
};

function buildPhotoMap(photos: ProductPhoto[]) {
    const ob = new Map<string, string>();
    const obAny = new Map<string, string>();
    const pb = new Map<string, string>();
    const pbAny = new Map<string, string>();
    const obMrp = new Map<string, string>();
    const pbMrp = new Map<string, string>();
    for (const p of photos) {
        const size = (p.packing_size ?? '').toLowerCase();
        if (p.party_id === null) {
            const b = p.our_brand.toLowerCase();
            ob.set(`${b}|${size}`, p.photo_url);
            if (!p.packing_size) ob.set(`${b}|`, p.photo_url);
            if (!obAny.has(b)) obAny.set(b, p.photo_url);
        } else if (p.party_brand) {
            const anyKey = `${p.party_id}|${p.party_brand.toLowerCase()}`;
            pb.set(`${anyKey}|${size}`, p.photo_url);
            if (!pbAny.has(anyKey)) pbAny.set(anyKey, p.photo_url);
        }

        for (const s of p.sizes ?? []) {
            if (s.mrp == null || s.mrp === '') continue;
            const sSize = (s.packing_size ?? '').toLowerCase();
            const mrp = String(s.mrp);
            if (p.party_id === null) {
                obMrp.set(`${p.our_brand.toLowerCase()}|${sSize}`, mrp);
            } else if (p.party_brand) {
                pbMrp.set(`${p.party_id}|${p.party_brand.toLowerCase()}|${sSize}`, mrp);
            }
        }
        if (p.mrp != null && p.mrp !== '') {
            const mrp = String(p.mrp);
            if (p.party_id === null) {
                if (!obMrp.has(`${p.our_brand.toLowerCase()}|${size}`)) obMrp.set(`${p.our_brand.toLowerCase()}|${size}`, mrp);
                if (!p.packing_size && !obMrp.has(`${p.our_brand.toLowerCase()}|`)) obMrp.set(`${p.our_brand.toLowerCase()}|`, mrp);
            } else if (p.party_brand) {
                if (!pbMrp.has(`${p.party_id}|${p.party_brand.toLowerCase()}|${size}`)) pbMrp.set(`${p.party_id}|${p.party_brand.toLowerCase()}|${size}`, mrp);
            }
        }
    }
    return { ob, obAny, pb, pbAny, obMrp, pbMrp };
}

function getItemPhoto(
    item: OrderItem,
    partyId: number | null | undefined,
    map: { ob: Map<string, string>; obAny: Map<string, string>; pb: Map<string, string>; pbAny: Map<string, string> },
): string | null {
    if (!item.our_brand) return null;
    const size = (item.packing_size ?? '').toLowerCase();
    if (partyId && item.party_brand) {
        const anyKey = `${partyId}|${item.party_brand.toLowerCase()}`;
        const url = map.pb.get(`${anyKey}|${size}`) ?? map.pb.get(`${anyKey}|`) ?? map.pbAny.get(anyKey);
        if (url) return url;
    }
    const b = item.our_brand.toLowerCase();
    return map.ob.get(`${b}|${size}`)
        ?? map.ob.get(`${b}|`)
        ?? map.obAny.get(b)
        ?? null;
}

function getItemMrp(
    item: OrderItem,
    partyId: number | null | undefined,
    map: { obMrp: Map<string, string>; pbMrp: Map<string, string> },
): string | null {
    if (!item.our_brand) return null;
    const size = (item.packing_size ?? '').toLowerCase();
    if (partyId && item.party_brand) {
        const key = `${partyId}|${item.party_brand.toLowerCase()}|${size}`;
        const mrp = map.pbMrp.get(key);
        if (mrp) return mrp;
    }
    return map.obMrp.get(`${item.our_brand.toLowerCase()}|${size}`) ?? null;
}

type StageLogEntry = {
    from: string;
    to: string;
    by?: number | null;
    name?: string | null;
    at: string;
    revert?: boolean;
};

type OrderItem = {
    id: number;
    order_id: number;
    our_brand?: string | null;
    party_brand?: string | null;
    packing_size?: string | null;
    box_size?: number | null;
    boxes_override?: number | null;
    labels_received?: number | null;
    quantity: string | number;
    dispatched_qty?: string | number | null;
    filled_qty?: string | number | null;
    labeled_qty?: string | number | null;
    rate: string | number;
    amount: string | number;
    type?: string | null;
    shape?: string | null;
    cap_color?: string | null;
    status: string;
    stage_log?: StageLogEntry[] | null;
};

type BoxDimension = {
    our_brand: string;
    packing_size: string | null;
    dim_l: string | number | null;
    dim_w: string | number | null;
    dim_h: string | number | null;
};

function buildBoxDimMap(boxDimensions: BoxDimension[]) {
    const map = new Map<string, BoxDimension>();
    for (const d of boxDimensions) {
        const size = (d.packing_size ?? '').toLowerCase();
        map.set(`${d.our_brand.toLowerCase()}|${size}`, d);
        if (!d.packing_size) map.set(`${d.our_brand.toLowerCase()}|`, d);
    }
    return map;
}

function getItemBoxDim(item: OrderItem, map: Map<string, BoxDimension>): string {
    if (!item.our_brand) return '';
    const size = (item.packing_size ?? '').toLowerCase();
    const d = map.get(`${item.our_brand.toLowerCase()}|${size}`) ?? map.get(`${item.our_brand.toLowerCase()}|`);
    if (!d || (!d.dim_l && !d.dim_w && !d.dim_h)) return '';
    return [d.dim_l, d.dim_w, d.dim_h].map((v) => v != null && Number(v) > 0 ? Number(v) : '?').join(' × ');
}

type DesignStatus = {
    stage: string;
    label: string;
    by?: string | null;
    at?: string | null;
};

type Order = {
    id: number;
    party_id?: number | null;
    order_number: string;
    company_name: string;
    customer_name: string;
    destination?: string | null;
    transport_name?: string | null;
    order_date?: string | null;
    priority?: string | null;
    status?: string | null;
    notes?: string | null;
    factory_notes?: string | null;
    sales_user_name?: string | null;
    created_by_name?: string | null;
    design_status?: DesignStatus | null;
    tax_docs_pending?: boolean;
    docs?: Array<{ id: number; document_type: string; original_name: string }>;
    pan_doc?: { id: number; original_name: string } | null;
    labels_last_printed_by?: string | null;
    labels_last_printed_at?: string | null;
    items: OrderItem[];
};

type UrgentPendingOrder = {
    id: number;
    order_number: string;
    company_name: string;
    customer_name: string;
    order_date?: string | null;
    sales_user?: { id: number; name: string } | null;
    created_by?: { id: number; name: string } | null;
    items: { id: number; our_brand?: string | null; packing_size?: string | null; quantity: string | number }[];
};

type Props = {
    orders: Order[];
    urgentPending: UrgentPendingOrder[];
    canAdvance: boolean;
    productPhotos?: ProductPhoto[];
    packingSizes?: { name: string; multiplier: string | number; pieces_per_box: number | null; pack_unit: string | null }[];
    godowns?: { id: number; name: string; is_default?: boolean }[];
    boxDimensions?: BoxDimension[];
};

const STAGE_ORDER = ['accepted', 'filling', 'filled', 'labeling', 'ready', 'dispatched'];

const STAGE_LABELS: Record<string, string> = {
    accepted:   'Accept Order',
    filling:    'Filling',
    filled:     'Filled',
    labeling:   'Labeling',
    ready:      'Ready',
    dispatched: 'Dispatched',
};

const STAGE_CLASS: Record<string, string> = {
    accepted:   's-processing',
    filling:    's-filling',
    filled:     's-filling',
    labeling:   's-labeling',
    ready:      's-ready',
    dispatched: 's-dispatched',
};

// Map common cap-colour names to a swatch colour so factory staff can see
// at a glance which cap colour each bottle needs.
const CAP_COLOR_HEX: Record<string, string> = {
    red: '#dc2626', green: '#16a34a', blue: '#2563eb', white: '#ffffff', black: '#111827',
    yellow: '#eab308', orange: '#f97316', purple: '#7c3aed', violet: '#7c3aed', pink: '#ec4899',
    brown: '#92400e', grey: '#6b7280', gray: '#6b7280', silver: '#cbd5e1', gold: '#d4af37',
    'sky blue': '#38bdf8', skyblue: '#38bdf8', 'light green': '#86efac', 'dark blue': '#1e3a8a',
    transparent: '#e5e7eb', clear: '#e5e7eb', natural: '#e5e7eb',
};
function capColorHex(name: string): string {
    const k = name.trim().toLowerCase();
    if (CAP_COLOR_HEX[k]) return CAP_COLOR_HEX[k];
    try {
        if (typeof CSS !== 'undefined' && CSS.supports?.('color', k)) return k;
        if (typeof CSS !== 'undefined' && CSS.supports?.('color', k.replace(/\s+/g, ''))) return k.replace(/\s+/g, '');
    } catch { /* ignore */ }
    return '#9ca3af';
}

type EditableLabel = {
    key: string;
    transport: string;
    destination: string;
    party: string;
    boxNum: number;
    totalBoxes: number;
    unit: string;        // pack unit for this item's parcels (box / bag / carba)
    itemBoxNum: number;   // this box's position within its product (1-of-3)
    itemTotalBoxes: number; // total boxes for this product
    brand: string;
    inBoxPcs: string;
    orderRef: string;
    boxDim: string;
};

type FilterKey = 'all' | 'new' | 'in-process' | 'filling' | 'ready' | 'dispatched';

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'in-process', label: 'In Process' },
    { key: 'filling', label: 'Filling' },
    { key: 'ready', label: 'Ready' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'all', label: 'All' },
];

// An item is "new" (awaiting acceptance) when it has no status or the
// legacy 'pending' status. The DB column is NOT NULL and defaults to
// 'pending', so new order items arrive here as 'pending'.
const isNewItem = (status?: string | null) => !status || status === 'pending';

const stageIndex = (status?: string | null) => {
    if (isNewItem(status)) return -1; // not yet accepted
    const idx = STAGE_ORDER.indexOf(status as string);
    return idx < 0 ? -1 : idx;
};

const itemProgress = (item: OrderItem) => {
    const idx = stageIndex(item.status);
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
};

const orderProgress = (order: Order) => {
    if (order.items.length === 0) return 0;
    const sum = order.items.reduce((acc, i) => {
        const idx = stageIndex(i.status);
        return acc + (idx < 0 ? 0 : (idx + 1) / STAGE_ORDER.length);
    }, 0);
    return Math.round((sum / order.items.length) * 100);
};

const matchesFilter = (order: Order, filter: FilterKey) => {
    if (filter === 'all') return true;
    const statuses = order.items.map((i) => i.status ?? null);
    switch (filter) {
        case 'new':
            return statuses.some((s) => isNewItem(s));
        case 'in-process':
            return statuses.some((s) => ['accepted', 'filling', 'filled', 'labeling'].includes(s ?? ''));
        case 'filling':
            return statuses.some((s) => s === 'filling' || s === 'filled');
        case 'ready':
            return statuses.some((s) => s === 'ready');
        case 'dispatched':
            return order.status === 'dispatched' || statuses.some((s) => s === 'dispatched');
        default:
            return true;
    }
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const formatTime = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const formatDay = (iso?: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const priorityClass = (priority?: string | null) => `badge priority-${priority ?? 'normal'}`;

// Standard pcs-per-box/bag/carba lookup by normalized packing size
const STD_PCS_PER_BOX: Record<string, number> = {
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

// Pack unit (box / bag / carba) by normalized packing size, when admin hasn't set one
const STD_PACK_UNIT: Record<string, string> = {
    '10kg': 'bag', '25kg': 'bag', '50kg': 'bag',
    '10ltr': 'carba', '20ltr': 'carba', '50ltr': 'carba', '200ltr': 'carba',
};

const normalizeSize = (s: string): string =>
    s.toLowerCase().replace(/\s+/g, '')
        .replace(/litre|liter|litres|liters/g, 'ltr')
        .replace(/kilogram|kilograms|kgs\b/g, 'kg')
        .replace(/gram|grams\b/g, 'gm')
        .replace(/millilitre|milliliter|millilitres|milliliters|mls\b/g, 'ml');

const stdPcsPerBox = (packing: string | null | undefined, overrides: Record<string, number> = {}): number | null => {
    if (!packing) return null;
    const key = normalizeSize(packing);
    return overrides[key] ?? STD_PCS_PER_BOX[key] ?? null;
};

const packUnitFor = (packing: string | null | undefined, overrides: Record<string, string> = {}): string => {
    if (!packing) return 'box';
    const key = normalizeSize(packing);
    return overrides[key] ?? STD_PACK_UNIT[key] ?? 'box';
};

const pluralizeUnit = (unit: string, count: number): string => {
    if (count === 1) return unit;
    if (unit === 'box') return 'boxes';
    if (unit === 'bag') return 'bags';
    return unit;
};

const formatQty = (value: string | number) => {
    const n = Number(value);
    return isNaN(n) ? String(value) : String(n);
};

// Effective pcs/box: stored box_size takes priority, else derive from packing_size
const pcsPerBox = (item: OrderItem, overrides: Record<string, number> = {}): number | null =>
    item.box_size ?? stdPcsPerBox(item.packing_size, overrides);

const boxesFor = (item: OrderItem, overrides: Record<string, number> = {}): number | null => {
    if (item.boxes_override != null && item.boxes_override > 0) return item.boxes_override;
    const ppb = pcsPerBox(item, overrides);
    if (!ppb || ppb <= 0) return null;
    return Math.ceil(Number(item.quantity) / ppb);
};

export default function FactoryIndex({ orders, urgentPending, canAdvance, productPhotos = [], packingSizes = [], godowns = [], boxDimensions = [] }: Props) {
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

    const boxDimMap = useMemo(() => buildBoxDimMap(boxDimensions), [boxDimensions]);

    const initialFilter = (): FilterKey => {
        const param = new URLSearchParams(window.location.search).get('filter');
        const valid: FilterKey[] = ['all', 'new', 'in-process', 'filling', 'ready', 'dispatched'];
        return valid.includes(param as FilterKey) ? (param as FilterKey) : 'new';
    };
    const [activeFilter, setActiveFilter] = useState<FilterKey>(initialFilter);
    const { auth } = usePage<{ auth: Auth }>().props;
    const canFill = auth.user?.role === 'admin' || (auth.user?.permissions ?? []).includes('filling');
    const [search, setSearch] = useState('');
    const [openOrders, setOpenOrders] = useState<number[]>([]);
    const [stagingItem, setStagingItem] = useState<number | null>(null);
    const [fillingPrompt, setFillingPrompt] = useState<{ item: OrderItem; current: string | null } | null>(null);
    const [stageQty, setStageQty] = useState<{
        item: OrderItem; toStage: string; field: 'filled_qty' | 'labeled_qty';
        title: string; question: string; doneLabel: string; takenLabel: string; taken: number;
    } | null>(null);
    const [stageQtyVal, setStageQtyVal] = useState('');
    const [dispatchingOrder, setDispatchingOrder] = useState<number | null>(null);
    const [approvingId, setApprovingId] = useState<number | null>(null);
    const [rejectingId, setRejectingId] = useState<number | null>(null);

    // Factory notes (local editable copy, keyed by order id)
    const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
    const [savingNotes, setSavingNotes] = useState<number | null>(null);

    // Labels received modal
    const [labelsModal, setLabelsModal] = useState<{ item: OrderItem } | null>(null);
    const [labelsValue, setLabelsValue] = useState('');
    const [labelsSaving, setLabelsSaving] = useState(false);

    const [photoLightbox, setPhotoLightbox] = useState<string | null>(null);
    const [labelEditor, setLabelEditor] = useState<{ order: Order; labels: EditableLabel[]; unitSummary: string } | null>(null);
    const [labelFS, setLabelFS] = useState({ transport: 28, totalBoxes: 22, brand: 16, boxNum: 18, party: 10 });
    const adjFS = (key: keyof typeof labelFS, delta: number) =>
        setLabelFS((prev) => ({ ...prev, [key]: Math.max(6, prev[key] + delta) }));
    const totalBoxesRefs = useRef<(HTMLSpanElement | null)[]>([]);

    // Shrink the parcel-summary line so it always fits on one line within the label
    useEffect(() => {
        if (!labelEditor) return;
        totalBoxesRefs.current.forEach((el) => {
            if (!el || !el.parentElement) return;
            let size = labelFS.totalBoxes;
            el.style.fontSize = `${size}pt`;
            while (size > 8 && el.scrollWidth > el.parentElement.clientWidth) {
                size -= 1;
                el.style.fontSize = `${size}pt`;
            }
        });
    }, [labelEditor, labelFS.totalBoxes]);
    const [boxSizeDraft, setBoxSizeDraft] = useState<Record<number, string>>({});
    const [savingBoxSize, setSavingBoxSize] = useState<number | null>(null);
    const [boxCountDraft, setBoxCountDraft] = useState<Record<number, string>>({});
    const [savingBoxCount, setSavingBoxCount] = useState<number | null>(null);

    // Unit transfer modal (opened from a specific order item)
    const [transferModal, setTransferModal] = useState<{ order: Order; item: OrderItem } | null>(null);
    const [transferForm, setTransferForm] = useState({ from_unit: '', to_unit: '', unit: 'pcs', notes: '', quantity: '' });
    const [transferSaving, setTransferSaving] = useState(false);

    // Dispatch modal — adjust per-item quantities before dispatching
    const [dispatchModal, setDispatchModal] = useState<Order | null>(null);
    const [dispatchQtys, setDispatchQtys] = useState<Record<number, string>>({});

    // Urgent approve/reject modal — days on approve, reason on reject
    const [urgentModal, setUrgentModal] = useState<{ order: UrgentPendingOrder; mode: 'approve' | 'reject' } | null>(null);
    const [urgentDays, setUrgentDays] = useState('');
    const [urgentReason, setUrgentReason] = useState('');

    const openTransfer = (order: Order, item: OrderItem) => {
        const defaultGodown = godowns.find((g) => g.is_default)?.name ?? '';
        setTransferForm({
            from_unit: defaultGodown,
            to_unit: '',
            unit: 'pcs',
            notes: '',
            quantity: String(item.quantity),
        });
        setTransferModal({ order, item });
    };

    const submitTransfer = () => {
        if (!transferModal) return;
        const { order, item } = transferModal;
        const productName = [item.our_brand, item.packing_size].filter(Boolean).join(' ');
        setTransferSaving(true);
        router.post('/unit-transfer', {
            order_number: order.order_number,
            from_unit:    transferForm.from_unit,
            to_unit:      transferForm.to_unit,
            item_type:    'finished_good',
            item_name:    productName,
            quantity:     transferForm.quantity,
            unit:         transferForm.unit,
            notes:        transferForm.notes,
        }, {
            preserveScroll: true,
            onFinish: () => setTransferSaving(false),
            onSuccess: () => setTransferModal(null),
        });
    };

    const photoMap = useMemo(() => buildPhotoMap(productPhotos), [productPhotos]);

    const visibleOrders = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = orders.filter((o) => {
            if (!matchesFilter(o, activeFilter)) return false;
            if (!q) return true;
            return (
                o.order_number.toLowerCase().includes(q) ||
                o.company_name.toLowerCase().includes(q) ||
                o.customer_name.toLowerCase().includes(q)
            );
        });

        return [...filtered].sort((a, b) => {
            const aHasNew = a.items.some((i) => isNewItem(i.status));
            const bHasNew = b.items.some((i) => isNewItem(i.status));
            if (aHasNew !== bHasNew) return aHasNew ? -1 : 1;
            return b.id - a.id;
        });
    }, [orders, activeFilter, search]);

    const toggleOrder = (orderId: number) =>
        setOpenOrders((curr) => (curr.includes(orderId) ? curr.filter((id) => id !== orderId) : [...curr, orderId]));

    const setItemStage = (itemId: number, stage: string, current: string | null, onDone?: () => void, extra?: Record<string, string | number>) => {
        if (stage === current) {
            onDone?.();
            return;
        }
        const targetIdx = STAGE_ORDER.indexOf(stage);
        const currentIdx = current ? STAGE_ORDER.indexOf(current) : -1;
        if (targetIdx < currentIdx && !confirm(`Move this item back to "${STAGE_LABELS[stage] ?? stage}"?`)) return;
        setStagingItem(itemId);
        router.post(
            itemSetStage(itemId).url,
            { stage, ...(extra ?? {}) },
            { preserveScroll: true, onFinish: () => { setStagingItem(null); onDone?.(); } },
        );
    };

    const openFillingDone = (item: OrderItem) => {
        const taken = Number(item.quantity);
        setStageQtyVal(String(taken));
        setStageQty({
            item, toStage: 'filled', field: 'filled_qty',
            title: '✓ Filling Done', question: 'How many pcs filled?',
            doneLabel: '✓ Filling Done', takenLabel: 'Taken for filling', taken,
        });
    };
    const openLabelingDone = (item: OrderItem) => {
        const taken = item.filled_qty != null ? Number(item.filled_qty) : Number(item.quantity);
        setStageQtyVal(String(taken));
        setStageQty({
            item, toStage: 'ready', field: 'labeled_qty',
            title: '✓ Labeling Done', question: 'How many pcs labeled?',
            doneLabel: '✓ Done → Ready', takenLabel: 'Filled', taken,
        });
    };
    const stepStageQty = (delta: number) => {
        setStageQtyVal((prev) => String(Math.max(0, (parseFloat(prev) || 0) + delta)));
    };
    const submitStageQty = () => {
        if (!stageQty) return;
        const qty = Math.max(0, parseFloat(stageQtyVal) || 0);
        setItemStage(
            stageQty.item.id,
            stageQty.toStage,
            stageQty.item.status ?? '',
            () => setStageQty(null),
            { [stageQty.field]: qty },
        );
    };

    const dispatchReady = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        const readyItems = order.items.filter((i) => i.status === 'ready');
        if (readyItems.length === 0) return;
        setDispatchQtys(Object.fromEntries(readyItems.map((i) => [i.id, String(Number(i.quantity))])));
        setDispatchModal(order);
    };

    const stepDispatchQty = (itemId: number, delta: number) => {
        setDispatchQtys((prev) => {
            const next = Math.max(0, (parseFloat(prev[itemId]) || 0) + delta);
            return { ...prev, [itemId]: String(next) };
        });
    };

    const submitDispatch = () => {
        if (!dispatchModal) return;
        const readyItems = dispatchModal.items.filter((i) => i.status === 'ready');
        const items = readyItems.map((i) => ({
            id: i.id,
            dispatched_qty: parseFloat(dispatchQtys[i.id]) || 0,
        }));
        setDispatchingOrder(dispatchModal.id);
        router.post(orderDispatch(dispatchModal.id).url, { items }, {
            preserveScroll: true,
            onSuccess: () => setDispatchModal(null),
            onFinish: () => setDispatchingOrder(null),
        });
    };

    const approveUrgent = (order: UrgentPendingOrder) => {
        setUrgentDays('');
        setUrgentModal({ order, mode: 'approve' });
    };

    const rejectUrgent = (order: UrgentPendingOrder) => {
        setUrgentReason('');
        setUrgentModal({ order, mode: 'reject' });
    };

    const submitUrgent = () => {
        if (!urgentModal) return;
        const { order, mode } = urgentModal;
        if (mode === 'approve') {
            setApprovingId(order.id);
            router.post(
                ordersApproveUrgent(order.id).url,
                { days: urgentDays.trim() === '' ? null : parseInt(urgentDays, 10) },
                { preserveScroll: true, onSuccess: () => setUrgentModal(null), onFinish: () => setApprovingId(null) },
            );
        } else {
            setRejectingId(order.id);
            router.post(
                ordersRejectUrgent(order.id).url,
                { reason: urgentReason.trim() === '' ? null : urgentReason.trim() },
                { preserveScroll: true, onSuccess: () => setUrgentModal(null), onFinish: () => setRejectingId(null) },
            );
        }
    };

    const saveNotes = (order: Order) => {
        const value = notesDraft[order.id] ?? order.factory_notes ?? '';
        setSavingNotes(order.id);
        router.post(
            orderNotes(order.id).url,
            { factory_notes: value },
            { preserveScroll: true, onFinish: () => setSavingNotes(null) },
        );
    };

    const saveBoxSize = (itemId: number) => {
        const raw = boxSizeDraft[itemId];
        if (raw === undefined) return;
        const num = parseInt(raw, 10);
        if (isNaN(num) || num < 1) return;
        setSavingBoxSize(itemId);
        router.patch(
            `/factory/items/${itemId}`,
            { box_size: num },
            { preserveScroll: true, onFinish: () => setSavingBoxSize(null) },
        );
    };

    const saveBoxCount = (itemId: number, computed: number | null) => {
        const raw = boxCountDraft[itemId];
        if (raw === undefined) return;
        const trimmed = raw.trim();
        // Empty or same-as-computed clears the override back to auto
        const num = trimmed === '' ? null : parseInt(trimmed, 10);
        if (num !== null && (isNaN(num) || num < 1)) return;
        setSavingBoxCount(itemId);
        router.patch(
            `/factory/items/${itemId}`,
            { boxes_override: num !== null && num === computed ? null : num },
            {
                preserveScroll: true,
                onFinish: () => {
                    setSavingBoxCount(null);
                    setBoxCountDraft((prev) => {
                        const next = { ...prev };
                        delete next[itemId];
                        return next;
                    });
                },
            },
        );
    };

    const openLabelsModal = (item: OrderItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setLabelsModal({ item });
        setLabelsValue(item.labels_received != null ? String(item.labels_received) : '');
    };

    const submitLabels = () => {
        if (!labelsModal) return;
        const qty = parseInt(labelsValue, 10);
        if (isNaN(qty) || qty < 0) return;
        setLabelsSaving(true);
        router.post(
            itemLabels(labelsModal.item.id).url,
            { labels_received: qty },
            {
                preserveScroll: true,
                onFinish: () => {
                    setLabelsSaving(false);
                    setLabelsModal(null);
                },
            },
        );
    };

    const openLabelEditor = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();

        // Tally parcel counts per pack unit (box / bag / carba) across the order
        const unitTotals: Record<string, number> = {};
        order.items.forEach((item) => {
            const itemBoxes = boxesFor(item, pcsPerBoxOverrides) ?? 1;
            const unit = packUnitFor(item.packing_size, packUnitOverrides);
            unitTotals[unit] = (unitTotals[unit] ?? 0) + itemBoxes;
        });
        const totalParcels = Object.values(unitTotals).reduce((sum, n) => sum + n, 0);
        const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        const unitSummary = Object.entries(unitTotals)
            .map(([unit, count]) => `${count} ${cap(pluralizeUnit(unit, count))}`)
            .join(' + ') + ` = ${totalParcels} Parcel${totalParcels !== 1 ? 's' : ''}`;

        const labels: EditableLabel[] = [];
        let seq = 1;
        order.items.forEach((item) => {
            const itemBoxes = boxesFor(item, pcsPerBoxOverrides) ?? 1;
            const unit = packUnitFor(item.packing_size, packUnitOverrides);
            const brand = item.party_brand || item.our_brand || '—';
            const ppb = pcsPerBox(item, pcsPerBoxOverrides);
            for (let b = 1; b <= itemBoxes; b++) {
                labels.push({
                    key: `${item.id}-${b}`,
                    transport: order.transport_name ?? '',
                    destination: order.destination ?? '',
                    party: order.company_name,
                    boxNum: seq++,
                    totalBoxes: totalParcels,
                    unit,
                    itemBoxNum: b,
                    itemTotalBoxes: itemBoxes,
                    brand: `${brand}${item.packing_size ? ' · ' + item.packing_size : ''}`,
                    inBoxPcs: ppb != null ? String(ppb) : '',
                    orderRef: order.order_number,
                    boxDim: getItemBoxDim(item, boxDimMap),
                });
            }
        });
        setLabelEditor({ order, labels, unitSummary });
    };

    const updateLabelField = (idx: number, field: keyof Omit<EditableLabel, 'key' | 'boxNum' | 'totalBoxes' | 'itemBoxNum' | 'itemTotalBoxes'>, value: string) => {
        setLabelEditor((prev) => {
            if (!prev) return prev;
            const labels = [...prev.labels];
            labels[idx] = { ...labels[idx], [field]: value };
            return { ...prev, labels };
        });
    };

    const downloadLabelsPDF = () => {
        if (!labelEditor) return;
        const printedOn = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const printedBy = auth.user?.name ?? '';
        const esc = (s: string) =>
            s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const win = window.open('', '_blank', 'width=900,height=700');
        if (!win) return;
        const labelHtml = labelEditor.labels
            .map(
                (lbl) => `
            <div class="label">
                <div class="label-inner">
                    <div class="transport-row">
                        <span class="transport">${esc(lbl.transport || '—')}</span>
                        <span class="box-badge">${lbl.boxNum}</span>
                    </div>
                    <div class="destination">${esc(lbl.destination || '—')}</div>
                    <div class="party-tag">DELIVER TO</div>
                    <div class="party">${esc(lbl.party || '—')}</div>
                    <div class="mid-row">
                        <span class="total-boxes">${esc(labelEditor.unitSummary)}</span>
                    </div>
                    <div class="auto-row2">
                        <span class="inboxpcs">${lbl.inBoxPcs ? `In-${esc(lbl.unit)}: <b>${esc(lbl.inBoxPcs)} pcs</b>` : '—'}</span>
                    </div>
                    <div class="product-block">
                        <span class="brand-name">${esc(lbl.brand || '—')}</span>
                        <span class="item-box-count">${lbl.itemTotalBoxes} ${esc(pluralizeUnit(lbl.unit, lbl.itemTotalBoxes))}</span>
                    </div>
                    <div class="footer-row">
                        <span class="unit-tag">${esc(lbl.unit.toUpperCase())}</span>
                        <span class="order-ref">${esc(lbl.orderRef)}</span>
                    </div>
                    ${lbl.boxDim ? `<div class="box-dim">Dim: ${esc(lbl.boxDim)} mm</div>` : ''}
                </div>
            </div>`,
            )
            .join('');
        win.document.write(`<html><head><title>Box Labels — ${labelEditor.order.order_number}</title>
            <style>
                @page { size: 100mm 75mm; margin: 0; }
                * { box-sizing: border-box; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
                .label { width:100mm; height:75mm; border:1px solid #000; page-break-after:always; overflow:hidden; position:relative; }
                .label:last-child { page-break-after:avoid; }
                .label-inner { padding:3mm 4mm; transform-origin:top left; }
                .transport-row { display:flex; justify-content:space-between; align-items:center; gap:2mm; border-bottom:2px solid #000; padding-bottom:1mm; margin-bottom:1mm; }
                .transport { font-size:${labelFS.transport}pt; font-weight:900; line-height:1.1; }
                .box-badge { min-width:11mm; height:11mm; padding:0 2mm; background:#000; color:#fff; display:flex; align-items:center; justify-content:center; font-size:${labelFS.boxNum}pt; font-weight:900; border-radius:1.5mm; flex-shrink:0; }
                .destination { font-size:9pt; color:#333; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:1mm; }
                .party-tag { font-size:6.5pt; font-weight:700; color:#777; letter-spacing:1.5px; }
                .party { font-size:${labelFS.party}pt; font-weight:700; margin-bottom:1.5mm; }
                .mid-row { background:#000; border-radius:1.5mm; padding:1mm 0; margin-bottom:1.5mm; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
                .total-boxes { font-size:${labelFS.totalBoxes}pt; font-weight:900; line-height:1.05; white-space:nowrap; color:#fff; }
                .auto-row2 { display:flex; justify-content:space-between; align-items:center; font-size:9pt; margin-bottom:1.5mm; }
                .inboxpcs { font-weight:700; color:#222; }
                .product-block { padding-top:0.5mm; display:flex; justify-content:space-between; align-items:center; gap:2mm; }
                .brand-name { font-size:${labelFS.brand}pt; font-weight:900; word-break:break-word; white-space:normal; line-height:1.15; flex:1; min-width:0; }
                .item-box-count { font-size:${labelFS.brand}pt; font-weight:900; white-space:nowrap; flex-shrink:0; background:#000; color:#fff; padding:0.5mm 2.5mm; border-radius:1.5mm; }
                .footer-row { display:flex; justify-content:space-between; align-items:center; margin-top:1mm; }
                .unit-tag { font-size:8pt; font-weight:900; border:1.5px solid #000; padding:0.5mm 2.5mm; letter-spacing:1.5px; border-radius:1mm; }
                .order-ref { font-size:7.5pt; color:#888; text-align:right; }
                .box-dim { font-size:7pt; color:#555; text-align:right; margin-top:0.5mm; }
                .printed-by { font-size:7pt; color:#555; margin-top:0.5mm; text-align:right; }
                .toolbar { position:sticky; top:0; z-index:10; background:#1e293b; color:#fff; padding:10px 16px; display:flex; align-items:center; gap:12px; }
                .toolbar button { background:#2563eb; color:#fff; border:0; border-radius:6px; padding:8px 18px; font-size:14px; font-weight:700; cursor:pointer; }
                .toolbar span { color:#cbd5e1; font-size:12px; }
                @media screen { body { background:#f0f0f0; } .label { margin:10px auto; border:1px dashed #888; border-radius:4px; background:#fff; } }
                @media print { .toolbar { display:none; } }
            </style>
            <script>
            function fitLabels() {
                // Shrink the parcel-summary line so it always stays on one line
                document.querySelectorAll('.total-boxes').forEach(function(el) {
                    var size = ${labelFS.totalBoxes};
                    el.style.fontSize = size + 'pt';
                    var parent = el.parentElement;
                    while (size > 8 && el.scrollWidth > parent.clientWidth) {
                        size -= 1;
                        el.style.fontSize = size + 'pt';
                    }
                });
                document.querySelectorAll('.label').forEach(function(label) {
                    var inner = label.querySelector('.label-inner');
                    if (!inner) return;
                    inner.style.transform = '';
                    inner.style.width = '';
                    var labelH = label.offsetHeight;
                    var labelW = label.offsetWidth;
                    var innerH = inner.scrollHeight;
                    var innerW = inner.scrollWidth;
                    var scaleH = innerH > labelH ? labelH / innerH : 1;
                    var scaleW = innerW > labelW ? labelW / innerW : 1;
                    var scale = Math.min(scaleH, scaleW);
                    if (scale < 0.999) {
                        inner.style.transform = 'scale(' + scale.toFixed(4) + ')';
                        inner.style.width = Math.ceil(100 / scale) + '%';
                    }
                });
            }
            window.addEventListener('load', fitLabels);
            window.addEventListener('beforeprint', fitLabels);
            <\/script>
            </head>
            <body><div class="toolbar"><button onclick="fitLabels();window.print()">🖨 Save as PDF / Print</button><span>${labelEditor.labels.length} label(s) — ${labelEditor.order.order_number}</span></div>
            ${labelHtml}</body></html>`);
        win.document.close();
        router.post(`/factory/orders/${labelEditor.order.id}/label-print`, {}, { preserveScroll: true });
    };

    const allLogEntries = orders.flatMap((o) => o.items);
    void allLogEntries; // history is rendered inline per item below

    return (
        <>
            <Head title="Production Orders" />
            <div id="view-factory" className="view active">
                {/* ── Header: title · search · filters ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--tx-head)', whiteSpace: 'nowrap' }}>
                        Production Orders
                    </h1>
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Search order, company, customer…"
                        style={{ width: '220px', flexShrink: 1 }}
                    />
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            type="button"
                            className={`pill ${activeFilter === f.key ? 'active' : ''}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* ── Urgent Approval Requests (factory/admin only) ── */}
                {canAdvance && urgentPending.length > 0 && (
                    <div className="card" style={{ marginBottom: '20px', border: '2px solid #ef4444' }}>
                        <div className="card-title" style={{ color: '#ef4444' }}>
                            🚨 Urgent Approval Requests
                            <span className="ct-badge" style={{ background: '#ef4444', color: '#fff' }}>
                                {urgentPending.length} pending
                            </span>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--tx-sub)', marginBottom: '14px' }}>
                            These urgent orders are waiting for your approval before sales can confirm them for production.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {urgentPending.map((order) => (
                                <div
                                    key={order.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        background: 'var(--bg-page)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <div style={{ minWidth: '80px', fontWeight: 700, color: 'var(--accent)', fontSize: '13px' }}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '140px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--tx-head)' }}>{order.company_name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--tx-sub)' }}>{order.customer_name}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--tx-muted)', minWidth: '100px' }}>
                                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                        {order.items.slice(0, 2).map((item, idx) => (
                                            <div key={idx} style={{ color: 'var(--tx-faint)' }}>
                                                {item.our_brand ?? '—'} {item.packing_size ? `(${item.packing_size})` : ''} ×{formatQty(item.quantity)}
                                            </div>
                                        ))}
                                        {order.items.length > 2 && <div style={{ color: 'var(--tx-faint)' }}>+{order.items.length - 2} more</div>}
                                    </div>
                                    {order.order_date && <div style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>{formatDate(order.order_date)}</div>}
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            type="button"
                                            className="btn primary"
                                            style={{ padding: '6px 16px', fontSize: '13px' }}
                                            onClick={() => approveUrgent(order)}
                                            disabled={approvingId === order.id || rejectingId === order.id}
                                        >
                                            {approvingId === order.id ? '…' : '✓ Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn danger-xs"
                                            style={{ padding: '6px 14px', fontSize: '13px' }}
                                            onClick={() => rejectUrgent(order)}
                                            disabled={approvingId === order.id || rejectingId === order.id}
                                        >
                                            {rejectingId === order.id ? '…' : '✕ Reject'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {visibleOrders.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">🏭</div>
                        <p>
                            {orders.length === 0
                                ? 'No confirmed orders in production. Orders must be confirmed by sales/admin first.'
                                : 'No orders match this filter.'}
                        </p>
                    </div>
                ) : (
                    visibleOrders.map((order) => {
                        const isOpen = openOrders.includes(order.id);
                        const progress = orderProgress(order);
                        const readyCount = order.items.filter((i) => i.status === 'ready').length;
                        const notesValue = notesDraft[order.id] ?? order.factory_notes ?? '';

                        return (
                            <div key={order.id} className={`order-card${isOpen ? ' open' : ''}`}>
                                <div
                                    className="order-card-header"
                                    onClick={() => toggleOrder(order.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') toggleOrder(order.id);
                                    }}
                                >
                                    <div className="o-id" style={order.status === 'dispatched' ? { background: '#d1fae5', color: '#065f46' } : undefined}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="o-company">{order.company_name}</div>
                                        <div className="o-customer">
                                            {order.customer_name} · {order.items.length} product(s)
                                        </div>
                                    </div>
                                    <div className="o-meta" style={{ alignItems: 'flex-end' }}>
                                        <div>
                                            {formatDate(order.order_date)}
                                            {order.sales_user_name ? ` · ${order.sales_user_name}` : ''}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div className="progress-bar" style={{ width: '90px' }}>
                                                <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--tx-muted)', fontWeight: 600 }}>{progress}%</span>
                                        </div>
                                        <span className={priorityClass(order.priority)}>{(order.priority ?? 'normal').toUpperCase()}</span>
                                        {order.status === 'dispatched' && (
                                            <span className="badge s-dispatched">✓ Dispatched</span>
                                        )}
                                    </div>
                                    <div className="chevron">▶</div>
                                </div>

                                <div className="order-body">
                                    {/* ── Action toolbar ── */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            gap: '8px',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            background: 'var(--bg-page)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            marginBottom: '14px',
                                        }}
                                    >
                                        <button type="button" className="btn sm" onClick={() => toggleOrder(order.id)}>
                                            👁 {isOpen ? 'Hide' : 'View'}
                                        </button>
                                        <a
                                            href={`/orders/${order.id}/print`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn sm"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            🖨 Print
                                        </a>
                                        {canAdvance && (
                                            <button
                                                type="button"
                                                className={`btn sm${readyCount > 0 ? ' primary' : ''}`}
                                                onClick={(e) => dispatchReady(order, e)}
                                                disabled={readyCount === 0 || dispatchingOrder === order.id}
                                                title={readyCount === 0 ? 'No items ready for dispatch' : `Dispatch ${readyCount} ready item(s)`}
                                            >
                                                {dispatchingOrder === order.id ? '…' : `📦 Dispatch${readyCount > 0 ? ` (${readyCount})` : ''}`}
                                            </button>
                                        )}
                                        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                            {(() => {
                                                const unitTotals: Record<string, number> = {};
                                                order.items.forEach((item) => {
                                                    const count = boxesFor(item, pcsPerBoxOverrides) ?? 1;
                                                    const unit = packUnitFor(item.packing_size, packUnitOverrides);
                                                    unitTotals[unit] = (unitTotals[unit] ?? 0) + count;
                                                });
                                                const totalParcels = Object.values(unitTotals).reduce((sum, n) => sum + n, 0);
                                                const summary = Object.entries(unitTotals)
                                                    .map(([unit, count]) => `${count} ${pluralizeUnit(unit, count)}`)
                                                    .join(' + ');
                                                return (
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--tx-muted)', textAlign: 'right' }}>
                                                        📦 {summary} = {totalParcels} parcel{totalParcels !== 1 ? 's' : ''}
                                                    </span>
                                                );
                                            })()}
                                            <button
                                                type="button"
                                                className="btn sm"
                                                style={{ borderColor: '#d97706', color: '#d97706' }}
                                                onClick={(e) => openLabelEditor(order, e)}
                                            >
                                                🏷 Box Labels
                                            </button>
                                            {order.labels_last_printed_by && order.labels_last_printed_at && (
                                                <span style={{ fontSize: '10px', color: 'var(--tx-muted)', textAlign: 'right' }}>
                                                    🖨 {order.labels_last_printed_by} · {formatTime(order.labels_last_printed_at)} {formatDay(order.labels_last_printed_at)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Design status banner ── */}
                                    {order.design_status && (
                                        <div
                                            style={{
                                                borderLeft: '3px solid var(--accent, #7c3aed)',
                                                background: 'var(--accent-soft, #f5f3ff)',
                                                borderRadius: '6px',
                                                padding: '8px 12px',
                                                marginBottom: '10px',
                                                fontSize: '13px',
                                            }}
                                        >
                                            <span style={{ fontWeight: 700, color: 'var(--accent, #7c3aed)' }}>
                                                🎨 DESIGN: {order.design_status.label.toUpperCase()}
                                            </span>
                                            {order.design_status.by && <span style={{ color: 'var(--tx-muted)' }}> · {order.design_status.by}</span>}
                                            {order.design_status.at && (
                                                <span style={{ color: 'var(--tx-faint)' }}>
                                                    {' · '}
                                                    {formatTime(order.design_status.at)} · {formatDay(order.design_status.at)}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Tax documents ── */}
                                    {((order.docs ?? []).length > 0 || order.tax_docs_pending) && (
                                        <div style={{ marginBottom: '10px' }}>
                                            {order.tax_docs_pending && (
                                                <div style={{ background: 'var(--bg-yellow, #fefce8)', border: '1px solid var(--border-yellow, #fde68a)', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', color: '#92400e', marginBottom: '6px' }}>
                                                    📄 Tax Invoice pending — accountant will upload
                                                </div>
                                            )}
                                            {(order.docs ?? []).length > 0 && (
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    {(order.docs ?? []).map((doc) => (
                                                        <a
                                                            key={doc.id}
                                                            href={`/orders/${order.id}/documents/${doc.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#1e40af' }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {doc.document_type === 'tax_invoice' ? '🧾 Tax Invoice' : '📋 E-way Bill'}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* ── PAN card (from order upload or party record) ── */}
                                    {order.pan_doc && (
                                        <div style={{ marginBottom: '10px' }}>
                                            <a
                                                href={`/orders/${order.id}/documents/${order.pan_doc.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#fef3f2', border: '1px solid #fecdca', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#b42318' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                🪪 PAN Card
                                            </a>
                                        </div>
                                    )}

                                    {/* ── Factory notes ── */}
                                    <div style={{ marginBottom: '14px' }}>
                                        {canAdvance ? (
                                            <>
                                                <textarea
                                                    value={notesValue}
                                                    onChange={(e) => setNotesDraft((d) => ({ ...d, [order.id]: e.target.value }))}
                                                    placeholder="Factory notes…"
                                                    rows={2}
                                                    style={{ width: '100%', resize: 'vertical' }}
                                                />
                                                {notesValue !== (order.factory_notes ?? '') && (
                                                    <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                                                        <button
                                                            type="button"
                                                            className="btn sm primary"
                                                            onClick={() => saveNotes(order)}
                                                            disabled={savingNotes === order.id}
                                                        >
                                                            {savingNotes === order.id ? 'Saving…' : '💾 Save notes'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn sm"
                                                            onClick={() => setNotesDraft((d) => ({ ...d, [order.id]: order.factory_notes ?? '' }))}
                                                            disabled={savingNotes === order.id}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            order.factory_notes && (
                                                <div style={{ fontSize: '13px', color: 'var(--tx-muted)', fontStyle: 'italic' }}>
                                                    🏭 {order.factory_notes}
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* ── Items table ── */}
                                    <div className="prod-wrap">
                                        <table className="prod-table">
                                            <thead>
                                                <tr>
                                                    <th>Product</th>
                                                    <th>Details</th>
                                                    <th>Stage Actions</th>
                                                    <th style={{ width: '150px' }}>Progress</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {order.items.map((item) => {
                                                    const isDispatched = item.status === 'dispatched';
                                                    const boxes = boxesFor(item, pcsPerBoxOverrides);
                                                    const total = Number(item.quantity);
                                                    const received = item.labels_received ?? null;
                                                    const short = received != null ? total - received : null;
                                                    const showLabels = received != null || item.status !== 'pending';
                                                    const log = [...(item.stage_log ?? [])].reverse();
                                                    const photo = getItemPhoto(item, order.party_id, photoMap);
                                                    const mrp = getItemMrp(item, order.party_id, photoMap);

                                                    return (
                                                        <tr key={item.id}>
                                                            {/* Product */}
                                                            <td>
                                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                                    {photo ? (
                                                                        <img
                                                                            src={photo}
                                                                            alt=""
                                                                            onClick={(e) => { e.stopPropagation(); setPhotoLightbox(photo); }}
                                                                            style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', padding: '2px', flexShrink: 0, cursor: 'zoom-in' }}
                                                                        />
                                                                    ) : (
                                                                        <div style={{ width: '48px', height: '48px', borderRadius: '6px', border: '1px dashed var(--border)', background: 'var(--bg-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: 'var(--tx-muted)', flexShrink: 0 }}>
                                                                            📷
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div className="prod-name">{item.our_brand ?? '—'}</div>
                                                                        {item.party_brand && <div className="prod-detail">{item.party_brand}</div>}
                                                                        {mrp && <div className="prod-detail">MRP: ₹{mrp}</div>}
                                                                        <span
                                                                            className={`badge ${isNewItem(item.status) ? 's-pending' : (STAGE_CLASS[item.status!] ?? 'gray')}`}
                                                                            style={{ marginTop: '4px', display: 'inline-block' }}
                                                                        >
                                                                            {isNewItem(item.status) ? 'Awaiting Acceptance' : (STAGE_LABELS[item.status!] ?? item.status)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Details */}
                                                            <td>
                                                                <div style={{ fontSize: '13px' }}>
                                                                    {item.packing_size ? `${item.packing_size} · ` : ''}Qty: {formatQty(item.quantity)}
                                                                </div>
                                                                {(item.shape || item.cap_color) && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '3px' }}>
                                                                        {item.shape && (
                                                                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tx-body)' }}>🫙 {item.shape}</span>
                                                                        )}
                                                                        {item.cap_color && (
                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 700, color: 'var(--tx-body)' }}>
                                                                                <span
                                                                                    style={{
                                                                                        width: '15px', height: '15px', borderRadius: '50%',
                                                                                        background: capColorHex(item.cap_color),
                                                                                        border: '1.5px solid rgba(0,0,0,0.25)', flexShrink: 0,
                                                                                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
                                                                                    }}
                                                                                    title={`Cap: ${item.cap_color}`}
                                                                                />
                                                                                {item.cap_color} cap
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {item.filled_qty != null && (
                                                                    <div style={{ fontSize: '12px', fontWeight: 600, color: Number(item.filled_qty) < Number(item.quantity) ? '#d97706' : '#16a34a' }}>
                                                                        🧪 Filled: {formatQty(item.filled_qty)} pcs
                                                                    </div>
                                                                )}
                                                                {item.labeled_qty != null && (
                                                                    <div style={{ fontSize: '12px', fontWeight: 600, color: Number(item.labeled_qty) < Number(item.filled_qty ?? item.quantity) ? '#d97706' : '#16a34a' }}>
                                                                        🏷 Labeled: {formatQty(item.labeled_qty)} pcs
                                                                    </div>
                                                                )}
                                                                {isDispatched && item.dispatched_qty != null && Number(item.dispatched_qty) !== Number(item.quantity) && (
                                                                    <div style={{ fontSize: '12px', fontWeight: 600, color: Number(item.dispatched_qty) < Number(item.quantity) ? '#dc2626' : '#d97706' }}>
                                                                        Dispatched: {Number(item.dispatched_qty)}
                                                                    </div>
                                                                )}
                                                                {/* Per-box/bag/carba pcs — auto from packing size, overridable */}
                                                                {(() => {
                                                                    const auto = stdPcsPerBox(item.packing_size, pcsPerBoxOverrides);
                                                                    const effective = pcsPerBox(item, pcsPerBoxOverrides);
                                                                    const unit = packUnitFor(item.packing_size, packUnitOverrides);
                                                                    const isOverridden = item.box_size != null;
                                                                    const draftVal = boxSizeDraft[item.id];
                                                                    const inputVal = draftVal ?? (item.box_size != null ? String(item.box_size) : '');
                                                                    return (
                                                                        <div className="prod-detail" style={{ marginTop: '4px' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                <span>📦</span>
                                                                                {/* Auto-derived value */}
                                                                                {auto != null && !isOverridden ? (
                                                                                    <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                                                                        {auto} pcs/{unit}
                                                                                    </span>
                                                                                ) : (
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        value={inputVal}
                                                                                        onChange={(e) => setBoxSizeDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                                                        onBlur={() => saveBoxSize(item.id)}
                                                                                        onKeyDown={(e) => e.key === 'Enter' && saveBoxSize(item.id)}
                                                                                        placeholder={`pcs/${unit}`}
                                                                                        disabled={savingBoxSize === item.id}
                                                                                        style={{
                                                                                            width: '60px', padding: '2px 4px', fontSize: '12px',
                                                                                            border: '1px solid var(--border)', borderRadius: '4px',
                                                                                            background: 'var(--bg-input, #fff)',
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                                {effective != null && boxes != null && (() => {
                                                                                    const autoBoxes = Math.ceil(Number(item.quantity) / effective);
                                                                                    const isCountOverridden = item.boxes_override != null;
                                                                                    return (
                                                                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--tx-muted)', fontWeight: 600 }}>
                                                                                            ·
                                                                                            <input
                                                                                                type="number"
                                                                                                min={1}
                                                                                                value={boxCountDraft[item.id] ?? String(boxes)}
                                                                                                onChange={(e) => setBoxCountDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                                                                onBlur={() => saveBoxCount(item.id, autoBoxes)}
                                                                                                onKeyDown={(e) => e.key === 'Enter' && saveBoxCount(item.id, autoBoxes)}
                                                                                                disabled={savingBoxCount === item.id}
                                                                                                style={{
                                                                                                    width: '52px', padding: '2px 4px', fontSize: '12px', fontWeight: 700,
                                                                                                    border: `1px solid ${isCountOverridden ? '#d97706' : 'var(--border)'}`,
                                                                                                    borderRadius: '4px', background: 'var(--bg-input, #fff)',
                                                                                                    color: isCountOverridden ? '#d97706' : 'inherit',
                                                                                                }}
                                                                                            />
                                                                                            {pluralizeUnit(unit, boxes)}
                                                                                            {isCountOverridden && (
                                                                                                <>
                                                                                                    <span style={{ color: '#d97706' }}>= {boxes * effective} pcs</span>
                                                                                                    <button
                                                                                                        type="button"
                                                                                                        title={`Reset to auto (${autoBoxes})`}
                                                                                                        onClick={() => {
                                                                                                            setSavingBoxCount(item.id);
                                                                                                            router.patch(`/factory/items/${item.id}`, { boxes_override: null }, { preserveScroll: true, onFinish: () => setSavingBoxCount(null) });
                                                                                                        }}
                                                                                                        disabled={savingBoxCount === item.id}
                                                                                                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', padding: 0, color: 'var(--tx-muted)' }}
                                                                                                    >
                                                                                                        ↺
                                                                                                    </button>
                                                                                                </>
                                                                                            )}
                                                                                        </span>
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                            {/* Show override input when auto value exists */}
                                                                            {auto != null && (
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                                    <span style={{ fontSize: '10px', color: 'var(--tx-faint)' }}>
                                                                                        {isOverridden ? 'override:' : 'override?'}
                                                                                    </span>
                                                                                    <input
                                                                                        type="number"
                                                                                        min={1}
                                                                                        value={inputVal}
                                                                                        onChange={(e) => setBoxSizeDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                                                        onBlur={() => saveBoxSize(item.id)}
                                                                                        onKeyDown={(e) => e.key === 'Enter' && saveBoxSize(item.id)}
                                                                                        placeholder="—"
                                                                                        disabled={savingBoxSize === item.id}
                                                                                        style={{
                                                                                            width: '48px', padding: '1px 4px', fontSize: '11px',
                                                                                            border: '1px dashed var(--border)', borderRadius: '4px',
                                                                                            background: 'transparent', color: 'var(--tx-muted)',
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                                {item.type && (
                                                                    <div className="prod-detail">{item.type}</div>
                                                                )}
                                                            </td>

                                                            {/* Stage actions */}
                                                            <td>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        {showLabels && (
                                                                            <span
                                                                                className={`badge ${short != null && short > 0 ? 'red' : received != null ? 'green' : 'gray'}`}
                                                                                style={{ cursor: canAdvance ? 'pointer' : 'default' }}
                                                                                onClick={canAdvance ? (e) => openLabelsModal(item, e) : undefined}
                                                                                title={canAdvance ? 'Record labels received at factory' : 'Labels received at factory'}
                                                                            >
                                                                                🏷 Labels: {received != null ? `${received}/${total}` : `—/${total}`}
                                                                                {short != null && short > 0 ? ` (${short} short)` : received != null ? ' ✓' : ''}
                                                                            </span>
                                                                        )}
                                                                        {!canAdvance && isDispatched && (
                                                                            <span style={{ fontSize: '12px', color: 'var(--tx-faint)' }}>✓ Completed</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Stage selector — factory user can pick any stage */}
                                                                    {canAdvance && (
                                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                            {STAGE_ORDER.map((stage) => {
                                                                                const isCurrent = item.status === stage ||
                                                                                    (isNewItem(item.status) && stage === 'accepted');
                                                                                const isActive = item.status === stage;
                                                                                return (
                                                                                    <button
                                                                                        key={stage}
                                                                                        type="button"
                                                                                        className={`badge ${isActive ? (STAGE_CLASS[stage] ?? 'gray') : (isCurrent && !item.status ? 's-pending' : 'gray')}`}
                                                                                        onClick={() => {
                                                                                            if (stage === 'filling' && !isActive) {
                                                                                                setFillingPrompt({ item, current: item.status ?? '' });
                                                                                                return;
                                                                                            }
                                                                                            setItemStage(item.id, stage, item.status ?? '');
                                                                                        }}
                                                                                        disabled={stagingItem === item.id || isActive}
                                                                                        title={isActive ? 'Current stage' : `Set to ${STAGE_LABELS[stage]}`}
                                                                                        style={{
                                                                                            cursor: isActive ? 'default' : 'pointer',
                                                                                            border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                                                                                            opacity: isActive ? 1 : 0.75,
                                                                                            fontWeight: isCurrent ? 700 : 500,
                                                                                        }}
                                                                                    >
                                                                                        {isActive ? '● ' : ''}
                                                                                        {STAGE_LABELS[stage]}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                            {stagingItem === item.id && <span style={{ fontSize: '12px', color: 'var(--tx-muted)' }}>…</span>}
                                                                        </div>
                                                                    )}

                                                                    {/* Clear "stage finished" action with a qty prompt */}
                                                                    {canAdvance && item.status === 'filling' && (
                                                                        <div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn sm"
                                                                                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff', fontWeight: 700 }}
                                                                                disabled={stagingItem === item.id}
                                                                                onClick={(e) => { e.stopPropagation(); openFillingDone(item); }}
                                                                                title="Mark filling as finished and record filled pcs"
                                                                            >
                                                                                ✓ Filling Done
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {canAdvance && item.status === 'filled' && (
                                                                        <div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn sm"
                                                                                style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff', fontWeight: 700 }}
                                                                                disabled={stagingItem === item.id}
                                                                                onClick={(e) => { e.stopPropagation(); setItemStage(item.id, 'labeling', item.status ?? ''); }}
                                                                                title="Start labeling for this item"
                                                                            >
                                                                                🏷 Start Labeling
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {canAdvance && item.status === 'labeling' && (
                                                                        <div>
                                                                            <button
                                                                                type="button"
                                                                                className="btn sm"
                                                                                style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff', fontWeight: 700 }}
                                                                                disabled={stagingItem === item.id}
                                                                                onClick={(e) => { e.stopPropagation(); openLabelingDone(item); }}
                                                                                title="Mark labeling as finished and record labeled pcs"
                                                                            >
                                                                                ✓ Labeling Done → Ready
                                                                            </button>
                                                                        </div>
                                                                    )}

                                                                    {/* Inline stage history */}
                                                                    {log.length > 0 && (
                                                                        <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {log.map((entry, idx) => (
                                                                                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                                                                    <span>{entry.revert ? '↩' : '▶'}</span>
                                                                                    <b>{STAGE_LABELS[entry.to] ?? entry.to}</b>
                                                                                    {entry.name && <span style={{ color: 'var(--tx-muted)' }}>— {entry.name}</span>}
                                                                                    <span style={{ color: 'var(--tx-faint)' }}>
                                                                                        · {formatTime(entry.at)} · {formatDay(entry.at)}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {canAdvance && (
                                                                        <div>
                                                                            <button
                                                                                className="btn sm"
                                                                                onClick={(e) => { e.stopPropagation(); openTransfer(order, item); }}
                                                                            >
                                                                                🔄 Transfer Unit
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Progress */}
                                                            <td>
                                                                <div className="progress-bar">
                                                                    <div className="progress-fill" style={{ width: `${itemProgress(item)}%`, background: 'var(--accent)' }} />
                                                                </div>
                                                                <div className="prod-detail" style={{ marginTop: '4px' }}>{STAGE_LABELS[item.status] ?? item.status}</div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Dispatch modal ── */}
            {dispatchModal && (() => {
                const readyItems = dispatchModal.items.filter((i) => i.status === 'ready');
                const saving = dispatchingOrder === dispatchModal.id;
                return (
                    <div className="modal-overlay open" onClick={() => !saving && setDispatchModal(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}>
                            <div className="modal-header">
                                <h2>📦 Dispatch — {dispatchModal.order_number}</h2>
                                <button className="modal-close" onClick={() => setDispatchModal(null)} disabled={saving}>✕</button>
                            </div>
                            <div className="modal-form" style={{ overflowY: 'auto' }}>
                                <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginBottom: '14px' }}>
                                    {dispatchModal.company_name} · Confirm the quantity being dispatched for each product.
                                </p>
                                {readyItems.map((item) => {
                                    const ordered = Number(item.quantity);
                                    const current = parseFloat(dispatchQtys[item.id]) || 0;
                                    return (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="prod-name" style={{ fontSize: '13px' }}>{item.our_brand ?? '—'}</div>
                                                <div className="prod-detail" style={{ fontSize: '12px' }}>
                                                    {item.party_brand ? `${item.party_brand} · ` : ''}
                                                    {item.packing_size ? `${item.packing_size} · ` : ''}
                                                    Ordered: {ordered}
                                                </div>
                                                {current !== ordered && (
                                                    <div style={{ fontSize: '11px', fontWeight: 600, color: current < ordered ? '#dc2626' : '#d97706', marginTop: '2px' }}>
                                                        {current < ordered ? `${ordered - current} short` : `${current - ordered} extra`}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    type="button"
                                                    className="btn sm"
                                                    onClick={() => stepDispatchQty(item.id, -1)}
                                                    disabled={saving || current <= 0}
                                                    style={{ width: '32px', padding: '4px 0', fontWeight: 700 }}
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={dispatchQtys[item.id] ?? ''}
                                                    onChange={(e) => setDispatchQtys((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                                    disabled={saving}
                                                    style={{ width: '76px', padding: '6px 8px', fontSize: '13px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-input, #fff)' }}
                                                />
                                                <button
                                                    type="button"
                                                    className="btn sm"
                                                    onClick={() => stepDispatchQty(item.id, 1)}
                                                    disabled={saving}
                                                    style={{ width: '32px', padding: '4px 0', fontWeight: 700 }}
                                                >
                                                    ＋
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setDispatchModal(null)} disabled={saving}>Cancel</button>
                                    <button type="button" className="btn-primary" onClick={submitDispatch} disabled={saving || readyItems.length === 0}>
                                        {saving ? 'Dispatching…' : `✓ Dispatch ${readyItems.length} item(s)`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Urgent approve / reject modal ── */}
            {urgentModal && (() => {
                const saving = approvingId === urgentModal.order.id || rejectingId === urgentModal.order.id;
                const isApprove = urgentModal.mode === 'approve';
                return (
                    <div className="modal-overlay open" onClick={() => !saving && setUrgentModal(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', width: '100%' }}>
                            <div className="modal-header">
                                <h2>{isApprove ? '✓ Approve Urgent' : '✕ Reject Urgent'} — {urgentModal.order.order_number}</h2>
                                <button className="modal-close" onClick={() => setUrgentModal(null)} disabled={saving}>✕</button>
                            </div>
                            <div className="modal-form">
                                <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginBottom: '14px' }}>
                                    {urgentModal.order.company_name} · {urgentModal.order.customer_name}
                                </p>
                                {isApprove ? (
                                    <div className="form-group">
                                        <label>Days to complete (shown to sales)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={365}
                                            value={urgentDays}
                                            onChange={(e) => setUrgentDays(e.target.value)}
                                            placeholder="e.g. 5"
                                            disabled={saving}
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label>Reason for rejection (shown to sales)</label>
                                        <textarea
                                            rows={3}
                                            maxLength={500}
                                            value={urgentReason}
                                            onChange={(e) => setUrgentReason(e.target.value)}
                                            placeholder="e.g. Material not available, production full…"
                                            disabled={saving}
                                            autoFocus
                                        />
                                    </div>
                                )}
                                <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setUrgentModal(null)} disabled={saving}>Cancel</button>
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        style={!isApprove ? { background: '#dc2626' } : undefined}
                                        onClick={submitUrgent}
                                        disabled={saving}
                                    >
                                        {saving ? 'Saving…' : isApprove ? '✓ Approve' : '✕ Reject'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Fill progress modal ── */}
            {labelsModal && (
                <div className="modal-overlay open" onClick={() => !labelsSaving && setLabelsModal(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px' }}>
                        <div className="modal-header">
                            <h2>🏷 Labels Received at Factory</h2>
                            <button className="modal-close" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>✕</button>
                        </div>
                        <div className="modal-form">
                            <p style={{ fontSize: '13px', color: 'var(--tx-muted)', marginBottom: '14px' }}>
                                {labelsModal.item.our_brand ?? '—'} · Total Qty: <strong>{labelsModal.item.quantity}</strong>
                            </p>
                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                <label>Labels Received</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={Number(labelsModal.item.quantity)}
                                    value={labelsValue}
                                    onChange={(e) => setLabelsValue(e.target.value)}
                                    autoFocus
                                    disabled={labelsSaving}
                                />
                                {labelsValue !== '' && parseInt(labelsValue, 10) < Number(labelsModal.item.quantity) && (
                                    <span style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', display: 'block' }}>
                                        {Number(labelsModal.item.quantity) - parseInt(labelsValue, 10)} short
                                    </span>
                                )}
                            </div>
                            <div className="modal-actions" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn-secondary" onClick={() => setLabelsModal(null)} disabled={labelsSaving}>Cancel</button>
                                <button type="button" className="btn-primary" onClick={submitLabels} disabled={labelsSaving || labelsValue === ''}>
                                    {labelsSaving ? 'Saving…' : '✓ Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Box Label Editor Modal ── */}
            {labelEditor && (
                <div
                    className="modal-overlay open"
                    onClick={() => setLabelEditor(null)}
                    style={{ zIndex: 9000 }}
                >
                    <div
                        className="modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 40px)' }}
                    >
                        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <h2 style={{ flex: 1, fontSize: '15px' }}>🏷 Box Labels — {labelEditor.order.order_number}</h2>
                            <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '7px 14px', fontSize: '13px' }}
                                onClick={downloadLabelsPDF}
                            >
                                ⬇ Download PDF
                            </button>
                            <button className="modal-close" onClick={() => setLabelEditor(null)}>✕</button>
                        </div>
                        {/* Parcel breakdown summary */}
                        <div style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700, color: '#1e293b', background: '#f8fafc', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                            📦 {labelEditor.unitSummary}
                        </div>
                        {/* Font size controls */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 16px', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600, marginRight: 2 }}>Font:</span>
                            {([
                                { key: 'transport', label: 'Transport' },
                                { key: 'party',     label: 'Party' },
                                { key: 'totalBoxes',label: 'Parcels' },
                                { key: 'boxNum',    label: 'Box#' },
                                { key: 'brand',     label: 'Product' },
                            ] as { key: keyof typeof labelFS; label: string }[]).map(({ key, label }) => (
                                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#f1f5f9', borderRadius: '5px', padding: '2px 5px' }}>
                                    <span style={{ fontSize: '10px', color: '#475569', minWidth: 48 }}>{label}</span>
                                    <button type="button" onClick={() => adjFS(key, -2)} style={{ width: 20, height: 20, border: '1px solid #cbd5e1', borderRadius: 3, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>−</button>
                                    <span style={{ fontSize: '11px', fontWeight: 700, minWidth: 26, textAlign: 'center' }}>{labelFS[key]}pt</span>
                                    <button type="button" onClick={() => adjFS(key, 2)} style={{ width: 20, height: 20, border: '1px solid #cbd5e1', borderRadius: 3, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>+</button>
                                </div>
                            ))}
                        </div>
                        {/* Scrollable labels — each card is exactly 100mm × 75mm */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                minHeight: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '16px',
                                background: '#e5e7eb',
                            }}
                        >
                            {labelEditor.labels.map((lbl, idx) => (
                                <div
                                    key={lbl.key}
                                    style={{
                                        width: '100mm',
                                        height: '75mm',
                                        border: '0.5px solid #000',
                                        background: '#fff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '2mm 3mm',
                                        fontFamily: 'Arial, sans-serif',
                                        boxSizing: 'border-box',
                                        flexShrink: 0,
                                        overflow: 'hidden',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                                        position: 'relative',
                                    }}
                                >
                                    {/* Transport | Box number badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2mm', borderBottom: '2px solid #000', paddingBottom: '1mm' }}>
                                        <textarea
                                            value={lbl.transport}
                                            onChange={(e) => updateLabelField(idx, 'transport', e.target.value)}
                                            placeholder="Transport name"
                                            rows={1}
                                            style={{
                                                border: 'none', outline: 'none',
                                                fontSize: `${labelFS.transport}pt`, fontWeight: 900, lineHeight: 1.1,
                                                padding: '0', flex: 1, background: 'transparent',
                                                fontFamily: 'Arial, sans-serif', resize: 'none',
                                                overflow: 'hidden',
                                            }}
                                        />
                                        <span
                                            style={{
                                                minWidth: '11mm', height: '11mm', padding: '0 2mm',
                                                background: '#000', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: `${labelFS.boxNum}pt`, fontWeight: 900,
                                                borderRadius: '1.5mm', flexShrink: 0,
                                            }}
                                        >
                                            {lbl.boxNum}
                                        </span>
                                    </div>
                                    {/* Destination */}
                                    <input
                                        value={lbl.destination}
                                        onChange={(e) => updateLabelField(idx, 'destination', e.target.value)}
                                        placeholder="Destination"
                                        style={{
                                            border: 'none', outline: 'none',
                                            fontSize: '8pt', color: '#333', marginTop: '1mm',
                                            textTransform: 'uppercase', letterSpacing: '0.5px',
                                            padding: '0', width: '100%', background: 'transparent',
                                            fontFamily: 'Arial, sans-serif',
                                        }}
                                    />
                                    {/* Party */}
                                    <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#777', letterSpacing: '1.5px', marginTop: '1mm' }}>DELIVER TO</div>
                                    <textarea
                                        value={lbl.party}
                                        onChange={(e) => updateLabelField(idx, 'party', e.target.value)}
                                        placeholder="Party name"
                                        rows={2}
                                        style={{
                                            border: 'none', outline: 'none',
                                            fontSize: `${labelFS.party}pt`, fontWeight: 700,
                                            padding: '0', width: '100%', background: 'transparent',
                                            fontFamily: 'Arial, sans-serif', resize: 'none',
                                            overflow: 'hidden', lineHeight: 1.2,
                                        }}
                                    />
                                    {/* Parcel summary — single line band, shrunk to fit the label width */}
                                    <div style={{ margin: '1mm 0 1.5mm', padding: '1mm 0', textAlign: 'center', background: '#000', borderRadius: '1.5mm', overflow: 'hidden' }}>
                                        <span
                                            ref={(el) => { totalBoxesRefs.current[idx] = el; }}
                                            style={{
                                                fontSize: `${labelFS.totalBoxes}pt`,
                                                fontWeight: 900, color: '#fff', lineHeight: 1.05, whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {labelEditor.unitSummary}
                                        </span>
                                    </div>
                                    {/* In-box pcs | product box/bag/carba */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1mm' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                                            <span style={{ fontSize: '8pt', color: '#555' }}>In-{lbl.unit}:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                value={lbl.inBoxPcs}
                                                onChange={(e) => updateLabelField(idx, 'inBoxPcs', e.target.value)}
                                                style={{
                                                    border: 'none', borderBottom: '1px dashed #bbb', outline: 'none',
                                                    fontSize: '9pt', fontWeight: 700, color: '#111',
                                                    width: '14mm', background: 'transparent', padding: '0',
                                                    fontFamily: 'Arial, sans-serif',
                                                }}
                                            />
                                            <span style={{ fontSize: '8pt', color: '#555' }}>pcs</span>
                                        </div>
                                    </div>
                                    {/* Brand / product + this item's box/bag/carba count */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2mm' }}>
                                        <textarea
                                            value={lbl.brand}
                                            onChange={(e) => updateLabelField(idx, 'brand', e.target.value)}
                                            placeholder="Brand · packing"
                                            rows={2}
                                            style={{
                                                border: 'none', outline: 'none',
                                                fontSize: `${labelFS.brand}pt`, fontWeight: 900, lineHeight: 1.15,
                                                padding: '0', width: '100%', background: 'transparent',
                                                resize: 'none', overflow: 'hidden',
                                                wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                                                fontFamily: 'Arial, sans-serif', flex: 1, minWidth: 0,
                                            }}
                                        />
                                        <span
                                            style={{
                                                fontSize: `${labelFS.brand}pt`, fontWeight: 900,
                                                whiteSpace: 'nowrap', flexShrink: 0,
                                                background: '#000', color: '#fff',
                                                padding: '0.5mm 2.5mm', borderRadius: '1.5mm',
                                            }}
                                        >
                                            {lbl.itemTotalBoxes} {pluralizeUnit(lbl.unit, lbl.itemTotalBoxes)}
                                        </span>
                                    </div>
                                    {/* Footer: unit tag | order ref */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', gap: '2mm' }}>
                                        <span
                                            style={{
                                                fontSize: '8pt', fontWeight: 900, border: '1.5px solid #000',
                                                padding: '0.5mm 2.5mm', letterSpacing: '1.5px', borderRadius: '1mm',
                                                flexShrink: 0,
                                            }}
                                        >
                                            {lbl.unit.toUpperCase()}
                                        </span>
                                        <input
                                            value={lbl.orderRef}
                                            onChange={(e) => updateLabelField(idx, 'orderRef', e.target.value)}
                                            placeholder="Order ref"
                                            style={{
                                                border: 'none', outline: 'none',
                                                fontSize: '7pt', color: '#999',
                                                padding: '0', flex: 1, background: 'transparent',
                                                textAlign: 'right', fontFamily: 'Arial, sans-serif',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filling choice prompt */}
            {fillingPrompt && (
                <div className="modal-overlay open" onClick={() => setFillingPrompt(null)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
                        <div className="modal-header">
                            <h2>🧪 Filling</h2>
                            <button className="modal-close" onClick={() => setFillingPrompt(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--tx-muted)' }}>
                                <strong>{fillingPrompt.item.our_brand ?? '—'}</strong>
                                {fillingPrompt.item.packing_size ? ` (${fillingPrompt.item.packing_size})` : ''}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <button
                                    type="button"
                                    className="btn"
                                    onClick={() => {
                                        setItemStage(fillingPrompt.item.id, 'filling', fillingPrompt.current);
                                        setFillingPrompt(null);
                                    }}
                                >
                                    ✅ Already Filled
                                </button>
                                <button
                                    type="button"
                                    className="btn primary"
                                    disabled={!canFill}
                                    title={!canFill ? 'You do not have access to the Filling page' : undefined}
                                    onClick={() => {
                                        if (!canFill) return;
                                        const params = new URLSearchParams({
                                            brand: fillingPrompt.item.our_brand ?? '',
                                            packing: fillingPrompt.item.packing_size ?? '',
                                        });
                                        setFillingPrompt(null);
                                        setItemStage(fillingPrompt.item.id, 'filling', fillingPrompt.current, () => {
                                            window.location.href = `/filling?${params.toString()}`;
                                        });
                                    }}
                                >
                                    🧪 Filling Now
                                </button>
                                {!canFill && (
                                    <span style={{ fontSize: 12, color: 'var(--tx-faint)' }}>
                                        "Filling Now" requires Filling access — ask admin to enable it for your account.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Done — record how many pcs were filled / labeled */}
            {stageQty && (() => {
                const taken = stageQty.taken;
                const current = parseFloat(stageQtyVal) || 0;
                const busy = stagingItem === stageQty.item.id;
                return (
                    <div className="modal-overlay open" onClick={() => !busy && setStageQty(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                            <div className="modal-header">
                                <h2>{stageQty.title}</h2>
                                <button className="modal-close" onClick={() => !busy && setStageQty(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--tx-muted)' }}>
                                    <strong>{stageQty.item.our_brand ?? '—'}</strong>
                                    {stageQty.item.packing_size ? ` (${stageQty.item.packing_size})` : ''}
                                    <div style={{ marginTop: 2 }}>{stageQty.takenLabel}: {formatQty(taken)} pcs</div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{stageQty.question}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn sm"
                                        onClick={() => stepStageQty(-1)}
                                        disabled={busy || current <= 0}
                                        style={{ width: '38px', padding: '6px 0', fontWeight: 700, fontSize: 16 }}
                                    >
                                        −
                                    </button>
                                    <input
                                        type="number"
                                        min={0}
                                        value={stageQtyVal}
                                        onChange={(e) => setStageQtyVal(e.target.value)}
                                        disabled={busy}
                                        style={{ flex: 1, padding: '8px 10px', fontSize: '15px', textAlign: 'center', fontWeight: 700, border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--bg-input, #fff)' }}
                                    />
                                    <button
                                        type="button"
                                        className="btn sm"
                                        onClick={() => stepStageQty(1)}
                                        disabled={busy}
                                        style={{ width: '38px', padding: '6px 0', fontWeight: 700, fontSize: 16 }}
                                    >
                                        ＋
                                    </button>
                                </div>
                                {current !== taken && (
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: current < taken ? '#dc2626' : '#d97706', marginTop: '6px' }}>
                                        {current < taken
                                            ? `${formatQty(taken - current)} pcs બાકી — એ ${STAGE_LABELS[stageQty.item.status] ?? stageQty.item.status} માં pending રહેશे (નવી row).`
                                            : `${formatQty(current - taken)} more than ${stageQty.takenLabel.toLowerCase()}`}
                                    </div>
                                )}
                                <div className="modal-actions" style={{ justifyContent: 'flex-end', marginTop: '16px' }}>
                                    <button type="button" className="btn-secondary" onClick={() => setStageQty(null)} disabled={busy}>Cancel</button>
                                    <button type="button" className="btn-primary" onClick={submitStageQty} disabled={busy}>
                                        {busy ? 'Saving…' : stageQty.doneLabel}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

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

            {/* Unit Transfer Modal */}
            {transferModal && (() => {
                const { order, item } = transferModal;
                const productName = [item.our_brand, item.packing_size].filter(Boolean).join(' ') || '—';
                return (
                    <div className="modal-overlay open" onClick={() => setTransferModal(null)}>
                        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                            <div className="modal-header">
                                <h2>🔄 Transfer Unit</h2>
                                <button className="modal-close" onClick={() => setTransferModal(null)}>✕</button>
                            </div>
                            <div className="modal-body">
                                {/* Auto-filled product info */}
                                <div style={{ background: 'var(--bg-paper)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                        <span><span style={{ color: 'var(--tx-muted)' }}>Order: </span><strong>{order.order_number}</strong></span>
                                        <span><span style={{ color: 'var(--tx-muted)' }}>Party: </span><strong>{order.company_name}</strong></span>
                                    </div>
                                    <div style={{ marginTop: 4 }}>
                                        <span style={{ color: 'var(--tx-muted)' }}>Product: </span><strong>{productName}</strong>
                                    </div>
                                </div>

                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>From Godown *</label>
                                        <select value={transferForm.from_unit} onChange={(e) => setTransferForm((f) => ({ ...f, from_unit: e.target.value }))}>
                                            <option value="">— Select —</option>
                                            {godowns.map((g) => (
                                                <option key={g.id} value={g.name}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>To Godown *</label>
                                        <select value={transferForm.to_unit} onChange={(e) => setTransferForm((f) => ({ ...f, to_unit: e.target.value }))}>
                                            <option value="">— Select —</option>
                                            {godowns.map((g) => (
                                                <option key={g.id} value={g.name}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Qty *</label>
                                        <input
                                            type="number"
                                            min="0.001"
                                            step="any"
                                            value={transferForm.quantity}
                                            onChange={(e) => setTransferForm((f) => ({ ...f, quantity: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Unit *</label>
                                        <select value={transferForm.unit} onChange={(e) => setTransferForm((f) => ({ ...f, unit: e.target.value }))}>
                                            {['pcs', 'kg', 'g', 'L', 'ml', 'bags', 'drums'].map((u) => <option key={u}>{u}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                                        <label>Notes</label>
                                        <textarea
                                            rows={2}
                                            value={transferForm.notes}
                                            onChange={(e) => setTransferForm((f) => ({ ...f, notes: e.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn" onClick={() => setTransferModal(null)}>Cancel</button>
                                <button
                                    className="btn primary"
                                    disabled={transferSaving || !transferForm.from_unit || !transferForm.to_unit || !transferForm.quantity}
                                    onClick={submitTransfer}
                                >
                                    {transferSaving ? 'Saving…' : '🔄 Create Transfer'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
