import { useAppearance } from '@/hooks/use-appearance';
import { useDraggableModals } from '@/hooks/use-draggable-modals';
import { dashboard, logout } from '@/routes';
import { index as bomIndex } from '@/routes/bom';
import { index as designIndex } from '@/routes/design';
import { index as galleryIndex } from '@/routes/design/gallery';
import { index as factoryIndex } from '@/routes/factory';
import { index as finishedGoodsIndex } from '@/routes/finished-goods';
import { index as inventoryIndex } from '@/routes/inventory';
import { create as ordersCreate, index as ordersIndex } from '@/routes/orders';
import { index as partiesIndex } from '@/routes/parties';
import { index as partyLedgerIndex } from '@/routes/parties/ledger';
import { index as productsIndex } from '@/routes/products';
import { index as inventoryPoolsIndex } from '@/routes/inventory-pools';
import { index as companiesIndex } from '@/routes/companies';
import { index as policiesIndex } from '@/routes/policies';
import { index as rateCalcIndex } from '@/routes/rate-calculator';
import { index as settingsIndex } from '@/routes/settings';
import { index as unitTransferIndex } from '@/routes/unit-transfer';
import { index as usersIndex } from '@/routes/users';
import companies from '@/routes/companies';
import type { Auth, Role } from '@/types';
import { Link, router, usePage, type InertiaLinkProps } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

type NavItem = {
    id: string;
    label: string;
    icon: string;
    href?: NonNullable<InertiaLinkProps['href']>;
};

type PageProps = {
    auth: Auth;
    pageTitle?: string;
    pendingApprovalsCount?: number;
};

const NAV_DEFS: Record<string, NavItem[]> = {
    admin: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        {
            id: 'all-orders',
            label: 'All Orders',
            icon: '📋',
            href: ordersIndex(),
        },
        {
            id: 'new-order',
            label: 'New Order',
            icon: '🌱',
            href: ordersCreate(),
        },
        { id: 'transport-report', label: 'Transport Report', icon: '🚚', href: '/transport-report' as NonNullable<InertiaLinkProps['href']> },
        { id: 'factory', label: 'Production Orders', icon: '🏭', href: factoryIndex() },
        { id: 'filling', label: 'Filling', icon: '🧪', href: '/filling' as NonNullable<InertiaLinkProps['href']> },
        { id: 'bom', label: 'Bill of Materials', icon: '⚗️', href: bomIndex() },
        { id: 'products', label: 'Products', icon: '🏷️', href: productsIndex() },
        { id: 'inventory-pools', label: 'Shared Inventory', icon: '🔗', href: inventoryPoolsIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'rate-calc', label: 'Rate Calculator', icon: '🧮', href: rateCalcIndex() },
        { id: 'unit-transfer', label: 'Unit Transfer', icon: '🔄', href: unitTransferIndex() },
        { id: 'design-orders', label: 'Design Orders', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Product Gallery', icon: '📷', href: galleryIndex() },
        { id: 'parties', label: 'Parties', icon: '🏢', href: partiesIndex() },
        { id: 'party-ledger', label: 'Party Ledger', icon: '📒', href: partyLedgerIndex() },
        { id: 'suppliers', label: 'Supplier / Vendor', icon: '🏭', href: '/suppliers' as NonNullable<InertiaLinkProps['href']> },
        { id: 'profit-loss', label: 'Profit / Loss', icon: '📈', href: '/reports/profit-loss' as NonNullable<InertiaLinkProps['href']> },
        { id: 'users', label: 'User Management', icon: '👥', href: usersIndex() },
        { id: 'companies', label: 'Companies', icon: '🏬', href: companiesIndex() },
        { id: 'policies', label: 'Policies', icon: '🛡️', href: policiesIndex() },
        { id: 'settings', label: 'Settings', icon: '⚙️', href: settingsIndex() },
    ],
    sales: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'new-order', label: 'New Order', icon: '🌱', href: ordersCreate() },
        { id: 'all-orders', label: 'All Orders', icon: '📋', href: ordersIndex() },
        { id: 'transport-report', label: 'Transport Report', icon: '🚚', href: '/transport-report' as NonNullable<InertiaLinkProps['href']> },
        { id: 'parties', label: 'Parties', icon: '🏢', href: partiesIndex() },
        { id: 'party-ledger', label: 'Party Ledger', icon: '📒', href: partyLedgerIndex() },
        { id: 'rate-calc', label: 'Rate Calculator', icon: '🧮', href: rateCalcIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'products', label: 'Products', icon: '🏷️', href: productsIndex() },
        { id: 'design-orders', label: 'Design Orders', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Product Gallery', icon: '📷', href: galleryIndex() },
    ],
    factory: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'factory', label: 'Production Orders', icon: '🏭', href: factoryIndex() },
        { id: 'transport-report', label: 'Transport Report', icon: '🚚', href: '/transport-report' as NonNullable<InertiaLinkProps['href']> },
        { id: 'unit-transfer', label: 'Unit Transfer', icon: '🔄', href: unitTransferIndex() },
        { id: 'bom', label: 'Bill of Materials', icon: '⚗️', href: bomIndex() },
        { id: 'products', label: 'Products', icon: '🏷️', href: productsIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'users', label: 'Factory Users', icon: '👥', href: usersIndex() },
    ],
    design: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'all-orders', label: 'My Design Orders', icon: '📋', href: ordersIndex() },
        { id: 'design-orders', label: 'Design Work', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Product Gallery', icon: '📷', href: galleryIndex() },
    ],
    accountant: [
        { id: 'acct-dashboard', label: 'Dashboard', icon: '📊', href: dashboard() },
        { id: 'all-orders', label: 'Orders', icon: '📋', href: ordersIndex() },
        { id: 'transport-report', label: 'Transport Report', icon: '🚚', href: '/transport-report' as NonNullable<InertiaLinkProps['href']> },
        { id: 'party-ledger', label: 'Party Ledger', icon: '📒', href: partyLedgerIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
    ],
};

// Union of every nav item across all roles, for the admin "sidebar visibility" checklist.
export const ALL_NAV_ITEMS: { id: string; label: string }[] = (() => {
    const seen = new Map<string, string>();
    Object.values(NAV_DEFS).forEach((items) => {
        items.forEach((item) => {
            if (!seen.has(item.id)) seen.set(item.id, item.label);
        });
    });
    return Array.from(seen, ([id, label]) => ({ id, label }));
})();

const roleLabel = (roles?: Role[], role?: string | null): string => {
    if (roles && roles.length > 0) {
        return roles.map((item) => item.name).join(', ');
    }

    if (role) {
        return role.charAt(0).toUpperCase() + role.slice(1);
    }

    return 'User';
};

const initials = (name?: string | null): string => {
    if (!name) {
        return 'U';
    }

    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

type NotificationItem = {
    id: string;
    data: {
        order_id: number;
        order_number: string;
        company_name: string;
        total_amount: string;
    };
    created_at: string;
};

export default function ErpLayout({ children }: { children: React.ReactNode }) {
    const { auth, pageTitle, pendingApprovalsCount } = usePage<PageProps>().props;
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [timeLabel, setTimeLabel] = useState('');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [toastQueue, setToastQueue] = useState<NotificationItem[]>([]);
    const seenIds = useRef<Set<string>>(new Set());
    const { resolvedAppearance, updateAppearance } = useAppearance();

    const role        = auth.user?.role ?? auth.user?.roles?.[0]?.slug ?? null;
    const permissions = (auth.user?.permissions ?? []) as string[];
    const hiddenNavItems = (auth.user?.hidden_nav_items ?? []) as string[];

    const navItems = useMemo(() => {
        const base = NAV_DEFS[role ?? 'admin'] ?? [];
        let items = base;
        if (role === 'factory' && permissions.includes('filling')) {
            const insertAfter = items.findIndex((i) => i.id === 'factory');
            const fillingItem: NavItem = { id: 'filling', label: 'Filling', icon: '🧪', href: '/filling' as NonNullable<InertiaLinkProps['href']> };
            items = insertAfter >= 0
                ? [...items.slice(0, insertAfter + 1), fillingItem, ...items.slice(insertAfter + 1)]
                : [...items, fillingItem];
        }
        if (role !== 'admin' && !permissions.includes('manage_users')) {
            items = items.filter((i) => i.id !== 'users');
        }
        if (hiddenNavItems.length > 0) {
            items = items.filter((item) => !hiddenNavItems.includes(item.id));
        }
        return items;
    }, [role, permissions, hiddenNavItems]);

    useDraggableModals();

    const canReceiveNotifications = role === 'accountant' || role === 'sales' || role === 'admin';

    const fetchNotifications = () => {
        if (!canReceiveNotifications) return;
        fetch('/erp/notifications', { headers: { Accept: 'application/json' } })
            .then((r) => r.ok ? r.json() : [])
            .then((data: NotificationItem[]) => {
                setNotifications(data);
                // Queue toast for any notification we haven't seen yet.
                // Accountants only see the toast for orders > ₹50k.
                const fresh = data.filter((n) => {
                    if (seenIds.current.has(n.id)) return false;
                    if (role === 'accountant' && Number(n.data.total_amount) <= 50000) return false;
                    return true;
                });
                if (fresh.length > 0) {
                    fresh.forEach((n) => seenIds.current.add(n.id));
                    setToastQueue((prev) => [...prev, ...fresh]);
                }
                // Mark skipped items as seen so they don't re-queue on next poll
                data.filter((n) => !seenIds.current.has(n.id)).forEach((n) => seenIds.current.add(n.id));
            })
            .catch(() => {});
    };

    const dismissNotification = (id: string) => {
        fetch(`/erp/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '', Accept: 'application/json' },
        }).then(() => setNotifications((prev) => prev.filter((n) => n.id !== id)));
    };

    const dismissAll = () => {
        fetch('/erp/notifications/read-all', {
            method: 'POST',
            headers: { 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '', Accept: 'application/json' },
        }).then(() => setNotifications([]));
    };

    useEffect(() => {
        if (!canReceiveNotifications) return;
        fetchNotifications();
        const interval = window.setInterval(fetchNotifications, 30000);
        const onFocus = () => fetchNotifications();
        window.addEventListener('focus', onFocus);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role]);

    // Auto-dismiss each toast after 6 seconds
    useEffect(() => {
        if (toastQueue.length === 0) return;
        const timer = window.setTimeout(() => {
            setToastQueue((prev) => prev.slice(1));
        }, 6000);
        return () => window.clearTimeout(timer);
    }, [toastQueue]);

    useEffect(() => {
        const updateTime = () => {
            setTimeLabel(
                new Date().toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                }),
            );
        };

        updateTime();
        const interval = window.setInterval(updateTime, 30000);

        return () => window.clearInterval(interval);
    }, []);

    const toggleTheme = () => {
        updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
    };

    const userCompanies = auth.user?.companies ?? [];

    const handleCompanyChange = (companyId: number) => {
        router.post(companies.switch.url(), { company_id: companyId }, { preserveScroll: true });
    };

    return (
        <div id="app-screen" className="visible">
            <div
                className={`mob-overlay${isMobileOpen ? ' show' : ''}`}
                onClick={() => setIsMobileOpen(false)}
            />
            <aside
                className={`sidebar${isMobileOpen ? ' mobile-open' : ''}`}
                id="main-sidebar"
            >
                <div className="sidebar-brand">
                    <div className="sb-icon">
                        <img src="/ubc-logo.png" alt="UBC" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
                    </div>
                    <div className="sb-text">
                        <h3>Unicrop Biochem</h3>
                        <span>Agrochem Order System</span>
                    </div>
                    <button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        id="theme-btn"
                        title="Toggle Light/Dark"
                    >
                        {resolvedAppearance === 'dark' ? '☀️' : '🌙'}
                    </button>
                </div>
                {userCompanies.length > 1 && (
                    <div className="sidebar-company-switch">
                        <select
                            className="company-switcher"
                            value={auth.current_company?.id ?? ''}
                            onChange={(event) => handleCompanyChange(Number(event.target.value))}
                            title="Switch company"
                        >
                            {userCompanies.map((company) => (
                                <option key={company.id} value={company.id}>
                                    🏢 {company.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="sidebar-user">
                    <div
                        className={`u-avatar ${role ?? 'sales'}`}
                        id="sb-avatar"
                    >
                        {initials(auth.user?.name)}
                    </div>
                    <div className="u-info">
                        <div className="u-role" id="sb-role">
                            {roleLabel(auth.user?.roles, role)}
                        </div>
                        <div className="u-name" id="sb-name">
                            {auth.user?.name ?? '—'}
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav" id="sidebar-nav">
                    <div className="nav-label">Navigation</div>
                    {navItems.map((item) =>
                        item.href ? (
                            <Link
                                key={item.id}
                                href={item.href}
                                className="nav-item"
                                onClick={() => setIsMobileOpen(false)}
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                                {item.id === 'inventory' && pendingApprovalsCount && pendingApprovalsCount > 0 ? (
                                    <span style={{
                                        marginLeft: 'auto', background: '#ef4444', color: '#fff',
                                        borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                                        padding: '1px 6px', minWidth: '18px', textAlign: 'center',
                                    }}>{pendingApprovalsCount}</span>
                                ) : null}
                            </Link>
                        ) : (
                            <button
                                key={item.id}
                                type="button"
                                className="nav-item"
                                aria-disabled="true"
                            >
                                <span className="nav-icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </button>
                        ),
                    )}
                </nav>
                <div className="sidebar-footer">
                    <Link
                        className="logout-btn"
                        href={logout()}
                        method="post"
                        as="button"
                    >
                        🚪 &nbsp;Sign Out
                    </Link>
                </div>
            </aside>

            <div className="main-content">
                <div className="topbar">
                    <button
                        className="mob-hamburger"
                        onClick={() => setIsMobileOpen(!isMobileOpen)}
                        id="mob-hamburger"
                    >
                        ☰
                    </button>
                    <div className="topbar-title" id="tb-title">
                        {pageTitle ?? 'Dashboard'}
                    </div>
                    <div className="topbar-chip" id="tb-time">
                        {timeLabel}
                    </div>
                </div>

                <div className="content-area">{children}</div>
            </div>

            {/* ── Persistent notification panel (bottom-right) ── */}
            {notifications.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9990,
                    maxWidth: '360px', width: '100%',
                    background: 'var(--card-bg, #fff)', border: '1.5px solid #fcd34d',
                    borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', background: '#fef3c7', borderBottom: '1px solid #fcd34d',
                    }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#92400e' }}>
                            🔔 Order Ready ({notifications.length})
                        </span>
                        <button
                            onClick={dismissAll}
                            style={{ fontSize: '11px', color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                            Dismiss All
                        </button>
                    </div>
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                        {notifications.map((n) => (
                            <div key={n.id} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '10px 14px', borderBottom: '1px solid var(--border-color, #e5e7eb)',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary, #111)' }}>
                                        Order #{n.data.order_number} ready
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted, #6b7280)', marginTop: '2px' }}>
                                        {n.data.company_name} &mdash; ₹{Number(n.data.total_amount).toLocaleString('en-IN')}
                                    </div>
                                </div>
                                <button
                                    onClick={() => dismissNotification(n.id)}
                                    style={{ flexShrink: 0, fontSize: '16px', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', paddingTop: '2px' }}
                                    title="Dismiss"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Popup toast (top-center, auto-dismisses after 6 s) ── */}
            {toastQueue.length > 0 && (() => {
                const n = toastQueue[0];
                const isBig = Number(n.data.total_amount) > 50000;
                const accent      = isBig ? '#dc2626' : '#22c55e';
                const accentLight = isBig ? '#fef2f2' : '#dcfce7';
                const textColor   = isBig ? '#7f1d1d' : '#14532d';
                return (
                    <div style={{
                        position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
                        zIndex: 99999, minWidth: 320, maxWidth: 460,
                        background: '#fff', borderRadius: 14,
                        boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                        border: `2px solid ${accent}`,
                        overflow: 'hidden',
                        animation: 'slideDownFade 0.35s ease',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px',
                        }}>
                            <div style={{
                                flexShrink: 0, width: 44, height: 44, borderRadius: '50%',
                                background: accentLight, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 22,
                            }}>{isBig ? '🧾' : '✅'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: textColor }}>
                                    {isBig
                                        ? `Order #${n.data.order_number} — Create Tax Invoice & E-Way Bill`
                                        : `Order #${n.data.order_number} — Ready!`}
                                </div>
                                <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                                    {n.data.company_name}
                                    {n.data.total_amount && Number(n.data.total_amount) > 0
                                        ? ` — ₹${Number(n.data.total_amount).toLocaleString('en-IN')}`
                                        : ''}
                                </div>
                                {isBig && (
                                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                                        Amount exceeds ₹50,000 — Tax Invoice &amp; E-Way Bill required
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setToastQueue((prev) => prev.slice(1))}
                                style={{ flexShrink: 0, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}
                                title="Close"
                            >×</button>
                        </div>
                        {/* Progress bar that shrinks over 6 s */}
                        <div style={{ height: 3, background: accentLight }}>
                            <div style={{
                                height: '100%', background: accent,
                                animation: 'shrinkBar 6s linear forwards',
                            }} />
                        </div>
                    </div>
                );
            })()}

            <style>{`
                @keyframes slideDownFade {
                    from { opacity: 0; transform: translateX(-50%) translateY(-16px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
                @keyframes shrinkBar {
                    from { width: 100%; }
                    to   { width: 0%; }
                }
            `}</style>
        </div>
    );
}
