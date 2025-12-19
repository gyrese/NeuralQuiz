import { io } from 'socket.io-client';

// En développement (Vite), on force le port 3001.
// En production (NAS/Render), si le site est servi par le même serveur, 'undefined' laisse Socket.io se connecter automatiquement à l'URL courante.
// En dev, on utilise le hostname actuel (localhost ou IP) sur le port 3001
const URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : undefined);

export const socket = io(URL, {
    autoConnect: true,
    // Reconnection settings for mobile stability
    reconnection: true,
    reconnectionAttempts: Infinity,  // Never stop trying
    reconnectionDelay: 500,          // Start with 500ms (faster initial retry)
    reconnectionDelayMax: 3000,      // Max 3s between attempts (reduced for responsiveness)
    randomizationFactor: 0.3,        // Random jitter to prevent thundering herd
    timeout: 10000,                  // 10s connection timeout (reduced for faster retry)
    // Transports - prefer WebSocket but fallback to polling
    transports: ['websocket', 'polling'],
    // Upgrade from polling to websocket when possible
    upgrade: true,
    // Force new connection on reconnect (helps with stale connections)
    forceNew: false,
    // Ping settings for mobile keep-alive
    // These are configured server-side, but client should be compatible
});

// Debug: Log connection events
if (import.meta.env.DEV) {
    socket.on('connect', () => console.log('[Socket] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));
    socket.on('connect_error', (err) => console.log('[Socket] Connect error:', err.message));
    socket.on('reconnect', (attempt) => console.log('[Socket] Reconnected after', attempt, 'attempts'));
    socket.on('reconnect_attempt', (attempt) => console.log('[Socket] Reconnection attempt', attempt));
}
