import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo: Echo;
    }
}

window.Pusher = Pusher;

const isHttps = window.location.protocol === 'https:';

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY as string,
    // Connect over the same host + standard web port as the app.
    // nginx proxies /app and /apps to the local Reverb server, so no
    // separate port needs to be exposed in Dokploy.
    wsHost: window.location.hostname,
    wsPort: isHttps ? 443 : 80,
    wssPort: isHttps ? 443 : 80,
    forceTLS: isHttps,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
});

export default window.Echo;
