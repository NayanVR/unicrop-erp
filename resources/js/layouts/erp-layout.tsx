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
        { id: 'inventory', label: 'Inventory', icon: '🗄️', href: inventoryIndex() },
        { id: 'settings', label: 'Products & HSN', icon: '🌿', href: settingsIndex() },
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

export default function ErpLayout({ children }: { children: React.ReactNode }) {
    const { auth, pageTitle } = usePage<PageProps>().props;
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [timeLabel, setTimeLabel] = useState('');
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
        </div>
    );
}
