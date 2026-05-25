/**
 * GeoGuessr Game Manager (SQLite & Anti-Cheat Version)
 */

const geoLocations = require('./geoLocations');

class GeoGameManager {
    constructor() {
        this.rooms = new Map(); // Map<roomCode, GeoRoom>
        
        // Chargement asynchrone du nombre de lieux pour le log (retardé pour laisser SQLite s'initialiser)
        setTimeout(() => {
            geoLocations.getAll().then(locs => {
                console.log(`[GEO] Loaded ${locs.length} locations from SQLite.`);
            }).catch(err => {
                console.error('[GEO] Error getting initial locations count:', err);
            });
        }, 1000);

        // Nettoyage périodique des rooms mortes (toutes les 5 min)
        setInterval(() => this.cleanupRooms(), 5 * 60 * 1000);
    }

    cleanupRooms() {
        const now = Date.now();
        const GAME_END_TTL = 30 * 60 * 1000; // 30 min après GAME_END
        const STALE_TTL = 60 * 60 * 1000;    // 1h sans activité

        for (const [code, room] of this.rooms) {
            const gameEndRef = room.gameEndTime || room.roundStartTime;
            if (room.gameState === 'GAME_END' && gameEndRef && (now - gameEndRef) > GAME_END_TTL) {
                console.log(`[GEO] Cleanup: room ${code} (GAME_END depuis ${Math.round((now - gameEndRef) / 60000)} min)`);
                this.deleteRoom(code);
                continue;
            }
            const activePlayers = Array.from(room.players.values()).filter(p => !p.disconnected);
            if (activePlayers.length === 0 && room.players.size > 0 && room.roundStartTime && (now - room.roundStartTime) > STALE_TTL) {
                console.log(`[GEO] Cleanup: room ${code} (aucun joueur actif depuis ${Math.round((now - room.roundStartTime) / 60000)} min)`);
                this.deleteRoom(code);
            }
        }
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
            currentLocation: null, // Vrai lieu {lat, lng, country, city}
            currentLocationApprox: null, // Lieu approximatif envoyé aux clients
            locations: [],         // Lieux utilisés dans cette partie (vrais lieux)
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
            const playerData = room.players.get(existingPlayerId);
            room.players.delete(existingPlayerId);

            playerData.id = playerId;
            playerData.disconnected = false;
            if (avatar) playerData.avatar = avatar;

            room.players.set(playerId, playerData);

            console.log(`[GEO] Player ${playerName} reconnected to room ${roomCode}`);

            return {
                success: true,
                room,
                reconnected: true,
                gameState: room.gameState,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds,
                // Ne renvoyer que la position approximative si la manche est en cours
                location: (room.gameState === 'PLAYING') ? room.currentLocationApprox : room.currentLocation,
                roundStartTime: room.roundStartTime,
                timePerRound: room.timePerRound,
                myScore: playerData.totalScore
            };
        }

        const isLateJoin = room.gameState !== 'LOBBY';
        const missedRounds = isLateJoin ? room.currentRound - 1 : 0;

        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            avatar: avatar || null,
            totalScore: 0,
            roundScores: Array(missedRounds).fill(0),
            currentGuess: null,
            hasGuessed: room.gameState === 'PLAYING' ? false : true,
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
            // Ne renvoyer que la position approximative si la manche est en cours
            location: (room.gameState === 'PLAYING') ? room.currentLocationApprox : room.currentLocation,
            roundStartTime: room.roundStartTime,
            timePerRound: room.timePerRound,
            missedRounds
        };
    }

    async getRandomLocation(mapType = ['world'], room = null) {
        const allLocations = await geoLocations.getAll();
        let pool = [];
        const selectedRegions = Array.isArray(mapType) ? mapType : [mapType];
        const playedLocations = room?.locations || [];

        // Si "world" est sélectionné ou si la liste est vide, on prend tout
        if (selectedRegions.includes('world') || selectedRegions.length === 0) {
            return this.pickRealLocationFrom(allLocations, playedLocations);
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

        const specialCategories = {
            themeparks: [
                'Disneyland', 'Disney', 'Universal', 'Europa-Park', 'PortAventura',
                'Walibi', 'Efteling', 'Phantasialand', 'Tropical Islands', 'Legoland',
                'Gardaland', 'Parque Warner', 'Parc Astérix', 'Puy du Fou', 'Futuroscope',
                'Studio City', 'Lotte World', 'Everland', 'Amusement Park', 'Sunway Lagoon',
                'Dream World', 'Dunia Fantasi', 'Alton Towers', 'Harry Potter Studio',
                'Longleat', 'Movie World', 'Sea World', 'Dreamworld', 'Ferrari Land',
                'Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom',
                'Islands of Adventure', 'CityWalk', 'DisneySea', 'Plopsa',
                'Children\'s Amusement', 'Safari'
            ],
            beaches: [
                'Beach', 'Plage', 'Bondi', 'Copacabana', 'Waikiki', 'Miami Beach',
                'Maho Beach', 'Seminyak', 'Maya Bay', 'Surfers Paradise', 'Sentosa',
                'Kuta', 'Patong', 'Haeundae', 'Front de mer', 'Waterfront',
                'Playa', 'Promenade', 'Barceloneta', 'Ipanema', 'Croisette',
                'South Beach', 'La Jolla', 'Fort Lauderdale', 'Santa Monica',
                'Santa Cruz', 'Unawatuna', 'Calangute', 'White Bay', 'Cas Abao'
            ],
            markets: [
                'Market', 'Marché', 'Bazaar', 'Bazar', 'Chatuchak', 'Yu Garden',
                'Grand Bazaar', 'Souk', 'Mercado', 'Medina',
                'Boqueria', 'San Miguel', 'Tsukiji', 'Toyosu', 'Temple Street',
                'Shilin', 'Ben Thanh', 'Central Market', 'Tanah Abang',
                'Ciudadela', 'Surquillo', 'Pike Place', 'Grand Central', 'French Market',
                'Borough', 'Spitalfields', 'Albert Cuyp', 'Campo de\' Fiori', 'Centrale'
            ]
        };

        selectedRegions.forEach(region => {
            if (specialCategories[region]) {
                const keywords = specialCategories[region];
                const categoryLocations = allLocations.filter(l =>
                    keywords.some(keyword => l.city.toLowerCase().includes(keyword.toLowerCase()))
                );
                pool = pool.concat(categoryLocations);
            }
            else if (regions[region]) {
                const countryList = regions[region];
                const regionLocations = allLocations.filter(l => countryList.includes(l.country));
                pool = pool.concat(regionLocations);
            }
        });

        if (pool.length === 0) {
            pool = allLocations;
        }

        pool = [...new Set(pool)];

        return this.pickRealLocationFrom(pool, playedLocations);
    }

    pickRealLocationFrom(locations, playedLocations = []) {
        const playedCities = new Set(playedLocations.map(l => l.city));
        let available = locations.filter(l => !playedCities.has(l.city));

        if (available.length === 0) {
            console.warn('[GEO] pickRealLocationFrom: pool épuisé, reprise du pool complet');
            available = locations;
        }

        return available[Math.floor(Math.random() * available.length)];
    }

    async startGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'PLAYING';
        room.currentRound = 1;
        room.locations = [];

        // Générer le premier lieu (réel)
        const location = await this.getRandomLocation(room.settings.mapType, room);
        room.currentLocation = location;
        room.locations.push(location);

        // Bruitage pour Street View des joueurs (~200m)
        const offset = 0.002;
        const latApprox = location.lat + (Math.random() - 0.5) * offset * 2;
        const lngApprox = location.lng + (Math.random() - 0.5) * offset * 2;
        room.currentLocationApprox = { lat: latApprox, lng: lngApprox };

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

        // Retourner la location approximative au démarrage (pour masquer city/country/vrais coords)
        return {
            success: true,
            location: { lat: latApprox, lng: lngApprox },
            round: 1,
            total: room.totalRounds
        };
    }

    submitGuess(roomCode, playerId, guessLat, guessLng) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };
        if (room.gameState !== 'PLAYING') return { error: 'Partie non en cours' };

        const player = room.players.get(playerId);
        if (!player) return { error: 'Joueur introuvable' };
        if (player.hasGuessed) return { error: 'Déjà répondu' };

        // Détection Anti-Triche: si les coordonnées de guess sont STRICTEMENT identiques
        // aux coordonnées approximatives envoyées par le serveur (copier-coller du payload websocket)
        const isCheating = (guessLat === room.currentLocationApprox.lat && guessLng === room.currentLocationApprox.lng);

        player.currentGuess = { lat: guessLat, lng: guessLng };
        player.hasGuessed = true;

        let distance = 0;
        let distanceScore = 0;

        if (isCheating) {
            console.warn(`[GEO] [ANTI-CHEAT] Player "${player.name}" in room ${roomCode} detected cheating!`);
            distance = 9999.9; // Arbitrairement grand
            distanceScore = 0;
            player.isCheater = true;
        } else {
            // Calcul par rapport au lieu réel
            distance = this.calculateDistance(
                room.currentLocation.lat,
                room.currentLocation.lng,
                guessLat,
                guessLng
            );
            distanceScore = this.calculateScore(distance, room.maxPoints);
        }

        player.lastDistance = distance;

        // Bonus de temps
        let timeBonus = 0;
        if (distanceScore > 0 && !isCheating) {
            const timeElapsed = (Date.now() - room.roundStartTime) / 1000;
            const totalTime = room.timePerRound;
            const ratio = Math.max(0, 1 - (timeElapsed / totalTime));
            timeBonus = Math.round(1000 * ratio);
        }

        const totalRoundScore = distanceScore + timeBonus;

        player.roundScores.push(totalRoundScore);
        player.totalScore += totalRoundScore;

        player.roundDistances.push(distance);
        const timeTaken = (Date.now() - room.roundStartTime) / 1000;
        player.roundTimes.push(timeTaken);

        const allGuessed = this.allPlayersGuessed(roomCode);

        return {
            success: true,
            distance,
            score: totalRoundScore,
            pointsBreakdown: { distance: distanceScore, time: timeBonus },
            allGuessed,
            isCheater: isCheating
        };
    }

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

    calculateScore(distance, maxPoints) {
        const score = maxPoints * Math.exp(-distance / 2000);
        return Math.max(0, Math.round(score));
    }

    endRound(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (room.gameState === 'ROUND_END') {
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
                    hasGuessed: player.hasGuessed,
                    isCheater: player.isCheater || false
                });
            }
            results.sort((a, b) => b.roundScore - a.roundScore);
            return {
                success: true,
                correctLocation: room.currentLocation, // Renvoyer le VRAI lieu à la fin du round
                results,
                currentRound: room.currentRound,
                totalRounds: room.totalRounds
            };
        }

        if (room.gameState !== 'PLAYING') {
            return { error: `Cannot end round: game is in ${room.gameState} state` };
        }

        if (room.isEndingRound) {
            return { error: 'Round end already in progress' };
        }
        room.isEndingRound = true;

        room.gameState = 'ROUND_END';

        const results = [];
        for (const player of room.players.values()) {
            if (!player.hasGuessed) {
                player.roundScores.push(0);
                player.roundDistances.push(null);
                player.roundTimes.push(null);
            }

            results.push({
                id: player.id,
                name: player.name,
                avatar: player.avatar,
                guess: player.currentGuess,
                distance: player.lastDistance || null,
                roundScore: player.roundScores[player.roundScores.length - 1] || 0,
                totalScore: player.totalScore,
                hasGuessed: player.hasGuessed,
                isCheater: player.isCheater || false
            });
        }

        results.sort((a, b) => b.roundScore - a.roundScore);

        room.isEndingRound = false;

        return {
            success: true,
            correctLocation: room.currentLocation, // Renvoyer le VRAI lieu à la fin du round
            results,
            currentRound: room.currentRound,
            totalRounds: room.totalRounds
        };
    }

    async nextRound(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (room.gameState !== 'ROUND_END') {
            console.log(`[GEO] nextRound called but room ${roomCode} is in state ${room.gameState}, ignoring`);
            return { error: `Cannot advance round: game is in ${room.gameState} state` };
        }

        room.currentRound++;

        if (room.currentRound > room.totalRounds) {
            room.gameState = 'GAME_END';
            room.gameEndTime = Date.now();

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
        const location = await this.getRandomLocation(room.settings.mapType, room);
        room.currentLocation = location;
        room.locations.push(location);

        // Bruitage pour Street View des joueurs (~200m)
        const offset = 0.002;
        const latApprox = location.lat + (Math.random() - 0.5) * offset * 2;
        const lngApprox = location.lng + (Math.random() - 0.5) * offset * 2;
        room.currentLocationApprox = { lat: latApprox, lng: lngApprox };

        room.roundStartTime = Date.now();

        for (const player of room.players.values()) {
            player.currentGuess = null;
            player.hasGuessed = false;
            player.lastDistance = null;
            player.isCheater = false; // Reset anti-cheat status
        }

        // Retourner la location approximative au début de la manche
        return {
            success: true,
            round: room.currentRound,
            total: room.totalRounds,
            timePerRound: room.timePerRound,
            location: { lat: latApprox, lng: lngApprox }
        };
    }

    restartGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'LOBBY';
        room.currentRound = 0;
        room.currentLocation = null;
        room.currentLocationApprox = null;
        room.locations = [];
        room.roundStartTime = null;
        room.gameEndTime = null;

        for (const player of room.players.values()) {
            player.totalScore = 0;
            player.roundScores = [];
            player.currentGuess = null;
            player.hasGuessed = false;
            player.lastDistance = null;
            player.roundDistances = [];
            player.roundTimes = [];
            player.disconnected = false;
            player.isCheater = false;
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

    deleteRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room) {
            if (room.roundTimer) {
                clearTimeout(room.roundTimer);
                room.roundTimer = null;
            }
            this.rooms.delete(roomCode);
            console.log(`[GEO] Room ${roomCode} deleted`);
        }
    }

    removePlayer(playerId) {
        for (const [code, room] of this.rooms) {
            if (room.hostId === playerId) {
                room.hostDisconnected = true;
                return { roomCode: code, room, isHost: true };
            }

            if (room.players.has(playerId)) {
                if (room.gameState !== 'LOBBY') {
                    const player = room.players.get(playerId);
                    player.disconnected = true;
                    return { roomCode: code, room, isHost: false, type: 'disconnected', player };
                }

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

            const totalTime = player.roundTimes.reduce((a, b) => a + (b || 0), 0);
            if (totalTime < fastestTime) {
                fastestTime = totalTime;
                fastestPlayer = player;
            }

            const totalDistance = player.roundDistances.reduce((a, b) => a + (b || 0), 0);
            if (totalDistance > maxTotalDistance) {
                maxTotalDistance = totalDistance;
                worstPlayer = player;
            }

            const maxDist = Math.max(...player.roundDistances.map(d => d || 0));
            if (maxDist > maxSingleDistance) {
                maxSingleDistance = maxDist;
                furthestPlayer = player;
            }
        }

        const awards = [];
        if (fastestPlayer) {
            awards.push({
                type: 'fastest',
                title: 'eCLAIRE',
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
