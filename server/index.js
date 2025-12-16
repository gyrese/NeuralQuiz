const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const gameManager = require('./gameManager');
const quizManager = require('./quizManager');
const geoGameManager = require('./geoGameManager');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

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
    }
});

// Fonction pour calculer les statistiques amusantes
function calculateStats(players) {
    const stats = {
        demographics: {},
        correlations: [],
        topPerformers: {}
    };

    const categories = ['hairColor', 'profession', 'isSportive', 'isVegetarian',
        'zodiacSign', 'favoriteDrink', 'favoriteAnimal', 'bedtime', 'coffeesPerDay'];

    categories.forEach(category => {
        const counts = {};
        const scores = {};

        players.forEach(p => {
            const value = p.profile[category];
            if (value) {
                counts[value] = (counts[value] || 0) + 1;
                if (!scores[value]) scores[value] = [];
                scores[value].push(p.score);
            }
        });

        stats.demographics[category] = counts;

        Object.keys(scores).forEach(value => {
            const avg = scores[value].reduce((a, b) => a + b, 0) / scores[value].length;

            if (!stats.topPerformers[category]) stats.topPerformers[category] = {};
            stats.topPerformers[category][value] = {
                avgScore: Math.round(avg),
                count: scores[value].length
            };
        });
    });


    // Générer des corrélations amusantes
    const funFacts = [];

    // 1. Battle Chat vs Chien (prioritaire)
    if (stats.topPerformers.favoriteAnimal?.Chat && stats.topPerformers.favoriteAnimal?.Chien) {
        const chatScore = stats.topPerformers.favoriteAnimal.Chat.avgScore;
        const chienScore = stats.topPerformers.favoriteAnimal.Chien.avgScore;
        const diff = Math.abs(chatScore - chienScore);
        if (diff > 100) { // Seulement si la différence est significative
            if (chatScore > chienScore) {
                funFacts.push(`🐱 Team Chat domine avec ${diff} points d'avance !`);
            } else {
                funFacts.push(`🐶 Team Chien écrase avec ${diff} points d'avance !`);
            }
        }
    }

    // 2. Meilleur signe astrologique
    if (stats.topPerformers.zodiacSign) {
        const sorted = Object.entries(stats.topPerformers.zodiacSign).sort((a, b) => b[1].avgScore - a[1].avgScore);
        if (sorted.length > 0 && sorted[0][1].count >= 2) {
            const [sign, data] = sorted[0];
            funFacts.push(`♈ Les ${sign} sont les plus brillants (${data.avgScore} pts) !`);
        }
    }

    // 3. Café
    if (stats.topPerformers.coffeesPerDay) {
        const sorted = Object.entries(stats.topPerformers.coffeesPerDay).sort((a, b) => b[1].avgScore - a[1].avgScore);
        if (sorted.length > 0) {
            const [amount, data] = sorted[0];
            funFacts.push(`☕ Les buveurs de ${amount} café(s)/jour dominent (${data.avgScore} pts) !`);
        }
    }

    // 4. Couche-tard vs Couche-tôt
    if (stats.topPerformers.bedtime?.['Après minuit'] && stats.topPerformers.bedtime?.['Avant 22h']) {
        const tardScore = stats.topPerformers.bedtime['Après minuit'].avgScore;
        const totScore = stats.topPerformers.bedtime['Avant 22h'].avgScore;
        if (tardScore > totScore) {
            funFacts.push(`🌙 Les couche-tard sont plus performants (+${tardScore - totScore} pts) !`);
        } else {
            funFacts.push(`🌅 Les lève-tôt dominent (+${totScore - tardScore} pts) !`);
        }
    }

    // 5. Végétariens vs Non-végétariens
    if (stats.topPerformers.isVegetarian?.['Oui'] && stats.topPerformers.isVegetarian?.['Non']) {
        const vegeScore = stats.topPerformers.isVegetarian['Oui'].avgScore;
        const nonVegeScore = stats.topPerformers.isVegetarian['Non'].avgScore;
        const diff = Math.abs(vegeScore - nonVegeScore);
        if (diff > 100) {
            if (vegeScore > nonVegeScore) {
                funFacts.push(`🥗 Les végétariens dominent (+${diff} pts) !`);
            } else {
                funFacts.push(`🍖 Les carnivores sont en tête (+${diff} pts) !`);
            }
        }
    }

    // 6. Sportifs vs Non-sportifs
    if (stats.topPerformers.isSportive?.['Oui'] && stats.topPerformers.isSportive?.['Non']) {
        const sportScore = stats.topPerformers.isSportive['Oui'].avgScore;
        const nonSportScore = stats.topPerformers.isSportive['Non'].avgScore;
        const diff = Math.abs(sportScore - nonSportScore);
        if (diff > 100) {
            if (sportScore > nonSportScore) {
                funFacts.push(`🏃 Les sportifs écrasent (+${diff} pts) !`);
            } else {
                funFacts.push(`🛋️ Les sédentaires dominent (+${diff} pts) !`);
            }
        }
    }

    // 7. Profession
    if (stats.topPerformers.profession) {
        const sorted = Object.entries(stats.topPerformers.profession).sort((a, b) => b[1].avgScore - a[1].avgScore);
        if (sorted.length > 0 && sorted[0][1].count >= 2) {
            const [prof, data] = sorted[0];
            funFacts.push(`💼 Les "${prof}" sont en tête (${data.avgScore} pts) !`);
        }
    }

    stats.correlations = funFacts.slice(0, 5);

    return stats;
}

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create-room', (callback) => {
        const roomCode = gameManager.createRoom(socket.id);
        socket.join(roomCode);
        callback({ roomCode });
        console.log(`Room created: ${roomCode} by ${socket.id}`);
    });

    socket.on('join-room', ({ roomCode, playerName, avatar }, callback) => {
        try {
            console.log(`Tentative de connexion: ${playerName}`);
            const result = gameManager.joinRoom(roomCode, socket.id, playerName, avatar);
            if (result.error) {
                callback({ error: result.error });
            } else {
                socket.join(roomCode);
                callback({ success: true });
                io.to(roomCode).emit('player-joined', Array.from(result.room.players.values()));
                console.log(`${playerName} joined room ${roomCode}`);
            }
        } catch (error) {
            console.error("Erreur lors du join-room:", error);
            callback({ error: "Erreur serveur lors de la connexion." });
        }
    });

    socket.on('submit-profile', ({ roomCode, profile }) => {
        const room = gameManager.getRoom(roomCode);
        if (room) {
            const player = room.players.get(socket.id);
            if (player) {
                player.profile = profile;
                console.log(`${player.name} a soumis son profil`);
            }
        }
    });

    socket.on('start-game', ({ roomCode, quizId }) => {
        const room = gameManager.getRoom(roomCode);
        if (room && room.hostId === socket.id) {
            let selectedQuiz = null;
            if (quizId) {
                selectedQuiz = quizManager.getQuiz(quizId);
            }

            if (!selectedQuiz) {
                const allQuizzes = quizManager.getAllQuizzes();
                if (allQuizzes.length > 0) selectedQuiz = allQuizzes[0];
            }

            if (selectedQuiz && selectedQuiz.questions.length > 0) {
                room.gameState = 'QUESTION';
                room.questions = selectedQuiz.questions;
                room.currentQuestionIndex = 0;
                room.questionStartTime = Date.now();

                // Ajouter le score maximum possible de cette série au total de la salle
                // 1500 points max par question (1000 base + 500 vitesse)
                room.maxPossibleScore += (selectedQuiz.questions.length * 1500);
                console.log(`Série démarrée. Max score ajouté: ${selectedQuiz.questions.length * 1500}. Total max: ${room.maxPossibleScore}`);

                io.to(roomCode).emit('game-started', {
                    question: room.questions[0],
                    total: room.questions.length,
                    current: 1
                });
            } else {
                console.error("Aucun quiz disponible pour démarrer la partie.");
            }
        }
    });

    socket.on('submit-answer', ({ roomCode, answerIndex }) => {
        const room = gameManager.getRoom(roomCode);
        if (room && room.gameState === 'QUESTION') {
            const player = room.players.get(socket.id);
            if (player && player.lastAnswer === null) {
                const responseTime = Date.now() - room.questionStartTime;
                player.lastAnswer = answerIndex;
                player.answerTime = responseTime;
                io.to(roomCode).emit('player-answered', { playerId: socket.id });
                console.log(`Player ${player.name} answered ${answerIndex} in ${responseTime}ms`);
            }
        }
    });

    socket.on('end-question', ({ roomCode }) => {
        const room = gameManager.getRoom(roomCode);
        if (room && room.hostId === socket.id) {
            const currentQuestion = room.questions[room.currentQuestionIndex];
            const correctIndex = currentQuestion.correct;

            const MAX_TIME = 20000;
            const BASE_POINTS = 1000;

            for (const player of room.players.values()) {
                if (player.lastAnswer === correctIndex) {
                    const timeBonus = player.answerTime
                        ? Math.max(0, Math.floor(500 * (1 - player.answerTime / MAX_TIME)))
                        : 0;

                    const points = BASE_POINTS + timeBonus;
                    player.score += points;
                    console.log(`${player.name} gagne ${points} points`);
                }
                player.lastAnswer = null;
                player.answerTime = null;
            }

            const leaderboard = Array.from(room.players.values()).sort((a, b) => b.score - a.score);

            io.to(roomCode).emit('round-results', {
                leaderboard,
                correctAnswer: correctIndex
            });
        }
    });

    socket.on('next-question', ({ roomCode }) => {
        const room = gameManager.getRoom(roomCode);
        if (room && room.hostId === socket.id) {
            room.currentQuestionIndex++;
            if (room.currentQuestionIndex < room.questions.length) {
                room.gameState = 'QUESTION';
                room.questionStartTime = Date.now();
                const nextQuestion = room.questions[room.currentQuestionIndex];
                io.to(roomCode).emit('game-started', {
                    question: nextQuestion,
                    total: room.questions.length,
                    current: room.currentQuestionIndex + 1
                });
            } else {
                // Fin de la série (pas de la soirée)
                room.gameState = 'SERIES_END';

                const players = Array.from(room.players.values());
                const leaderboard = players.sort((a, b) => b.score - a.score);
                const stats = calculateStats(players);

                io.to(roomCode).emit('series-end', {
                    leaderboard: leaderboard,
                    stats: stats
                });
            }
        }
    });

    // Événement pour terminer la soirée et calculer le QI
    socket.on('end-evening', ({ roomCode }) => {
        const room = gameManager.getRoom(roomCode);
        if (room && room.hostId === socket.id) {
            const players = Array.from(room.players.values());

            // Calcul du QI basé sur un système plus précis
            // Calcul du QI basé sur un système plus précis et dynamique
            // Utilise le score maximum possible réel de la session (basé sur le nombre de questions jouées)
            const maxScore = room.maxPossibleScore || 1; // Éviter division par 0

            players.forEach(player => {
                // 1. Calculer le pourcentage de réussite
                const scorePercentage = (player.score / maxScore) * 100;

                // 2. Conversion en QI selon une courbe réaliste
                // Basé sur la distribution normale de Wechsler (WAIS)
                // 0-20% → QI 70-85 (Limite/Faible)
                // 20-40% → QI 85-95 (Moyen faible)
                // 40-60% → QI 95-105 (Moyen)
                // 60-80% → QI 105-120 (Moyen supérieur)
                // 80-95% → QI 120-135 (Supérieur)
                // 95-100% → QI 135-145 (Très supérieur/Génie)

                let iq;
                if (scorePercentage < 20) {
                    iq = 70 + (scorePercentage / 20) * 15;
                } else if (scorePercentage < 40) {
                    iq = 85 + ((scorePercentage - 20) / 20) * 10;
                } else if (scorePercentage < 60) {
                    iq = 95 + ((scorePercentage - 40) / 20) * 10;
                } else if (scorePercentage < 80) {
                    iq = 105 + ((scorePercentage - 60) / 20) * 15;
                } else if (scorePercentage < 95) {
                    iq = 120 + ((scorePercentage - 80) / 15) * 15;
                } else {
                    iq = 135 + ((scorePercentage - 95) / 5) * 10;
                }

                player.iq = Math.round(iq);
                player.iq = Math.max(70, Math.min(145, player.iq));

                console.log(`${player.name}: ${player.score} pts (${scorePercentage.toFixed(1)}%) → QI ${player.iq}`);
            });

            const leaderboard = players.sort((a, b) => b.score - a.score);
            const stats = calculateStats(players);

            io.to(roomCode).emit('game-over', {
                leaderboard: leaderboard,
                stats: stats
            });
        }
    });

    socket.on('disconnect', () => {
        // Quiz game disconnect
        const result = gameManager.removePlayer(socket.id);
        if (result) {
            if (result.isHost) {
                io.to(result.roomCode).emit('host-disconnected');
            } else {
                io.to(result.roomCode).emit('player-left', Array.from(result.room.players.values()));
            }
        }

        // Geo game disconnect
        const geoResult = geoGameManager.removePlayer(socket.id);
        if (geoResult) {
            if (geoResult.isHost) {
                io.to(geoResult.roomCode).emit('geo-host-disconnected');
            } else {
                // If disconnected (in game), we still emit 'player-left' or 'player-updated'
                // The client will receive the full list of players, including the disconnected one (if in game)
                // or excluding the one (if in lobby)
                io.to(geoResult.roomCode).emit('geo-player-left', geoGameManager.getPlayersInRoom(geoResult.roomCode));

                // If game was playing and this player disconnected, maybe everyone else has answered now?
                if (geoResult.type === 'disconnected') {
                    const allGuessed = geoGameManager.allPlayersGuessed(geoResult.roomCode);
                    if (allGuessed) {
                        io.to(geoResult.roomCode).emit('geo-all-guessed');
                    }
                }
            }
        }

        console.log('User disconnected:', socket.id);
    });

    // ================================================
    // GEO GUESSR EVENTS
    // ================================================

    // Helper: Check if socket can control the game (host or remote)
    const canControlGame = (room, socketId) => {
        if (!room) return false;
        if (room.hostId === socketId) return true;
        if (room.remoteIds && room.remoteIds.includes(socketId)) return true;
        return false;
    };

    socket.on('geo-create-room', ({ settings }, callback) => {
        const roomCode = geoGameManager.createRoom(socket.id, settings);
        socket.join(`geo-${roomCode}`);
        callback({ roomCode });
        console.log(`[GEO] Room created: ${roomCode} by ${socket.id}`);
    });

    socket.on('geo-join-room', ({ roomCode, playerName, avatar }, callback) => {
        try {
            const result = geoGameManager.joinRoom(roomCode, socket.id, playerName, avatar);
            if (result.error) {
                callback({ error: result.error });
            } else {
                socket.join(`geo-${roomCode}`);

                // Si c'est une reconnexion, on renvoie l'état du jeu
                if (result.reconnected) {
                    callback({
                        success: true,
                        reconnected: true,
                        gameState: result.gameState,
                        currentRound: result.currentRound,
                        totalRounds: result.totalRounds,
                        location: result.location,
                        roundStartTime: result.roundStartTime,
                        timePerRound: result.timePerRound,
                        myScore: result.myScore
                    });
                    console.log(`[GEO] ${playerName} reconnected to room ${roomCode}`);
                } else {
                    callback({ success: true });
                    console.log(`[GEO] ${playerName} joined room ${roomCode}`);
                }

                // Informer tout le monde (mise à jour de la liste des joueurs avec le nouvel ID socket)
                io.to(`geo-${roomCode}`).emit('geo-player-joined', geoGameManager.getPlayersInRoom(roomCode));
            }
        } catch (error) {
            console.error("[GEO] Erreur lors du join-room:", error);
            callback({ error: "Erreur serveur lors de la connexion." });
        }
    });

    // Remote control connection - allows controlling the game from a phone
    socket.on('geo-join-remote', ({ roomCode }, callback) => {
        try {
            const room = geoGameManager.getRoom(roomCode);
            if (!room) {
                callback({ error: 'Salon introuvable' });
                return;
            }

            // Store remote socket for this room (allow controlling)
            if (!room.remoteIds) room.remoteIds = [];
            room.remoteIds.push(socket.id);

            socket.join(`geo-${roomCode}`);

            callback({
                success: true,
                gameState: room.gameState,
                players: geoGameManager.getPlayersInRoom(roomCode),
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                timePerRound: room.timePerRound,
                roundStartTime: room.roundStartTime
            });

            console.log(`[GEO] Remote control connected to room ${roomCode}`);
        } catch (error) {
            console.error("[GEO] Erreur lors du join-remote:", error);
            callback({ error: "Erreur serveur lors de la connexion." });
        }
    });

    socket.on('geo-update-settings', ({ roomCode, settings }) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room) return;

        // Allow host OR remote to update settings
        if (!canControlGame(room, socket.id)) return;

        if (settings) {
            room.totalRounds = settings.roundsCount || room.totalRounds;
            room.timePerRound = settings.timePerRound || room.timePerRound;
            room.settings = { ...room.settings, ...settings };
            console.log(`[GEO] Settings updated for room ${roomCode}:`, settings);

            // Broadcast settings update to all clients in the room
            io.to(`geo-${roomCode}`).emit('geo-settings-updated', {
                roundsCount: room.totalRounds,
                timePerRound: room.timePerRound,
                mapType: room.settings.mapType || ['world']
            });
        }
    });

    socket.on('geo-start-game', ({ roomCode, settings }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (room && canControlGame(room, socket.id)) {
            // Appliquer les settings si fournis
            if (settings) {
                room.totalRounds = settings.roundsCount || room.totalRounds;
                room.timePerRound = settings.timePerRound || room.timePerRound;
                room.settings = { ...room.settings, ...settings };
            }

            const result = geoGameManager.startGame(roomCode);
            if (result.success) {
                callback({
                    success: true,
                    location: result.location,
                    round: result.round,
                    total: result.total
                });

                // Informer les joueurs
                io.to(`geo-${roomCode}`).emit('geo-game-started', {
                    round: result.round,
                    total: result.total,
                    location: result.location,
                    timePerRound: room.timePerRound,
                    roundStartTime: room.roundStartTime,
                    mapType: room.settings.mapType || ['world']
                });

                console.log(`[GEO] Game started in room ${roomCode}`);
            } else {
                callback({ error: result.error });
            }
        } else {
            callback({ error: 'Room not found or not host' });
        }
    });

    socket.on('geo-restart-game', ({ roomCode }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (!canControlGame(room, socket.id)) {
            callback({ error: 'Not authorized' });
            return;
        }

        const result = geoGameManager.restartGame(roomCode);
        if (result.success) {
            callback({ success: true });
            io.to(`geo-${roomCode}`).emit('geo-game-restarted');
        } else {
            callback({ error: result.error });
        }
    });

    socket.on('geo-kick-player', ({ roomCode, playerId }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room || room.hostId !== socket.id) {
            callback({ error: 'Unauthorized' });
            return;
        }

        const result = geoGameManager.kickPlayer(roomCode, playerId);
        if (result.success) {
            callback({ success: true });

            // Notify specific player they were kicked (optional, but good UX)
            // Since we kick by socket ID, we can target them directly if they are still connected
            io.to(playerId).emit('geo-kicked');
            // Force verify they leave the room
            io.sockets.sockets.get(playerId)?.leave(`geo-${roomCode}`);

            // Notify room
            io.to(`geo-${roomCode}`).emit('geo-player-left', geoGameManager.getPlayersInRoom(roomCode));
        } else {
            callback({ error: result.error });
        }
    });

    socket.on('geo-submit-guess', ({ roomCode, lat, lng }, callback) => {
        const result = geoGameManager.submitGuess(roomCode, socket.id, lat, lng);
        if (result.success) {
            callback({
                success: true,
                distance: result.distance,
                score: result.score,
                breakdown: result.pointsBreakdown
            });
            io.to(`geo-${roomCode}`).emit('geo-player-guessed', { playerId: socket.id });

            // Vérifier si tous ont répondu
            if (result.allGuessed) {
                console.log(`[GEO] All players guessed in room ${roomCode}`);
                io.to(`geo-${roomCode}`).emit('geo-all-guessed');
            }
        } else {
            callback({ error: result.error });
        }
    });

    // Player sends an emoji reaction (visible on TV)
    socket.on('geo-reaction', ({ roomCode, emoji, playerName }) => {
        const room = geoGameManager.getRoom(roomCode);
        if (room) {
            // Broadcast reaction to everyone in the room (including TV)
            io.to(`geo-${roomCode}`).emit('geo-reaction', {
                emoji,
                playerName,
                playerId: socket.id
            });
        }
    });

    socket.on('geo-end-round', ({ roomCode }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (!canControlGame(room, socket.id)) {
            callback({ error: 'Not authorized' });
            return;
        }

        const result = geoGameManager.endRound(roomCode);
        if (result.success) {
            callback(result);

            // Informer les joueurs
            io.to(`geo-${roomCode}`).emit('geo-round-ended', {
                results: result.results,
                correctLocation: result.correctLocation,
                currentRound: result.currentRound,
                totalRounds: result.totalRounds
            });

            console.log(`[GEO] Round ${result.currentRound} ended in room ${roomCode}`);
        } else {
            callback({ error: result.error || 'Unknown error' });
        }
    });

    socket.on('geo-next-round', ({ roomCode }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (!canControlGame(room, socket.id)) {
            callback({ error: 'Not authorized' });
            return;
        }

        const result = geoGameManager.nextRound(roomCode);

        if (result.gameOver) {
            callback(result);
            io.to(`geo-${roomCode}`).emit('geo-game-over', {
                results: result.results
            });
            console.log(`[GEO] Game over in room ${roomCode}`);
        } else if (result.success) {
            callback(result);
            io.to(`geo-${roomCode}`).emit('geo-next-round', {
                round: result.round,
                total: result.total,
                location: result.location,
                timePerRound: room.timePerRound,
                roundStartTime: room.roundStartTime
            });
            console.log(`[GEO] Round ${result.round} started in room ${roomCode}`);
        } else {
            callback({ error: result.error || 'Unknown error' });
        }
    });

    // Request a new random location when current one has no Street View coverage
    socket.on('geo-request-new-location', ({ roomCode }, callback) => {
        const room = geoGameManager.getRoom(roomCode);
        if (!room) {
            callback({ error: 'Room not found' });
            return;
        }
        if (!canControlGame(room, socket.id)) {
            callback({ error: 'Not authorized' });
            return;
        }

        // Generate a new random location
        const newLocation = geoGameManager.getRandomLocation(room.settings.mapType);
        room.currentLocation = newLocation;

        // Also update the locations array (replace last one)
        if (room.locations.length > 0) {
            room.locations[room.locations.length - 1] = newLocation;
        }

        console.log(`[GEO] New location requested for room ${roomCode}: ${newLocation.city}`);

        callback({
            success: true,
            location: newLocation
        });

        // Broadcast to all players so they also get the new location
        io.to(`geo-${roomCode}`).emit('geo-location-changed', {
            location: newLocation
        });
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
