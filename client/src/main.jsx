import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Intercepteur global Fetch pour injecter automatiquement le token JWT d'administration
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('admin_token');
    const urlStr = typeof url === 'string' ? url : (url && url.url) ? url.url : '';
    const isApiRequest = urlStr.includes('/api/quizzes') || urlStr.includes('/api/admin') || urlStr.includes('/api/apero');

    if (token && isApiRequest) {
        options.headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
    }

    const response = await originalFetch(url, options);

    // Si le serveur répond que le token est invalide/expiré
    if (isApiRequest && (response.status === 401 || response.status === 403)) {
        console.warn('[AUTH] Token admin expiré ou invalide. Déconnexion automatique.');
        localStorage.removeItem('admin_token');
        window.dispatchEvent(new Event('admin-logout'));
    }

    return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

