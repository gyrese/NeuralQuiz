class GameManager {
    constructor() {
        this.rooms = new Map(); // Map<roomCode, Room>
    }

    createRoom(hostId) {
        const roomCode = this.generateRoomCode();
        this.rooms.set(roomCode, {
            code: roomCode,
            hostId: hostId,
            players: new Map(), // Map<socketId, {name, score, answers, avatar}>
            gameState: 'LOBBY', // LOBBY, QUESTION, SERIES_END, END
            currentQuestionIndex: 0,
            questions: [], // Array of questions
            questionStartTime: null, // Timestamp du début de la question
            maxPossibleScore: 0, // Score maximum cumulé de toutes les séries jouées
        });
        return roomCode;
    }

    joinRoom(roomCode, playerId, playerName, avatar) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Room not found' };
        if (room.gameState !== 'LOBBY') return { error: 'Game already started' };

        // Check if name already taken
        for (const p of room.players.values()) {
            if (p.name === playerName) return { error: 'Name already taken' };
        }

        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            avatar: avatar || null,
            score: 0,
            lastAnswer: null,
            answerTime: null, // Temps de réponse en ms
            profile: {
                hairColor: null,
                profession: null,
                isSportive: null,
                isVegetarian: null,
                zodiacSign: null,
                favoriteDrink: null,
                favoriteAnimal: null,
                bedtime: null,
                coffeesPerDay: null
            }
        });
        return { success: true, room };
    }

    generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    removePlayer(playerId) {
        // Find room with player
        for (const [code, room] of this.rooms) {
            if (room.players.has(playerId)) {
                room.players.delete(playerId);
                return { roomCode: code, room };
            }
            if (room.hostId === playerId) {
                this.rooms.delete(code);
                return { roomCode: code, room, isHost: true };
            }
        }
        return null;
    }
}

module.exports = new GameManager();
