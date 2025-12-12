import { io } from 'socket.io-client';

// En développement (Vite), on force le port 3001.
// En production (NAS/Render), si le site est servi par le même serveur, 'undefined' laisse Socket.io se connecter automatiquement à l'URL courante.
// En dev, on utilise le hostname actuel (localhost ou IP) sur le port 3001
const URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : undefined);

export const socket = io(URL, {
    autoConnect: true
});
