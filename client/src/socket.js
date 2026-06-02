import { io } from 'socket.io-client';

// En production (NAS), le site est servi par le même serveur → undefined = même origine
// En dev, on cible le bon port serveur selon le protocole utilisé par Vite :
//   - Si la page est servie en HTTPS (ex: certificat auto-signé sur NAS), on pointe vers le port HTTPS du serveur (3443)
//   - Sinon on pointe vers le port HTTP (3005)
function getServerURL() {
    if (import.meta.env.VITE_SERVER_URL) return import.meta.env.VITE_SERVER_URL;
    if (!import.meta.env.DEV) return undefined;
    const isHttps = window.location.protocol === 'https:';
    const port = isHttps ? 3443 : 3005;
    const proto = isHttps ? 'https' : 'http';
    return `${proto}://${window.location.hostname}:${port}`;
}
const URL = getServerURL();

export const socket = io(URL, {
    autoConnect: true,
    // STRATÉGIE POLLING-ONLY (Stabilité maximale - mobile)
    transports: ['polling'],
    upgrade: false,
    rememberUpgrade: false,
    // Reconnexion robuste
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,  // Plus lent pour le polling
    randomizationFactor: 0.5,
    timeout: 20000,
    forceNew: false,
});

// Exposition du socket pour les tests E2E uniquement (jamais en usage normal).
// Le flag window.__E2E__ est posé par Playwright via addInitScript avant le chargement.
if (typeof window !== 'undefined' && window.__E2E__) {
    window.__geoSocket = socket;
}

// Debug: Log connection events (toujours actif pour diagnostic mobile)
socket.on('connect', () => {
    const transport = socket.io?.engine?.transport?.name;
    console.log(`[SOCKET] Connecté (POLLING) socket=${socket.id} transport=${transport}`);
});
socket.on('disconnect', (reason) => console.log(`[SOCKET] Déconnecté: ${reason}`));
socket.on('connect_error', (err) => console.error(`[SOCKET] Erreur connexion: ${err.message}`));
socket.io.on('reconnect_attempt', (attempt) => console.log(`[SOCKET] Tentative reconnexion #${attempt}`));
socket.io.on('reconnect_error', (err) => console.error(`[SOCKET] Erreur reconnexion: ${err.message}`));
socket.io.on('reconnect_failed', () => console.error('[SOCKET] Échec définitif de la reconnexion'));
