const geoGameManager = require('../geoGameManager');

const canControlGame = (room, socketId) => {
    if (!room) return false;
    if (room.hostId === socketId) return true;
    if (room.remoteIds && room.remoteIds.includes(socketId)) return true;
    return false;
};

module.exports = {
    handleConnection: (io, socket) => {
        // ================================================
        // GEO GUESSR EVENTS
        // ================================================

        socket.on('geo-create-room', ({ settings }, callback) => {
            const roomCode = geoGameManager.createRoom(socket.id, settings);
            socket.join(`geo-${roomCode}`);
            callback({ roomCode });
            console.log(`[GEO] Room created: ${roomCode} by ${socket.id}`);
        });

        socket.on('geo-host-reconnect', ({ roomCode }) => {
            const room = geoGameManager.getRoom(roomCode);
            if (room) {
                room.hostId = socket.id;
                socket.join(`geo-${roomCode}`);
                console.log(`[GEO] Host reconnected and rejoined room ${roomCode}`);
            }
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
                    } else if (result.lateJoin) {
                        // Nouveau joueur qui rejoint en cours de partie (late join)
                        callback({
                            success: true,
                            lateJoin: true,
                            gameState: result.gameState,
                            currentRound: result.currentRound,
                            totalRounds: result.totalRounds,
                            location: result.location,
                            roundStartTime: result.roundStartTime,
                            timePerRound: result.timePerRound,
                            missedRounds: result.missedRounds
                        });
                        console.log(`[GEO] ${playerName} late joined room ${roomCode} (missed ${result.missedRounds} rounds)`);
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

                const players = geoGameManager.getPlayersInRoom(roomCode);
                
                let results = null;
                if (room.gameState === 'ROUND_END' || room.gameState === 'GAME_END') {
                    results = players.map(p => ({
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        distance: p.lastDistance || null,
                        roundScore: p.roundScores[p.roundScores.length - 1] || 0,
                        totalScore: p.totalScore
                    })).sort((a, b) => {
                        if (room.gameState === 'GAME_END') return b.totalScore - a.totalScore;
                        return b.roundScore - a.roundScore;
                    });
                }

                callback({
                    success: true,
                    gameState: room.gameState,
                    players: players,
                    currentRound: room.currentRound,
                    totalRounds: room.totalRounds,
                    timePerRound: room.timePerRound,
                    roundStartTime: room.roundStartTime,
                    currentLocation: room.currentLocation,
                    results: results
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
                        total: result.total,
                        timePerRound: room.timePerRound,
                        roundStartTime: room.roundStartTime
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

        socket.on('disconnect', () => {
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
                        // FIX: We don't auto end round on disconnect to allow them time to reconnect.
                        // Wait for timer or remote control.
                    }
                }
            }
        });
    }
};
