import {
    store as matStore,
    transactions as matTransaction,
    update as matUpdate,
} from '@/routes/inventory/materials';
import type { Auth } from '@/types/auth';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type RawMaterial = {
    id: number;
    name: string;
    sku: string | null;
    hsn: string | null;
    gst: string | number;
    category: string | null;
    group_name: string | null;
    shape: string | null;
    unit: string;
    stock_qty: string | number;
    min_stock: string | number;
    reorder_level: string | number;
    cost_per_unit: string | number;
    selling_rate: string | number;
    dim_l: string | number | null;
    dim_w: string | number | null;
    dim_h: string | number | null;
    supplier: string | null;
    notes: string | null;
    is_active: boolean;
    transactions_count?: number;
};

type Transaction = {
    id: number;
    raw_material_id: number;
    type: 'purchase' | 'issue' | 'adjustment' | 'return';
    qty: string | number;
    previous_stock: string | number | null;
    new_stock: string | number | null;
    cost_per_unit: string | number | null;
    reference: string | null;
    notes: string | null;
    created_at: string;
    raw_material: { id: number; name: string; unit: string } | null;
    user: { id: number; name: string } | null;
};

type PurchaseBillItem = {
    id: number;
    material_name: string;
    sku: string | null;
    category: string | null;
    hsn: string | null;
    qty: string | number;
    unit: string;
    rate: string | number;
    gst: string | number;
    amount: string | number;
};

type PurchaseBill = {
    id: number;
    vendor_name: string;
    bill_number: string | null;
    bill_date: string | null;
    total_amount: string | number;
    freight_charges: string | number;
    round_off: string | number;
    bill_file: string | null;
    bill_name: string | null;
    add_to_stock: boolean;
    created_at: string;
    items: PurchaseBillItem[];
    user: { id: number; name: string } | null;
};

type Vendor = {
    id: number;
    name: string;
    gst_no: string | null;
};

type MatSearchResult = {
    id: number;
    name: string;
    sku: string | null;
    hsn: string | null;
    gst: string | number;
    category: string | null;
    unit: string;
    cost_per_unit: string | number;
};

type Reorder = {
    id: number;
    raw_material_id: number;
    qty_ordered: string | number;
    unit: string;
    supplier: string | null;
    order_date: string;
    expected_delivery: string | null;
    transport_name: string | null;
    lr_number: string | null;
    notes: string | null;
    status: 'pending' | 'received';
    received_at: string | null;
    billed_at: string | null;
    received_by_user: { id: number; name: string } | null;
    raw_material: { id: number; name: string } | null;
};

type Stats = {
    totalMaterials: number;
    lowStock: number;
    outOfStock: number;
    totalStockValue: number;
};

type InventoryCategory = {
    id: number;
    name: string;
    color: string | null;
};

type GodownStock = {
    id: number;
    godown_id: number;
    raw_material_id: number;
    stock_qty: string | number;
    raw_material?: { id: number; name: string; unit: string; category: string | null } | null;
};

type Godown = {
    id: number;
    name: string;
    location: string | null;
    notes: string | null;
    is_active: boolean;
    stocks: GodownStock[];
};

type FinishGoodGroup = { name: string; count: number };

type Props = {
    materials: RawMaterial[];
    recentTransactions: Transaction[];
    purchaseBills: PurchaseBill[];
    reorders: Reorder[];
    stats: Stats;
    vendors: Vendor[];
    inventoryCategories: InventoryCategory[];
    bomOutputMap: Record<string, string[]>;
    fillingOutputMap: Record<string, string[]>;
    godowns: Godown[];
    finishGoodGroups: FinishGoodGroup[];
};

// ── Route constants ───────────────────────────────────────────────────────────

const ROUTES = {
    destroyMaterial: (id: number) => `/inventory/materials/${id}`,
    storePurchaseBill: '/inventory/purchase-bills',
    destroyPurchaseBill: (id: number) => `/inventory/purchase-bills/${id}`,
    storeReorder: '/inventory/reorders',
    receiveReorder: (id: number) => `/inventory/reorders/${id}/receive`,
    destroyReorder: (id: number) => `/inventory/reorders/${id}`,
    storeCategory: '/inventory/categories',
    storeGodown: '/inventory/godowns',
    updateGodown: (id: number) => `/inventory/godowns/${id}`,
    destroyGodown: (id: number) => `/inventory/godowns/${id}`,
    updateCategory: (id: number) => `/inventory/categories/${id}`,
    destroyCategory: (id: number) => `/inventory/categories/${id}`,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'bags', 'drums', 'bottles'];
const GST_OPTIONS = ['0', '5', '12', '18', '28'];

const PACKAGING_CATEGORIES = [
    { label: 'Bottle', icon: '🫙', code: 'BOT', unit: 'pcs' },
    { label: 'Box/Carton', icon: '📦', code: 'BOX', unit: 'pcs' },
    { label: 'Printed Box', icon: '🖨️', code: 'PBOX', unit: 'pcs' },
    { label: 'Label', icon: '🏷️', code: 'LBL', unit: 'pcs' },
    { label: 'Drum', icon: '🥁', code: 'DRM', unit: 'pcs' },
    { label: 'Pouch', icon: '👝', code: 'PCH', unit: 'pcs' },
    { label: 'Jar', icon: '🫙', code: 'JAR', unit: 'pcs' },
    { label: 'Cap/Closure', icon: '🔩', code: 'CAP', unit: 'pcs' },
];

type WizardCategory = { label: string; icon: string; code: string; unit: string; color?: string };

const SHAPE_ABBR: Record<string, string> = {
    round: 'RND',
    square: 'SQ',
    flat: 'FLT',
    oval: 'OVL',
    rectangular: 'RECT',
};

// ── Helper functions ──────────────────────────────────────────────────────────

function stockStatus(m: RawMaterial): 'out' | 'low' | 'reorder' | 'good' {
    const qty = Number(m.stock_qty);
    const min = Number(m.min_stock);
    const reorder = Number(m.reorder_level);
    if (qty <= 0) return 'out';
    if (min > 0 && qty <= min) return 'low';
    if (reorder > 0 && qty <= reorder) return 'reorder';
    return 'good';
}

const fmt = (v: string | number, decimals = 3) =>
    Number(v).toLocaleString('en-IN', { maximumFractionDigits: decimals });

const fmtAmt = (v: string | number | null | undefined) =>
    (v == null || v === '') ? '—' : '₹' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function normalizeSize(s: string): string {
    return s.toUpperCase().replace(/\s+/g, '');
}

function abbrevShape(s: string): string {
    const key = s.toLowerCase().trim();
    if (SHAPE_ABBR[key]) return SHAPE_ABBR[key];
    return s.slice(0, 3).toUpperCase();
}

function buildSku(catCode: string, size: string, shape: string): string {
    const parts = ['PKG', catCode];
    if (size) parts.push(normalizeSize(size));
    if (shape) parts.push(abbrevShape(shape));
    return parts.join('-');
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InventoryIndex({ materials, recentTransactions, purchaseBills, reorders, stats, vendors, inventoryCategories, bomOutputMap, fillingOutputMap, godowns, finishGoodGroups }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const role = auth.user?.role ?? auth.user?.roles?.[0]?.slug ?? '';
    const canSeeCost      = role === 'admin' || auth.user?.cost_access === true;
    const canSeeTotalValue = role === 'accountant' || canSeeCost;
    const canMarkReceived  = role === 'admin' || role === 'factory';
    const canManageStock   = role === 'admin' || role === 'factory';
    const canEditMaterial  = role === 'admin' || role === 'factory' || role === 'accountant';
    const canEnterBill    = role === 'admin' || role === 'factory' || role === 'accountant';
    const isSales         = !['admin', 'factory', 'accountant'].includes(role);

    // Tab
    const [tab, setTab] = useState<'materials' | 'log' | 'bills' | 'reorders' | 'categories' | 'godowns'>('materials');

    // Category management
    const [catMgmtModal, setCatMgmtModal] = useState(false);
    const [editingCat, setEditingCat] = useState<InventoryCategory | null>(null);
    const [catForm, setCatForm] = useState({ name: '', color: '' });
    const [catSaving, setCatSaving] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');
    const [catFilter, setCatFilter] = useState<string>('all');

    // Group name combobox
    const [groupNameOpen, setGroupNameOpen] = useState(false);
    const groupNameRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (groupNameRef.current && !groupNameRef.current.contains(e.target as Node)) {
                setGroupNameOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Finish-good grouped view
    const [collapsedFinishGroups, setCollapsedFinishGroups] = useState<Set<string>>(new Set());
    const toggleFinishGroup = (key: string) => {
        setCollapsedFinishGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Modal states
    const [matModal, setMatModal] = useState(false);
    const [txnModal, setTxnModal] = useState(false);
    const [billModal, setBillModal] = useState(false);
    const [reorderModal, setReorderModal] = useState(false);
    const [packModal, setPackModal] = useState(false);
    const [scanModal, setScanModal] = useState(false);
    const [godownModal, setGodownModal] = useState(false);
    const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
    const [godownForm, setGodownForm] = useState({ name: '', location: '', notes: '' });
    const [godownCatFilter, setGodownCatFilter] = useState<string>('all');
    const [selectedGodown, setSelectedGodown] = useState<Godown | null>(null);

    // Modal targets
    const [editingMat, setEditingMat] = useState<RawMaterial | null>(null);
    const [txnTarget, setTxnTarget] = useState<RawMaterial | null>(null);
    const [expandedBill, setExpandedBill] = useState<number | null>(null);
    const [viewReorder, setViewReorder] = useState<Reorder | null>(null);

    // Bill-pending → enter purchase bill for a received reorder
    const [billReorder, setBillReorder] = useState<Reorder | null>(null);
    const [billReorderForm, setBillReorderForm] = useState({ vendor_name: '', bill_number: '', bill_date: '', rate: '', total_amount: '' });
    const [billReorderFile, setBillReorderFile] = useState<File | null>(null);
    const [billReorderProcessing, setBillReorderProcessing] = useState(false);

    const openBillReorder = (r: Reorder) => {
        setBillReorderForm({ vendor_name: r.supplier ?? '', bill_number: '', bill_date: '', rate: '', total_amount: '' });
        setBillReorderFile(null);
        setBillReorder(r);
    };

    const submitBillReorder = (e: React.FormEvent) => {
        e.preventDefault();
        if (!billReorder) return;
        const fd = new FormData();
        fd.append('vendor_name', billReorderForm.vendor_name);
        if (billReorderForm.bill_number) fd.append('bill_number', billReorderForm.bill_number);
        if (billReorderForm.bill_date) fd.append('bill_date', billReorderForm.bill_date);
        if (billReorderForm.rate) fd.append('rate', billReorderForm.rate);
        if (billReorderForm.total_amount) fd.append('total_amount', billReorderForm.total_amount);
        if (billReorderFile) fd.append('bill_file', billReorderFile);
        setBillReorderProcessing(true);
        router.post(`/inventory/reorders/${billReorder.id}/receive-with-bill`, fd, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => setBillReorder(null),
            onFinish: () => setBillReorderProcessing(false),
        });
    };

    // Selling rate mode for material form and packing form
    const [matSellMode, setMatSellMode]   = useState<'manual' | 'profit'>('manual');
    const [matProfitPct, setMatProfitPct] = useState('');
    const [pkgSellMode, setPkgSellMode]   = useState<'manual' | 'profit'>('manual');
    const [pkgProfitPct, setPkgProfitPct] = useState('');

    // Packaging wizard
    const [packStep, setPackStep] = useState(1);
    const [packCat, setPackCat] = useState<WizardCategory | null>(null);
    const [packForm, setPackForm] = useState({
        size: '',
        shape: '',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        hsn: '',
        gst: '18',
        sku: '',
        unit: 'pcs',
        supplier: '',
        stock: '0',
        cost_per_unit: '',
        selling_rate: '',
        notes: '',
    });

    // Bill form (local state for dynamic rows)
    const [billForm, setBillForm] = useState({
        party_id: '',
        vendor_name: '',
        bill_number: '',
        bill_date: '',
        freight_charges: '0',
        round_off: '0',
        add_to_stock: true,
        godown_id: '',
    });
    const [billFile, setBillFile] = useState<File | null>(null);
    const [billRows, setBillRows] = useState<
        { raw_material_id: string; material_name: string; matSearch: string; sku: string; category: string; hsn: string; qty: string; unit: string; rate: string; gst: string; amount: string }[]
    >([]);
    const [billProcessing, setBillProcessing] = useState(false);
    const [billMatDropdown, setBillMatDropdown] = useState<number | null>(null);
    const [billVendorSearch, setBillVendorSearch] = useState('');
    const [billVendorOpen, setBillVendorOpen] = useState(false);

    // Server-side material search (for the open bill row)
    const [matResults, setMatResults] = useState<MatSearchResult[]>([]);
    const [matSearching, setMatSearching] = useState(false);
    const matSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [matDropdownRect, setMatDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const matInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const matSearchSeq = useRef(0);

    const runMaterialSearch = (q: string) => {
        if (matSearchTimer.current) clearTimeout(matSearchTimer.current);
        const query = q.trim();
        if (query.length < 1) {
            setMatResults([]);
            setMatSearching(false);
            return;
        }
        setMatSearching(true);
        const seq = ++matSearchSeq.current;
        matSearchTimer.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/inventory/search?q=${encodeURIComponent(query)}`, {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });
                if (res.ok && seq === matSearchSeq.current) {
                    setMatResults(await res.json());
                }
            } catch {
                if (seq === matSearchSeq.current) setMatResults([]);
            } finally {
                if (seq === matSearchSeq.current) setMatSearching(false);
            }
        }, 250);
    };

    // Add Supplier mini-modal
    const [addSupplierModal, setAddSupplierModal] = useState(false);
    const [addSupplierForm, setAddSupplierForm] = useState({ name: '', phone: '', gst_no: '', type: 'supplier' });
    const [addSupplierProcessing, setAddSupplierProcessing] = useState(false);
    const pendingSupplierName = useRef<string | null>(null);

    // Auto-select newly created supplier once vendors list refreshes
    useEffect(() => {
        if (!pendingSupplierName.current) return;
        const match = vendors.find((v) => v.name === pendingSupplierName.current);
        if (match) {
            setBillForm((p) => ({ ...p, party_id: String(match.id), vendor_name: match.name }));
            setBillVendorSearch(match.name);
            pendingSupplierName.current = null;
        }
    }, [vendors]);

    // Material form
    const matForm = useForm({
        name: '',
        sku: '',
        hsn: '',
        gst: '18',
        unit: 'kg',
        category: '',
        group_name: '',
        shape: '',
        min_stock: '0',
        reorder_level: '0',
        cost_per_unit: '0',
        selling_rate: '0',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        supplier: '',
        notes: '',
        is_active: true,
    });

    // Transaction form
    const txnForm = useForm({
        type: 'purchase',
        qty: '',
        godown_id: '',
        cost_per_unit: '',
        reference: '',
        notes: '',
    });

    // Reorder form
    const reorderForm = useForm({
        raw_material_id: '',
        qty_ordered: '',
        unit: '',
        supplier: '',
        order_date: new Date().toISOString().slice(0, 10),
        expected_delivery: '',
        transport_name: '',
        lr_number: '',
        notes: '',
    });

    // Packaging form (useForm for submission)
    const packSubmitForm = useForm({
        name: '',
        sku: '',
        hsn: '',
        gst: '18',
        unit: 'pcs',
        category: '',
        min_stock: '0',
        reorder_level: '0',
        cost_per_unit: '0',
        selling_rate: '0',
        dim_l: '',
        dim_w: '',
        dim_h: '',
        supplier: '',
        notes: '',
        stock_qty: '0',
        is_active: true,
    });

    // ── Derived data ──────────────────────────────────────────────────────────

    const categories = inventoryCategories.map((c) => c.name);

    const packingHardcodedLabels = new Set(PACKAGING_CATEGORIES.map((c) => c.label.toLowerCase()));
    const wizardCategories: WizardCategory[] = [
        ...PACKAGING_CATEGORIES,
        ...inventoryCategories
            .filter((c) => !packingHardcodedLabels.has(c.name.toLowerCase()))
            .map((c) => ({
                label: c.name,
                icon: '📁',
                code: c.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase(),
                unit: 'pcs',
                color: c.color ?? undefined,
            })),
    ];

    const isFinishGoodCat = catFilter !== 'all' &&
        catFilter.toLowerCase().includes('finish') &&
        catFilter.toLowerCase().includes('good') &&
        !catFilter.toLowerCase().includes('semi');

    const filteredMaterials = materials.filter((m) => {
        const s = stockStatus(m);
        if (statusFilter === 'low' && s !== 'low') return false;
        if (statusFilter === 'out' && s !== 'out') return false;
        if (catFilter !== 'all' && m.category !== catFilter) return false;
        if (search.trim()) {
            const q = search.toLowerCase();
            if (
                !m.name.toLowerCase().includes(q) &&
                !(m.sku ?? '').toLowerCase().includes(q) &&
                !(m.category ?? '').toLowerCase().includes(q)
            )
                return false;
        }
        return true;
    });

    const alertMaterials = materials.filter((m) => {
        const s = stockStatus(m);
        if (s !== 'low' && s !== 'out' && s !== 'reorder') return false;
        return !reorders.some((r) => r.raw_material_id === m.id && (r.status === 'pending' || (r.status === 'received' && !r.billed_at)));
    });

    const pendingReorders = reorders.filter((r) => r.status === 'pending');
    const billPendingReorders = reorders.filter((r) => r.status === 'received' && !r.billed_at);

    const isDuplicateBillNumber =
        billForm.bill_number.trim() !== '' &&
        purchaseBills.some((b) => b.bill_number === billForm.bill_number.trim());

    // ── Handlers ──────────────────────────────────────────────────────────────

    const openNewCat = () => {
        setEditingCat(null);
        setCatForm({ name: '', color: '' });
        setCatMgmtModal(true);
    };

    const openEditCat = (cat: InventoryCategory) => {
        setEditingCat(cat);
        setCatForm({ name: cat.name, color: cat.color ?? '' });
        setCatMgmtModal(true);
    };

    const submitCat = () => {
        if (!catForm.name.trim()) return;
        setCatSaving(true);
        if (editingCat) {
            router.patch(ROUTES.updateCategory(editingCat.id), catForm, {
                onFinish: () => { setCatSaving(false); setCatMgmtModal(false); },
            });
        } else {
            router.post(ROUTES.storeCategory, catForm, {
                onFinish: () => { setCatSaving(false); setCatMgmtModal(false); },
            });
        }
    };

    const destroyCat = (cat: InventoryCategory) => {
        if (!confirm(`Delete category "${cat.name}"? Materials in this category will keep the name but the category list will no longer include it.`)) return;
        router.delete(ROUTES.destroyCategory(cat.id));
    };

    const openNewMat = () => {
        matForm.reset();
        matForm.clearErrors();
        setEditingMat(null);
        setMatSellMode('manual');
        setMatProfitPct('');
        setMatModal(true);
    };

    const openEditMat = (m: RawMaterial) => {
        matForm.setData({
            name: m.name,
            sku: m.sku ?? '',
            hsn: m.hsn ?? '',
            gst: String(m.gst),
            unit: m.unit,
            category: m.category ?? '',
            group_name: m.group_name ?? '',
            shape: m.shape ?? '',
            min_stock: String(m.min_stock),
            reorder_level: String(m.reorder_level),
            cost_per_unit: String(m.cost_per_unit),
            selling_rate: String(m.selling_rate),
            dim_l: m.dim_l != null ? String(m.dim_l) : '',
            dim_w: m.dim_w != null ? String(m.dim_w) : '',
            dim_h: m.dim_h != null ? String(m.dim_h) : '',
            supplier: m.supplier ?? '',
            notes: m.notes ?? '',
            is_active: m.is_active,
        });
        matForm.clearErrors();
        setEditingMat(m);
        setMatModal(true);
    };

    const submitMat = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingMat) {
            matForm.patch(matUpdate(editingMat.id).url, {
                preserveScroll: true,
                onSuccess: () => { setMatModal(false); setEditingMat(null); matForm.reset(); },
            });
        } else {
            matForm.post(matStore().url, {
                preserveScroll: true,
                onSuccess: () => { setMatModal(false); matForm.reset(); },
            });
        }
    };

    const deleteMaterial = (id: number) => {
        if (!confirm('Delete this material? This cannot be undone.')) return;
        router.delete(ROUTES.destroyMaterial(id), { preserveScroll: true });
    };

    const openTxn = (m: RawMaterial) => {
        txnForm.reset();
        txnForm.clearErrors();
        setTxnTarget(m);
        setTxnModal(true);
    };

    const submitTxn = (e: React.FormEvent) => {
        e.preventDefault();
        if (!txnTarget) return;
        txnForm.post(matTransaction(txnTarget.id).url, {
            preserveScroll: true,
            onSuccess: () => setTxnModal(false),
        });
    };

    const computedNewStock = (() => {
        if (!txnTarget) return null;
        const current = Number(txnTarget.stock_qty);
        const qty = Number(txnForm.data.qty) || 0;
        if (!qty) return null;
        switch (txnForm.data.type) {
            case 'purchase':
            case 'return':
                return current + qty;
            case 'issue':
                return current - qty;
            case 'adjustment':
                return qty;
            default:
                return null;
        }
    })();

    const addBillRow = () => {
        setBillRows((prev) => [
            ...prev,
            { raw_material_id: '', material_name: '', matSearch: '', sku: '', category: '', hsn: '', qty: '', unit: 'pcs', rate: '', gst: '18', amount: '' },
        ]);
    };

    const selectBillRowMaterial = (i: number, mat: MatSearchResult) => {
        setBillRows((prev) => {
            const rows = [...prev];
            const rate = mat.cost_per_unit && Number(mat.cost_per_unit) > 0 ? String(Number(mat.cost_per_unit)) : rows[i].rate;
            const gst = mat.gst ? String(Number(mat.gst)) : rows[i].gst;
            const qty = Number(rows[i].qty) || 0;
            const rateNum = Number(rate) || 0;
            const gstNum = Number(gst) || 0;
            const base = qty * rateNum;
            const amount = base > 0 ? (base + (base * gstNum) / 100).toFixed(2) : '';
            rows[i] = {
                ...rows[i],
                raw_material_id: String(mat.id),
                material_name: mat.name,
                matSearch: mat.name,
                sku: mat.sku ?? '',
                category: mat.category ?? '',
                hsn: mat.hsn ?? '',
                unit: mat.unit,
                gst,
                rate,
                amount,
            };
            return rows;
        });
        setBillMatDropdown(null);
    };

    const updateBillRow = (i: number, key: string, val: string) => {
        setBillRows((prev) => {
            const rows = [...prev];
            rows[i] = { ...rows[i], [key]: val };
            if (key === 'matSearch') {
                rows[i].material_name = val;
                rows[i].raw_material_id = '';
            }
            if (key === 'qty' || key === 'rate' || key === 'gst') {
                const qty = Number(key === 'qty' ? val : rows[i].qty) || 0;
                const rate = Number(key === 'rate' ? val : rows[i].rate) || 0;
                const gst = Number(key === 'gst' ? val : rows[i].gst) || 0;
                const base = qty * rate;
                rows[i].amount = (base + (base * gst) / 100).toFixed(2);
            }
            return rows;
        });
    };

    const removeBillRow = (i: number) => {
        setBillRows((prev) => prev.filter((_, idx) => idx !== i));
    };

    const billSubtotal = billRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const billFreight = Number(billForm.freight_charges) || 0;
    const billRoundOff = Number(billForm.round_off) || 0;
    const billTotal = billSubtotal + billFreight + billRoundOff;

    const autoRoundOff = (subtotal: number, freight: number) => {
        const raw = subtotal + freight;
        const rounded = Math.round(raw);
        return (rounded - raw).toFixed(2);
    };

    const resetBillForm = () => {
        setBillForm({ party_id: '', vendor_name: '', bill_number: '', bill_date: '', freight_charges: '0', round_off: '0', add_to_stock: true, godown_id: '' });
        setBillFile(null);
        setBillRows([]);
        setBillMatDropdown(null);
        setBillVendorSearch('');
        setBillVendorOpen(false);
    };

    const submitAddSupplier = () => {
        if (!addSupplierForm.name.trim()) return;
        setAddSupplierProcessing(true);
        pendingSupplierName.current = addSupplierForm.name.trim();
        router.post('/parties', addSupplierForm, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setAddSupplierModal(false);
                setAddSupplierForm({ name: '', phone: '', gst_no: '', type: 'supplier' });
                setAddSupplierProcessing(false);
            },
            onError: () => {
                pendingSupplierName.current = null;
                setAddSupplierProcessing(false);
            },
        });
    };

    const submitBill = () => {
        const fd = new FormData();
        if (billForm.party_id) fd.append('party_id', billForm.party_id);
        fd.append('vendor_name', billForm.vendor_name || vendors.find((v) => String(v.id) === billForm.party_id)?.name || '');
        fd.append('bill_number', billForm.bill_number);
        fd.append('bill_date', billForm.bill_date);
        fd.append('freight_charges', billForm.freight_charges || '0');
        fd.append('round_off', billForm.round_off || '0');
        fd.append('add_to_stock', billForm.add_to_stock ? '1' : '0');
        if (billForm.godown_id) fd.append('godown_id', billForm.godown_id);
        fd.append('total_amount', String(billTotal));
        if (billFile) fd.append('bill_file', billFile);
        billRows.forEach((row, i) => {
            const { raw_material_id, matSearch: _ms, ...rest } = row;
            if (raw_material_id) fd.append(`items[${i}][raw_material_id]`, raw_material_id);
            Object.entries(rest).forEach(([k, v]) => fd.append(`items[${i}][${k}]`, String(v)));
        });
        setBillProcessing(true);
        router.post(ROUTES.storePurchaseBill, fd, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setBillModal(false);
                resetBillForm();
                setBillProcessing(false);
            },
            onError: () => setBillProcessing(false),
        });
    };

    const deleteBill = (id: number) => {
        if (!confirm('Delete this purchase bill?')) return;
        router.delete(ROUTES.destroyPurchaseBill(id), { preserveScroll: true });
    };

    const submitReorder = (e: React.FormEvent) => {
        e.preventDefault();
        reorderForm.post(ROUTES.storeReorder, {
            preserveScroll: true,
            onSuccess: () => setReorderModal(false),
        });
    };

    const receiveReorder = (id: number) => {
        router.post(ROUTES.receiveReorder(id), {}, { preserveScroll: true });
    };

    const deleteReorder = (id: number) => {
        if (!confirm('Delete this reorder?')) return;
        router.delete(ROUTES.destroyReorder(id), { preserveScroll: true });
    };

    const openReorderModal = () => {
        reorderForm.reset();
        reorderForm.clearErrors();
        reorderForm.setData('order_date', new Date().toISOString().slice(0, 10));
        setReorderModal(true);
    };

    const openOrderPlaced = (m: RawMaterial) => {
        reorderForm.reset();
        reorderForm.clearErrors();
        reorderForm.setData({
            raw_material_id: String(m.id),
            qty_ordered: '',
            unit: m.unit,
            supplier: '',
            order_date: new Date().toISOString().slice(0, 10),
            expected_delivery: '',
            transport_name: '',
            lr_number: '',
            notes: '',
        });
        setReorderModal(true);
    };

    const handleReorderMaterialChange = (id: string) => {
        reorderForm.setData('raw_material_id', id);
        const mat = materials.find((m) => String(m.id) === id);
        if (mat) reorderForm.setData('unit', mat.unit);
    };

    // Packaging wizard helpers
    const openPackModal = () => {
        setPackStep(1);
        setPackCat(null);
        setPackForm({ size: '', shape: '', dim_l: '', dim_w: '', dim_h: '', hsn: '', gst: '18', sku: '', unit: 'pcs', supplier: '', stock: '0', cost_per_unit: '', selling_rate: '', notes: '' });
        setPkgSellMode('manual');
        setPkgProfitPct('');
        setPackModal(true);
    };

    const packSelectCat = (cat: WizardCategory) => {
        setPackCat(cat);
        setPackForm((prev) => ({ ...prev, unit: cat.unit }));
        setPackStep(2);
    };

    const packGoStep3 = () => {
        if (!packCat) return;
        const sku = buildSku(packCat.code, packForm.size, packForm.shape);
        setPackForm((prev) => ({ ...prev, sku }));
        setPackStep(3);
    };

    const packGoStep4 = () => setPackStep(4);

    const submitPackaging = () => {
        if (!packCat) return;
        packSubmitForm.setData({
            name: `${packCat.label}${packForm.size ? ' ' + packForm.size : ''}${packForm.shape ? ' ' + packForm.shape : ''}`,
            sku: packForm.sku,
            hsn: packForm.hsn,
            gst: packForm.gst,
            unit: packForm.unit,
            category: packCat.label,
            min_stock: '0',
            reorder_level: '0',
            cost_per_unit: packForm.cost_per_unit || '0',
            selling_rate: packForm.selling_rate || '0',
            dim_l: packForm.dim_l || '',
            dim_w: packForm.dim_w || '',
            dim_h: packForm.dim_h || '',
            supplier: packForm.supplier,
            notes: packForm.notes,
            stock_qty: packForm.stock || '0',
            is_active: true,
        });
        packSubmitForm.post(matStore().url, {
            preserveScroll: true,
            onSuccess: () => setPackModal(false),
        });
    };

    // ── Status badge helper ───────────────────────────────────────────────────

    const StatusBadge = ({ m }: { m: RawMaterial }) => {
        const s = stockStatus(m);
        const map: Record<string, [string, string]> = {
            out: ['badge red', 'Out of Stock'],
            low: ['badge amber', 'Low Stock'],
            reorder: ['badge sky', 'Reorder'],
            good: ['badge teal', 'Good Stock'],
        };
        const [cls, label] = map[s];
        return <span className={cls}>{label}</span>;
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div id="view-inventory" className="view active">
            <Head title="Inventory" />

            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <h1>Inventory</h1>
                    <p>Raw material stock levels &amp; transaction history</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {canEnterBill && role !== 'accountant' && <button className="btn sm" onClick={() => setScanModal(true)}>📸 Scan Bill</button>}
                    {canEnterBill && role !== 'accountant' && <button className="btn sm" onClick={() => setBillModal(true)}>📄 Purchase Bill</button>}
                    {canMarkReceived && <button className="btn sm" onClick={openPackModal}>📦 Packaging</button>}
                    {canMarkReceived && <button className="btn sm primary" onClick={openNewMat}>+ Add Material</button>}
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#d1fae5' }}>📦</div>
                    <div>
                        <div className="stat-val">{stats.totalMaterials}</div>
                        <div className="stat-label">Total Materials</div>
                    </div>
                </div>
                {role !== 'accountant' && <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fef3c7' }}>⚠️</div>
                    <div>
                        <div className="stat-val">{stats.lowStock}</div>
                        <div className="stat-label">Low Stock</div>
                    </div>
                </div>}
                {role !== 'accountant' && <div className="stat-card">
                    <div className="stat-icon" style={{ background: '#fee2e2' }}>🚫</div>
                    <div>
                        <div className="stat-val">{stats.outOfStock}</div>
                        <div className="stat-label">Out of Stock</div>
                    </div>
                </div>}
                {canSeeTotalValue && (
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: '#e0f2fe' }}>💰</div>
                        <div>
                            <div className="stat-val">{fmtAmt(stats.totalStockValue)}</div>
                            <div className="stat-label">Total Stock Value</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stock Alerts — Out of Stock / Low Stock / BOM Production / Filling Production / Reorder Level */}
            {!isSales && role !== 'accountant' && alertMaterials.length > 0 && (() => {
                const bomOutputIds     = Object.keys(bomOutputMap).map(Number);
                const fillingOutputIds = Object.keys(fillingOutputMap).map(Number);
                const isProduced = (m: RawMaterial) => bomOutputIds.includes(m.id) || fillingOutputIds.includes(m.id);

                // Produced (BOM/Filling output) materials go to the production banners;
                // purchased materials are split by status.
                const outAlerts     = alertMaterials.filter((m) => !isProduced(m) && stockStatus(m) === 'out');
                const lowAlerts     = alertMaterials.filter((m) => !isProduced(m) && stockStatus(m) === 'low');
                const reorderAlerts = alertMaterials.filter((m) => !isProduced(m) && stockStatus(m) === 'reorder');
                const bomAlerts     = alertMaterials.filter((m) => bomOutputIds.includes(m.id));
                const fillingAlerts = alertMaterials.filter((m) => fillingOutputIds.includes(m.id) && !bomOutputIds.includes(m.id));

                const statusColors = (s: ReturnType<typeof stockStatus>) => {
                    if (s === 'out') return { border: '#fca5a5', bg: '#fef2f2', text: '#dc2626', icon: '🔴' };
                    if (s === 'low') return { border: '#fcd34d', bg: '#fffbeb', text: '#d97706', icon: '🟡' };
                    return { border: '#bae6fd', bg: '#f0f9ff', text: '#0284c7', icon: '🔵' };
                };

                const renderChip = (m: RawMaterial, recipes: string[] | null) => {
                    const c = statusColors(stockStatus(m));
                    return (
                        <div key={m.id} style={{ borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, padding: '8px 12px', fontSize: 13, minWidth: 200 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ cursor: 'pointer', fontWeight: 700, color: c.text }} onClick={() => { setSearch(m.name); setTab('materials'); }}>
                                    {c.icon} {m.name}: {fmt(m.stock_qty)} {m.unit}
                                </span>
                                {!recipes && (
                                    <button type="button" className="btn sm primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => openOrderPlaced(m)}>
                                        + Order Placed
                                    </button>
                                )}
                            </div>
                            {recipes && recipes.length > 0 && (
                                <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600, marginTop: 2 }}>
                                    🏭 Run: {recipes.join(', ')}
                                </div>
                            )}
                        </div>
                    );
                };

                const banner = (
                    title: string,
                    icon: string,
                    accent: string,
                    items: RawMaterial[],
                    recipesFor: ((m: RawMaterial) => string[]) | null,
                ) => items.length > 0 && (
                    <div className="card" style={{ borderLeft: `4px solid ${accent}` }}>
                        <div className="card-title" style={{ marginBottom: 8, color: accent }}>
                            {icon} {title}
                            <span className="ct-badge" style={{ background: accent, color: '#fff' }}>{items.length}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {items.map((m) => renderChip(m, recipesFor ? recipesFor(m) : null))}
                        </div>
                    </div>
                );

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                        {banner('Out of Stock', '🔴', '#dc2626', outAlerts, null)}
                        {banner('Low Stock Alert', '🟡', '#d97706', lowAlerts, null)}
                        {banner('BOM Production Required', '⚗️', '#7c3aed', bomAlerts, (m) => bomOutputMap[String(m.id)] ?? [])}
                        {banner('Filling Production Required', '🧪', '#0891b2', fillingAlerts, (m) => fillingOutputMap[String(m.id)] ?? [])}
                        {banner('Reorder Level', '🔵', '#0284c7', reorderAlerts, null)}
                    </div>
                );
            })()}

            {/* On The Way */}
            {!isSales && role !== 'accountant' && pendingReorders.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>🚚 On The Way</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {pendingReorders.map((r) => (
                            <div
                                key={r.id}
                                onClick={() => setViewReorder(r)}
                                style={{
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 8,
                                    padding: '8px 14px',
                                    fontSize: 13,
                                    cursor: 'pointer',
                                    transition: 'box-shadow 0.15s',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px #bfdbfe')}
                                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>{r.raw_material?.name ?? '—'}</div>
                                <div style={{ color: '#6b7280', marginTop: 2 }}>
                                    {fmt(r.qty_ordered)} {r.unit}
                                    {r.supplier ? ` · ${r.supplier}` : ''}
                                    {r.expected_delivery ? ` · EDD ${fmtDate(r.expected_delivery)}` : ''}
                                </div>
                                {r.lr_number && <div style={{ color: '#2563eb', fontSize: 11, marginTop: 2 }}>LR: {r.lr_number}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bill Pending — received, awaiting purchase bill */}
            {!isSales && role !== 'accountant' && billPendingReorders.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title" style={{ marginBottom: 8 }}>🧾 Bill Pending</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {billPendingReorders.map((r) => (
                            <div
                                key={r.id}
                                style={{
                                    background: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: 8,
                                    padding: '8px 14px',
                                    fontSize: 13,
                                }}
                            >
                                <div style={{ fontWeight: 700, color: '#92400e' }}>{r.raw_material?.name ?? '—'}</div>
                                <div style={{ color: '#6b7280', marginTop: 2 }}>
                                    {fmt(r.qty_ordered)} {r.unit}
                                    {r.supplier ? ` · ${r.supplier}` : ''}
                                </div>
                                {canMarkReceived && (
                                    <button
                                        className="btn sm primary"
                                        style={{ marginTop: 6 }}
                                        onClick={() => openBillReorder(r)}
                                    >🧾 Enter Bill</button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="filter-bar" style={{ marginBottom: 0, borderBottom: '1px solid #e5e7eb' }}>
                {(['materials', 'log', 'bills', 'reorders', 'categories', 'godowns'] as const).filter((t) => {
                    if (role === 'accountant') return t === 'materials' || t === 'categories';
                    return !isSales || t === 'materials';
                }).map((t) => (
                    <button
                        key={t}
                        className={`pill${tab === t ? ' active' : ''}`}
                        onClick={() => setTab(t)}
                        style={{ fontWeight: tab === t ? 600 : 400 }}
                    >
                        {t === 'materials' && 'Materials'}
                        {t === 'log' && 'Transaction Log'}
                        {t === 'bills' && 'Purchase Bills'}
                        {t === 'reorders' && 'Reorders'}
                        {t === 'categories' && 'Categories'}
                        {t === 'godowns' && '🏭 Godowns'}
                    </button>
                ))}
            </div>

            {/* ── Materials Tab ─────────────────────────────────────────────── */}
            {tab === 'materials' && (
                <div className="card" style={{ marginTop: 16 }}>
                    {/* Filter bar */}
                    <div className="filter-bar" style={{ marginBottom: 12 }}>
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', minWidth: 200 }}
                        />
                        {(['all', 'low', 'out'] as const).map((s) => (
                            <button
                                key={s}
                                className={`pill${statusFilter === s ? ' active' : ''}`}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s === 'all' ? 'All' : s === 'low' ? 'Low' : 'Out'}
                            </button>
                        ))}
                        <button
                            className={`pill${catFilter === 'all' ? ' active' : ''}`}
                            onClick={() => setCatFilter('all')}
                        >
                            All Categories
                        </button>
                        {categories.map((c) => (
                            <button
                                key={c}
                                className={`pill${catFilter === c ? ' active' : ''}`}
                                onClick={() => setCatFilter(c)}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    {filteredMaterials.length === 0 ? (
                        <div className="empty-state">No materials found.</div>
                    ) : role === 'accountant' ? (() => {
                        const missingHsnGst = filteredMaterials.filter((m) => !m.hsn || m.gst == null || m.gst === '');
                        const complete      = filteredMaterials.filter((m) =>  m.hsn && m.gst != null && m.gst !== '');
                        const renderTable   = (rows: typeof filteredMaterials) => (
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th>Category</th>
                                        <th>HSN Code</th>
                                        <th>GST %</th>
                                        <th>Stock</th>
                                        <th>Selling Rate</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((m) => (
                                        <tr key={m.id}>
                                            <td><div className="prod-name">{m.name}</div></td>
                                            <td>{m.sku ? <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.sku}</span> : <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                            <td>{m.category ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                            <td>
                                                {m.hsn
                                                    ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.hsn}</span>
                                                    : <span style={{ color: '#ef4444', fontSize: 12 }}>Not set</span>}
                                            </td>
                                            <td>
                                                {m.gst != null && m.gst !== ''
                                                    ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 4, padding: '2px 8px', fontWeight: 600, fontSize: 13 }}>{m.gst}%</span>
                                                    : <span style={{ color: '#ef4444', fontSize: 12 }}>Not set</span>}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{fmt(m.stock_qty)} {m.unit}</td>
                                            <td>{fmtAmt(m.selling_rate)}</td>
                                            <td>
                                                <button className="btn sm" onClick={() => openEditMat(m)}>Edit</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                        return (
                            <>
                                {missingHsnGst.length > 0 && (
                                    <div style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8 }}>
                                            <span style={{ fontSize: 15 }}>⚠️</span>
                                            <span style={{ fontWeight: 700, color: '#92400e', fontSize: 14 }}>HSN / GST Missing ({missingHsnGst.length})</span>
                                        </div>
                                        <div className="prod-wrap">{renderTable(missingHsnGst)}</div>
                                    </div>
                                )}
                                {complete.length > 0 && (
                                    <div>
                                        {missingHsnGst.length > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8 }}>
                                                <span style={{ fontSize: 15 }}>✅</span>
                                                <span style={{ fontWeight: 700, color: '#166534', fontSize: 14 }}>Complete ({complete.length})</span>
                                            </div>
                                        )}
                                        <div className="prod-wrap">{renderTable(complete)}</div>
                                    </div>
                                )}
                            </>
                        );
                    })()
                    : isFinishGoodCat ? (() => {
                        // Build grouped structure by group_name
                        const groupMap: Record<string, RawMaterial[]> = {};
                        for (const m of filteredMaterials) {
                            const key = m.group_name || '';
                            if (!groupMap[key]) groupMap[key] = [];
                            groupMap[key].push(m);
                        }
                        const sortedKeys = Object.keys(groupMap).sort((a, b) => {
                            if (a === '' && b !== '') return 1;
                            if (b === '' && a !== '') return -1;
                            return a.localeCompare(b);
                        });

                        return (
                            <div>
                                {sortedKeys.map((groupKey) => {
                                    const groupMats = groupMap[groupKey];
                                    const isCollapsed = collapsedFinishGroups.has(groupKey);
                                    const hasLowStock = groupMats.some((m) => stockStatus(m) === 'low' || stockStatus(m) === 'out');

                                    return (
                                        <div key={groupKey || '__ungrouped__'} style={{ marginBottom: 24 }}>
                                            {(groupKey || sortedKeys.length > 1) && (
                                                <div
                                                    onClick={() => toggleFinishGroup(groupKey)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                                        padding: '10px 16px', borderRadius: 10, marginBottom: isCollapsed ? 0 : 14,
                                                        background: groupKey ? '#f0fdf4' : 'var(--bg-paper)',
                                                        border: `1.5px solid ${groupKey ? '#86efac' : 'var(--border)'}`,
                                                        userSelect: 'none',
                                                    }}
                                                >
                                                    <span style={{
                                                        fontSize: 13, display: 'inline-block',
                                                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s',
                                                        color: 'var(--tx-muted)',
                                                    }}>▼</span>
                                                    <span style={{ fontWeight: 700, fontSize: 15, flex: 1, color: groupKey ? '#166534' : 'var(--tx-head)' }}>
                                                        {groupKey || '📂 No Group'}
                                                    </span>
                                                    {hasLowStock && (
                                                        <span style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                                                            ⚠ Low Stock
                                                        </span>
                                                    )}
                                                    <span style={{ fontSize: 12, background: groupKey ? '#dcfce7' : 'var(--bg-secondary)', color: groupKey ? '#166534' : 'var(--tx-muted)', border: '1px solid ' + (groupKey ? '#86efac' : 'var(--border)'), padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>
                                                        {groupMats.length}
                                                    </span>
                                                </div>
                                            )}

                                            {!isCollapsed && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                                    {groupMats.map((m) => {
                                                        const s = stockStatus(m);
                                                        const borderColor = s === 'out' ? '#fca5a5' : s === 'low' ? '#fcd34d' : '#e5e7eb';
                                                        const accentColor = s === 'out' ? '#dc2626' : s === 'low' ? '#d97706' : '#2563eb';
                                                        return (
                                                            <div key={m.id} style={{
                                                                background: '#fff',
                                                                border: `1px solid ${borderColor}`,
                                                                borderLeft: `4px solid ${accentColor}`,
                                                                borderRadius: 10,
                                                                padding: '14px 16px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                gap: 8,
                                                                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                                                            }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                                                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{m.name}</div>
                                                                    <StatusBadge m={m} />
                                                                </div>
                                                                {m.sku && <div style={{ fontSize: 12, color: 'var(--tx-muted)', fontFamily: 'monospace' }}>{m.sku}</div>}
                                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
                                                                    <div>
                                                                        <span style={{ color: 'var(--tx-muted)', fontSize: 11 }}>Stock</span>
                                                                        <div style={{ fontWeight: 600, color: s === 'out' ? '#dc2626' : s === 'low' ? '#d97706' : '#111827' }}>
                                                                            {fmt(m.stock_qty)} {m.unit}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ color: 'var(--tx-muted)', fontSize: 11 }}>Selling Rate</span>
                                                                        <div style={{ fontWeight: 600 }}>{fmtAmt(m.selling_rate)}</div>
                                                                    </div>
                                                                    {canSeeCost && (
                                                                        <div>
                                                                            <span style={{ color: 'var(--tx-muted)', fontSize: 11 }}>Cost/Unit</span>
                                                                            <div style={{ fontWeight: 600 }}>{fmtAmt(m.cost_per_unit)}</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {canEditMaterial && (
                                                                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                                                        {canManageStock && <button className="btn sm primary" onClick={() => openTxn(m)}>+ Stock</button>}
                                                                        <button className="btn sm" onClick={() => openEditMat(m)}>Edit</button>
                                                                        {canManageStock && <button className="btn danger sm" onClick={() => deleteMaterial(m.id)}>🗑</button>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()
                    : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Material / SKU</th>
                                        <th>Category</th>
                                        <th>Stock</th>
                                        {!isSales && <th>Min</th>}
                                        <th>Status</th>
                                        {canSeeCost && <th>Cost/Unit</th>}
                                        {canSeeCost && <th>Value</th>}
                                        <th>Selling Rate</th>
                                        {canEditMaterial && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaterials.map((m) => (
                                        <tr key={m.id}>
                                            <td>
                                                <div className="prod-name">{m.name}</div>
                                                {!isSales && m.sku && <div className="prod-detail">{m.sku}</div>}
                                                {!isSales && (m.dim_l || m.dim_w || m.dim_h) && (
                                                    <div className="prod-detail" style={{ color: '#6b7280' }}>
                                                        📐 {[m.dim_l, m.dim_w, m.dim_h].map((d) => d != null && Number(d) > 0 ? Number(d) : '?').join(' × ')} mm
                                                    </div>
                                                )}
                                            </td>
                                            <td>{m.category ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                            <td>{fmt(m.stock_qty)} {m.unit}</td>
                                            {!isSales && <td>{fmt(m.min_stock)}</td>}
                                            <td><StatusBadge m={m} /></td>
                                            {canSeeCost && <td>{fmtAmt(m.cost_per_unit)}</td>}
                                            {canSeeCost && <td>{fmtAmt(Number(m.stock_qty) * Number(m.cost_per_unit))}</td>}
                                            <td>{fmtAmt(m.selling_rate)}</td>
                                            {canEditMaterial && (
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        {canManageStock && <button className="btn sm primary" onClick={() => openTxn(m)}>+ Stock</button>}
                                                        <button className="btn sm" onClick={() => openEditMat(m)}>Edit</button>
                                                        {canManageStock && <button className="btn danger sm" onClick={() => deleteMaterial(m.id)}>🗑</button>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Transaction Log Tab ───────────────────────────────────────── */}
            {tab === 'log' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>Transaction Log</div>
                    {recentTransactions.length === 0 ? (
                        <div className="empty-state">No transactions recorded yet.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Material</th>
                                        <th>Type</th>
                                        <th>Qty</th>
                                        <th>Before → After</th>
                                        <th>Reference</th>
                                        <th>By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransactions.map((t) => {
                                        const isPositive = t.type === 'purchase' || t.type === 'return';
                                        const badgeMap: Record<string, string> = {
                                            purchase: 'badge teal',
                                            issue: 'badge amber',
                                            adjustment: 'badge sky',
                                            return: 'badge gray',
                                        };
                                        return (
                                            <tr key={t.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(t.created_at)}</td>
                                                <td>{t.raw_material?.name ?? '—'}</td>
                                                <td>
                                                    <span className={badgeMap[t.type] ?? 'badge gray'}>
                                                        {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                                    </span>
                                                </td>
                                                <td style={{ color: isPositive ? '#059669' : '#dc2626', fontWeight: 600 }}>
                                                    {isPositive ? '+' : t.type === 'adjustment' ? '=' : '-'}{fmt(t.qty)} {t.raw_material?.unit ?? ''}
                                                </td>
                                                <td>
                                                    {t.previous_stock != null && t.new_stock != null
                                                        ? `${fmt(t.previous_stock)} → ${fmt(t.new_stock)}`
                                                        : '—'}
                                                </td>
                                                <td>{t.reference ?? '—'}</td>
                                                <td>{t.user?.name ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Purchase Bills Tab ────────────────────────────────────────── */}
            {tab === 'bills' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">Purchase Bills</div>
                        {canEnterBill && <button className="btn sm primary" onClick={() => setBillModal(true)}>+ New Bill</button>}
                    </div>
                    {purchaseBills.length === 0 ? (
                        <div className="empty-state">No purchase bills recorded.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Vendor</th>
                                        <th>Bill #</th>
                                        <th>Items</th>
                                        <th>Total</th>
                                        <th>Stock Added</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchaseBills.map((b) => (
                                        <>
                                            <tr
                                                key={b.id}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => setExpandedBill(expandedBill === b.id ? null : b.id)}
                                            >
                                                <td style={{ whiteSpace: 'nowrap' }}>{b.bill_date ? fmtDate(b.bill_date) : fmtDate(b.created_at)}</td>
                                                <td>{b.vendor_name}</td>
                                                <td>{b.bill_number ?? '—'}</td>
                                                <td>
                                                    <span className="ct-badge">{b.items.length}</span>
                                                </td>
                                                <td>{fmtAmt(b.total_amount)}</td>
                                                <td>
                                                    {b.add_to_stock
                                                        ? <span className="badge teal">Yes</span>
                                                        : <span className="badge gray">No</span>}
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <button className="btn danger sm" onClick={() => deleteBill(b.id)}>🗑</button>
                                                </td>
                                            </tr>
                                            {expandedBill === b.id && b.items.length > 0 && (
                                                <tr key={`${b.id}-items`}>
                                                    <td colSpan={7} style={{ background: '#f9fafb', padding: 12 }}>
                                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Material</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>SKU</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>HSN</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Qty</th>
                                                                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Unit</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Rate</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>GST%</th>
                                                                    <th style={{ textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {b.items.map((item) => (
                                                                    <tr key={item.id}>
                                                                        <td style={{ padding: '4px 8px' }}>{item.material_name}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.sku ?? '—'}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.hsn ?? '—'}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmt(item.qty)}</td>
                                                                        <td style={{ padding: '4px 8px' }}>{item.unit}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtAmt(item.rate)}</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{item.gst}%</td>
                                                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtAmt(item.amount)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Reorders Tab ──────────────────────────────────────────────── */}
            {tab === 'reorders' && (
                <div className="card" style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div className="card-title">Reorders</div>
                        <button className="btn sm primary" onClick={openReorderModal}>+ New Reorder</button>
                    </div>
                    {reorders.length === 0 ? (
                        <div className="empty-state">No reorders placed.</div>
                    ) : (
                        <div className="prod-wrap">
                            <table className="prod-table">
                                <thead>
                                    <tr>
                                        <th>Material</th>
                                        <th>Qty</th>
                                        <th>Supplier</th>
                                        <th>Order Date</th>
                                        <th>EDD</th>
                                        <th>Transport</th>
                                        <th>LR #</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reorders.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.raw_material?.name ?? '—'}</td>
                                            <td>{fmt(r.qty_ordered)} {r.unit}</td>
                                            <td>{r.supplier ?? '—'}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.order_date)}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{r.expected_delivery ? fmtDate(r.expected_delivery) : '—'}</td>
                                            <td>{r.transport_name ?? '—'}</td>
                                            <td>{r.lr_number ?? '—'}</td>
                                            <td>
                                                {r.status === 'received' ? (
                                                    <div>
                                                        <span className="badge teal">✓ Received</span>
                                                        {!r.billed_at && (
                                                            <span className="badge amber" style={{ marginLeft: 4 }}>Bill Pending</span>
                                                        )}
                                                        {r.received_by_user && (
                                                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                                                by {r.received_by_user.name}
                                                            </div>
                                                        )}
                                                        {r.received_at && (
                                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                                                {fmtDate(r.received_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="badge amber">Pending</span>
                                                )}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    {r.status === 'pending' && canMarkReceived && (
                                                        <button className="btn sm primary" onClick={() => receiveReorder(r.id)}>✓ Mark Received</button>
                                                    )}
                                                    {r.status === 'received' && !r.billed_at && canMarkReceived && (
                                                        <button className="btn sm primary" onClick={() => openBillReorder(r)}>🧾 Enter Bill</button>
                                                    )}
                                                    <button className="btn danger sm" onClick={() => deleteReorder(r.id)}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Categories Tab ─────────────────────────────────────────────── */}
            {tab === 'categories' && (
                <div style={{ padding: '20px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Material Categories</h3>
                        <button className="btn primary sm" onClick={openNewCat}>+ Add Category</button>
                    </div>
                    {inventoryCategories.length === 0 ? (
                        <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>
                            No categories yet. Click "+ Add Category" to create one.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            {inventoryCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        background: cat.color ? cat.color + '22' : '#f3f4f6',
                                        border: `1.5px solid ${cat.color ?? '#d1d5db'}`,
                                        borderRadius: 8,
                                        padding: '6px 12px',
                                        fontSize: 14,
                                    }}
                                >
                                    {cat.color && (
                                        <span style={{ width: 12, height: 12, borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                                    )}
                                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                                    <span style={{ color: '#6b7280', fontSize: 12 }}>
                                        ({materials.filter((m) => m.category === cat.name).length} items)
                                    </span>
                                    <button
                                        className="btn sm"
                                        style={{ padding: '1px 8px', fontSize: 12, marginLeft: 4 }}
                                        onClick={() => openEditCat(cat)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn danger sm"
                                        style={{ padding: '1px 8px', fontSize: 12 }}
                                        onClick={() => destroyCat(cat)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Godowns Tab ───────────────────────────────────────────────── */}
            {tab === 'godowns' && (
                <div style={{ padding: '20px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>🏭 Godowns / Warehouses</h3>
                        {!isSales && (
                            <button className="btn primary sm" onClick={() => { setEditingGodown(null); setGodownForm({ name: '', location: '', notes: '' }); setGodownModal(true); }}>
                                + Add Godown
                            </button>
                        )}
                    </div>

                    {/* Godown cards */}
                    {godowns.length === 0 ? (
                        <div style={{ color: '#9ca3af', textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
                            No godowns added yet. Add your first warehouse/godown.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                            {godowns.map((g) => {
                                const gCats = Array.from(new Set(g.stocks.map((s) => s.raw_material?.category ?? 'Uncategorized')));
                                const filteredStocks = godownCatFilter === 'all' || selectedGodown?.id !== g.id
                                    ? g.stocks : g.stocks.filter((s) => (s.raw_material?.category ?? 'Uncategorized') === godownCatFilter);

                                return (
                                    <div key={g.id} className="card" style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                                                {g.location && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>📍 {g.location}</div>}
                                            </div>
                                            {!isSales && (
                                                <button className="btn sm" style={{ flexShrink: 0 }} onClick={() => {
                                                    setEditingGodown(g);
                                                    setGodownForm({ name: g.name, location: g.location ?? '', notes: g.notes ?? '' });
                                                    setGodownModal(true);
                                                }}>Edit</button>
                                            )}
                                        </div>

                                        {/* Category filter pills for this godown */}
                                        {g.stocks.length > 0 && (
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                                <button
                                                    className={`pill${(selectedGodown?.id !== g.id || godownCatFilter === 'all') ? ' active' : ''}`}
                                                    style={{ fontSize: 11, padding: '2px 8px' }}
                                                    onClick={() => { setSelectedGodown(g); setGodownCatFilter('all'); }}
                                                >All</button>
                                                {gCats.map((c) => (
                                                    <button
                                                        key={c}
                                                        className={`pill${selectedGodown?.id === g.id && godownCatFilter === c ? ' active' : ''}`}
                                                        style={{ fontSize: 11, padding: '2px 8px' }}
                                                        onClick={() => { setSelectedGodown(g); setGodownCatFilter(c); }}
                                                    >{c}</button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Stock list */}
                                        {g.stocks.length === 0 ? (
                                            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>No stock recorded in this godown.</div>
                                        ) : (
                                            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600 }}>Material</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>Category</th>
                                                        <th style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600 }}>Stock</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(selectedGodown?.id === g.id && godownCatFilter !== 'all' ? filteredStocks : g.stocks)
                                                        .filter((s) => Number(s.stock_qty) > 0)
                                                        .sort((a, b) => (a.raw_material?.name ?? '').localeCompare(b.raw_material?.name ?? ''))
                                                        .map((s) => (
                                                            <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                                <td style={{ padding: '5px 8px', fontWeight: 500 }}>{s.raw_material?.name ?? `#${s.raw_material_id}`}</td>
                                                                <td style={{ padding: '5px 8px', color: '#6b7280' }}>{s.raw_material?.category ?? '—'}</td>
                                                                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>
                                                                    {Number(s.stock_qty).toLocaleString('en-IN', { maximumFractionDigits: 3 })} {s.raw_material?.unit}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        )}

                                        {/* Total items count */}
                                        <div style={{ marginTop: 8, fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                                            {g.stocks.filter((s) => Number(s.stock_qty) > 0).length} item(s) in stock
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════════ */}

            {/* ── Godown Modal ──────────────────────────────────────────────── */}
            <div className={`modal-overlay${godownModal ? ' open' : ''}`} onClick={() => setGodownModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, width: '95%' }}>
                    <div className="modal-header">
                        <h3>{editingGodown ? 'Edit Godown' : 'Add Godown'}</h3>
                        <button className="modal-close" onClick={() => setGodownModal(false)}>×</button>
                    </div>
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="form-group">
                            <label>Godown Name *</label>
                            <input type="text" value={godownForm.name} onChange={(e) => setGodownForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Main Warehouse, Cold Storage" />
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <input type="text" value={godownForm.location} onChange={(e) => setGodownForm((p) => ({ ...p, location: e.target.value }))} placeholder="e.g. Plot 12, GIDC Rajkot" />
                        </div>
                        <div className="form-group">
                            <label>Notes</label>
                            <input type="text" value={godownForm.notes} onChange={(e) => setGodownForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional" />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                            <button className="btn" onClick={() => setGodownModal(false)}>Cancel</button>
                            <button className="btn primary" onClick={() => {
                                if (!godownForm.name.trim()) return;
                                if (editingGodown) {
                                    router.patch(ROUTES.updateGodown(editingGodown.id), godownForm, {
                                        preserveScroll: true, onSuccess: () => setGodownModal(false),
                                    });
                                } else {
                                    router.post(ROUTES.storeGodown, godownForm, {
                                        preserveScroll: true, onSuccess: () => setGodownModal(false),
                                    });
                                }
                            }}>
                                {editingGodown ? 'Update' : 'Add Godown'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Material Modal ────────────────────────────────────────────── */}
            <div className={`modal-overlay${matModal ? ' open' : ''}`} onClick={() => setMatModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '95%' }}>
                    <div className="modal-header">
                        <h3>{editingMat ? 'Edit Material' : 'Add Material'}</h3>
                        <button className="modal-close" onClick={() => setMatModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitMat} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Name *</label>
                                    <input
                                        type="text"
                                        value={matForm.data.name}
                                        onChange={(e) => matForm.setData('name', e.target.value)}
                                        required
                                    />
                                    {matForm.errors.name && <div className="form-error">{matForm.errors.name}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select
                                        value={matForm.data.unit}
                                        onChange={(e) => matForm.setData('unit', e.target.value)}
                                        required
                                    >
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    {matForm.errors.unit && <div className="form-error">{matForm.errors.unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Category</label>
                                    <select
                                        value={matForm.data.category}
                                        onChange={(e) => matForm.setData('category', e.target.value)}
                                    >
                                        <option value="">— None —</option>
                                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {matForm.errors.category && <div className="form-error">{matForm.errors.category}</div>}
                                </div>
                                {(() => {
                                    const cat = matForm.data.category.toLowerCase();
                                    const isFinish = cat.includes('finish') && cat.includes('good') && !cat.includes('semi');
                                    if (!isFinish) return null;

                                    const currentVal = matForm.data.group_name.trim();
                                    const exactMatch = finishGoodGroups.find(
                                        (g) => g.name.toLowerCase() === currentVal.toLowerCase()
                                    );
                                    const similarMatches = !exactMatch && currentVal.length >= 2
                                        ? finishGoodGroups.filter((g) =>
                                            g.name.toLowerCase().includes(currentVal.toLowerCase()) ||
                                            currentVal.toLowerCase().includes(g.name.toLowerCase())
                                          )
                                        : [];
                                    const filteredGroups = finishGoodGroups.filter((g) =>
                                        g.name.toLowerCase().includes(currentVal.toLowerCase())
                                    );

                                    return (
                                        <>
                                        <div className="form-group" ref={groupNameRef} style={{ position: 'relative' }}>
                                            <label>Product Group <span style={{ fontSize: 11, color: 'var(--tx-muted)', fontWeight: 400 }}>(groups same-brand items)</span></label>
                                            <input
                                                type="text"
                                                value={matForm.data.group_name}
                                                onChange={(e) => { matForm.setData('group_name', e.target.value); setGroupNameOpen(true); }}
                                                onFocus={() => setGroupNameOpen(true)}
                                                placeholder="e.g. Chia Seed Oil"
                                                autoComplete="off"
                                            />
                                            {groupNameOpen && finishGoodGroups.length > 0 && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                                    background: '#fff', border: '1px solid #d1d5db', borderRadius: 8,
                                                    boxShadow: '0 4px 12px rgba(0,0,0,.12)', marginTop: 2, maxHeight: 200, overflowY: 'auto',
                                                }}>
                                                    {(currentVal ? filteredGroups : finishGoodGroups).length === 0 ? (
                                                        <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tx-muted)' }}>No matching groups</div>
                                                    ) : (currentVal ? filteredGroups : finishGoodGroups).map((g) => (
                                                        <div
                                                            key={g.name}
                                                            onMouseDown={(e) => { e.preventDefault(); matForm.setData('group_name', g.name); setGroupNameOpen(false); }}
                                                            style={{
                                                                padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                background: g.name.toLowerCase() === currentVal.toLowerCase() ? '#f0fdf4' : 'transparent',
                                                            }}
                                                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                                                            onMouseLeave={(e) => (e.currentTarget.style.background = g.name.toLowerCase() === currentVal.toLowerCase() ? '#f0fdf4' : 'transparent')}
                                                        >
                                                            <span style={{ fontWeight: 500 }}>{g.name}</span>
                                                            <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 7px', borderRadius: 10 }}>
                                                                {g.count} item{g.count !== 1 ? 's' : ''}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {exactMatch && (
                                                <div style={{ marginTop: 5, fontSize: 12, color: '#059669', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    ✓ Group exists — joining "{exactMatch.name}" ({exactMatch.count} product{exactMatch.count !== 1 ? 's' : ''})
                                                </div>
                                            )}
                                            {!exactMatch && similarMatches.length > 0 && (
                                                <div style={{ marginTop: 5, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '4px 10px' }}>
                                                    ⚠ Similar group exists: {similarMatches.map((g) => `"${g.name}"`).join(', ')}
                                                </div>
                                            )}
                                            {matForm.errors.group_name && <div className="form-error">{matForm.errors.group_name}</div>}
                                        </div>
                                        <div className="form-group">
                                            <label>Bottle Shape <span style={{ fontSize: 11, color: 'var(--tx-muted)', fontWeight: 400 }}>(e.g. Square, Diamond — blank if only one shape)</span></label>
                                            <input
                                                type="text"
                                                value={matForm.data.shape}
                                                onChange={(e) => matForm.setData('shape', e.target.value)}
                                                placeholder="Square"
                                            />
                                            {matForm.errors.shape && <div className="form-error">{matForm.errors.shape}</div>}
                                        </div>
                                        </>
                                    );
                                })()}
                                <div className="form-group">
                                    <label>SKU</label>
                                    <input
                                        type="text"
                                        value={matForm.data.sku}
                                        onChange={(e) => matForm.setData('sku', e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Tab' && !matForm.data.sku && matForm.data.category) {
                                                matForm.setData('sku', `PKG-${matForm.data.category.toUpperCase().slice(0, 3)}-`);
                                            }
                                        }}
                                        placeholder="Press Tab to auto-suggest PKG-..."
                                    />
                                    {matForm.errors.sku && <div className="form-error">{matForm.errors.sku}</div>}
                                </div>
                                <div className="form-group">
                                    <label>HSN</label>
                                    <input
                                        type="text"
                                        value={matForm.data.hsn}
                                        onChange={(e) => matForm.setData('hsn', e.target.value)}
                                    />
                                    {matForm.errors.hsn && <div className="form-error">{matForm.errors.hsn}</div>}
                                </div>
                                <div className="form-group">
                                    <label>GST %</label>
                                    <select
                                        value={matForm.data.gst}
                                        onChange={(e) => matForm.setData('gst', e.target.value)}
                                    >
                                        {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                    {matForm.errors.gst && <div className="form-error">{matForm.errors.gst}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Min Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.min_stock}
                                        onChange={(e) => matForm.setData('min_stock', e.target.value)}
                                    />
                                    {matForm.errors.min_stock && <div className="form-error">{matForm.errors.min_stock}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Reorder Level</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.reorder_level}
                                        onChange={(e) => matForm.setData('reorder_level', e.target.value)}
                                    />
                                    {matForm.errors.reorder_level && <div className="form-error">{matForm.errors.reorder_level}</div>}
                                </div>
                                {role !== 'accountant' && <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={matForm.data.cost_per_unit}
                                        onChange={(e) => matForm.setData('cost_per_unit', e.target.value)}
                                    />
                                    {matForm.errors.cost_per_unit && <div className="form-error">{matForm.errors.cost_per_unit}</div>}
                                </div>}
                                {role !== 'accountant' && <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>Selling Rate (₹)</span>
                                        <span style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', fontSize: 11, height: 20 }}>
                                            <button type="button" onClick={() => setMatSellMode('manual')} style={{ padding: '0 8px', border: 'none', cursor: 'pointer', background: matSellMode === 'manual' ? 'var(--accent)' : 'var(--bg-paper)', color: matSellMode === 'manual' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>Manual</button>
                                            <button type="button" onClick={() => { setMatSellMode('profit'); if (matProfitPct) { const cost = Number(matForm.data.cost_per_unit) || 0; matForm.setData('selling_rate', String(cost * (1 + Number(matProfitPct) / 100))); } }} style={{ padding: '0 8px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', background: matSellMode === 'profit' ? '#059669' : 'var(--bg-paper)', color: matSellMode === 'profit' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>% Profit</button>
                                        </span>
                                    </label>
                                    {matSellMode === 'manual' ? (
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={matForm.data.selling_rate}
                                            onChange={(e) => matForm.setData('selling_rate', e.target.value)}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    placeholder="Profit %"
                                                    value={matProfitPct}
                                                    onChange={(e) => {
                                                        setMatProfitPct(e.target.value);
                                                        const cost = Number(matForm.data.cost_per_unit) || 0;
                                                        const pct  = Number(e.target.value) || 0;
                                                        matForm.setData('selling_rate', String(cost * (1 + pct / 100)));
                                                    }}
                                                    style={{ paddingRight: 28 }}
                                                />
                                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
                                            </div>
                                            <span style={{ fontSize: 13, color: '#059669', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                = ₹{(Number(matForm.data.cost_per_unit) * (1 + Number(matProfitPct || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}
                                    {matForm.errors.selling_rate && <div className="form-error">{matForm.errors.selling_rate}</div>}
                                </div>}
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Box Dimensions (mm) — L × W × H</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_l}
                                            onChange={(e) => matForm.setData('dim_l', e.target.value)}
                                            placeholder="L"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_w}
                                            onChange={(e) => matForm.setData('dim_w', e.target.value)}
                                            placeholder="W"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={matForm.data.dim_h}
                                            onChange={(e) => matForm.setData('dim_h', e.target.value)}
                                            placeholder="H"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>mm</span>
                                    </div>
                                    {(matForm.errors.dim_l || matForm.errors.dim_w || matForm.errors.dim_h) && (
                                        <div className="form-error">Invalid dimensions</div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input
                                        type="text"
                                        value={matForm.data.supplier}
                                        onChange={(e) => matForm.setData('supplier', e.target.value)}
                                    />
                                    {matForm.errors.supplier && <div className="form-error">{matForm.errors.supplier}</div>}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={matForm.data.notes}
                                        onChange={(e) => matForm.setData('notes', e.target.value)}
                                    />
                                    {matForm.errors.notes && <div className="form-error">{matForm.errors.notes}</div>}
                                </div>
                                {editingMat && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <label style={{ margin: 0 }}>Active</label>
                                        <input
                                            type="checkbox"
                                            checked={matForm.data.is_active}
                                            onChange={(e) => matForm.setData('is_active', e.target.checked)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setMatModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={matForm.processing}>
                                {matForm.processing ? 'Saving...' : editingMat ? 'Update' : 'Add Material'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Transaction Modal ─────────────────────────────────────────── */}
            <div className={`modal-overlay${txnModal ? ' open' : ''}`} onClick={() => setTxnModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95%' }}>
                    <div className="modal-header">
                        <h3>Stock Transaction</h3>
                        <button className="modal-close" onClick={() => setTxnModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitTxn} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div className="modal-body">
                            {txnTarget && (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                                    <strong>{txnTarget.name}</strong>
                                    <span style={{ marginLeft: 12, color: '#374151' }}>
                                        Current Stock: {fmt(txnTarget.stock_qty)} {txnTarget.unit}
                                    </span>
                                </div>
                            )}
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Type *</label>
                                    <select
                                        value={txnForm.data.type}
                                        onChange={(e) => txnForm.setData('type', e.target.value)}
                                        required
                                    >
                                        <option value="purchase">📥 Stock In</option>
                                        <option value="issue">📤 Issue / Use</option>
                                        <option value="adjustment">⚖️ Adjust Stock</option>
                                        <option value="return">↩ Return</option>
                                    </select>
                                    {txnForm.errors.type && <div className="form-error">{txnForm.errors.type}</div>}
                                </div>
                                {godowns.length > 0 && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label>Godown / Warehouse</label>
                                        <select value={txnForm.data.godown_id} onChange={(e) => txnForm.setData('godown_id', e.target.value)}>
                                            <option value="">— No specific godown —</option>
                                            {godowns.map((g) => <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Qty *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={txnForm.data.qty}
                                        onChange={(e) => txnForm.setData('qty', e.target.value)}
                                        required
                                    />
                                    {txnForm.errors.qty && <div className="form-error">{txnForm.errors.qty}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={txnForm.data.cost_per_unit}
                                        onChange={(e) => txnForm.setData('cost_per_unit', e.target.value)}
                                    />
                                    {txnForm.errors.cost_per_unit && <div className="form-error">{txnForm.errors.cost_per_unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Reference / Bill No</label>
                                    <input
                                        type="text"
                                        value={txnForm.data.reference}
                                        onChange={(e) => txnForm.setData('reference', e.target.value)}
                                    />
                                    {txnForm.errors.reference && <div className="form-error">{txnForm.errors.reference}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Notes</label>
                                    <input
                                        type="text"
                                        value={txnForm.data.notes}
                                        onChange={(e) => txnForm.setData('notes', e.target.value)}
                                    />
                                    {txnForm.errors.notes && <div className="form-error">{txnForm.errors.notes}</div>}
                                </div>
                                {computedNewStock !== null && (
                                    <div style={{ gridColumn: '1 / -1', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', fontWeight: 600, color: '#1e40af' }}>
                                        New Stock: {fmt(computedNewStock)} {txnTarget?.unit}
                                        {computedNewStock < 0 && (
                                            <span style={{ color: '#dc2626', marginLeft: 8 }}>⚠ Stock will go negative!</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setTxnModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={txnForm.processing}>
                                {txnForm.processing ? 'Saving...' : 'Record Transaction'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Purchase Bill Modal ───────────────────────────────────────── */}
            <div className={`modal-overlay${billModal ? ' open' : ''}`} onClick={() => { setBillModal(false); resetBillForm(); }}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1050, width: '98%' }}>
                    <div className="modal-header">
                        <h3>📄 New Purchase Bill</h3>
                        <button className="modal-close" onClick={() => { setBillModal(false); resetBillForm(); }}>×</button>
                    </div>
                    <div className="modal-body" onClick={() => { setBillMatDropdown(null); setBillVendorOpen(false); }}>
                        {/* Row 1: Bill Number + Vendor/Supplier */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 12 }}>
                            <div className="form-group">
                                <label>Bill / Invoice Number</label>
                                <input
                                    type="text"
                                    value={billForm.bill_number}
                                    onChange={(e) => setBillForm((p) => ({ ...p, bill_number: e.target.value }))}
                                    placeholder="e.g. INV-2024-001"
                                />
                                {isDuplicateBillNumber && (
                                    <div className="form-error">⚠ This bill number already exists.</div>
                                )}
                            </div>
                            <div className="form-group" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                                <label>Vendor / Supplier *</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input
                                        type="text"
                                        value={billVendorSearch}
                                        onChange={(e) => {
                                            setBillVendorSearch(e.target.value);
                                            setBillVendorOpen(true);
                                            if (!e.target.value.trim()) {
                                                setBillForm((p) => ({ ...p, party_id: '', vendor_name: '' }));
                                            }
                                        }}
                                        onFocus={() => setBillVendorOpen(true)}
                                        placeholder="Search supplier..."
                                        autoComplete="off"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        title="Add new supplier"
                                        onClick={() => {
                                            setAddSupplierForm((p) => ({ ...p, name: billVendorSearch.trim() }));
                                            setAddSupplierModal(true);
                                            setBillVendorOpen(false);
                                        }}
                                        style={{ flexShrink: 0, width: 34, height: 34, border: '1px solid #d1d5db', borderRadius: 6, background: '#f0fdf4', color: '#059669', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
                                    >+</button>
                                </div>
                                {billForm.party_id && (
                                    <div style={{ fontSize: 11, color: '#2563eb', marginTop: 3 }}>
                                        ✓ {vendors.find((v) => String(v.id) === billForm.party_id)?.name}
                                        {vendors.find((v) => String(v.id) === billForm.party_id)?.gst_no
                                            ? ` · GST: ${vendors.find((v) => String(v.id) === billForm.party_id)?.gst_no}`
                                            : ''}
                                        <button
                                            type="button"
                                            onClick={() => { setBillForm((p) => ({ ...p, party_id: '', vendor_name: '' })); setBillVendorSearch(''); }}
                                            style={{ marginLeft: 8, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                                        >✕ clear</button>
                                    </div>
                                )}
                                {billVendorOpen && (() => {
                                    const q = billVendorSearch.toLowerCase();
                                    const matches = vendors.filter((v) =>
                                        v.name.toLowerCase().includes(q) ||
                                        (v.gst_no ?? '').toLowerCase().includes(q)
                                    );
                                    return (matches.length > 0 || billVendorSearch.trim().length > 0) ? (
                                        <div style={{
                                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                                            background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
                                        }}>
                                            {matches.map((v) => (
                                                <div
                                                    key={v.id}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBillForm((p) => ({ ...p, party_id: String(v.id), vendor_name: v.name }));
                                                        setBillVendorSearch(v.name);
                                                        setBillVendorOpen(false);
                                                    }}
                                                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                                >
                                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                                                    {v.gst_no && <div style={{ fontSize: 11, color: '#6b7280' }}>GST: {v.gst_no}</div>}
                                                </div>
                                            ))}
                                            {matches.length === 0 && billVendorSearch.trim().length > 0 && (
                                                <div
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setBillForm((p) => ({ ...p, party_id: '', vendor_name: billVendorSearch }));
                                                        setBillVendorOpen(false);
                                                    }}
                                                    style={{ padding: '8px 12px', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 13 }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                                >
                                                    ➕ Use "{billVendorSearch}" as manual vendor
                                                </div>
                                            )}
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            {/* Row 2: Purchase Date + Bill Upload */}
                            <div className="form-group">
                                <label>Purchase Date</label>
                                <input
                                    type="date"
                                    value={billForm.bill_date}
                                    onChange={(e) => setBillForm((p) => ({ ...p, bill_date: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill Photo / PDF Upload</label>
                                <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setBillFile(e.target.files?.[0] ?? null)}
                                />
                                {billFile && <div style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>✓ {billFile.name}</div>}
                            </div>
                        </div>

                        {/* Line Items */}
                        <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <strong style={{ fontSize: 14 }}>Items</strong>
                                <button type="button" className="btn sm primary" onClick={addBillRow}>+ Add Item</button>
                            </div>
                            {billRows.length === 0 ? (
                                <div style={{ color: '#9ca3af', fontSize: 13, padding: '20px 0', textAlign: 'center', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
                                    No items yet. Click "+ Add Item" to begin.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', border: '1px solid #e5e7eb' }}>
                                        <colgroup>
                                            <col style={{ width: '22%' }} />
                                            <col style={{ width: '8%' }} />
                                            <col style={{ width: '11%' }} />
                                            <col style={{ width: '7%' }} />
                                            <col style={{ width: '7%' }} />
                                            <col style={{ width: '7%' }} />
                                            <col style={{ width: '9%' }} />
                                            <col style={{ width: '8%' }} />
                                            <col style={{ width: '9%' }} />
                                            <col style={{ width: '3%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr style={{ background: '#f3f4f6' }}>
                                                <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #d1d5db' }}>Material / Item Name</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #d1d5db' }}>SKU</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #d1d5db' }}>Category</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #d1d5db' }}>HSN</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #d1d5db' }}>Qty</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'left', border: '1px solid #d1d5db' }}>Unit</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #d1d5db' }}>Rate (₹)</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #d1d5db' }}>GST%</th>
                                                <th style={{ padding: '5px 6px', textAlign: 'right', border: '1px solid #d1d5db' }}>Amount</th>
                                                <th style={{ border: '1px solid #d1d5db' }}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {billRows.map((row, i) => {
                                                return (
                                                    <tr key={i}>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }} onClick={(e) => e.stopPropagation()}>
                                                            <input
                                                                ref={(el) => { matInputRefs.current[i] = el; }}
                                                                type="text"
                                                                value={row.matSearch || row.material_name}
                                                                onChange={(e) => {
                                                                    updateBillRow(i, 'matSearch', e.target.value);
                                                                    setBillMatDropdown(i);
                                                                    const rect = matInputRefs.current[i]?.getBoundingClientRect();
                                                                    if (rect) setMatDropdownRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 260) });
                                                                    runMaterialSearch(e.target.value);
                                                                }}
                                                                onFocus={() => {
                                                                    if (row.matSearch || !row.raw_material_id) {
                                                                        setBillMatDropdown(i);
                                                                        const rect = matInputRefs.current[i]?.getBoundingClientRect();
                                                                        if (rect) setMatDropdownRect({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 260) });
                                                                        runMaterialSearch(row.matSearch || row.material_name);
                                                                    }
                                                                }}
                                                                onBlur={() => setTimeout(() => setBillMatDropdown(null), 150)}
                                                                style={{ width: '100%', fontSize: 12 }}
                                                                placeholder="Search or type name…"
                                                            />
                                                            {row.raw_material_id && (
                                                                <div style={{ fontSize: 10, color: '#2563eb', marginTop: 1, lineHeight: 1.2 }}>✓ linked</div>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <input type="text" value={row.sku} onChange={(e) => updateBillRow(i, 'sku', e.target.value)} style={{ width: '100%', fontSize: 12 }} />
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <select value={row.category} onChange={(e) => updateBillRow(i, 'category', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                                                                <option value="">—</option>
                                                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                                                {row.category && !categories.includes(row.category) && <option value={row.category}>{row.category}</option>}
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <input type="text" value={row.hsn} onChange={(e) => updateBillRow(i, 'hsn', e.target.value)} style={{ width: '100%', fontSize: 12 }} />
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <input type="number" min="0" step="any" value={row.qty} onChange={(e) => updateBillRow(i, 'qty', e.target.value)} style={{ width: '100%', textAlign: 'right', fontSize: 12 }} />
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <select value={row.unit} onChange={(e) => updateBillRow(i, 'unit', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                                                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <input type="number" min="0" step="any" value={row.rate} onChange={(e) => updateBillRow(i, 'rate', e.target.value)} style={{ width: '100%', textAlign: 'right', fontSize: 12 }} />
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb' }}>
                                                            <select value={row.gst} onChange={(e) => updateBillRow(i, 'gst', e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                                                                {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                                            </select>
                                                        </td>
                                                        <td style={{ padding: '3px 4px', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>
                                                            {row.amount ? fmtAmt(row.amount) : '—'}
                                                        </td>
                                                        <td style={{ padding: '4px 6px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                                            <button type="button" className="btn danger sm" onClick={() => removeBillRow(i)}>×</button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Totals */}
                        {billRows.length > 0 && (
                            <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
                                        <span style={{ color: '#6b7280', minWidth: 210, textAlign: 'right' }}>Items Subtotal:</span>
                                        <span style={{ fontWeight: 600, minWidth: 110, textAlign: 'right' }}>{fmtAmt(billSubtotal)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
                                        <label style={{ color: '#6b7280', minWidth: 210, textAlign: 'right' }}>Courier / Freight / Handling:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 110 }}>
                                            <span style={{ color: '#6b7280' }}>₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={billForm.freight_charges}
                                                onChange={(e) => {
                                                    const f = e.target.value;
                                                    setBillForm((p) => ({
                                                        ...p,
                                                        freight_charges: f,
                                                        round_off: autoRoundOff(billSubtotal, Number(f) || 0),
                                                    }));
                                                }}
                                                style={{ width: 95, textAlign: 'right' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 210, justifyContent: 'flex-end' }}>
                                            <span style={{ color: '#6b7280' }}>Round Off:</span>
                                            <button
                                                type="button"
                                                onClick={() => setBillForm((p) => ({ ...p, round_off: autoRoundOff(billSubtotal, billFreight) }))}
                                                style={{ fontSize: 11, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', cursor: 'pointer' }}
                                                title="Auto-calculate round off"
                                            >auto</button>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 110 }}>
                                            <span style={{ color: '#6b7280' }}>₹</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={billForm.round_off}
                                                onChange={(e) => setBillForm((p) => ({ ...p, round_off: e.target.value }))}
                                                style={{ width: 95, textAlign: 'right' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 16, borderTop: '2px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                                        <span style={{ fontWeight: 700, minWidth: 210, textAlign: 'right' }}>Grand Total:</span>
                                        <span style={{ fontWeight: 800, minWidth: 110, textAlign: 'right', color: '#1e40af', fontSize: 18 }}>{fmtAmt(billTotal)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add to stock */}
                        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="checkbox"
                                    id="addToStock"
                                    checked={billForm.add_to_stock}
                                    onChange={(e) => setBillForm((p) => ({ ...p, add_to_stock: e.target.checked }))}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                                <label htmlFor="addToStock" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: '#059669' }}>
                                    📦 Add Qty to Inventory Stock
                                </label>
                                <span style={{ fontSize: 12, color: '#6b7280' }}>— automatically update stock for all items in this bill</span>
                            </div>
                            {billForm.add_to_stock && godowns.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Godown / Warehouse</label>
                                    <select
                                        value={billForm.godown_id}
                                        onChange={(e) => setBillForm((p) => ({ ...p, godown_id: e.target.value }))}
                                        style={{ fontSize: 13, width: '100%', maxWidth: 300 }}
                                    >
                                        <option value="">— No specific godown —</option>
                                        {godowns.map((g) => <option key={g.id} value={g.id}>{g.name}{g.location ? ` (${g.location})` : ''}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => { setBillModal(false); resetBillForm(); }}>Cancel</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={submitBill}
                            disabled={billProcessing || (!billForm.vendor_name.trim() && !billForm.party_id) || billRows.length === 0}
                        >
                            {billProcessing ? 'Saving...' : 'Save Bill'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Material search dropdown (fixed, outside table overflow) ─── */}
            {billMatDropdown !== null && matDropdownRect && (() => {
                const row = billRows[billMatDropdown];
                if (!row || row.matSearch.trim().length < 1) return null;
                return (
                    <div
                        style={{
                            position: 'fixed',
                            top: matDropdownRect.top,
                            left: matDropdownRect.left,
                            width: matDropdownRect.width,
                            zIndex: 9999,
                            background: '#fff',
                            border: '1px solid #d1d5db',
                            borderRadius: 6,
                            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            maxHeight: 220,
                            overflowY: 'auto',
                        }}
                        onMouseDown={(e) => e.preventDefault()}
                    >
                        {matSearching && (
                            <div style={{ padding: '7px 10px', fontSize: 12, color: '#9ca3af' }}>Searching…</div>
                        )}
                        {matResults.map((m) => (
                            <div
                                key={m.id}
                                onMouseDown={(e) => { e.preventDefault(); selectBillRowMaterial(billMatDropdown, m); }}
                                style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                            >
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                                <div style={{ fontSize: 11, color: '#6b7280' }}>
                                    {m.sku ? `SKU: ${m.sku} · ` : ''}{m.category ?? ''}{m.category ? ' · ' : ''}{m.unit}
                                    {Number(m.cost_per_unit) > 0 ? ` · ₹${Number(m.cost_per_unit).toFixed(2)}` : ''}
                                </div>
                            </div>
                        ))}
                        {!matSearching && matResults.length === 0 && (
                            <div
                                onMouseDown={(e) => { e.preventDefault(); updateBillRow(billMatDropdown, 'material_name', row.matSearch); setBillMatDropdown(null); }}
                                style={{ padding: '7px 10px', cursor: 'pointer', color: '#2563eb', fontWeight: 600, fontSize: 13 }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                            >
                                ➕ Add as new: "{row.matSearch}"
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Reorder Modal ─────────────────────────────────────────────── */}
            <div className={`modal-overlay${reorderModal ? ' open' : ''}`} onClick={() => setReorderModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: '95%' }}>
                    <div className="modal-header">
                        <h3>🚚 Order Placed</h3>
                        <button className="modal-close" onClick={() => setReorderModal(false)}>×</button>
                    </div>
                    <form onSubmit={submitReorder} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        <div className="modal-body">
                            <div className="form-grid">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Material *</label>
                                    {reorderForm.data.raw_material_id ? (
                                        <>
                                            <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: 6, fontWeight: 600, color: '#1e40af', border: '1px solid #bfdbfe' }}>
                                                {materials.find((m) => String(m.id) === reorderForm.data.raw_material_id)?.name ?? '—'}
                                            </div>
                                            <input type="hidden" name="raw_material_id" value={reorderForm.data.raw_material_id} />
                                        </>
                                    ) : (
                                        <select
                                            value={reorderForm.data.raw_material_id}
                                            onChange={(e) => handleReorderMaterialChange(e.target.value)}
                                            required
                                        >
                                            <option value="">— Select material —</option>
                                            {materials.filter((m) => m.is_active).map((m) => (
                                                <option key={m.id} value={String(m.id)}>{m.name} ({m.unit})</option>
                                            ))}
                                        </select>
                                    )}
                                    {reorderForm.errors.raw_material_id && <div className="form-error">{reorderForm.errors.raw_material_id}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Qty Ordered *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={reorderForm.data.qty_ordered}
                                        onChange={(e) => reorderForm.setData('qty_ordered', e.target.value)}
                                        required
                                    />
                                    {reorderForm.errors.qty_ordered && <div className="form-error">{reorderForm.errors.qty_ordered}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Unit *</label>
                                    <select
                                        value={reorderForm.data.unit}
                                        onChange={(e) => reorderForm.setData('unit', e.target.value)}
                                        required
                                    >
                                        <option value="">— Unit —</option>
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                    {reorderForm.errors.unit && <div className="form-error">{reorderForm.errors.unit}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Vendor / Supplier *</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.supplier}
                                        onChange={(e) => reorderForm.setData('supplier', e.target.value)}
                                        placeholder="Vendor name"
                                    />
                                    {reorderForm.errors.supplier && <div className="form-error">{reorderForm.errors.supplier}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Order Date *</label>
                                    <input
                                        type="date"
                                        value={reorderForm.data.order_date}
                                        onChange={(e) => reorderForm.setData('order_date', e.target.value)}
                                        required
                                    />
                                    {reorderForm.errors.order_date && <div className="form-error">{reorderForm.errors.order_date}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Transport LR Number</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.lr_number}
                                        onChange={(e) => reorderForm.setData('lr_number', e.target.value)}
                                        placeholder="LR / docket number"
                                    />
                                    {reorderForm.errors.lr_number && <div className="form-error">{reorderForm.errors.lr_number}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Transport Company</label>
                                    <input
                                        type="text"
                                        value={reorderForm.data.transport_name}
                                        onChange={(e) => reorderForm.setData('transport_name', e.target.value)}
                                        placeholder="e.g. DTDC, Delhivery"
                                    />
                                    {reorderForm.errors.transport_name && <div className="form-error">{reorderForm.errors.transport_name}</div>}
                                </div>
                                <div className="form-group">
                                    <label>Expected Delivery</label>
                                    <input
                                        type="date"
                                        value={reorderForm.data.expected_delivery}
                                        onChange={(e) => reorderForm.setData('expected_delivery', e.target.value)}
                                    />
                                    {reorderForm.errors.expected_delivery && <div className="form-error">{reorderForm.errors.expected_delivery}</div>}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={reorderForm.data.notes}
                                        onChange={(e) => reorderForm.setData('notes', e.target.value)}
                                    />
                                    {reorderForm.errors.notes && <div className="form-error">{reorderForm.errors.notes}</div>}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setReorderModal(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={reorderForm.processing}>
                                {reorderForm.processing ? 'Saving...' : 'Place Reorder'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Packaging Wizard Modal ────────────────────────────────────── */}
            <div className={`modal-overlay${packModal ? ' open' : ''}`} onClick={() => setPackModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: '95%' }}>
                    <div className="modal-header">
                        <h3>📦 Packaging Wizard — Step {packStep} of 4</h3>
                        <button className="modal-close" onClick={() => setPackModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        {/* Step indicator */}
                        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                            {['Category', 'Size & Details', 'SKU Preview', 'Cost'].map((label, idx) => (
                                <div
                                    key={label}
                                    style={{
                                        flex: 1,
                                        textAlign: 'center',
                                        padding: '8px 4px',
                                        fontSize: 12,
                                        fontWeight: packStep === idx + 1 ? 700 : 400,
                                        background: packStep === idx + 1 ? '#2563eb' : packStep > idx + 1 ? '#d1fae5' : '#f9fafb',
                                        color: packStep === idx + 1 ? '#fff' : packStep > idx + 1 ? '#059669' : '#6b7280',
                                        borderRight: idx < 3 ? '1px solid #e5e7eb' : undefined,
                                    }}
                                >
                                    {packStep > idx + 1 ? '✓ ' : ''}{label}
                                </div>
                            ))}
                        </div>

                        {/* Step 1: Category */}
                        {packStep === 1 && (
                            <div>
                                <p style={{ color: '#6b7280', marginBottom: 16 }}>Select the type of packaging material:</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    {wizardCategories.map((cat) => (
                                        <button
                                            key={cat.code}
                                            type="button"
                                            onClick={() => packSelectCat(cat)}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '14px 8px',
                                                border: `2px solid ${cat.color ?? '#e5e7eb'}`,
                                                borderRadius: 10,
                                                background: cat.color ? cat.color + '11' : '#fff',
                                                cursor: 'pointer',
                                                transition: 'border-color 0.15s, background 0.15s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = cat.color ?? '#2563eb';
                                                e.currentTarget.style.background = cat.color ? cat.color + '22' : '#eff6ff';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = cat.color ?? '#e5e7eb';
                                                e.currentTarget.style.background = cat.color ? cat.color + '11' : '#fff';
                                            }}
                                        >
                                            <span style={{ fontSize: 28 }}>{cat.icon}</span>
                                            <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center' }}>{cat.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Step 2: Size & Details */}
                        {packStep === 2 && packCat && (
                            <div className="form-grid">
                                <div style={{ gridColumn: '1 / -1', marginBottom: 8, padding: '8px 12px', background: packCat.color ? packCat.color + '22' : '#eff6ff', border: `1px solid ${packCat.color ?? '#bfdbfe'}`, borderRadius: 8, fontWeight: 600, color: packCat.color ?? '#1e40af' }}>
                                    {packCat.icon} {packCat.label}
                                </div>
                                <div className="form-group">
                                    <label>Size (e.g. 500ml, 1L, 100gm)</label>
                                    <input
                                        type="text"
                                        value={packForm.size}
                                        onChange={(e) => setPackForm((p) => ({ ...p, size: e.target.value }))}
                                        placeholder="500ml"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Shape (e.g. Round, Square, Flat)</label>
                                    <input
                                        type="text"
                                        value={packForm.shape}
                                        onChange={(e) => setPackForm((p) => ({ ...p, shape: e.target.value }))}
                                        placeholder="Round"
                                    />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Box Dimensions (mm) — L × W × H</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_l}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_l: e.target.value }))}
                                            placeholder="L"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_w}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_w: e.target.value }))}
                                            placeholder="W"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#9ca3af', fontWeight: 700 }}>×</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={packForm.dim_h}
                                            onChange={(e) => setPackForm((p) => ({ ...p, dim_h: e.target.value }))}
                                            placeholder="H"
                                            style={{ flex: 1 }}
                                        />
                                        <span style={{ color: '#6b7280', fontSize: 13, whiteSpace: 'nowrap' }}>mm</span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>HSN</label>
                                    <input
                                        type="text"
                                        value={packForm.hsn}
                                        onChange={(e) => setPackForm((p) => ({ ...p, hsn: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>GST %</label>
                                    <select
                                        value={packForm.gst}
                                        onChange={(e) => setPackForm((p) => ({ ...p, gst: e.target.value }))}
                                    >
                                        {GST_OPTIONS.map((g) => <option key={g} value={g}>{g}%</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Step 3: SKU Preview */}
                        {packStep === 3 && packCat && (
                            <div className="form-grid">
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Auto-generated SKU</div>
                                        <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#059669' }}>
                                            {packForm.sku || buildSku(packCat.code, packForm.size, packForm.shape)}
                                        </div>
                                        {(packForm.dim_l || packForm.dim_w || packForm.dim_h) && (
                                            <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                                                📐 {[packForm.dim_l || '?', packForm.dim_w || '?', packForm.dim_h || '?'].join(' × ')} mm
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>SKU (editable)</label>
                                    <input
                                        type="text"
                                        value={packForm.sku}
                                        onChange={(e) => setPackForm((p) => ({ ...p, sku: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Unit</label>
                                    <select
                                        value={packForm.unit}
                                        onChange={(e) => setPackForm((p) => ({ ...p, unit: e.target.value }))}
                                    >
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Supplier</label>
                                    <input
                                        type="text"
                                        value={packForm.supplier}
                                        onChange={(e) => setPackForm((p) => ({ ...p, supplier: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Step 4: Cost */}
                        {packStep === 4 && (
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>Initial Stock (qty)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packForm.stock}
                                        onChange={(e) => setPackForm((p) => ({ ...p, stock: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Cost/Unit (₹)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={packForm.cost_per_unit}
                                        onChange={(e) => setPackForm((p) => ({ ...p, cost_per_unit: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>Selling Rate (₹)</span>
                                        <span style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', fontSize: 11, height: 20 }}>
                                            <button type="button" onClick={() => setPkgSellMode('manual')} style={{ padding: '0 8px', border: 'none', cursor: 'pointer', background: pkgSellMode === 'manual' ? 'var(--accent)' : 'var(--bg-paper)', color: pkgSellMode === 'manual' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>Manual</button>
                                            <button type="button" onClick={() => setPkgSellMode('profit')} style={{ padding: '0 8px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', background: pkgSellMode === 'profit' ? '#059669' : 'var(--bg-paper)', color: pkgSellMode === 'profit' ? '#fff' : 'var(--tx-muted)', fontWeight: 600 }}>% Profit</button>
                                        </span>
                                    </label>
                                    {pkgSellMode === 'manual' ? (
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={packForm.selling_rate}
                                            onChange={(e) => setPackForm((p) => ({ ...p, selling_rate: e.target.value }))}
                                        />
                                    ) : (
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    placeholder="Profit %"
                                                    value={pkgProfitPct}
                                                    onChange={(e) => {
                                                        setPkgProfitPct(e.target.value);
                                                        const cost = Number(packForm.cost_per_unit) || 0;
                                                        const pct  = Number(e.target.value) || 0;
                                                        setPackForm((p) => ({ ...p, selling_rate: String(cost * (1 + pct / 100)) }));
                                                    }}
                                                    style={{ paddingRight: 28 }}
                                                />
                                                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-muted)', fontSize: 13, pointerEvents: 'none' }}>%</span>
                                            </div>
                                            <span style={{ fontSize: 13, color: '#059669', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                = ₹{(Number(packForm.cost_per_unit) * (1 + Number(pkgProfitPct || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label>Notes</label>
                                    <textarea
                                        rows={2}
                                        value={packForm.notes}
                                        onChange={(e) => setPackForm((p) => ({ ...p, notes: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        {packStep > 1 && (
                            <button type="button" className="btn" onClick={() => setPackStep((s) => s - 1)}>Back</button>
                        )}
                        <button type="button" className="btn" onClick={() => setPackModal(false)}>Cancel</button>
                        {packStep === 1 && null}
                        {packStep === 2 && (
                            <button type="button" className="btn primary" onClick={packGoStep3}>Next: SKU Preview</button>
                        )}
                        {packStep === 3 && (
                            <button type="button" className="btn primary" onClick={packGoStep4}>Next: Cost</button>
                        )}
                        {packStep === 4 && (
                            <button type="button" className="btn primary" onClick={submitPackaging} disabled={packSubmitForm.processing}>
                                {packSubmitForm.processing ? 'Creating...' : 'Create Packaging Item'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Transport Detail Modal (On The Way) ───────────────────────── */}
            <div className={`modal-overlay${viewReorder ? ' open' : ''}`} onClick={() => setViewReorder(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95%' }}>
                    <div className="modal-header">
                        <h3>🚚 Transport Details</h3>
                        <button className="modal-close" onClick={() => setViewReorder(null)}>×</button>
                    </div>
                    {viewReorder && (
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: 14 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>MATERIAL</div>
                                    <div style={{ fontWeight: 700, color: '#1e40af' }}>{viewReorder.raw_material?.name ?? '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>QTY ORDERED</div>
                                    <div style={{ fontWeight: 700 }}>{fmt(viewReorder.qty_ordered)} {viewReorder.unit}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>VENDOR / SUPPLIER</div>
                                    <div>{viewReorder.supplier ?? '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>ORDER DATE</div>
                                    <div>{viewReorder.order_date ? fmtDate(viewReorder.order_date) : '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>TRANSPORT COMPANY</div>
                                    <div>{viewReorder.transport_name ?? '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>LR / DOCKET NUMBER</div>
                                    <div style={{ fontWeight: 600, color: '#2563eb' }}>{viewReorder.lr_number ?? '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>EXPECTED DELIVERY</div>
                                    <div>{viewReorder.expected_delivery ? fmtDate(viewReorder.expected_delivery) : '—'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>STATUS</div>
                                    {viewReorder?.status === 'received' ? (
                                        <div>
                                            <span className="badge teal">✓ Received</span>
                                            {viewReorder.received_by_user && (
                                                <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>
                                                    by <strong>{viewReorder.received_by_user.name}</strong>
                                                </div>
                                            )}
                                            {viewReorder.received_at && (
                                                <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(viewReorder.received_at)}</div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="badge sky">Pending</span>
                                    )}
                                </div>
                                {viewReorder.notes && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>NOTES</div>
                                        <div>{viewReorder.notes}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="modal-footer">
                        <button className="btn" onClick={() => setViewReorder(null)}>Close</button>
                        {viewReorder && viewReorder.status === 'pending' && canMarkReceived && (
                            <button
                                className="btn primary"
                                onClick={() => {
                                    if (!confirm('Mark as received? You can enter the purchase bill next to update stock.')) return;
                                    router.post(
                                        `/inventory/reorders/${viewReorder.id}/receive`,
                                        {},
                                        {
                                            preserveScroll: true,
                                            onSuccess: () => setViewReorder(null),
                                        },
                                    );
                                }}
                            >
                                ✓ Mark as Received
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Enter Bill (for received reorder) Modal ───────────────────── */}
            <div className={`modal-overlay${billReorder ? ' open' : ''}`} onClick={() => setBillReorder(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: '95%' }}>
                    <div className="modal-header">
                        <h3>🧾 Enter Purchase Bill</h3>
                        <button className="modal-close" onClick={() => setBillReorder(null)}>×</button>
                    </div>
                    <form onSubmit={submitBillReorder}>
                        <div className="modal-body">
                            {billReorder && (
                                <div style={{ marginBottom: 12, fontSize: 13, color: '#374151' }}>
                                    <strong>{billReorder.raw_material?.name ?? '—'}</strong> · {fmt(billReorder.qty_ordered)} {billReorder.unit}
                                </div>
                            )}
                            <div className="form-group">
                                <label>Vendor / Supplier *</label>
                                <input
                                    type="text"
                                    value={billReorderForm.vendor_name}
                                    onChange={(e) => setBillReorderForm((p) => ({ ...p, vendor_name: e.target.value }))}
                                    placeholder="Supplier name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill / Invoice Number</label>
                                <input
                                    type="text"
                                    value={billReorderForm.bill_number}
                                    onChange={(e) => setBillReorderForm((p) => ({ ...p, bill_number: e.target.value }))}
                                    placeholder="e.g. INV-2024-001"
                                />
                            </div>
                            <div className="form-group">
                                <label>Bill Date</label>
                                <input
                                    type="date"
                                    value={billReorderForm.bill_date}
                                    onChange={(e) => setBillReorderForm((p) => ({ ...p, bill_date: e.target.value }))}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Rate (per {billReorder?.unit ?? 'unit'})</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={billReorderForm.rate}
                                        onChange={(e) => setBillReorderForm((p) => ({ ...p, rate: e.target.value }))}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Total Amount</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={billReorderForm.total_amount}
                                        onChange={(e) => setBillReorderForm((p) => ({ ...p, total_amount: e.target.value }))}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Bill File (JPG, PNG, PDF — max 10 MB)</label>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,application/pdf"
                                    onChange={(e) => setBillReorderFile(e.target.files?.[0] ?? null)}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn" onClick={() => setBillReorder(null)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={billReorderProcessing || !billReorderForm.vendor_name.trim()}>
                                {billReorderProcessing ? 'Saving…' : 'Save Bill & Update Stock'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* ── Add Supplier Mini Modal ──────────────────────────────────── */}
            <div className={`modal-overlay${addSupplierModal ? ' open' : ''}`} onClick={() => setAddSupplierModal(false)} style={{ zIndex: 1100 }}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, width: '95%' }}>
                    <div className="modal-header">
                        <h3>➕ Add New Supplier</h3>
                        <button className="modal-close" onClick={() => setAddSupplierModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-grid">
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Name *</label>
                                <input
                                    type="text"
                                    value={addSupplierForm.name}
                                    onChange={(e) => setAddSupplierForm((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="Supplier / company name"
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="text"
                                    value={addSupplierForm.phone}
                                    onChange={(e) => setAddSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                                    placeholder="Mobile / landline"
                                />
                            </div>
                            <div className="form-group">
                                <label>GST Number</label>
                                <input
                                    type="text"
                                    value={addSupplierForm.gst_no}
                                    onChange={(e) => setAddSupplierForm((p) => ({ ...p, gst_no: e.target.value.toUpperCase() }))}
                                    placeholder="22AAAAA0000A1Z5"
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label>Type</label>
                                <select value={addSupplierForm.type} onChange={(e) => setAddSupplierForm((p) => ({ ...p, type: e.target.value }))}>
                                    <option value="supplier">Supplier only</option>
                                    <option value="both">Supplier + Customer</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => setAddSupplierModal(false)}>Cancel</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={submitAddSupplier}
                            disabled={addSupplierProcessing || !addSupplierForm.name.trim()}
                        >
                            {addSupplierProcessing ? 'Adding...' : 'Add Supplier'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Scan Bill Modal ───────────────────────────────────────────── */}
            <div className={`modal-overlay${scanModal ? ' open' : ''}`} onClick={() => setScanModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '95%' }}>
                    <div className="modal-header">
                        <h3>📸 Scan Bill</h3>
                        <button className="modal-close" onClick={() => setScanModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div
                            style={{
                                border: '2px dashed #d1d5db',
                                borderRadius: 12,
                                padding: '40px 20px',
                                textAlign: 'center',
                                background: '#f9fafb',
                                marginBottom: 16,
                            }}
                        >
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                            <div style={{ fontWeight: 600, marginBottom: 6 }}>Upload Bill Image or PDF</div>
                            <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>
                                Drag &amp; drop or click to select
                            </div>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: 'block', margin: '0 auto' }}
                            />
                        </div>
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
                            🤖 AI-powered bill scanning will automatically detect items. Upload a bill to get started.
                        </div>
                        <button
                            type="button"
                            className="btn primary"
                            disabled
                            style={{ width: '100%', opacity: 0.6, cursor: 'not-allowed' }}
                        >
                            🤖 Process with AI — Coming Soon
                        </button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => setScanModal(false)}>Close</button>
                    </div>
                </div>
            </div>
            {/* ── Category Add/Edit Modal ───────────────────────────────────── */}
            <div className={`modal-overlay${catMgmtModal ? ' open' : ''}`} onClick={() => setCatMgmtModal(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: '95%' }}>
                    <div className="modal-header">
                        <h3>{editingCat ? 'Edit Category' : 'Add Category'}</h3>
                        <button className="modal-close" onClick={() => setCatMgmtModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Category Name *</label>
                            <input
                                type="text"
                                value={catForm.name}
                                onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Packaging, Raw, Chemical"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Color (optional)</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={catForm.color || '#6366f1'}
                                    onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                                    style={{ width: 40, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                                />
                                <input
                                    type="text"
                                    value={catForm.color}
                                    onChange={(e) => setCatForm((f) => ({ ...f, color: e.target.value }))}
                                    placeholder="#6366f1 or leave blank"
                                    style={{ flex: 1 }}
                                />
                                {catForm.color && (
                                    <button type="button" className="btn sm" onClick={() => setCatForm((f) => ({ ...f, color: '' }))}>
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn" onClick={() => setCatMgmtModal(false)}>Cancel</button>
                        <button type="button" className="btn primary" disabled={catSaving || !catForm.name.trim()} onClick={submitCat}>
                            {catSaving ? 'Saving…' : editingCat ? 'Save Changes' : 'Add Category'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
