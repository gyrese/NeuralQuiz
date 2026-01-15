/**
 * GeoGuessr Game Manager
 * Gère les salons de jeu GeoGuessr avec Google Street View
 */

// Import des coordonnées de lieux (300+ lieux dans le monde)
const geoLocations = require('./geoLocations');

class GeoGameManager {
    constructor() {
        this.rooms = new Map(); // Map<roomCode, GeoRoom>
        console.log(`[GEO] Loaded ${geoLocations.getAll().length} locations`);
    }

    // ... (keep generateRoomCode, createRoom, getRoom, joinRoom as is) ...

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
            playerData.disconnected = false; // Remettre connecté
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
                location: room.currentLocation, // Renvoyer la location actuelle pour ré-afficher Street View
                roundStartTime: room.roundStartTime,
                timePerRound: room.timePerRound,
                myScore: playerData.totalScore
            };
        }

        // NOUVEAU JOUEUR
        // Allow late joiners during the game (they start with 0 points for missed rounds)
        const isLateJoin = room.gameState !== 'LOBBY';

        // Calculate how many rounds were missed
        const missedRounds = isLateJoin ? room.currentRound - 1 : 0;

        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            avatar: avatar || null,
            totalScore: 0,
            roundScores: Array(missedRounds).fill(0), // Fill missed rounds with 0
            currentGuess: null,   // {lat, lng}
            hasGuessed: room.gameState === 'PLAYING' ? false : true, // If joining during PLAYING, allow guess
            lastDistance: null,
            roundDistances: Array(missedRounds).fill(null),
            roundTimes: Array(missedRounds).fill(null),
            lateJoin: isLateJoin,
            joinedAtRound: isLateJoin ? room.currentRound : 0
        });

        console.log(`[GEO] Player ${playerName} joined room ${roomCode}${isLateJoin ? ` (late join at round ${room.currentRound})` : ''}`);

        return {
            success: true,
            room,
            lateJoin: isLateJoin,
            gameState: room.gameState,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds,
            location: room.currentLocation,
            roundStartTime: room.roundStartTime,
            timePerRound: room.timePerRound,
            missedRounds
        };
    }

    // Sélectionner un lieu aléatoire
    getRandomLocation(mapType = ['world']) {
        const allLocations = geoLocations.getAll();
        let locations = [];
        const selectedRegions = Array.isArray(mapType) ? mapType : [mapType];

        // Si "world" est sélectionné ou si la liste est vide, on prend tout
        if (selectedRegions.includes('world') || selectedRegions.length === 0) {
            return this.pickRandomFrom(allLocations);
        }

        const regions = {
            europe: [
                'France', 'UK', 'Italy', 'Germany', 'Spain', 'Portugal', 'Austria',
                'Czech Republic', 'Sweden', 'Denmark', 'Netherlands', 'Belgium',
                'Switzerland', 'Norway', 'Finland', 'Poland', 'Hungary', 'Romania',
                'Bulgaria', 'Greece', 'Croatia', 'Slovenia', 'Serbia', 'Ireland',
                'Slovakia', 'Estonia', 'Latvia', 'Lithuania', 'Albania', 'Montenegro',
                'North Macedonia', 'Bosnia and Herzegovina', 'Ukraine', 'Belarus', 'Moldova'
            ],
            asia: [
                'Japan', 'South Korea', 'China', 'Taiwan', 'Hong Kong', 'Macau',
                'Thailand', 'Vietnam', 'Indonesia', 'Malaysia', 'Singapore', 'Philippines',
                'Cambodia', 'Laos', 'Myanmar', 'India', 'Sri Lanka', 'Nepal', 'Bhutan',
                'Bangladesh', 'Pakistan', 'UAE', 'Qatar', 'Saudi Arabia', 'Israel',
                'Turkey', 'Iran', 'Jordan', 'Lebanon', 'Oman', 'Bahrain', 'Kuwait',
                'Uzbekistan', 'Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan'
            ],
            africa: [
                'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'South Africa', 'Kenya',
                'Tanzania', 'Nigeria', 'Ghana', 'Senegal', 'Ethiopia', 'Rwanda',
                'Uganda', 'Namibia', 'Botswana', 'Zimbabwe', 'Zambia', 'Mozambique',
                'Madagascar', 'Mauritius', 'Seychelles', 'Ivory Coast', 'Liberia'
            ],
            americas: [
                'USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia',
                'Peru', 'Ecuador', 'Venezuela', 'Bolivia', 'Paraguay', 'Uruguay',
                'Costa Rica', 'Panama', 'Guatemala', 'Honduras', 'El Salvador',
                'Nicaragua', 'Cuba', 'Dominican Republic', 'Jamaica', 'Puerto Rico',
                'Bahamas', 'Barbados', 'Martinique', 'Guadeloupe', 'Belize'
            ],
            oceania: [
                'Australia', 'New Zealand', 'Fiji', 'Tonga', 'Samoa', 'New Caledonia',
                'French Polynesia', 'Palau', 'Guam'
            ],
            france: ['France'],
            usa: ['USA'],
            reunion: ['Reunion']
        };

        // Catégories spéciales (filtrage par mots-clés dans le nom)
        const specialCategories = {
            themeparks: [
                'Disneyland', 'Disney', 'Universal', 'Europa-Park', 'PortAventura',
                'Walibi', 'Efteling', 'Phantasialand', 'Tropical Islands', 'Legoland',
                'Gardaland', 'Parque Warner', 'Parc Astérix', 'Puy du Fou', 'Futuroscope',
                'Studio City', 'Lotte World', 'Everland', 'Amusement Park', 'Sunway Lagoon',
                'Dream World', 'Dunia Fantasi', 'Alton Towers', 'Harry Potter Studio',
                'Longleat', 'Movie World', 'Sea World', 'Dreamworld', 'Ferrari Land',
                // Ajouts pour matcher les noms dans geoLocations.js
                'Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom',
                'Islands of Adventure', 'CityWalk', 'DisneySea', 'Plopsa',
                'Children\'s Amusement', 'Safari'
            ],
            beaches: [
                'Beach', 'Plage', 'Bondi', 'Copacabana', 'Waikiki', 'Miami Beach',
                'Maho Beach', 'Seminyak', 'Maya Bay', 'Surfers Paradise', 'Sentosa',
                'Kuta', 'Patong', 'Haeundae', 'Front de mer', 'Waterfront',
                // Ajouts pour englober plus de lieux côtiers
                'Playa', 'Promenade', 'Barceloneta', 'Ipanema', 'Croisette',
                'South Beach', 'La Jolla', 'Fort Lauderdale', 'Santa Monica',
                'Santa Cruz', 'Unawatuna', 'Calangute', 'White Bay', 'Cas Abao'
            ],
            markets: [
                'Market', 'Marché', 'Bazaar', 'Bazar', 'Chatuchak', 'Yu Garden',
                'Grand Bazaar', 'Souk', 'Mercado', 'Medina',
                // Ajouts pour matcher les noms dans geoLocations.js
                'Boqueria', 'San Miguel', 'Tsukiji', 'Toyosu', 'Temple Street',
                'Shilin', 'Ben Thanh', 'Central Market', 'Tanah Abang',
                'Ciudadela', 'Surquillo', 'Pike Place', 'Grand Central', 'French Market',
                'Borough', 'Spitalfields', 'Albert Cuyp', 'Campo de\' Fiori', 'Centrale'
            ]
        };

        // Compiler les lieux de toutes les régions sélectionnées
        let pool = [];
        selectedRegions.forEach(region => {
            // Vérifier si c'est une catégorie spéciale
            if (specialCategories[region]) {
                const keywords = specialCategories[region];
                const categoryLocations = allLocations.filter(l =>
                    keywords.some(keyword => l.city.toLowerCase().includes(keyword.toLowerCase()))
                );
                pool = pool.concat(categoryLocations);
            }
            // Sinon c'est une région géographique
            else if (regions[region]) {
                const countryList = regions[region];
                const regionLocations = allLocations.filter(l => countryList.includes(l.country));
                pool = pool.concat(regionLocations);
            }
        });

        // Fallback
        if (pool.length === 0) {
            pool = allLocations;
        }

        // Dédoublonner (au cas où, ex: France inclu dans Europe ET France)
        pool = [...new Set(pool)];

        return this.pickRandomFrom(pool);
    }

    pickRandomFrom(locations) {
        // Ajouter un léger décalage aléatoire pour varier les vues
        const baseLocation = locations[Math.floor(Math.random() * locations.length)];
        const offset = 0.002; // ~200m de variation (was 1km, too far from coverage)

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
            player.roundDistances = [];
            player.roundTimes = [];
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

        // 1. Score de Distance (5000 max)
        const distanceScore = this.calculateScore(distance, room.maxPoints);

        // 2. Bonus de Temps (1000 max)
        // Uniquement si le joueur a marqué des points de distance (> 0)
        let timeBonus = 0;
        if (distanceScore > 0) {
            const timeElapsed = (Date.now() - room.roundStartTime) / 1000;
            const totalTime = room.timePerRound;
            const ratio = Math.max(0, 1 - (timeElapsed / totalTime)); // 1.0 au début, 0.0 à la fin
            timeBonus = Math.round(1000 * ratio);
        }


        const totalRoundScore = distanceScore + timeBonus;

        player.roundScores.push(totalRoundScore);
        player.totalScore += totalRoundScore;

        // Track stats for awards
        player.roundDistances.push(distance);
        const timeTaken = (Date.now() - room.roundStartTime) / 1000;
        player.roundTimes.push(timeTaken);

        const allGuessed = this.allPlayersGuessed(roomCode);

        // On retourne le détail pour l'afficher côté client si besoin
        return {
            success: true,
            distance,
            score: totalRoundScore,
            pointsBreakdown: { distance: distanceScore, time: timeBonus },
            allGuessed
        };
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

        // Éviter les doubles appels - si déjà en ROUND_END, retourner le résultat actuel
        if (room.gameState === 'ROUND_END') {
            console.log(`[GEO] Round already ended for room ${roomCode}, returning cached results`);
            // Retourner les résultats actuels sans modifier l'état
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
            results.sort((a, b) => b.roundScore - a.roundScore);
            return {
                success: true,
                correctLocation: room.currentLocation,
                results,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds
            };
        }

        // Vérifier qu'on est bien en état PLAYING
        if (room.gameState !== 'PLAYING') {
            console.log(`[GEO] Cannot end round - game state is ${room.gameState}`);
            return { error: `Cannot end round: game is in ${room.gameState} state` };
        }

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

            return { gameOver: true, results: finalResults, awards: this.calculateAwards(roomCode) };
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
            round: room.currentRound,
            total: room.totalRounds,
            timePerRound: room.timePerRound,
            location: location
        };
    }


    restartGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        // Reset game state but keep players
        room.gameState = 'LOBBY';
        room.currentRound = 0;
        room.currentLocation = null;
        room.locations = [];
        room.roundStartTime = null;

        // Reset scores
        for (const player of room.players.values()) {
            player.totalScore = 0;
            player.currentGuess = null;
            player.hasGuessed = false;
            player.lastDistance = null;
            player.roundDistances = [];
            player.roundTimes = [];
            player.disconnected = false; // Reset disconnect status on restart
        }

        return { success: true, room };
    }

    kickPlayer(roomCode, playerId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (room.players.has(playerId)) {
            room.players.delete(playerId);
            return { success: true };
        }
        return { error: 'Joueur introuvable' };
    }

    removePlayer(playerId) {
        for (const [code, room] of this.rooms) {
            if (room.hostId === playerId) {
                this.rooms.delete(code);
                return { roomCode: code, room, isHost: true };
            }

            if (room.players.has(playerId)) {

                // Si on est en partie, on ne supprime pas le joueur, on le marque déconnecté
                if (room.gameState !== 'LOBBY') {
                    const player = room.players.get(playerId);
                    player.disconnected = true;
                    return { roomCode: code, room, isHost: false, type: 'disconnected', player };
                }

                // Si on est dans le lobby, on supprime carrément
                room.players.delete(playerId);
                return { roomCode: code, room, isHost: false, type: 'left' };
            }
        }
        return null;
    }

    getPlayersInRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return [];
        return Array.from(room.players.values());
    }

    // Vérifier si tous les joueurs (connectés) ont répondu
    allPlayersGuessed(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return false;

        const activePlayers = Array.from(room.players.values()).filter(p => !p.disconnected);

        if (activePlayers.length === 0) return false;

        for (const player of activePlayers) {
            if (!player.hasGuessed) return false;
        }
        return true;
    }

    calculateAwards(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return [];

        let fastestPlayer = null;
        let fastestTime = Infinity;

        let worstPlayer = null;
        let maxTotalDistance = -1;

        let furthestPlayer = null;
        let maxSingleDistance = -1;

        for (const player of room.players.values()) {
            if (player.roundTimes.length === 0) continue;

            // 1. Fastest Cumulative Time
            const totalTime = player.roundTimes.reduce((a, b) => a + b, 0);
            if (totalTime < fastestTime) {
                fastestTime = totalTime;
                fastestPlayer = player;
            }

            // 2. Worst Player (Max Total Distance) - "Le Touriste"
            const totalDistance = player.roundDistances.reduce((a, b) => a + b, 0);
            if (totalDistance > maxTotalDistance) {
                maxTotalDistance = totalDistance;
                worstPlayer = player;
            }

            // 3. Furthest Single Guess - "L'Astronaute"
            const maxDist = Math.max(...player.roundDistances);
            if (maxDist > maxSingleDistance) {
                maxSingleDistance = maxDist;
                furthestPlayer = player;
            }
        }

        const awards = [];
        if (fastestPlayer) {
            awards.push({
                type: 'fastest',
                title: 'eCLAIRE', // "Le plus rapide"
                icon: '⚡',
                playerId: fastestPlayer.id,
                playerName: fastestPlayer.name,
                avatar: fastestPlayer.avatar,
                value: `${fastestTime.toFixed(1)}s (total)`
            });
        }
        if (worstPlayer) {
            awards.push({
                type: 'tourist',
                title: 'Le Touriste',
                icon: '🧭',
                playerId: worstPlayer.id,
                playerName: worstPlayer.name,
                avatar: worstPlayer.avatar,
                value: `${Math.round(maxTotalDistance).toLocaleString()} km`
            });
        }
        if (furthestPlayer) {
            awards.push({
                type: 'astronaut',
                title: 'L\'Astronaute',
                icon: '🚀',
                playerId: furthestPlayer.id,
                playerName: furthestPlayer.name,
                avatar: furthestPlayer.avatar,
                value: `${Math.round(maxSingleDistance).toLocaleString()} km`
            });
        }

        return awards;
    }
}

module.exports = new GeoGameManager();
