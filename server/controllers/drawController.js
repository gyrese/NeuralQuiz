const drawGameManager = require('../drawGameManager');

const canControlDrawGame = (room, socketId) => {
    if (!room) return false;
    if (room.hostId === socketId) return true;
    if (room.remoteIds && room.remoteIds.includes(socketId)) return true;
    return false;
};

module.exports = {
    handleConnection: (io, socket) => {
        // ================================================
        // DRAW UP (PICTIONARY) EVENTS
        // ================================================

        socket.on('draw-create-room', ({ settings }, callback) => {
            const roomCode = drawGameManager.createRoom(socket.id, settings);
            socket.join(`draw-${roomCode}`);
            callback({ roomCode });
            console.log(`[DRAW] Room created: ${roomCode} by ${socket.id}`);
        });

        socket.on('draw-join-room', ({ roomCode, playerName, avatar }, callback) => {
            try {
                const result = drawGameManager.joinRoom(roomCode, socket.id, playerName, avatar);
                if (result.error) {
                    callback({ error: result.error });
                } else {
                    socket.join(`draw-${roomCode}`);

                    if (result.reconnected) {
                        callback({
                            success: true,
                            reconnected: true,
                            gameState: result.gameState,
                            currentRound: result.currentRound,
                            currentWord: result.isDrawer ? result.currentWord : { category: result.currentWord?.category, wordLength: result.currentWord?.word?.length },
                            currentDrawerId: result.currentDrawerId,
                            isDrawer: result.isDrawer,
                            roundStartTime: result.roundStartTime,
                            timePerRound: result.timePerRound,
                            canvasHistory: result.canvasHistory,
                            myScore: result.myScore,
                            hasGuessed: result.hasGuessed
                        });
                        console.log(`[DRAW] ${playerName} reconnected to room ${roomCode}`);
                    } else if (result.lateJoin) {
                        callback({
                            success: true,
                            lateJoin: true,
                            gameState: result.gameState,
                            currentRound: result.currentRound,
                            currentWord: result.currentWord,
                            currentDrawerId: result.currentDrawerId,
                            roundStartTime: result.roundStartTime,
                            timePerRound: result.timePerRound,
                            canvasHistory: result.canvasHistory
                        });
                        console.log(`[DRAW] ${playerName} late joined room ${roomCode}`);
                    } else {
                        callback({ success: true });
                        console.log(`[DRAW] ${playerName} joined room ${roomCode}`);
                    }

                    io.to(`draw-${roomCode}`).emit('draw-player-joined', drawGameManager.getPlayersInRoom(roomCode));
                }
            } catch (error) {
                console.error("[DRAW] Error in join-room:", error);
                callback({ error: "Erreur serveur lors de la connexion." });
            }
        });

        // Remote control connection
        socket.on('draw-join-remote', ({ roomCode }, callback) => {
            try {
                const room = drawGameManager.getRoom(roomCode);
                if (!room) {
                    callback({ error: 'Salon introuvable' });
                    return;
                }

                if (!room.remoteIds) room.remoteIds = [];
                room.remoteIds.push(socket.id);

                socket.join(`draw-${roomCode}`);

                callback({
                    success: true,
                    gameState: room.gameState,
                    players: drawGameManager.getPlayersInRoom(roomCode),
                    currentRound: room.currentRound,
                    totalRounds: room.totalRounds,
                    timePerRound: room.timePerRound,
                    roundStartTime: room.roundStartTime,
                    currentDrawerId: drawGameManager.getCurrentDrawerId(roomCode)
                });

                console.log(`[DRAW] Remote control connected to room ${roomCode}`);
            } catch (error) {
                console.error("[DRAW] Error in join-remote:", error);
                callback({ error: "Erreur serveur lors de la connexion." });
            }
        });

        socket.on('draw-update-settings', ({ roomCode, settings }) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room || !canControlDrawGame(room, socket.id)) return;

            if (settings) {
                room.settings = { ...room.settings, ...settings };
                room.timePerRound = settings.timePerRound || room.timePerRound;
                console.log(`[DRAW] Settings updated for room ${roomCode}:`, settings);

                io.to(`draw-${roomCode}`).emit('draw-settings-updated', {
                    timePerRound: room.timePerRound,
                    categories: room.settings.categories,
                    roundsPerPlayer: room.settings.roundsPerPlayer
                });
            }
        });

        socket.on('draw-start-game', ({ roomCode, settings }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room || !canControlDrawGame(room, socket.id)) {
                callback({ error: 'Room not found or not authorized' });
                return;
            }

            if (settings) {
                room.settings = { ...room.settings, ...settings };
                room.timePerRound = settings.timePerRound || room.timePerRound;
            }

            const result = drawGameManager.startGame(roomCode);
            if (result.success) {
                callback({
                    success: true,
                    round: result.round,
                    totalRounds: result.totalRounds,
                    drawerId: result.drawerId,
                    word: result.word,
                    timePerRound: result.timePerRound,
                    roundStartTime: result.roundStartTime
                });

                // Notify all players (but hide word from guessers)
                io.to(`draw-${roomCode}`).emit('draw-game-started', {
                    round: result.round,
                    totalRounds: result.totalRounds,
                    drawerId: result.drawerId,
                    drawerName: result.drawerName,
                    wordCategory: result.word.category,
                    wordLength: result.word.word.length,
                    timePerRound: result.timePerRound,
                    roundStartTime: result.roundStartTime
                });

                // Send word only to drawer
                io.to(result.drawerId).emit('draw-your-word', {
                    word: result.word.word,
                    category: result.word.category,
                    hint: result.word.hint
                });

                console.log(`[DRAW] Game started in room ${roomCode}`);
            } else {
                callback({ error: result.error });
            }
        });

        socket.on('draw-restart-game', ({ roomCode }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room || !canControlDrawGame(room, socket.id)) {
                callback({ error: 'Not authorized' });
                return;
            }

            const result = drawGameManager.restartGame(roomCode);
            if (result.success) {
                callback({ success: true });
                io.to(`draw-${roomCode}`).emit('draw-game-restarted');
            } else {
                callback({ error: result.error });
            }
        });

        socket.on('draw-kick-player', ({ roomCode, playerId }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room || room.hostId !== socket.id) {
                callback({ error: 'Unauthorized' });
                return;
            }

            const result = drawGameManager.kickPlayer(roomCode, playerId);
            if (result.success) {
                callback({ success: true });
                io.to(playerId).emit('draw-kicked');
                io.sockets.sockets.get(playerId)?.leave(`draw-${roomCode}`);
                io.to(`draw-${roomCode}`).emit('draw-player-left', drawGameManager.getPlayersInRoom(roomCode));
            } else {
                callback({ error: result.error });
            }
        });

        // Drawing events - real-time canvas sync
        socket.on('draw-stroke', ({ roomCode, stroke }) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room) return;

            // Only drawer can draw
            if (drawGameManager.getCurrentDrawerId(roomCode) !== socket.id) return;

            // Store stroke for late joiners
            drawGameManager.addStroke(roomCode, stroke);

            // Broadcast to all other players
            socket.to(`draw-${roomCode}`).emit('draw-stroke', stroke);
        });

        socket.on('draw-clear', ({ roomCode }) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room) return;

            if (drawGameManager.getCurrentDrawerId(roomCode) !== socket.id) return;

            drawGameManager.clearCanvas(roomCode);
            socket.to(`draw-${roomCode}`).emit('draw-clear');
        });

        // Player guesses
        socket.on('draw-submit-guess', ({ roomCode, guess }, callback) => {
            const result = drawGameManager.submitGuess(roomCode, socket.id, guess);

            if (result.success && result.correct) {
                callback({
                    success: true,
                    correct: true,
                    points: result.points,
                    rank: result.rank
                });

                const player = drawGameManager.getRoom(roomCode)?.players.get(socket.id);

                // Notify everyone that someone guessed correctly
                io.to(`draw-${roomCode}`).emit('draw-player-guessed', {
                    playerId: socket.id,
                    playerName: player?.name,
                    rank: result.rank,
                    points: result.points
                });

                // Check if all players have guessed
                if (result.totalGuessers >= result.totalPlayers) {
                    io.to(`draw-${roomCode}`).emit('draw-all-guessed');
                }
            } else if (result.closeMatch) {
                callback({
                    success: false,
                    closeMatch: true,
                    message: result.message
                });

                // Optionally notify host about close guess
                const player = drawGameManager.getRoom(roomCode)?.players.get(socket.id);
                io.to(`draw-${roomCode}`).emit('draw-close-guess', {
                    playerName: player?.name
                });
            } else {
                callback(result);
            }
        });

        socket.on('draw-end-round', ({ roomCode }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room) {
                callback({ error: 'Room not found' });
                return;
            }
            if (!canControlDrawGame(room, socket.id)) {
                callback({ error: 'Not authorized' });
                return;
            }

            const result = drawGameManager.endRound(roomCode);
            if (result.success) {
                callback(result);

                io.to(`draw-${roomCode}`).emit('draw-round-ended', {
                    word: result.word,
                    results: result.results,
                    guessersCount: result.guessersCount,
                    currentRound: result.currentRound,
                    totalRounds: result.totalRounds
                });

                console.log(`[DRAW] Round ${result.currentRound} ended in room ${roomCode}`);
            } else {
                callback({ error: result.error });
            }
        });

        socket.on('draw-next-round', ({ roomCode }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room) {
                callback({ error: 'Room not found' });
                return;
            }
            if (!canControlDrawGame(room, socket.id)) {
                callback({ error: 'Not authorized' });
                return;
            }

            const result = drawGameManager.nextRound(roomCode);

            if (result.gameOver) {
                callback(result);
                io.to(`draw-${roomCode}`).emit('draw-game-over', {
                    results: result.results,
                    awards: result.awards
                });
                console.log(`[DRAW] Game over in room ${roomCode}`);
            } else if (result.success) {
                callback(result);

                // Notify all players (but hide word from guessers)
                io.to(`draw-${roomCode}`).emit('draw-next-round', {
                    round: result.round,
                    totalRounds: result.totalRounds,
                    drawerId: result.drawerId,
                    drawerName: result.drawerName,
                    wordCategory: result.word.category,
                    wordLength: result.word.word.length,
                    timePerRound: result.timePerRound,
                    roundStartTime: result.roundStartTime
                });

                // Send word only to drawer
                io.to(result.drawerId).emit('draw-your-word', {
                    word: result.word.word,
                    category: result.word.category,
                    hint: result.word.hint
                });

                console.log(`[DRAW] Round ${result.round} started in room ${roomCode}`);
            } else {
                callback({ error: result.error });
            }
        });

        // Skip word (drawer can't draw it)
        socket.on('draw-skip-word', ({ roomCode }, callback) => {
            const room = drawGameManager.getRoom(roomCode);
            if (!room) {
                callback({ error: 'Room not found' });
                return;
            }

            // Only current drawer can skip
            if (drawGameManager.getCurrentDrawerId(roomCode) !== socket.id) {
                callback({ error: 'Not the drawer' });
                return;
            }

            // Get new word
            const { getRandomWord } = require('../drawWords');
            const newWord = getRandomWord(room.settings.categories);
            room.currentWord = newWord;
            room.canvasHistory = [];

            callback({
                success: true,
                word: newWord.word,
                category: newWord.category,
                hint: newWord.hint
            });

            // Notify others that canvas was cleared (new word)
            io.to(`draw-${roomCode}`).emit('draw-word-skipped', {
                wordCategory: newWord.category,
                wordLength: newWord.word.length
            });
            io.to(`draw-${roomCode}`).emit('draw-clear');

            console.log(`[DRAW] Word skipped in room ${roomCode}. New word: ${newWord.word}`);
        });

        socket.on('disconnect', () => {
            const drawResult = drawGameManager.removePlayer(socket.id);
            if (drawResult) {
                if (drawResult.isHost) {
                    io.to(`draw-${drawResult.roomCode}`).emit('draw-host-disconnected');
                } else {
                    io.to(`draw-${drawResult.roomCode}`).emit('draw-player-left', drawGameManager.getPlayersInRoom(drawResult.roomCode));

                    // If drawer disconnected mid-round, skip to next round
                    if (drawResult.wasDrawer && drawResult.room.gameState === 'PLAYING') {
                        const endResult = drawGameManager.endRound(drawResult.roomCode);
                        if (endResult.success) {
                            io.to(`draw-${drawResult.roomCode}`).emit('draw-drawer-left', {
                                word: endResult.word,
                                results: endResult.results
                            });
                        }
                    }
                }
            }
        });
    }
};
