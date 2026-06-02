const geoGameManager = require('../geoGameManager');

const HOST_GRACE_PERIOD_MS = 120000; // 2 minutes
const geoHostDisconnectTimers = new Map();

const canControlGame = (room, socketId) => {
    if (!room) return false;
    if (room.hostId === socketId) return true;
    if (room.remoteIds && room.remoteIds.includes(socketId)) return true;
    return false;
};

// Helper: appel sécurisé du callback
const safeCallback = (callback, data) => {
    if (typeof callback === 'function') callback(data);
};

module.exports = {
    handleConnection: (io, socket) => {
        // ================================================
        // GEO GUESSR EVENTS
        // ================================================

        socket.on('geo-create-room', (data, callback) => {
            try {
                const { settings } = data || {};
                const roomCode = geoGameManager.createRoom(socket.id, settings);
                const room = geoGameManager.getRoom(roomCode);
                socket.join(`geo-${roomCode}`);
                // Le remoteToken n'est renvoyé qu'à l'hôte créateur (jamais broadcasté)
                safeCallback(callback, { roomCode, remoteToken: room.remoteToken });
                console.log(`[GEO] Room created: ${roomCode} by ${socket.id}`);
            } catch (error) {
                console.error('[GEO] Erreur geo-create-room:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-host-reconnect', (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (room) {
                    // Annuler le timer de suppression si l'hôte revient
                    if (geoHostDisconnectTimers.has(roomCode)) {
                        clearTimeout(geoHostDisconnectTimers.get(roomCode));
                        geoHostDisconnectTimers.delete(roomCode);
                        console.log(`[GEO] Host reconnect: timer de grâce annulé pour ${roomCode}`);
                    }
                    room.hostId = socket.id;
                    room.hostDisconnected = false;
                    socket.join(`geo-${roomCode}`);
                    console.log(`[GEO] Host reconnected and rejoined room ${roomCode}`);

                    const players = Array.from(room.players.values()).map(p => ({
                        id: p.id,
                        name: p.name,
                        avatar: p.avatar,
                        totalScore: p.totalScore || 0,
                        disconnected: p.disconnected || false
                    }));

                    safeCallback(callback, {
                        success: true,
                        roomCode,
                        gameState: room.gameState,
                        currentRound: room.currentRound,
                        totalRounds: room.totalRounds,
                        players,
                        timePerRound: room.timePerRound,
                        mapType: room.settings?.mapType || ['world'],
                        currentLocation: (room.gameState === 'PLAYING') ? room.currentLocationApprox : room.currentLocation,
                        roundStartTime: room.roundStartTime
                    });

                    // Informer les joueurs que l'hôte est de retour
                    socket.to(`geo-${roomCode}`).emit('geo-host-reconnected');
                } else {
                    safeCallback(callback, { error: 'Room not found' });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-host-reconnect:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-join-room', (data, callback) => {
            try {
                const { roomCode, playerName, avatar } = data || {};
                const result = geoGameManager.joinRoom(roomCode, socket.id, playerName, avatar);
                if (result.error) {
                    safeCallback(callback, { error: result.error });
                } else {
                    socket.join(`geo-${roomCode}`);

                    if (result.reconnected) {
                        safeCallback(callback, {
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
                        safeCallback(callback, {
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
                        safeCallback(callback, { success: true });
                        console.log(`[GEO] ${playerName} joined room ${roomCode}`);
                    }

                    io.to(`geo-${roomCode}`).emit('geo-player-joined', geoGameManager.getPlayersInRoom(roomCode));
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-join-room:', error);
                safeCallback(callback, { error: 'Erreur serveur lors de la connexion.' });
            }
        });

        socket.on('geo-join-remote', (data, callback) => {
            try {
                const { roomCode, remoteToken } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) {
                    safeCallback(callback, { error: 'Salon introuvable' });
                    return;
                }

                // Auth télécommande : exiger le token secret du salon (connu du seul hôte)
                if (!remoteToken || remoteToken !== room.remoteToken) {
                    console.warn(`[GEO] [SECURITY] Tentative de remote non autorisée sur ${roomCode} par ${socket.id}`);
                    safeCallback(callback, { error: 'Télécommande non autorisée' });
                    return;
                }

                if (!room.remoteIds) room.remoteIds = [];
                if (!room.remoteIds.includes(socket.id)) room.remoteIds.push(socket.id);

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

                safeCallback(callback, {
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
                console.error('[GEO] Erreur geo-join-remote:', error);
                safeCallback(callback, { error: 'Erreur serveur lors de la connexion.' });
            }
        });

        socket.on('geo-update-settings', (data) => {
            try {
                const { roomCode, settings } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) return;
                if (!canControlGame(room, socket.id)) return;

                if (settings) {
                    room.totalRounds = settings.roundsCount || room.totalRounds;
                    room.timePerRound = settings.timePerRound || room.timePerRound;
                    room.settings = { ...room.settings, ...settings };
                    console.log(`[GEO] Settings updated for room ${roomCode}:`, settings);

                    io.to(`geo-${roomCode}`).emit('geo-settings-updated', {
                        roundsCount: room.totalRounds,
                        timePerRound: room.timePerRound,
                        mapType: room.settings.mapType || ['world']
                    });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-update-settings:', error);
            }
        });

        socket.on('geo-start-game', async (data, callback) => {
            try {
                const { roomCode, settings } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room || !canControlGame(room, socket.id)) {
                    safeCallback(callback, { error: 'Room not found or not host' });
                    return;
                }

                // Guard: uniquement depuis LOBBY
                if (room.gameState !== 'LOBBY') {
                    safeCallback(callback, { error: 'Partie déjà en cours' });
                    return;
                }

                if (settings) {
                    room.totalRounds = settings.roundsCount || room.totalRounds;
                    room.timePerRound = settings.timePerRound || room.timePerRound;
                    room.settings = { ...room.settings, ...settings };
                }

                const result = await geoGameManager.startGame(roomCode);
                if (result.success) {
                    safeCallback(callback, {
                        success: true,
                        location: result.location,
                        round: result.round,
                        total: result.total,
                        timePerRound: room.timePerRound,
                        roundStartTime: room.roundStartTime
                    });

                    io.to(`geo-${roomCode}`).emit('geo-game-started', {
                        round: result.round,
                        total: result.total,
                        location: result.location,
                        timePerRound: room.timePerRound,
                        roundStartTime: room.roundStartTime,
                        mapType: room.settings.mapType || ['world']
                    });

                    // Timer serveur de sécurité — auto-end round si l'hôte ne le fait pas
                    setupServerRoundTimer(io, roomCode, room);

                    console.log(`[GEO] Game started in room ${roomCode}`);
                } else {
                    safeCallback(callback, { error: result.error });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-start-game:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-restart-game', (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) {
                    safeCallback(callback, { error: 'Room not found' });
                    return;
                }
                if (!canControlGame(room, socket.id)) {
                    safeCallback(callback, { error: 'Not authorized' });
                    return;
                }

                const result = geoGameManager.restartGame(roomCode);
                if (result.success) {
                    safeCallback(callback, { success: true });
                    io.to(`geo-${roomCode}`).emit('geo-game-restarted');
                } else {
                    safeCallback(callback, { error: result.error });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-restart-game:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-kick-player', (data, callback) => {
            try {
                const { roomCode, playerId } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    safeCallback(callback, { error: 'Unauthorized' });
                    return;
                }

                const result = geoGameManager.kickPlayer(roomCode, playerId);
                if (result.success) {
                    safeCallback(callback, { success: true });
                    io.to(playerId).emit('geo-kicked');
                    io.sockets.sockets.get(playerId)?.leave(`geo-${roomCode}`);
                    io.to(`geo-${roomCode}`).emit('geo-player-left', geoGameManager.getPlayersInRoom(roomCode));
                } else {
                    safeCallback(callback, { error: result.error });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-kick-player:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-delete-room', (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room || room.hostId !== socket.id) {
                    safeCallback(callback, { error: 'Unauthorized or room not found' });
                    return;
                }

                // Annuler le timer de déconnexion de grâce s'il y en avait un
                if (geoHostDisconnectTimers.has(roomCode)) {
                    clearTimeout(geoHostDisconnectTimers.get(roomCode));
                    geoHostDisconnectTimers.delete(roomCode);
                }

                // Informer tous les joueurs que l'hôte s'en va et que le salon est fermé
                io.to(`geo-${roomCode}`).emit('geo-host-disconnected');

                // Supprimer la room
                geoGameManager.deleteRoom(roomCode);
                console.log(`[GEO] Room ${roomCode} explicitly deleted by host ${socket.id}`);

                safeCallback(callback, { success: true });
            } catch (error) {
                console.error('[GEO] Erreur geo-delete-room:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-submit-guess', (data, callback) => {
            try {
                const { roomCode, lat, lng } = data || {};
                const result = geoGameManager.submitGuess(roomCode, socket.id, lat, lng);
                if (result.success) {
                    safeCallback(callback, {
                        success: true,
                        distance: result.distance,
                        score: result.score,
                        breakdown: result.pointsBreakdown
                    });
                    io.to(`geo-${roomCode}`).emit('geo-player-guessed', { playerId: socket.id });

                    if (result.allGuessed) {
                        console.log(`[GEO] All players guessed in room ${roomCode}`);
                        io.to(`geo-${roomCode}`).emit('geo-all-guessed');
                    }
                } else {
                    safeCallback(callback, { error: result.error });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-submit-guess:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-reaction', (data) => {
            try {
                const { roomCode, emoji, playerName } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (room) {
                    io.to(`geo-${roomCode}`).emit('geo-reaction', {
                        emoji,
                        playerName,
                        playerId: socket.id
                    });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-reaction:', error);
            }
        });

        socket.on('geo-chat-message', (data) => {
            try {
                const { roomCode, message, playerName } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (room) {
                    io.to(`geo-${roomCode}`).emit('geo-chat-message', {
                        message,
                        playerName,
                        playerId: socket.id,
                        id: Date.now() + Math.random().toString(36).substring(2, 7)
                    });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-chat-message:', error);
            }
        });

        socket.on('geo-end-round', (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) {
                    safeCallback(callback, { error: 'Room not found' });
                    return;
                }
                if (!canControlGame(room, socket.id)) {
                    safeCallback(callback, { error: 'Not authorized' });
                    return;
                }

                // Annuler le timer serveur (le client a terminé le round lui-même)
                if (room.roundTimer) {
                    clearTimeout(room.roundTimer);
                    room.roundTimer = null;
                }

                const result = geoGameManager.endRound(roomCode);
                if (result.success) {
                    safeCallback(callback, result);

                    io.to(`geo-${roomCode}`).emit('geo-round-ended', {
                        results: result.results,
                        correctLocation: result.correctLocation,
                        currentRound: result.currentRound,
                        totalRounds: result.totalRounds
                    });

                    console.log(`[GEO] Round ${result.currentRound} ended in room ${roomCode}`);
                } else {
                    safeCallback(callback, { error: result.error || 'Unknown error' });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-end-round:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-next-round', async (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) {
                    safeCallback(callback, { error: 'Room not found' });
                    return;
                }
                if (!canControlGame(room, socket.id)) {
                    safeCallback(callback, { error: 'Not authorized' });
                    return;
                }

                const result = await geoGameManager.nextRound(roomCode);

                if (result.gameOver) {
                    safeCallback(callback, result);
                    io.to(`geo-${roomCode}`).emit('geo-game-over', {
                        results: result.results,
                        awards: result.awards
                    });
                    console.log(`[GEO] Game over in room ${roomCode}`);
                } else if (result.success) {
                    safeCallback(callback, result);
                    io.to(`geo-${roomCode}`).emit('geo-next-round', {
                        round: result.round,
                        total: result.total,
                        location: result.location,
                        timePerRound: room.timePerRound,
                        roundStartTime: room.roundStartTime
                    });

                    // Timer serveur pour le prochain round
                    setupServerRoundTimer(io, roomCode, room);

                    console.log(`[GEO] Round ${result.round} started in room ${roomCode}`);
                } else {
                    safeCallback(callback, { error: result.error || 'Unknown error' });
                }
            } catch (error) {
                console.error('[GEO] Erreur geo-next-round:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('geo-request-new-location', async (data, callback) => {
            try {
                const { roomCode } = data || {};
                const room = geoGameManager.getRoom(roomCode);
                if (!room) {
                    safeCallback(callback, { error: 'Room not found' });
                    return;
                }
                if (!canControlGame(room, socket.id)) {
                    safeCallback(callback, { error: 'Not authorized' });
                    return;
                }

                const newLocation = await geoGameManager.getRandomLocation(room.settings.mapType, room);
                room.currentLocation = newLocation;

                // Bruitage pour Street View des joueurs
                const offset = 0.002;
                const latApprox = newLocation.lat + (Math.random() - 0.5) * offset * 2;
                const lngApprox = newLocation.lng + (Math.random() - 0.5) * offset * 2;
                room.currentLocationApprox = { lat: latApprox, lng: lngApprox };

                if (room.locations.length > 0) {
                    room.locations[room.locations.length - 1] = newLocation;
                }

                console.log(`[GEO] New location requested for room ${roomCode}: ${newLocation.city}`);

                const clientLocation = { lat: latApprox, lng: lngApprox };

                safeCallback(callback, {
                    success: true,
                    location: clientLocation
                });

                io.to(`geo-${roomCode}`).emit('geo-location-changed', {
                    location: clientLocation
                });
            } catch (error) {
                console.error('[GEO] Erreur geo-request-new-location:', error);
                safeCallback(callback, { error: 'Erreur serveur' });
            }
        });

        socket.on('disconnect', () => {
            // Nettoyage des remoteIds
            for (const [, room] of geoGameManager.rooms) {
                if (room.remoteIds) {
                    room.remoteIds = room.remoteIds.filter(id => id !== socket.id);
                }
            }

            const geoResult = geoGameManager.removePlayer(socket.id);
            if (geoResult) {
                if (geoResult.isHost) {
                    // Délai de grâce : attendre avant de supprimer la room
                    const timer = setTimeout(() => {
                        geoHostDisconnectTimers.delete(geoResult.roomCode);
                        io.to(`geo-${geoResult.roomCode}`).emit('geo-host-disconnected');
                        geoGameManager.deleteRoom(geoResult.roomCode);
                        console.log(`[GEO] Salle ${geoResult.roomCode} supprimée après délai de grâce (${HOST_GRACE_PERIOD_MS / 1000}s)`);
                    }, HOST_GRACE_PERIOD_MS);
                    geoHostDisconnectTimers.set(geoResult.roomCode, timer);
                    console.log(`[GEO] Host déconnecté de ${geoResult.roomCode}, délai de grâce ${HOST_GRACE_PERIOD_MS / 1000}s`);
                } else {
                    io.to(`geo-${geoResult.roomCode}`).emit('geo-player-left', geoGameManager.getPlayersInRoom(geoResult.roomCode));
                }
            }
        });
    }
};

// Timer serveur de sécurité — si l'hôte/remote ne termine pas le round, le serveur le fait
function setupServerRoundTimer(io, roomCode, room) {
    if (room.roundTimer) {
        clearTimeout(room.roundTimer);
    }
    // +5s de marge pour laisser le client agir en premier
    const delay = (room.timePerRound + 5) * 1000;
    room.roundTimer = setTimeout(() => {
        room.roundTimer = null;
        const currentRoom = geoGameManager.getRoom(roomCode);
        if (!currentRoom || currentRoom.gameState !== 'PLAYING') return;

        console.log(`[GEO] Timer serveur: auto-end round ${currentRoom.currentRound} pour room ${roomCode}`);
        const result = geoGameManager.endRound(roomCode);
        if (result.success) {
            io.to(`geo-${roomCode}`).emit('geo-round-ended', {
                results: result.results,
                correctLocation: result.correctLocation,
                currentRound: result.currentRound,
                totalRounds: result.totalRounds
            });
        }
    }, delay);
}
