const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const quizManager = require('./quizManager');
const authMiddleware = require('./middleware/authMiddleware');

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
app.get('/api/quizzes', async (req, res) => {
    res.json(await quizManager.getAllQuizzes());
});

app.get('/api/quizzes/:id', async (req, res) => {
    const quiz = await quizManager.getQuiz(req.params.id);
    if (quiz) res.json(quiz);
    else res.status(404).json({ error: 'Quiz not found' });
});

app.post('/api/quizzes', authMiddleware, async (req, res) => {
    const newQuiz = await quizManager.createQuiz(req.body);
    res.json(newQuiz);
});

app.put('/api/quizzes/:id', authMiddleware, async (req, res) => {
    const updatedQuiz = await quizManager.updateQuiz(req.params.id, req.body);
    if (updatedQuiz) res.json(updatedQuiz);
    else res.status(404).json({ error: 'Quiz not found' });
});

app.delete('/api/quizzes/:id', authMiddleware, async (req, res) => {
    const success = await quizManager.deleteQuiz(req.params.id);
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
        methods: ["GET", "POST"],
        credentials: true
    },
    // STRATÉGIE POLLING-ONLY (Stabilité maximale - mobile)
    transports: ["polling"],
    allowUpgrades: false,
    // Hardening pour réseaux instables (mobile)
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    allowEIO3: false
});

// Logging Engine.IO (Focus Polling)
io.engine.on("connection_error", (err) => {
    console.error(`[POLLING_ERR] code=${err.code} message=${err.message} req_url=${err.req?.url}`);
});

io.engine.on("connection", (engineSocket) => {
    console.log(`[POLLING] Connexion active: sid=${engineSocket.id} transport=${engineSocket.transport.name} ip=${engineSocket.remoteAddress}`);
    engineSocket.on("close", (reason) => {
        console.log(`[POLLING] Connexion close: sid=${engineSocket.id} raison=${reason}`);
    });
});

// HTTP server (when HTTPS is enabled) — Socket.IO accessible en HTTP ET HTTPS
// On n'utilise PAS de redirection : Socket.IO ne suit pas les redirections 301
let httpServer = null;
if (sslOptions) {
    httpServer = http.createServer(app);
    // Attacher Socket.IO aussi au serveur HTTP pour les clients Vite (dev)
    io.attach(httpServer);
}

io.on('connection', (socket) => {
    const transport = socket.conn.transport.name;
    console.log(`[IO] Client connecté: socketId=${socket.id} transport=${transport}`);

    socket.on('error', (err) => {
        console.error(`[IO_ERR] socketId=${socket.id}: ${err.message}`);
    });

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

    socket.on('disconnect', (reason) => {
        console.log(`[IO] Client déconnecté: socketId=${socket.id} raison=${reason}`);
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
    // HTTPS mode: serveur principal sur HTTPS_PORT, HTTP sur PORT (sans redirection — Socket.IO doit fonctionner en HTTP aussi)
    server.listen(HTTPS_PORT, () => {
        console.log(`[SERVER] HTTPS en écoute sur le port ${HTTPS_PORT}`);
        console.log(`[SERVER] Accès sécurisé: https://localhost:${HTTPS_PORT}`);
    });
    if (httpServer) {
        httpServer.listen(PORT, () => {
            console.log(`[SERVER] HTTP en écoute sur le port ${PORT} (Socket.IO accessible en HTTP et HTTPS)`);
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
