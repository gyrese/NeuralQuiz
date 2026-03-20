const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const quizManager = require('./quizManager');

// Controllers
const quizController = require('./controllers/quizController');
const geoController = require('./controllers/geoController');
const drawController = require('./controllers/drawController');
const adminController = require('./controllers/adminController');
const aperoController = require('./controllers/aperoController');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Setup Admin Routes
adminController.setupRoutes(app);
// Setup Apero API Routes
aperoController.setupAperoRoutes(app);

// Servir les fichiers uploadés (Images, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API REST pour l'Admin
app.get('/api/quizzes', (req, res) => {
    res.json(quizManager.getAllQuizzes());
});

app.get('/api/quizzes/:id', (req, res) => {
    const quiz = quizManager.getQuiz(req.params.id);
    if (quiz) res.json(quiz);
    else res.status(404).json({ error: 'Quiz not found' });
});

app.post('/api/quizzes', (req, res) => {
    const newQuiz = quizManager.createQuiz(req.body);
    res.json(newQuiz);
});

app.put('/api/quizzes/:id', (req, res) => {
    const updatedQuiz = quizManager.updateQuiz(req.params.id, req.body);
    if (updatedQuiz) res.json(updatedQuiz);
    else res.status(404).json({ error: 'Quiz not found' });
});

app.delete('/api/quizzes/:id', (req, res) => {
    const success = quizManager.deleteQuiz(req.params.id);
    if (success) res.json({ success: true });
    else res.status(404).json({ error: 'Quiz not found' });
});

// --- HTTPS / HTTP SERVER SETUP ---
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const PORT = process.env.PORT || 3001;

// Try to load SSL certificates
let sslOptions = null;
const certDir = path.join(__dirname, 'certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
        sslOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        console.log('[SERVER] SSL certificates loaded from server/certs/');
    } catch (err) {
        console.warn('[SERVER] Failed to load SSL certificates:', err.message);
    }
}

// Create main server: HTTPS if certs available, HTTP otherwise
let server;
if (sslOptions) {
    server = https.createServer(sslOptions, app);
    console.log('[SERVER] HTTPS mode enabled');
} else {
    server = http.createServer(app);
    console.log('[SERVER] HTTP mode (no SSL certificates)');
}

const io = new Server(server, {
    maxHttpBufferSize: 1e8,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    // Ping settings for mobile stability
    pingTimeout: 30000,     // 30s before considering connection dead
    pingInterval: 10000,    // Ping every 10s to keep connection alive
    // Allow upgrades from polling to websocket
    allowUpgrades: true,
    // Increase for slow mobile connections
    upgradeTimeout: 30000
});

// HTTP → HTTPS redirect server (when HTTPS is enabled)
let httpRedirectServer = null;
if (sslOptions) {
    const redirectApp = express();
    redirectApp.use((req, res) => {
        const httpsUrl = `https://${req.hostname}:${HTTPS_PORT}${req.url}`;
        res.redirect(301, httpsUrl);
    });
    httpRedirectServer = http.createServer(redirectApp);
}

io.on('connection', (socket) => {
    console.log('[SERVER] User connected:', socket.id);

    try {
        // Delegate execution to game controllers
        // Each controller will register its own event listeners on the socket
        quizController.handleConnection(io, socket);
        geoController.handleConnection(io, socket);
        drawController.handleConnection(io, socket);
        aperoController.handleConnection(io, socket);
        console.log('[SERVER] All controllers initialized for socket:', socket.id);
    } catch (error) {
        console.error('[SERVER] ERROR initializing controllers for socket', socket.id, ':', error);
    }

    socket.on('disconnect', () => {
        console.log('[SERVER] User disconnected:', socket.id);
    });
});

// --- SERVITUDE STATIQUE (POUR LE NAS/PROD) ---
// Sert les fichiers du frontend buildé s'ils existent
app.use(express.static(path.join(__dirname, '../client/dist')));

// Pour toutes les autres requêtes (SPA), renvoyer index.html
// Note: Commenté en dev car Vite gère le routing. Décommenter pour la production.
app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Frontend build not found. Did you run 'npm run build' in the client folder?");
    }
});

if (sslOptions) {
    // HTTPS mode: main server on HTTPS_PORT, redirect HTTP on PORT
    server.listen(HTTPS_PORT, () => {
        console.log(`[SERVER] HTTPS en écoute sur le port ${HTTPS_PORT}`);
        console.log(`[SERVER] Accès sécurisé: https://localhost:${HTTPS_PORT}`);
    });
    if (httpRedirectServer) {
        httpRedirectServer.listen(PORT, () => {
            console.log(`[SERVER] HTTP→HTTPS redirect sur le port ${PORT}`);
        });
    }
} else {
    // HTTP mode: main server on PORT
    server.listen(PORT, () => {
        console.log(`[SERVER] HTTP en écoute sur le port ${PORT}`);
    });
    console.log('[SERVER] Pour activer HTTPS, placez key.pem et cert.pem dans server/certs/');
    console.log('[SERVER] Générer un certificat auto-signé:');
    console.log('  openssl req -x509 -newkey rsa:2048 -keyout server/certs/key.pem -out server/certs/cert.pem -days 365 -nodes -subj "/CN=LTNhout"');
}
