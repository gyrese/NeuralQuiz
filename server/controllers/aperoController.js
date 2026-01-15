/**
 * Apéro Quiz - Controller
 * Gère les événements Socket.IO et les routes API
 */

const aperoGameManager = require('../aperoGameManager');
const aperoQuizzes = require('../aperoQuizzes');

function setupAperoController(io, app) {
    const aperoNamespace = io.of('/apero');

    // ================================================
    // API REST - Gestion des Quiz (Admin)
    // ================================================

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

    // ================================================
    // SOCKET.IO - Jeu en temps réel
    // ================================================

    aperoNamespace.on('connection', (socket) => {
        console.log(`[APERO] Socket connected: ${socket.id}`);

        // === HOST Events ===

        // Créer une salle
        socket.on('host:create', ({ quizId }) => {
            const quiz = aperoQuizzes.getById(quizId);
            if (!quiz) {
                socket.emit('error', { message: 'Quiz non trouvé' });
                return;
            }

            const roomCode = aperoGameManager.createRoom(socket.id, quizId, quiz);
            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.isHost = true;

            socket.emit('room:created', {
                roomCode,
                quiz: {
                    id: quiz.id,
                    title: quiz.title,
                    slideCount: quiz.slides.length
                }
            });
        });

        // Démarrer le jeu
        socket.on('host:start', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.startGame(socket.roomCode);
            if (result.error) {
                socket.emit('error', { message: result.error });
                return;
            }

            aperoNamespace.to(socket.roomCode).emit('game:started', {
                slide: result.slide
            });
        });

        // Navigation slides
        socket.on('host:nextSlide', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.nextSlide(socket.roomCode);
            if (result.gameOver) {
                aperoNamespace.to(socket.roomCode).emit('game:ended', result);
            } else if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('slide:changed', {
                    slideIndex: result.slideIndex,
                    slide: result.slide
                });
            }
        });

        socket.on('host:prevSlide', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.prevSlide(socket.roomCode);
            if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('slide:changed', {
                    slideIndex: result.slideIndex,
                    slide: result.slide
                });
            }
        });

        socket.on('host:goToSlide', ({ slideIndex }) => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.goToSlide(socket.roomCode, slideIndex);
            if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('slide:changed', {
                    slideIndex: result.slideIndex,
                    slide: result.slide
                });
            }
        });

        // Ouvrir une question (les joueurs peuvent répondre)
        socket.on('host:openQuestion', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.openQuestion(socket.roomCode);
            if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('question:opened', {
                    questionNumber: result.questionNumber,
                    questionType: result.questionType,
                    timer: result.timer
                });
            }
        });

        // Fermer une question (révéler la réponse)
        socket.on('host:closeQuestion', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.closeQuestion(socket.roomCode);
            if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('question:closed', {
                    correctAnswer: result.correctAnswer,
                    results: result.results,
                    answerStats: result.answerStats
                });
            }
        });

        // Obtenir le classement
        socket.on('host:getLeaderboard', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.getLeaderboard(socket.roomCode);
            if (result.success) {
                socket.emit('leaderboard', result.leaderboard);
            }
        });

        // Redémarrer
        socket.on('host:restart', () => {
            if (!socket.roomCode || !socket.isHost) return;

            const result = aperoGameManager.restartGame(socket.roomCode);
            if (result.success) {
                aperoNamespace.to(socket.roomCode).emit('game:restarted');
            }
        });

        // === TEAM Events ===

        // Rejoindre une salle
        socket.on('team:join', ({ roomCode, teamName }) => {
            const room = aperoGameManager.getRoom(roomCode);
            if (!room) {
                socket.emit('error', { message: 'Salon introuvable' });
                return;
            }

            const result = aperoGameManager.joinRoom(roomCode, socket.id, teamName);
            if (result.error) {
                socket.emit('error', { message: result.error });
                return;
            }

            socket.join(roomCode);
            socket.roomCode = roomCode;
            socket.teamName = teamName;

            socket.emit('team:joined', {
                roomCode,
                teamName,
                reconnected: result.reconnected,
                gameState: result.gameState
            });

            // Notifier le host
            aperoNamespace.to(roomCode).emit('teams:updated', {
                teams: aperoGameManager.getTeamsInRoom(roomCode)
            });
        });

        // Soumettre une réponse
        socket.on('team:answer', ({ answer }) => {
            if (!socket.roomCode || !socket.teamName) return;

            const result = aperoGameManager.submitAnswer(socket.roomCode, socket.teamName, answer);

            if (result.error) {
                socket.emit('error', { message: result.error });
                return;
            }

            socket.emit('answer:confirmed', { answer });

            // Notifier le host du nombre de réponses
            aperoNamespace.to(socket.roomCode).emit('answers:updated', {
                answeredCount: result.answeredCount,
                totalTeams: result.totalTeams,
                allAnswered: result.allAnswered
            });
        });

        // === Déconnexion ===

        socket.on('disconnect', () => {
            console.log(`[APERO] Socket disconnected: ${socket.id}`);

            const result = aperoGameManager.removeTeam(socket.id);
            if (result) {
                if (result.isHost) {
                    aperoNamespace.to(result.roomCode).emit('room:closed');
                } else {
                    aperoNamespace.to(result.roomCode).emit('teams:updated', {
                        teams: aperoGameManager.getTeamsInRoom(result.roomCode)
                    });
                }
            }
        });
    });

    console.log('[APERO] Controller initialized');
}

module.exports = { setupAperoController };
