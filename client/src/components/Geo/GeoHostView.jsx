import { useState, useEffect, useRef } from 'react';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function GeoHostView({ onBack }) {
    const [roomCode, setRoomCode] = useState(null);
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('INIT'); // INIT, LOBBY, PLAYING, ROUND_END, GAME_END
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [roundResults, setRoundResults] = useState(null);
    const [correctLocation, setCorrectLocation] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [guessedPlayers, setGuessedPlayers] = useState(new Set());
    const [isEndingRound, setIsEndingRound] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Settings
    const [settings, setSettings] = useState({
        roundsCount: 5,
        timePerRound: 60,
        mapType: ['world'] // Tableau pour multi-sélection
    });

    const streetViewRef = useRef(null);
    const mapRef = useRef(null);
    const panoramaInstance = useRef(null);
    const mapInstance = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        // Créer la room au montage
        socket.emit('geo-create-room', { settings }, (response) => {
            if (response.roomCode) {
                setRoomCode(response.roomCode);
                setGameState('LOBBY');
            }
        });

        // Listeners
        socket.on('geo-player-joined', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('geo-player-left', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('geo-player-guessed', ({ playerId }) => {
            setGuessedPlayers(prev => new Set([...prev, playerId]));
        });

        socket.on('geo-all-guessed', () => {
            // Accélérer la fin du round (3 secondes restantes)
            setTimeLeft(prev => Math.min(prev, 3));
        });

        return () => {
            socket.off('geo-player-joined');
            socket.off('geo-player-left');
            socket.off('geo-player-guessed');
            socket.off('geo-all-guessed');
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Détection automatique "Tous ont répondu"
    useEffect(() => {
        if (gameState === 'PLAYING' && players.length > 0 && guessedPlayers.size === players.length) {
            // Force le timer à 3 secondes max si tous ont répondu
            setTimeLeft(prev => Math.min(prev, 3));
        }
    }, [guessedPlayers, players.length, gameState]);

    // Charger Google Maps API
    useEffect(() => {
        if (gameState === 'PLAYING' && !window.google) {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initGeoHost`;
            script.async = true;
            window.initGeoHost = () => initStreetView();
            document.head.appendChild(script);
        } else if (gameState === 'PLAYING' && window.google) {
            initStreetView();
        }
    }, [gameState, currentRound]);

    const initStreetView = () => {
        if (!correctLocation || !streetViewRef.current) return;

        panoramaInstance.current = new window.google.maps.StreetViewPanorama(
            streetViewRef.current,
            {
                position: { lat: correctLocation.lat, lng: correctLocation.lng },
                pov: { heading: Math.random() * 360, pitch: 0 },
                zoom: 1,
                addressControl: false,
                showRoadLabels: false,
                linksControl: true,
                panControl: true,
                enableCloseButton: false,
                fullscreenControl: false
            }
        );
    };

    // Init map pour les résultats
    useEffect(() => {
        if (gameState === 'ROUND_END' && window.google && mapRef.current && correctLocation) {
            initResultsMap();
        }
    }, [gameState, roundResults]);

    const initResultsMap = () => {
        if (!mapRef.current || !correctLocation) return;

        // Custom Overlay for Round Avatars
        class AvatarMarker extends window.google.maps.OverlayView {
            constructor(position, image, map) {
                super();
                this.position = position;
                this.image = image;
                this.div = null;
                this.setMap(map);
            }

            onAdd() {
                this.div = document.createElement('div');
                this.div.style.position = 'absolute';
                this.div.style.width = '44px';
                this.div.style.height = '44px';
                this.div.style.border = '2px solid white';
                this.div.style.borderRadius = '50%';
                this.div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.5)';
                this.div.style.backgroundImage = `url(${this.image})`;
                this.div.style.backgroundSize = 'cover';
                this.div.style.backgroundPosition = 'center';
                this.div.style.transform = 'translate(-50%, -50%)'; // Center anchor
                this.div.style.zIndex = '1000'; // Make sure it's on top

                const panes = this.getPanes();
                panes.overlayMouseTarget.appendChild(this.div);
            }

            draw() {
                const overlayProjection = this.getProjection();
                const pos = overlayProjection.fromLatLngToDivPixel(this.position);
                if (this.div) {
                    this.div.style.left = pos.x + 'px';
                    this.div.style.top = pos.y + 'px';
                }
            }

            onRemove() {
                if (this.div) {
                    this.div.parentNode.removeChild(this.div);
                    this.div = null;
                }
            }
        }

        const bounds = new window.google.maps.LatLngBounds();

        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: correctLocation.lat, lng: correctLocation.lng },
            zoom: 3,
            mapTypeId: 'hybrid', // Satellite avec libellés
            disableDefaultUI: true, // Cacher tous les boutons
        });

        // Marqueur de la bonne réponse (étoile verte)
        const correctMarker = new window.google.maps.Marker({
            position: { lat: correctLocation.lat, lng: correctLocation.lng },
            map: mapInstance.current,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                scaledSize: new window.google.maps.Size(50, 50)
            },
            title: `${correctLocation.city}, ${correctLocation.country}`,
            zIndex: 1000
        });

        // InfoWindow pour la bonne réponse
        const correctInfoWindow = new window.google.maps.InfoWindow({
            content: `<div style="color:#000;font-weight:bold;padding:8px;font-size:14px;">✓ ${correctLocation.city}, ${correctLocation.country}</div>`
        });
        correctInfoWindow.open(mapInstance.current, correctMarker);

        bounds.extend({ lat: correctLocation.lat, lng: correctLocation.lng });

        // Marqueurs des joueurs avec leurs avatars
        if (roundResults) {
            roundResults.forEach((result, index) => {
                if (result.guess) {
                    const playerColor = getPlayerColor(index);

                    if (result.avatar) {
                        // Utiliser l'overlay personnalisé pour l'avatar rond
                        new AvatarMarker(
                            new window.google.maps.LatLng(result.guess.lat, result.guess.lng),
                            result.avatar,
                            mapInstance.current
                        );
                    } else {
                        // Fallback sur un point coloré standard
                        new window.google.maps.Marker({
                            position: { lat: result.guess.lat, lng: result.guess.lng },
                            map: mapInstance.current,
                            icon: {
                                url: `https://maps.google.com/mapfiles/ms/icons/${playerColor}-dot.png`,
                                scaledSize: new window.google.maps.Size(40, 40)
                            },
                            title: result.name,
                            zIndex: 100 - index
                        });
                    }

                    // InfoWindow supprimée à la demande de l'utilisateur (trop chargé)
                    // On garde juste le marqueur

                    /* 
                    // InfoWindow avec le nom du joueur et sa distance
                    const infoWindow = new window.google.maps.InfoWindow({
                        content: `<div style="color:#000;padding:5px;text-align:center;">
                            <strong>${result.name}</strong><br/>
                            <span style="color:#666;font-size:12px;">${formatDistance(result.distance)}</span>
                        </div>`
                    });

                    // Afficher l'info au clic
                    marker.addListener('click', () => {
                        infoWindow.open(mapInstance.current, marker);
                    });

                    // Ouvrir automatiquement pour le premier joueur
                    if (index === 0) {
                        infoWindow.open(mapInstance.current, marker);
                    }
                    */

                    bounds.extend({ lat: result.guess.lat, lng: result.guess.lng });

                    // Ligne entre guess et réponse
                    new window.google.maps.Polyline({
                        path: [
                            { lat: result.guess.lat, lng: result.guess.lng },
                            { lat: correctLocation.lat, lng: correctLocation.lng }
                        ],
                        map: mapInstance.current,
                        strokeColor: '#ff0055',
                        strokeOpacity: 0.7,
                        strokeWeight: 3,
                        geodesic: true
                    });
                }
            });
        }

        mapInstance.current.fitBounds(bounds, 80);
    };

    const getPlayerColor = (index) => {
        const colors = ['red', 'blue', 'yellow', 'purple', 'orange', 'pink'];
        return colors[index % colors.length];
    };

    const startGame = () => {
        // Envoyer les settings actualisés avant de démarrer
        socket.emit('geo-update-settings', { roomCode, settings });

        socket.emit('geo-start-game', { roomCode, settings }, (response) => {
            if (response.success) {
                setGameState('PLAYING');
                setCurrentRound(response.round);
                setTotalRounds(response.total);
                setCorrectLocation(response.location);
                setGuessedPlayers(new Set());
                soundManager.play('start');
                startTimer();
            } else {
                console.error('Erreur démarrage:', response.error);
            }
        });
    };

    const startTimer = () => {
        const duration = settings.timePerRound || 60;
        setTimeLeft(duration);
        setIsEndingRound(false);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 10 && prev > 0) {
                    soundManager.playTick();
                }
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    // Utiliser setTimeout pour éviter les problèmes de state
                    setTimeout(() => endRound(), 100);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const endRound = () => {
        // Protection contre les doubles appels
        if (isEndingRound) {
            console.log('[GEO] endRound already in progress, skipping');
            return;
        }
        setIsEndingRound(true);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        socket.emit('geo-end-round', { roomCode }, (response) => {
            if (response.success) {
                setGameState('ROUND_END');
                setRoundResults(response.results);
                setCorrectLocation(response.correctLocation);
                soundManager.play('end');
            } else {
                console.error('[GEO] End round error:', response.error);
                setIsEndingRound(false);
            }
        });
    };

    const nextRound = () => {
        console.log('[GEO] nextRound called');
        socket.emit('geo-next-round', { roomCode }, (response) => {
            console.log('[GEO] nextRound response:', response);
            if (response.gameOver) {
                setGameState('GAME_END');
                setFinalResults(response.results);
                soundManager.play('win');
            } else if (response.success) {
                setIsEndingRound(false);
                setGameState('PLAYING');
                setCurrentRound(response.round);
                setCorrectLocation(response.location);
                setRoundResults(null);
                setGuessedPlayers(new Set());
                soundManager.play('start');
                // Délai pour s'assurer que le state est mis à jour
                setTimeout(() => startTimer(), 200);
                // Re-initialiser Street View
                setTimeout(() => initStreetView(), 300);
            } else {
                console.error('[GEO] nextRound error:', response.error);
            }
        });
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDistance = (km) => {
        if (km === null || km === undefined) return 'Pas de réponse';
        if (km < 1) return `${Math.round(km * 1000)} m`;
        return `${Math.round(km).toLocaleString()} km`;
    };

    const kickPlayer = (playerId) => {
        if (window.confirm('Voulez-vous vraiment exclure ce joueur ?')) {
            socket.emit('geo-kick-player', { roomCode, playerId }, (response) => {
                if (response.error) console.error(response.error);
            });
        }
    };

    const restartGame = () => {
        socket.emit('geo-restart-game', { roomCode }, (response) => {
            if (response.success) {
                setGameState('LOBBY');
                setCurrentRound(0);
                setRoundResults(null);
                setFinalResults(null);
                setGuessedPlayers(new Set());
                setCorrectLocation(null);
            }
        });
    };

    // RENDER LOBBY
    if (gameState === 'LOBBY') {
        const joinUrl = window.location.origin;

        return (
            <div className="geo-lobby-background" style={{ overflow: 'hidden' }}>
                {/* KAHOOT TOP BAR */}
                <div className="kahoot-top-bar">
                    <div className="kahoot-bar-content">
                        <div className="kahoot-join-info">
                            <span>Rejoindre le jeu à l'adresse <strong>{window.location.host}</strong></span>
                        </div>
                        <div className="kahoot-pin-box">
                            <span className="kahoot-pin-label">Code PIN du jeu :</span>
                            <span className="kahoot-pin-value">{roomCode}</span>
                        </div>
                    </div>
                    <div className="kahoot-qr">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl + '?code=' + roomCode)}`} alt="QR Code" />
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="container-fluid h-100 d-flex flex-column align-items-center justify-content-center" style={{ paddingTop: '100px', paddingBottom: '60px' }}>

                    {/* LOGO & WAITING MSG */}
                    {/* LOGO & WAITING MSG */}
                    <div className="text-center mb-5">
                        <h1 className="display-1 fw-bold text-white mb-0" style={{ textShadow: '0 4px 15px rgba(0,0,0,0.5)', fontFamily: 'var(--font-display)', letterSpacing: '5px' }}>
                            GEO_TRACKR
                        </h1>
                        <div className="kahoot-waiting-msg">
                            En attente de participants
                        </div>
                    </div>

                    {/* PLAYERS GRID (Floating style) */}
                    <div className="container">
                        <div className="row justify-content-center g-3">
                            {players.map(player => (
                                <div key={player.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                    <div className="geo-lobby-player-card position-relative">
                                        <button
                                            className="btn btn-sm btn-danger position-absolute top-0 end-0 m-2 shadow-sm border-0"
                                            style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0, fontSize: '14px', lineHeight: '1', zIndex: 10 }}
                                            onClick={(e) => { e.stopPropagation(); kickPlayer(player.id); }}
                                            title="Exclure"
                                        >
                                            ✕
                                        </button>
                                        {player.avatar ? (
                                            <img src={player.avatar} alt="" />
                                        ) : (
                                            <span className="me-3" style={{ fontSize: '2rem' }}>👤</span>
                                        )}
                                        <div className="text-truncate">{player.name}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SETTINGS BUTTON (Main) */}
                    <div className="position-fixed bottom-0 start-0 p-4">
                        <button className="btn btn-dark rounded-circle shadow-lg d-flex align-items-center justify-content-center"
                            style={{ width: '60px', height: '60px', border: '2px solid var(--neon-blue)' }}
                            onClick={() => setShowSettings(true)}>
                            <span style={{ fontSize: '1.8rem' }}>⚙️</span>
                        </button>
                    </div>

                    {/* SETTINGS MODAL */}
                    {showSettings && (
                        <div className="geo-settings-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
                            <div className="geo-settings-modal">
                                <h3 className="text-center text-primary mb-4" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
                                    CONFIGURATION
                                </h3>

                                <div className="settings-section">
                                    <div className="settings-label">Nombre de manches</div>
                                    <div className="geo-range-container">
                                        <input
                                            type="range"
                                            className="geo-range"
                                            min="1" max="20"
                                            value={settings.roundsCount}
                                            onChange={(e) => setSettings({ ...settings, roundsCount: parseInt(e.target.value) })}
                                        />
                                        <div className="range-value">{settings.roundsCount}</div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <div className="settings-label">Temps par manche (secondes)</div>
                                    <div className="geo-range-container">
                                        <input
                                            type="range"
                                            className="geo-range"
                                            min="10" max="300" step="10"
                                            value={settings.timePerRound}
                                            onChange={(e) => setSettings({ ...settings, timePerRound: parseInt(e.target.value) })}
                                        />
                                        <div className="range-value">{settings.timePerRound}s</div>
                                    </div>
                                </div>

                                <div className="settings-section">
                                    <div className="settings-label">Régions (Plusieurs possibles)</div>
                                    <div className="region-grid">
                                        {[
                                            { id: 'world', name: 'Monde', icon: '🌍' },
                                            { id: 'europe', name: 'Europe', icon: '🇪🇺' },
                                            { id: 'asia', name: 'Asie', icon: '⛩️' },
                                            { id: 'africa', name: 'Afrique', icon: '🦁' },
                                            { id: 'americas', name: 'Amériques', icon: '🌎' },
                                            { id: 'oceania', name: 'Océanie', icon: '🦘' },
                                            { id: 'france', name: 'France', icon: '🇫🇷' },
                                            { id: 'usa', name: 'USA', icon: '🇺🇸' },
                                            { id: 'reunion', name: 'La Réunion', icon: '🏝️' },
                                        ].map(region => {
                                            const isSelected = settings.mapType.includes(region.id);
                                            return (
                                                <div
                                                    key={region.id}
                                                    className={`region-option ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        let newTypes;
                                                        if (region.id === 'world') {
                                                            // Si on clique World, on ne garde que World
                                                            newTypes = ['world'];
                                                        } else {
                                                            // Si on clique une autre, on enlève World si présent
                                                            newTypes = settings.mapType.filter(t => t !== 'world');

                                                            if (isSelected) {
                                                                newTypes = newTypes.filter(t => t !== region.id);
                                                            } else {
                                                                newTypes.push(region.id);
                                                            }

                                                            // Si plus rien, on remet World par défaut
                                                            if (newTypes.length === 0) newTypes = ['world'];
                                                        }
                                                        setSettings({ ...settings, mapType: newTypes });
                                                    }}
                                                >
                                                    <div className="region-icon">{region.icon}</div>
                                                    <div className="region-name">{region.name}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="text-center mt-4">
                                    <button className="btn btn-primary btn-lg px-5" onClick={() => setShowSettings(false)}>
                                        Valider
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* START BUTTON */}
                    <button className="kahoot-start-btn" onClick={startGame} disabled={players.length === 0}>
                        Commencer
                    </button>

                    {/* PLAYER COUNTER */}
                    <div className="kahoot-counter-box">
                        <span>👤</span>
                        <span>{players.length}</span>
                    </div>

                </div>
            </div>
        );
    }

    // RENDER PLAYING - Vue tableau de bord pour l'hôte
    if (gameState === 'PLAYING') {
        return (
            <div className="geo-lobby-background">
                <div className="geo-host-dashboard">
                    {/* Header avec infos principales */}
                    <div className="geo-host-header">
                        <div className="geo-host-code">
                            <span className="label">PIN SALON</span>
                            <span className="value text-warning">{roomCode}</span>
                        </div>
                        <div className="geo-host-round">
                            <span className="label">MANCHE</span>
                            <span className="value">{currentRound}/{totalRounds}</span>
                        </div>
                        <div className={`geo-host-timer ${timeLeft <= 10 ? 'danger' : ''}`}>
                            <span className="timer-value">{formatTime(timeLeft)}</span>
                        </div>
                        <div className="geo-host-progress">
                            <span className="label">RÉPONSES</span>
                            <span className="value">{guessedPlayers.size}/{players.length}</span>
                        </div>
                    </div>

                    {/* Contenu principal */}
                    <div className="container py-4">
                        <div className="row">
                            {/* Liste des joueurs avec leur statut */}
                            <div className="col-12">
                                <div className="card p-4">
                                    <h4 className="text-info mb-4">👥 État des joueurs</h4>
                                    <div className="row g-3">
                                        {players.map(player => {
                                            const hasGuessed = guessedPlayers.has(player.id);
                                            return (
                                                <div key={player.id} className="col-6 col-md-3">
                                                    <div className={`geo-player-status-card ${player.disconnected ? 'disconnected' : hasGuessed ? 'answered' : 'waiting'}`}>
                                                        <div className="player-avatar">
                                                            {player.avatar ? (
                                                                <img src={player.avatar} alt="" />
                                                            ) : '🌐'}
                                                        </div>
                                                        <div className="player-name">{player.name}</div>
                                                        <div className="player-status">
                                                            {player.disconnected ? '⚠️ Déconnecté' : hasGuessed ? '✓ Répondu' : '⏳ En attente...'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Message central */}
                        <div className="geo-host-message mt-5">
                            {guessedPlayers.size === players.length && players.length > 0 ? (
                                <div className="all-answered">
                                    <span className="icon">✅</span>
                                    <span className="text">Tous les joueurs ont répondu !</span>
                                </div>
                            ) : (
                                <div className="waiting-answers">
                                    <div className="spinner-border text-primary me-3" role="status"></div>
                                    <span>En attente des réponses...</span>
                                </div>
                            )}
                        </div>

                        {/* Bouton pour terminer */}
                        <div className="text-center mt-4">
                            <button className="btn btn-danger btn-lg px-5" onClick={endRound}>
                                ⏹️ TERMINER LA MANCHE
                            </button>
                            {guessedPlayers.size === players.length && players.length > 0 && (
                                <p className="text-success mt-2">
                                    <small>Tous ont répondu - vous pouvez terminer</small>
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER ROUND END - Grande carte avec résultats
    if (gameState === 'ROUND_END') {
        return (
            <div className="geo-lobby-background">
                <div className="geo-host-dashboard">
                    {/* Header */}
                    <div className="geo-host-header" style={{ borderColor: 'var(--neon-green)', justifyContent: 'space-between' }}>
                        <div>
                            <h2 className="m-0 text-primary">📍 Résultats - Manche {currentRound}/{totalRounds}</h2>
                            <p className="m-0 text-info fs-4">
                                C'était <strong>{correctLocation?.city}, {correctLocation?.country}</strong>
                            </p>
                        </div>
                        <div className="text-end">
                            <div className="text-muted small" style={{ letterSpacing: '2px' }}>PIN DU SALON</div>
                            <div className="fs-2 text-warning" style={{ fontFamily: 'var(--font-display)', letterSpacing: '4px' }}>{roomCode}</div>
                        </div>
                    </div>

                    <div className="container-fluid py-4">
                        <div className="row">
                            {/* Grande carte */}
                            <div className="col-lg-9">
                                <div ref={mapRef} className="geo-host-results-map"></div>
                            </div>

                            {/* Classement latéral */}
                            <div className="col-lg-3">
                                <div className="card p-3 h-100">
                                    <h5 className="text-info mb-3">🏆 Classement</h5>
                                    {roundResults?.map((result, index) => (
                                        <div key={result.id} className={`geo-result-row ${index === 0 ? 'winner' : ''}`}>
                                            <div className="geo-result-rank">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                            </div>
                                            <div className="geo-result-avatar me-2">
                                                {result.avatar ? (
                                                    <img
                                                        src={result.avatar}
                                                        alt=""
                                                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid white' }}
                                                    />
                                                ) : <span style={{ fontSize: '1.5rem' }}>👤</span>}
                                            </div>
                                            <div className="geo-result-info">
                                                <div className="geo-result-name">{result.name}</div>
                                                <div className="geo-result-distance">{formatDistance(result.distance)}</div>
                                            </div>
                                            <div className="geo-result-score">
                                                +{result.roundScore?.toLocaleString()} pts
                                            </div>
                                        </div>
                                    ))}

                                    <hr className="my-3" />

                                    {/* Score total */}
                                    <h6 className="text-muted mb-2">Score total</h6>
                                    {roundResults?.map((result, index) => (
                                        <div key={result.id} className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center">
                                                {result.avatar ? (
                                                    <img
                                                        src={result.avatar}
                                                        alt=""
                                                        className="me-2"
                                                        style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #555' }}
                                                    />
                                                ) : <span className="me-2">👤</span>}
                                                <span className="fw-bold">{result.name}</span>
                                            </div>
                                            <span className="text-primary fw-bold">{result.totalScore?.toLocaleString()} pts</span>
                                        </div>
                                    ))}

                                    <div className="mt-auto pt-4">
                                        <button className="btn btn-primary btn-lg w-100" onClick={nextRound}>
                                            {currentRound >= totalRounds ? '🏁 Résultats finaux' : '➡️ Manche suivante'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // RENDER GAME END
    if (gameState === 'GAME_END') {
        return (
            <div className="geo-lobby-background">
                <div className="container py-4">
                    <div className="text-center mb-5">
                        <h1 className="display-3 text-primary glitch-text" data-text="PARTIE TERMINÉE">
                            🏆 PARTIE TERMINÉE
                        </h1>
                    </div>

                    <div className="row justify-content-center">
                        <div className="col-md-8">
                            {/* Podium */}
                            <div className="geo-podium mb-5">
                                {finalResults?.slice(0, 3).map((result, index) => (
                                    <div key={result.id} className={`geo-podium-place place-${index + 1}`}>
                                        <div className="geo-podium-avatar">
                                            {result.avatar ? (
                                                <img src={result.avatar} alt="" />
                                            ) : '🌐'}
                                        </div>
                                        <div className="geo-podium-medal">
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                        </div>
                                        <div className="geo-podium-name">{result.name}</div>
                                        <div className="geo-podium-score">{result.totalScore?.toLocaleString()} pts</div>
                                    </div>
                                ))}
                            </div>

                            {/* Full Leaderboard */}
                            <div className="card p-4">
                                <h5 className="text-info mb-3">Classement complet</h5>
                                {finalResults?.map((result, index) => (
                                    <div key={result.id} className="geo-final-row">
                                        <span className="geo-final-rank">#{index + 1}</span>
                                        <span className="geo-final-name">{result.name}</span>
                                        <span className="geo-final-score">{result.totalScore?.toLocaleString()} pts</span>
                                    </div>
                                ))}
                            </div>

                            <div className="text-center mt-4">
                                <button className="btn btn-success btn-lg me-3" onClick={restartGame}>
                                    🔄 Rejouer
                                </button>
                                <button className="btn btn-outline-secondary btn-lg" onClick={onBack}>
                                    🏠 Retour au menu
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // INIT State
    return (
        <div className="container text-center py-5">
            <div className="spinner-border text-primary" role="status"></div>
            <p className="mt-3">Création du salon...</p>
        </div>
    );
}

// Dark map style
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f23' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] }
];

export default GeoHostView;
