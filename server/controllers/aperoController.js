/**
 * Apéro Quiz - Controller
 * Gère les événements Socket.IO et les routes API
 */

const aperoGameManager = require('../aperoGameManager');
const aperoQuizzes = require('../aperoQuizzes');

// ================================================
// API REST - Gestion des Quiz (Admin)
// ================================================
function setupAperoRoutes(app) {
    // Liste tous les quiz
    app.get('/api/apero/quizzes', (req, res) => {
        res.json(aperoQuizzes.getAll());
    });

    // Obtenir un quiz complet
    app.get('/api/apero/quizzes/:id', (req, res) => {
        const quiz = aperoQuizzes.getById(req.params.id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json(quiz);
    });

    // Créer un nouveau quiz
    app.post('/api/apero/quizzes', (req, res) => {
        const quiz = aperoQuizzes.create(req.body);
        res.json(quiz);
    });

    // Mettre à jour un quiz
    app.put('/api/apero/quizzes/:id', (req, res) => {
        const quiz = aperoQuizzes.update(req.params.id, req.body);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json(quiz);
    });

    // Supprimer un quiz
    app.delete('/api/apero/quizzes/:id', (req, res) => {
        const success = aperoQuizzes.delete(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json({ success: true });
    });

    // Dupliquer un quiz
    app.post('/api/apero/quizzes/:id/duplicate', (req, res) => {
        const quiz = aperoQuizzes.duplicate(req.params.id);
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json(quiz);
    });

    // === Slides ===

    // Ajouter un slide
    app.post('/api/apero/quizzes/:quizId/slides', (req, res) => {
        const { afterIndex } = req.query;
        const slide = aperoQuizzes.addSlide(
            req.params.quizId,
            req.body,
            afterIndex ? parseInt(afterIndex) : null
        );
        if (!slide) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json(slide);
    });

    // Mettre à jour un slide
    app.put('/api/apero/quizzes/:quizId/slides/:slideId', (req, res) => {
        const slide = aperoQuizzes.updateSlide(req.params.quizId, req.params.slideId, req.body);
        if (!slide) {
            return res.status(404).json({ error: 'Slide non trouvé' });
        }
        res.json(slide);
    });

    // Supprimer un slide
    app.delete('/api/apero/quizzes/:quizId/slides/:slideId', (req, res) => {
        const success = aperoQuizzes.deleteSlide(req.params.quizId, req.params.slideId);
        if (!success) {
            return res.status(404).json({ error: 'Slide non trouvé' });
        }
        res.json({ success: true });
    });

    // Réordonner les slides
    app.put('/api/apero/quizzes/:quizId/reorder', (req, res) => {
        const { order } = req.body; // Array d'IDs
        const success = aperoQuizzes.reorderSlides(req.params.quizId, order);
        if (!success) {
            return res.status(404).json({ error: 'Quiz non trouvé' });
        }
        res.json({ success: true });
    });

    // Templates de slides
    app.get('/api/apero/templates/question/:type', (req, res) => {
        const template = aperoQuizzes.createDefaultQuestionSlide(req.params.type);
        res.json(template);
    });

    console.log('[APERO] Routes initialized');
}

// ================================================
// SOCKET.IO - Jeu en temps réel (Main Namespace)
// ================================================
function handleConnection(io, socket) {
    // console.log(`[APERO] Handling connection for socket: ${socket.id}`);

    // === HOST Events ===

    // Créer une salle
    socket.on('apero-host-create', ({ quizId }) => {
        console.log(`[APERO SERVER Debug] Request create Room for QuizID: ${quizId} from Socket: ${socket.id}`);

        try {
            const quiz = aperoQuizzes.getById(quizId);
            if (!quiz) {
                console.error(`[APERO SERVER] Quiz NOT FOUND: ${quizId}`);
                socket.emit('apero-error', { message: 'Quiz non trouvé sur le serveur' });
                return;
            }

            console.log(`[APERO SERVER] Quiz found: "${quiz.title}" (${quiz.slides.length} slides)`);

            // Check if host already has a room (reconnection)
            // Note: For now we create new room, but we could handle reconnection better

            const roomCode = aperoGameManager.createRoom(socket.id, quizId, quiz);
            console.log(`[APERO SERVER] Room Code generated: ${roomCode}`);

            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.isHost = true;

            const responsePayload = {
                roomCode,
                quiz: {
                    id: quiz.id,
                    title: quiz.title,
                    slideCount: quiz.slides.length
                }
            };

            console.log('[APERO SERVER] Emitting apero-room-created...');
            socket.emit('apero-room-created', responsePayload);
            console.log('[APERO SERVER] Emit DONE.');

        } catch (e) {
            console.error('[APERO SERVER] EXCEPTION in host-create:', e);
            socket.emit('apero-error', { message: 'Erreur serveur: ' + e.message });
        }
    });

    // Reconnexion Hôte (si changement de socket ID)
    socket.on('apero-host-reconnect', ({ roomCode }) => {
        const result = aperoGameManager.reconnectHost(roomCode, socket.id);
        if (result.success) {
            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.isHost = true;

            socket.emit('apero-game-restored', result);
        } else {
            socket.emit('apero-error', { message: 'Impossible de restaurer la session' });
        }
    });

    // Démarrer le jeu
    socket.on('apero-host-start', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.startGame(socket.roomCode);
        if (result.error) {
            socket.emit('apero-error', { message: result.error });
            return;
        }

        io.to(socket.roomCode).emit('apero-game-started', {
            slide: result.slide
        });
    });

    // Navigation slides
    socket.on('apero-host-next-slide', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.nextSlide(socket.roomCode);
        if (result.gameOver) {
            io.to(socket.roomCode).emit('apero-game-ended', result);
        } else if (result.success) {
            io.to(socket.roomCode).emit('apero-slide-changed', {
                slideIndex: result.slideIndex,
                slide: result.slide
            });
        }
    });

    socket.on('apero-host-prev-slide', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.prevSlide(socket.roomCode);
        if (result.success) {
            io.to(socket.roomCode).emit('apero-slide-changed', {
                slideIndex: result.slideIndex,
                slide: result.slide
            });
        }
    });

    socket.on('apero-host-goto-slide', ({ slideIndex }) => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.goToSlide(socket.roomCode, slideIndex);
        if (result.success) {
            io.to(socket.roomCode).emit('apero-slide-changed', {
                slideIndex: result.slideIndex,
                slide: result.slide
            });
        }
    });

    // Ouvrir une question (les joueurs peuvent répondre)
    socket.on('apero-host-open-question', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.openQuestion(socket.roomCode);
        if (result.success) {
            io.to(socket.roomCode).emit('apero-question-opened', {
                questionNumber: result.questionNumber,
                questionType: result.questionType,
                timer: result.timer
            });
        }
    });

    // Fermer une question (révéler la réponse)
    socket.on('apero-host-close-question', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.closeQuestion(socket.roomCode);
        if (result.success) {
            io.to(socket.roomCode).emit('apero-question-closed', {
                correctAnswer: result.correctAnswer,
                results: result.results,
                answerStats: result.answerStats
            });
        }
    });

    // Obtenir le classement
    socket.on('apero-host-get-leaderboard', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.getLeaderboard(socket.roomCode);
        if (result.success) {
            socket.emit('apero-leaderboard', result.leaderboard);
        }
    });

    // Redémarrer
    socket.on('apero-host-restart', () => {
        if (!socket.roomCode || !socket.isHost) return;

        const result = aperoGameManager.restartGame(socket.roomCode);
        if (result.success) {
            io.to(socket.roomCode).emit('apero-game-restarted');
        }
    });

    // === TEAM Events ===

    // Rejoindre une salle
    socket.on('apero-team-join', ({ roomCode, teamName }) => {
        const normalizedCode = roomCode?.toUpperCase();
        const room = aperoGameManager.getRoom(normalizedCode);
        if (!room) {
            console.log(`[APERO] Team join failed - Room not found: ${normalizedCode}`);
            socket.emit('apero-error', { message: 'Salon introuvable' });
            return;
        }

        const result = aperoGameManager.joinRoom(normalizedCode, socket.id, teamName);
        if (result.error) {
            socket.emit('apero-error', { message: result.error });
            return;
        }

        socket.join(normalizedCode);
        socket.roomCode = normalizedCode;
        socket.teamName = teamName;

        socket.emit('apero-team-joined', {
            roomCode: normalizedCode,
            teamName,
            reconnected: result.reconnected,
            gameState: result.gameState
        });

        // Notifier le host
        io.to(normalizedCode).emit('apero-teams-updated', {
            teams: aperoGameManager.getTeamsInRoom(normalizedCode)
        });
    });

    // Soumettre une réponse
    socket.on('apero-team-answer', ({ answer }) => {
        if (!socket.roomCode || !socket.teamName) return;

        const result = aperoGameManager.submitAnswer(socket.roomCode, socket.teamName, answer);

        if (result.error) {
            socket.emit('apero-error', { message: result.error });
            return;
        }

        socket.emit('apero-answer-confirmed', { answer });

        // Notifier le host du nombre de réponses
        io.to(socket.roomCode).emit('apero-answers-updated', {
            answeredCount: result.answeredCount,
            totalTeams: result.totalTeams,
            allAnswered: result.allAnswered
        });
    });

    // === Déconnexion ===
    // Note: disconnect est géré globalement dans index.js mais on peut ajouter un listener spécifique ici si besoin
    // ou plutôt, on laisse aperoGameManager gérer ça via une méthode explicite appelée depuis index.js
    // Mais socket.on('disconnect') ici fonctionne car c'est le même socket object qui est passé.

    socket.on('disconnect', () => {
        // console.log(`[APERO] Socket disconnected check: ${socket.id}`);
        // Check if this socket was part of an apéro game
        const result = aperoGameManager.removeTeam(socket.id);
        if (result) {
            if (result.isHost && !result.hostDisconnected) {
                io.to(result.roomCode).emit('apero-room-closed');
            } else if (!result.isHost) {
                io.to(result.roomCode).emit('apero-teams-updated', {
                    teams: aperoGameManager.getTeamsInRoom(result.roomCode)
                });
            }
        }
    });
}

module.exports = { setupAperoRoutes, handleConnection };

