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
import { index as rateCalcIndex } from '@/routes/rate-calculator';
import { index as settingsIndex } from '@/routes/settings';
import { index as unitTransferIndex } from '@/routes/unit-transfer';
import { index as usersIndex } from '@/routes/users';
import type { Auth, Role } from '@/types';
import { Link, usePage, type InertiaLinkProps } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

type NavItem = {
    id: string;
    label: string;
    icon: string;
    href?: NonNullable<InertiaLinkProps['href']>;
};

type PageProps = {
    auth: Auth;
    pageTitle?: string;
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
        { id: 'factory', label: 'Production Orders', icon: '🏭', href: factoryIndex() },
        { id: 'filling', label: 'Filling', icon: '🧪', href: '/filling' as NonNullable<InertiaLinkProps['href']> },
        { id: 'bom', label: 'Bill of Materials', icon: '⚗️', href: bomIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'rate-calc', label: 'Rate Calculator', icon: '🧮', href: rateCalcIndex() },
        { id: 'unit-transfer', label: 'Unit Transfer', icon: '🔄', href: unitTransferIndex() },
        { id: 'design-orders', label: 'Design Orders', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Photo Gallery', icon: '📷', href: galleryIndex() },
        { id: 'parties', label: 'Parties', icon: '🏢', href: partiesIndex() },
        { id: 'users', label: 'User Management', icon: '👥', href: usersIndex() },
        { id: 'settings', label: 'Settings', icon: '⚙️', href: settingsIndex() },
    ],
    office: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'new-order', label: 'New Order', icon: '🌱', href: ordersCreate() },
        { id: 'all-orders', label: 'All Orders', icon: '📋', href: ordersIndex() },
        { id: 'parties', label: 'Parties', icon: '🏢', href: partiesIndex() },
        { id: 'rate-calc', label: 'Rate Calculator', icon: '🧮', href: rateCalcIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'design-orders', label: 'Design Orders', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Photo Gallery', icon: '📷', href: galleryIndex() },
    ],
    factory: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'factory', label: 'Production Orders', icon: '🏭', href: factoryIndex() },
        { id: 'unit-transfer', label: 'Unit Transfer', icon: '🔄', href: unitTransferIndex() },
        { id: 'bom', label: 'Bill of Materials', icon: '⚗️', href: bomIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'users', label: 'Factory Users', icon: '👥', href: usersIndex() },
    ],
    design: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'all-orders', label: 'My Design Orders', icon: '📋', href: ordersIndex() },
        { id: 'design-orders', label: 'Design Work', icon: '🎨', href: designIndex() },
        { id: 'photo-gallery', label: 'Photo Gallery', icon: '📷', href: galleryIndex() },
    ],
    accountant: [
        { id: 'acct-dashboard', label: 'Dashboard', icon: '📊', href: dashboard() },
        { id: 'all-orders', label: 'Orders', icon: '📋', href: ordersIndex() },
        { id: 'inventory', label: 'Products & HSN', icon: '🌿', href: inventoryIndex() },
    ],
    sales: [
        { id: 'dashboard', label: 'Dashboard', icon: '🌾', href: dashboard() },
        { id: 'new-order', label: 'New Order', icon: '🌱', href: ordersCreate() },
        { id: 'all-orders', label: 'All Orders', icon: '📋', href: ordersIndex() },
        { id: 'parties', label: 'Parties', icon: '🏢', href: partiesIndex() },
        { id: 'rate-calc', label: 'Rate Calculator', icon: '🧮', href: rateCalcIndex() },
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
    ],
};

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
    const { auth, pageTitle } = usePage<PageProps>().props;
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [timeLabel, setTimeLabel] = useState('');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const { resolvedAppearance, updateAppearance } = useAppearance();

    const role        = auth.user?.role ?? auth.user?.roles?.[0]?.slug ?? null;
    const permissions = (auth.user?.permissions ?? []) as string[];
    const modules     = (auth.user?.modules ?? []) as string[];

    // Maps a nav item id to the module slug required to see it.
    // Items not listed here have no module gate and always show.
    const MODULE_GATE: Record<string, string> = {
        factory:         'factory',
        bom:             'bom',
        filling:         'bottle-filling',
        inventory:       'inventory',
        'finished-goods':'finished-goods',
    };

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
        if (role !== 'admin' && modules.length > 0) {
            items = items.filter((item) => {
                const required = MODULE_GATE[item.id];
                return !required || modules.includes(required);
            });
        }
        return items;
    }, [role, permissions, modules]);

    useDraggableModals();

    const canReceiveNotifications = role === 'accountant' || role === 'sales' || role === 'admin';

    const fetchNotifications = () => {
        if (!canReceiveNotifications) return;
        fetch('/erp/notifications', { headers: { Accept: 'application/json' } })
            .then((r) => r.ok ? r.json() : [])
            .then((data: NotificationItem[]) => setNotifications(data))
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
                    <div className="sb-icon">🌿</div>
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
                <div className="sidebar-user">
                    <div
                        className={`u-avatar ${role ?? 'office'}`}
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

            {notifications.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
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
        </div>
    );
}
