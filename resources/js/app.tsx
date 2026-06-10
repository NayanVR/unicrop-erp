import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { router } from '@inertiajs/react';
import { createInertiaApp } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

const ICONS: Record<string, string> = {
    stage_changed: '🔄',
    dispatched: '📦',
    order_confirmed: '✅',
};

function ErpActivityListener() {
    useEffect(() => {
        let active = true;
        import('@/echo').then((mod) => {
            if (!active) return; // strict-mode double-fire guard
            mod.default
                .channel('erp.activity')
                .listen('.activity', (e: { type: string; message: string }) => {
                    const icon = ICONS[e.type] ?? '🔔';
                    toast(`${icon} ${e.message}`, {
                        duration: 7000,
                        action: { label: 'Refresh', onClick: () => router.reload() },
                    });
                });
        });
        return () => {
            active = false;
            window.Echo?.leaveChannel('erp.activity');
        };
    }, []);
    return null;
}

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name === 'auth/login':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                <ErpActivityListener />
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();

// Register service worker for PWA installability and offline asset caching.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}
