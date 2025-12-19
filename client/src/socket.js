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
    reconnectionDelay: 1000,         // Start with 1s
    reconnectionDelayMax: 5000,      // Max 5s between attempts
    timeout: 20000,                  // 20s connection timeout
    // Transports - prefer WebSocket but fallback to polling
    transports: ['websocket', 'polling']
});
