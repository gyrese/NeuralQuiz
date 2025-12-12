/**
 * GeoGuessr Game Manager
 * Gère les salons de jeu GeoGuessr avec Google Street View
 */

// Import des coordonnées de lieux (300+ lieux dans le monde)
const WORLD_LOCATIONS = require('./geoLocations');

class GeoGameManager {
    constructor() {
        this.rooms = new Map(); // Map<roomCode, GeoRoom>
        console.log(`[GEO] Loaded ${WORLD_LOCATIONS.length} locations`);
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    createRoom(hostId, settings = {}) {
        const roomCode = this.generateRoomCode();
        const defaultSettings = {
            roundsCount: 5,        // Nombre de manches
            timePerRound: 60,      // Secondes par manche
            maxPoints: 5000,       // Points max par manche
            mapType: 'world'       // world, europe, france, etc.
        };

        this.rooms.set(roomCode, {
            code: roomCode,
            hostId: hostId,
            players: new Map(),    // Map<socketId, PlayerData>
            gameState: 'LOBBY',    // LOBBY, PLAYING, ROUND_END, GAME_END
            currentRound: 0,
            totalRounds: settings.roundsCount || defaultSettings.roundsCount,
            timePerRound: settings.timePerRound || defaultSettings.timePerRound,
            maxPoints: settings.maxPoints || defaultSettings.maxPoints,
            currentLocation: null, // {lat, lng, country, city}
            locations: [],         // Lieux utilisés dans cette partie
            roundStartTime: null,
            settings: { ...defaultSettings, ...settings }
        });

        return roomCode;
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    joinRoom(roomCode, playerId, playerName, avatar) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        // Vérifier si le joueur existe déjà (Reconnexion)
        let existingPlayerId = null;
        for (const [id, p] of room.players) {
            if (p.name.toLowerCase() === playerName.toLowerCase()) {
                existingPlayerId = id;
                break;
            }
        }

        if (existingPlayerId) {
            // RECONNEXION
            const playerData = room.players.get(existingPlayerId);

            // Supprimer l'ancienne entrée et ajouter la nouvelle avec le nouveau Socket ID
            room.players.delete(existingPlayerId);

            // Mettre à jour l'ID et garder le reste des données (score, etc.)
            playerData.id = playerId;
            if (avatar) playerData.avatar = avatar; // Mettre à jour l'avatar si fourni

            room.players.set(playerId, playerData);

            console.log(`[GEO] Player ${playerName} reconnected to room ${roomCode}`);

            return {
                success: true,
                room,
                reconnected: true,
                gameState: room.gameState,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                location: room.currentLocation // Renvoyer la location actuelle pour ré-afficher Street View
            };
        }

        // NOUVEAU JOUEUR
        if (room.gameState !== 'LOBBY') return { error: 'Partie déjà en cours' };

        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            avatar: avatar || null,
            totalScore: 0,
            roundScores: [],
            currentGuess: null,   // {lat, lng}
            hasGuessed: false,
            lastDistance: null
        });

        return { success: true, room };
    }

    // Sélectionner un lieu aléatoire
    getRandomLocation(mapType = 'world') {
        let locations = WORLD_LOCATIONS;

        // Filtrer par région si nécessaire
        const europeanCountries = [
            'France', 'UK', 'Italy', 'Germany', 'Spain', 'Portugal', 'Austria',
            'Czech Republic', 'Sweden', 'Denmark', 'Netherlands', 'Belgium',
            'Switzerland', 'Norway', 'Finland', 'Poland', 'Hungary', 'Romania',
            'Bulgaria', 'Greece', 'Croatia', 'Slovenia', 'Serbia', 'Ireland',
            'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Albania', 'Montenegro',
            'North Macedonia', 'Bosnia and Herzegovina'
        ];

        const asianCountries = [
            'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Macau',
            'Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Singapore', 'Philippines',
            'Cambodia', 'Laos', 'Myanmar', 'India', 'Sri Lanka', 'Nepal', 'Bhutan',
            'Bangladesh', 'Pakistan', 'UAE', 'Qatar', 'Saudi Arabia', 'Israel',
            'Turkey', 'Iran', 'Jordan', 'Lebanon', 'Oman', 'Bahrain', 'Kuwait',
            'Uzbekistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan'
        ];

        if (mapType === 'europe') {
            locations = WORLD_LOCATIONS.filter(l => europeanCountries.includes(l.country));
        } else if (mapType === 'asia') {
            locations = WORLD_LOCATIONS.filter(l => asianCountries.includes(l.country));
        } else if (mapType === 'france') {
            locations = WORLD_LOCATIONS.filter(l => l.country === 'France');
        } else if (mapType === 'usa') {
            locations = WORLD_LOCATIONS.filter(l => l.country === 'USA');
        } else if (mapType === 'americas') {
            locations = WORLD_LOCATIONS.filter(l =>
                ['USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia',
                    'Peru', 'Ecuador', 'Venezuela', 'Bolivia', 'Paraguay', 'Uruguay',
                    'Costa Rica', 'Panama', 'Guatemala', 'Honduras', 'El Salvador',
                    'Nicaragua', 'Cuba', 'Dominican Republic', 'Jamaica', 'Puerto Rico',
                    'Bahamas', 'Barbados', 'Martinique', 'Guadeloupe', 'Belize'
                ].includes(l.country)
            );
        } else if (mapType === 'africa') {
            locations = WORLD_LOCATIONS.filter(l =>
                ['Egypt', 'Morocco', 'Tunisia', 'Algeria', 'South Africa', 'Kenya',
                    'Tanzania', 'Nigeria', 'Ghana', 'Senegal', 'Ethiopia', 'Rwanda',
                    'Uganda', 'Namibia', 'Botswana', 'Zimbabwe', 'Zambia', 'Mozambique',
                    'Madagascar', 'Mauritius', 'Seychelles', 'Ivory Coast', 'Liberia'
                ].includes(l.country)
            );
        } else if (mapType === 'oceania') {
            locations = WORLD_LOCATIONS.filter(l =>
                ['Australia', 'New Zealand', 'Fiji', 'Tonga', 'Samoa', 'New Caledonia',
                    'French Polynesia', 'Palau', 'Guam'
                ].includes(l.country)
            );
        }

        // Fallback si pas de locations trouvées
        if (locations.length === 0) {
            locations = WORLD_LOCATIONS;
        }

        // Ajouter un léger décalage aléatoire pour varier les vues
        const baseLocation = locations[Math.floor(Math.random() * locations.length)];
        const offset = 0.01; // ~1km de variation

        return {
            lat: baseLocation.lat + (Math.random() - 0.5) * offset * 2,
            lng: baseLocation.lng + (Math.random() - 0.5) * offset * 2,
            country: baseLocation.country,
            city: baseLocation.city
        };
    }

    startGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'PLAYING';
        room.currentRound = 1;
        room.locations = [];

        // Générer le premier lieu
        const location = this.getRandomLocation(room.settings.mapType);
        room.currentLocation = location;
        room.locations.push(location);
        room.roundStartTime = Date.now();

        // Reset les scores des joueurs
        for (const player of room.players.values()) {
            player.totalScore = 0;
            player.roundScores = [];
            player.currentGuess = null;
            player.hasGuessed = false;
        }

        return { success: true, location, round: 1, total: room.totalRounds };
    }

    submitGuess(roomCode, playerId, guessLat, guessLng) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };
        if (room.gameState !== 'PLAYING') return { error: 'Partie non en cours' };

        const player = room.players.get(playerId);
        if (!player) return { error: 'Joueur introuvable' };
        if (player.hasGuessed) return { error: 'Déjà répondu' };

        // Enregistrer la réponse
        player.currentGuess = { lat: guessLat, lng: guessLng };
        player.hasGuessed = true;

        // Calculer la distance
        const distance = this.calculateDistance(
            room.currentLocation.lat,
            room.currentLocation.lng,
            guessLat,
            guessLng
        );

        player.lastDistance = distance;

        // Calculer les points (plus c'est proche, plus c'est de points)
        // 5000 points max, diminue avec la distance
        const score = this.calculateScore(distance, room.maxPoints);
        player.roundScores.push(score);
        player.totalScore += score;

        const allGuessed = this.allPlayersGuessed(roomCode);

        return { success: true, distance, score, allGuessed };
    }

    // Formule de Haversine pour calculer la distance en km
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Rayon de la Terre en km
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    // Score basé sur la distance (courbe exponentielle)
    calculateScore(distance, maxPoints) {
        // 0 km = 5000 pts, ~15000 km = 0 pts
        // Courbe: score = max * e^(-distance/2000)
        const score = maxPoints * Math.exp(-distance / 2000);
        return Math.max(0, Math.round(score));
    }

    endRound(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'ROUND_END';

        // Compiler les résultats du round
        const results = [];
        for (const player of room.players.values()) {
            results.push({
                id: player.id,
                name: player.name,
                avatar: player.avatar,
                guess: player.currentGuess,
                distance: player.lastDistance || null,
                roundScore: player.roundScores[player.roundScores.length - 1] || 0,
                totalScore: player.totalScore,
                hasGuessed: player.hasGuessed
            });
        }

        // Trier par score du round
        results.sort((a, b) => b.roundScore - a.roundScore);

        return {
            success: true,
            correctLocation: room.currentLocation,
            results,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds
        };
    }

    nextRound(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.currentRound++;

        if (room.currentRound > room.totalRounds) {
            // Fin de partie
            room.gameState = 'GAME_END';

            const finalResults = [];
            for (const player of room.players.values()) {
                finalResults.push({
                    id: player.id,
                    name: player.name,
                    avatar: player.avatar,
                    totalScore: player.totalScore,
                    roundScores: player.roundScores
                });
            }
            finalResults.sort((a, b) => b.totalScore - a.totalScore);

            return { gameOver: true, results: finalResults };
        }

        // Préparer le prochain round
        room.gameState = 'PLAYING';
        const location = this.getRandomLocation(room.settings.mapType);
        room.currentLocation = location;
        room.locations.push(location);
        room.roundStartTime = Date.now();

        // Reset les réponses des joueurs
        for (const player of room.players.values()) {
            player.currentGuess = null;
            player.hasGuessed = false;
            player.lastDistance = null;
        }

        return {
            success: true,
            location,
            round: room.currentRound,
            total: room.totalRounds
        };
    }

    removePlayer(playerId) {
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

    getPlayersInRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return [];
        return Array.from(room.players.values());
    }

    // Vérifier si tous les joueurs ont répondu
    allPlayersGuessed(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        for (const player of room.players.values()) {
            if (!player.hasGuessed) return false;
        }
        return room.players.size > 0;
    }
}

module.exports = new GeoGameManager();
