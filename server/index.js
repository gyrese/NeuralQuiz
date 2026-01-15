const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const quizManager = require('./quizManager');

// Controllers
const quizController = require('./controllers/quizController');
const geoController = require('./controllers/geoController');
const drawController = require('./controllers/drawController');
const adminController = require('./controllers/adminController');
const { setupAperoController } = require('./controllers/aperoController');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Setup Admin Routes
adminController.setupRoutes(app);

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

const server = http.createServer(app);
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

// Setup Apéro Quiz Controller (uses its own namespace /apero)
setupAperoController(io, app);

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Delegate execution to game controllers
    // Each controller will register its own event listeners on the socket
    quizController.handleConnection(io, socket);
    geoController.handleConnection(io, socket);
    drawController.handleConnection(io, socket);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// --- SERVITUDE STATIQUE (POUR LE NAS/PROD) ---
// Sert les fichiers du frontend buildé s'ils existent
app.use(express.static(path.join(__dirname, '../client/dist')));

// Pour toutes les autres requêtes (SPA), renvoyer index.html
// Note: Commenté en dev car Vite gère le routing. Décommenter pour la production.
app.get(/(.*)/, (req, res) => {
    const indexPath = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send("Frontend build not found. Did you run 'npm run build' in the client folder?");
    }
});

server.listen(PORT, () => {
    console.log(`Serveur en écoute sur le port ${PORT}`);
});
