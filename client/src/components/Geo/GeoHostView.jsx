import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function GeoHostView() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState(null);
    const [remoteToken, setRemoteToken] = useState(null);
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('INIT'); // INIT, LOBBY, PLAYING, ROUND_END, GAME_END
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [roundResults, setRoundResults] = useState(null);

    useEffect(() => {
        document.body.classList.add('pop-culture-theme');
        return () => {
            document.body.classList.remove('pop-culture-theme');
        };
    }, []);

    const [correctLocation, setCorrectLocation] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [awards, setAwards] = useState([]);
    const [guessedPlayers, setGuessedPlayers] = useState(new Set());
    const [isEndingRound, setIsEndingRound] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [reactions, setReactions] = useState([]); // Floating emoji reactions
    const [autoNextCountdown, setAutoNextCountdown] = useState(null); // Countdown before auto next round
    const [showCountdown, setShowCountdown] = useState(false); // 3-2-1-GO! animation
    const [countdownNumber, setCountdownNumber] = useState(3);
    const [showConfetti, setShowConfetti] = useState(false); // Winner confetti
    const [showQRCode, setShowQRCode] = useState(false); // Toggle for persistent QR code
    const [isStarting, setIsStarting] = useState(false); // Protection double-clic start

    // Settings
    const [settings, setSettings] = useState({
        roundsCount: 5,
        timePerRound: 60,
        mapType: ['world'] // Tableau pour multi-sélection
    });

    const updateSettings = (newSettings) => {
        setSettings(newSettings);
        const activeRoomCode = roomCodeRef.current || roomCode;
        if (activeRoomCode) {
            socket.emit('geo-update-settings', {
                roomCode: activeRoomCode,
                settings: newSettings
            });
        }
    };

    const streetViewRef = useRef(null); // Div persistant du panorama
    const streetViewPlayingSlotRef = useRef(null); // Slot dans le layout PLAYING
    const streetViewRoundEndSlotRef = useRef(null); // Slot dans le layout ROUND_END
    const streetViewWrapperRef = useRef(null); // Ref pour le parent d'origine du div Street View
    const mapRef = useRef(null);
    const panoramaInstance = useRef(null);
    const mapInstance = useRef(null);
    const timerRef = useRef(null);
    const rotationRef = useRef(null); // Animation de rotation auto
    const autoNextRef = useRef(null); // Timer for auto next round
    const roomCodeRef = useRef(null); // Ref for roomCode to avoid stale closures
    const isNextRoundPendingRef = useRef(false); // Flag to prevent double nextRound processing
    const isEndingRoundRef = useRef(false); // Ref mirror of isEndingRound for socket listener
    const correctLocationRef = useRef(null); // Ref for correctLocation to avoid stale closures
    const gameStateRef = useRef(gameState); // Ref pour accéder à gameState dans les callbacks

    const isRequestingLocationRef = useRef(false); // Flag to prevent multiple parallel new location requests
    const roundStartTimeRef = useRef(null); // For smooth timer interpolation
    const timerDurationRef = useRef(null); // For smooth timer interpolation
    const allPlayersAnsweredRef = useRef(false); // Track if all players have answered
    const allPlayersAnsweredTimeRef = useRef(null); // When all players answered (timestamp)

    // Synchroniser gameStateRef et nettoyer quand on sort de PLAYING
    useEffect(() => {
        gameStateRef.current = gameState;
        if (gameState !== 'PLAYING') {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            // Stopper la rotation mais GARDER l'instance panorama vivante
            if (rotationRef.current) {
                cancelAnimationFrame(rotationRef.current);
                rotationRef.current = null;
            }
        }
    }, [gameState]);

    // Déplacer le div Street View persistant dans le bon slot selon l'état
    useEffect(() => {
        const svDiv = streetViewRef.current;
        if (!svDiv) return;
        if (gameState === 'PLAYING' && streetViewPlayingSlotRef.current) {
            streetViewPlayingSlotRef.current.appendChild(svDiv);
        } else if (gameState === 'ROUND_END' && streetViewRoundEndSlotRef.current) {
            streetViewRoundEndSlotRef.current.appendChild(svDiv);
        }

        return () => {
            // Remettre le div Street View dans son parent d'origine avant toute modification/démontage
            if (svDiv && streetViewWrapperRef.current) {
                streetViewWrapperRef.current.appendChild(svDiv);
            }
        };
    }, [gameState]);

    useEffect(() => {
        let initDone = false;

        // Créer une room au montage
        function createNewRoomEmit() {
            if (initDone) return;
            console.log('[Host] Creating new room...');
            socket.emit('geo-create-room', { settings: { roundsCount: 5, timePerRound: 60, mapType: ['world'] } }, (response) => {
                console.log('[Host] geo-create-room response:', response);
                if (response?.roomCode) {
                    initDone = true;
                    setRoomCode(response.roomCode);
                    roomCodeRef.current = response.roomCode;
                    if (response.remoteToken) setRemoteToken(response.remoteToken);
                    localStorage.setItem('geoHostSession', JSON.stringify({
                        roomCode: response.roomCode,
                        remoteToken: response.remoteToken,
                        createdAt: Date.now()
                    }));
                    setGameState('LOBBY');
                } else {
                    console.error('[Host] geo-create-room failed:', response);
                }
            });
        }

        function init() {
            if (initDone) return;
            // Ignorer les sessions de plus de 4 heures (serveur probablement redémarré)
            const savedHostSession = localStorage.getItem('geoHostSession');
            if (savedHostSession) {
                try {
                    const session = JSON.parse(savedHostSession);
                    const age = Date.now() - (session.createdAt || 0);
                    if (age > 4 * 60 * 60 * 1000) {
                        // Session trop vieille, créer une nouvelle room
                        localStorage.removeItem('geoHostSession');
                        createNewRoomEmit();
                        return;
                    }
                    console.log('[Host] Session trouvée, reconnexion à la room:', session.roomCode);
                    let reconnectHandled = false;
                    // Timeout de sécurité : si pas de réponse en 4s → nouvelle room
                    const reconnectTimeout = setTimeout(() => {
                        if (!reconnectHandled) {
                            reconnectHandled = true;
                            console.warn('[Host] Reconnect timeout → creating new room');
                            localStorage.removeItem('geoHostSession');
                            createNewRoomEmit();
                        }
                    }, 4000);

                    socket.emit('geo-host-reconnect', { roomCode: session.roomCode }, (response) => {
                        clearTimeout(reconnectTimeout);
                        if (reconnectHandled) return;
                        reconnectHandled = true;
                        console.log('[Host] geo-host-reconnect response:', response);
                        if (response?.success) {
                            initDone = true;
                            roomCodeRef.current = session.roomCode;
                            setRoomCode(session.roomCode);
                            if (session.remoteToken) setRemoteToken(session.remoteToken);
                            setGameState(response.gameState);
                            setCurrentRound(response.currentRound);
                            setTotalRounds(response.totalRounds);
                            setPlayers(response.players || []);
                            setSettings({
                                roundsCount: response.totalRounds || 5,
                                timePerRound: response.timePerRound || 60,
                                mapType: response.mapType || ['world']
                            });
                            console.log('[Host] État restauré:', response.gameState);
                            // Si on était en pleine partie, relancer le timer
                            if (response.gameState === 'PLAYING' && response.roundStartTime) {
                                setCorrectLocation(response.currentLocation);
                                correctLocationRef.current = response.currentLocation;
                                setupHostTimer(response.timePerRound || 60, response.roundStartTime);
                            }
                        } else {
                            console.warn('[Host] Reconnect failed:', response?.error, '→ creating new room');
                            localStorage.removeItem('geoHostSession');
                            createNewRoomEmit();
                        }
                    });
                } catch (e) {
                    console.error('[Host] Session parse error:', e);
                    localStorage.removeItem('geoHostSession');
                    createNewRoomEmit();
                }
            } else {
                createNewRoomEmit();
            }
        }

        // Si le socket est déjà connecté, on initialise directement
        if (socket.connected) {
            init();
        } else {
            // Sinon on attend la connexion
            socket.once('connect', init);
        }

        // Listeners - Player sync
        socket.on('geo-player-joined', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('geo-player-left', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('geo-player-guessed', ({ playerId }) => {
            setGuessedPlayers(prev => new Set([...prev, playerId]));
        });

        // When settings are updated from remote (sync only, no duplicate of the listener below)
        // NOTE: The full handler is registered later in this useEffect (line ~387)

        socket.on('geo-all-guessed', () => {
            // Accélérer la fin du round (3 secondes restantes)
            // Ajuster roundStartTimeRef pour que l'interpolation affiche bien 3s
            if (timerDurationRef.current) {
                const naturalRemaining = roundStartTimeRef.current
                    ? Math.max(0, timerDurationRef.current - Math.floor((Date.now() - roundStartTimeRef.current) / 1000))
                    : 3;
                if (naturalRemaining > 3) {
                    roundStartTimeRef.current = Date.now() - (timerDurationRef.current - 3) * 1000;
                }
            }
            setTimeLeft(prev => Math.min(prev, 3));
        });

        // Listen for emoji reactions from players
        socket.on('geo-reaction', ({ emoji, playerName, playerId }) => {
            const reactionId = Date.now() + Math.random();
            const xPos = 10 + Math.random() * 80; // Random x position 10%-90%
            setReactions(prev => [...prev, { id: reactionId, emoji, playerName, xPos }]);
            // Remove after animation (3.5s)
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reactionId));
            }, 3500);
        });

        // === SYNC EVENTS FROM REMOTE ===
        // When remote triggers game start
        socket.on('geo-game-started', (data) => {
            console.log('[Host] Game started event received from remote:', data);
            // Reset "all players answered" flags for new round
            allPlayersAnsweredRef.current = false;
            allPlayersAnsweredTimeRef.current = null;

            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total);
            setCorrectLocation(data.location);
            correctLocationRef.current = data.location; // Sync ref for initStreetView
            setGuessedPlayers(new Set());
            setIsEndingRound(false);
            soundManager.play('start');

            setupHostTimer(data.timePerRound || 60, data.roundStartTime);
        });

        // When remote ends a round (broadcast from server)
        // This is for when the remote control triggers round end, not when Host triggers it
        socket.on('geo-round-ended', (data) => {
            console.log('[Host] Round ended event received:', data);
            // Skip if we're already handling this (Host triggered endRound)
            // The callback in endRound() already handles the transition
            if (isEndingRoundRef.current) {
                console.log('[Host] Skipping geo-round-ended - we triggered this ourselves');
                return;
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (rotationRef.current) {
                cancelAnimationFrame(rotationRef.current);
                rotationRef.current = null;
            }
            if (autoNextRef.current) {
                clearInterval(autoNextRef.current);
                autoNextRef.current = null;
            }
            setGameState('ROUND_END');
            setRoundResults(data.results);
            setPlayers(prevPlayers => prevPlayers.map(p => {
                const res = data.results.find(r => r.id === p.id);
                return res ? { ...p, totalScore: res.totalScore } : p;
            }));
            setCorrectLocation(data.correctLocation);
            correctLocationRef.current = data.correctLocation; // Sync ref
            setIsEndingRound(false);
            soundManager.play('end');
            // Start countdown for auto-progression to next round (10 seconds)
            setAutoNextCountdown(10);
            autoNextRef.current = setInterval(() => {
                setAutoNextCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(autoNextRef.current);
                        autoNextRef.current = null;
                        // Auto-call nextRound when countdown reaches 0
                        setTimeout(() => nextRound(), 100);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        });

        // Handles next round (from host callback broadcast OR remote trigger)
        socket.on('geo-next-round', (data) => {
            console.log('[Host] Next round event received:', data);
            // Reset pending flag (the callback doesn't handle state/timer anymore)
            isNextRoundPendingRef.current = false;
            // Clear all timers
            if (autoNextRef.current) {
                clearInterval(autoNextRef.current);
                autoNextRef.current = null;
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            setAutoNextCountdown(null);
            setIsEndingRound(false);
            isEndingRoundRef.current = false;
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setCorrectLocation(data.location);
            correctLocationRef.current = data.location; // Sync ref for initStreetView
            setRoundResults(null);
            setGuessedPlayers(new Set());
            
            // Reset "all players answered" flags for new round
            allPlayersAnsweredRef.current = false;
            allPlayersAnsweredTimeRef.current = null;
            
            soundManager.play('start');
            setupHostTimer(data.timePerRound || 60, data.roundStartTime);
            // Street View init is handled by useEffect([gameState, currentRound, correctLocation])
        });

        // When game is over (from remote)
        socket.on('geo-game-over', (data) => {
            console.log('[Host] Game over event received:', data);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (autoNextRef.current) {
                clearInterval(autoNextRef.current);
                autoNextRef.current = null;
            }
            setAutoNextCountdown(null);
            setGameState('GAME_END');
            setFinalResults(data.results);
            setAwards(data.awards || []);
            // soundManager.play('win');
            triggerConfetti();
        });

        // When game is restarted (from remote)
        socket.on('geo-game-restarted', () => {
            console.log('[Host] Game restarted event received');
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (autoNextRef.current) {
                clearInterval(autoNextRef.current);
                autoNextRef.current = null;
            }
            setGameState('LOBBY');
            setCurrentRound(0);
            setRoundResults(null);
            setFinalResults(null);
            setGuessedPlayers(new Set());
            setCorrectLocation(null);
            setAutoNextCountdown(null);
        });

        // When settings are updated (from remote or host)
        socket.on('geo-settings-updated', (newSettings) => {
            console.log('[Host] Settings updated event received:', newSettings);
            setSettings(prev => ({
                ...prev,
                roundsCount: newSettings.roundsCount || prev.roundsCount,
                timePerRound: newSettings.timePerRound || prev.timePerRound,
                mapType: newSettings.mapType || prev.mapType
            }));
            setTotalRounds(newSettings.roundsCount || 5);
        });

        const handleReconnect = () => {
            if (roomCodeRef.current) {
                console.log('[Host] Reconnected via Socket.IO -> re-joining room');
                // Guard: ne réémettre que si le socket est bien connecté
                if (socket.connected) {
                    socket.emit('geo-host-reconnect', { roomCode: roomCodeRef.current });
                }
            }
        };
        socket.on('connect', handleReconnect);

        return () => {
            socket.off('connect', init); // Au cas où le composant est démonté avant la 1ère connexion
            socket.off('geo-player-joined');
            socket.off('geo-player-left');
            socket.off('geo-player-guessed');
            socket.off('geo-all-guessed');
            socket.off('geo-reaction');
            socket.off('geo-game-started');
            socket.off('geo-round-ended');
            socket.off('geo-next-round');
            socket.off('geo-game-over');
            socket.off('geo-game-restarted');
            socket.off('geo-settings-updated');
            socket.off('connect', handleReconnect);
            if (timerRef.current) clearInterval(timerRef.current);
            if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
            if (autoNextRef.current) clearInterval(autoNextRef.current);
            if (panoramaInstance.current && window.google?.maps?.event) {
                window.google.maps.event.clearInstanceListeners(panoramaInstance.current);
            }
            panoramaInstance.current = null;
            mapInstance.current = null;
        };
    }, []);

    // Détection automatique "Tous ont répondu" - ensure 3-second minimum countdown
    useEffect(() => {
        const activeCount = players.filter(p => !p.disconnected).length;
        if (gameState === 'PLAYING' && activeCount > 0 && guessedPlayers.size >= activeCount) {
            if (!allPlayersAnsweredRef.current) {
                console.log('[Host] All players answered! Ensuring 3-second countdown...');
                allPlayersAnsweredRef.current = true;
                allPlayersAnsweredTimeRef.current = Date.now();
                // Ajuster roundStartTimeRef pour que l'interpolation affiche bien 3s
                if (timerDurationRef.current) {
                    const naturalRemaining = roundStartTimeRef.current
                        ? Math.max(0, timerDurationRef.current - Math.floor((Date.now() - roundStartTimeRef.current) / 1000))
                        : 3;
                    if (naturalRemaining > 3) {
                        roundStartTimeRef.current = Date.now() - (timerDurationRef.current - 3) * 1000;
                    }
                }
            }
            setTimeLeft(prev => Math.min(prev, 3));
        }
    }, [guessedPlayers, players.length, gameState]);

    // Global flag to prevent multiple API loading attempts
    const googleMapsLoadingRef = useRef(false);
    const googleMapsReadyRef = useRef(false);
    const [googleMapsReady, setGoogleMapsReady] = useState(false); // State to trigger useEffect re-run
    // Charger Google Maps API avec garantie que window.google.maps est disponible
    useEffect(() => {
        const loadGoogleMapsAPI = async () => {
            // Already loaded or loading
            if (googleMapsReadyRef.current) {
                console.log('[Host] Google Maps API already ready');
                return;
            }
            if (googleMapsLoadingRef.current) {
                console.log('[Host] Google Maps API already loading');
                return;
            }

            googleMapsLoadingRef.current = true;

            // Check if already present
            if (window.google?.maps?.StreetViewService) {
                console.log('[Host] Google Maps API already available on window');
                googleMapsReadyRef.current = true;
                googleMapsLoadingRef.current = false;
                setGoogleMapsReady(true);
                return;
            }

            console.log('[Host] Starting Google Maps API load...');
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
            script.async = true;

            return new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('[Host] Google Maps script loaded, waiting for window.google.maps...');
                    
                    // Poll for window.google.maps.StreetViewService
                    let attempts = 0;
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.google?.maps?.StreetViewService) {
                            clearInterval(checkInterval);
                            console.log('[Host] ✓ window.google.maps.StreetViewService is ready after', attempts, 'checks');
                            googleMapsReadyRef.current = true;
                            googleMapsLoadingRef.current = false;
                            setGoogleMapsReady(true);
                            resolve();
                        } else if (attempts > 50) { // Timeout after 5 seconds (50 * 100ms)
                            clearInterval(checkInterval);
                            console.error('[Host] ✗ Timeout waiting for window.google.maps.StreetViewService');
                            googleMapsLoadingRef.current = false;
                            reject(new Error('Google Maps API timeout'));
                        }
                    }, 100);
                };

                script.onerror = () => {
                    console.error('[Host] ✗ Failed to load Google Maps API script');
                    googleMapsLoadingRef.current = false;
                    reject(new Error('Failed to load Google Maps API'));
                };

                document.head.appendChild(script);
            }).catch(error => {
                console.error('[Host] Google Maps loading error:', error);
                googleMapsLoadingRef.current = false;
            });
        };

        loadGoogleMapsAPI();
    }, []);

    // Particules de célébration néon (Podium final)
    useEffect(() => {
        if (gameState !== 'GAME_END') return;

        // Petite attente pour s'assurer que le DOM de GAME_END soit rendu
        const timeoutId = setTimeout(() => {
            const container = document.getElementById('main-canvas');
            if (!container) return;

            const createParticles = () => {
                const colors = ['#00f2ff', '#FFD700', '#d1bcff'];
                for (let i = 0; i < 30; i++) {
                    setTimeout(() => {
                        const canvas = document.getElementById('main-canvas');
                        if (!canvas) return;
                        const particle = document.createElement('div');
                        particle.className = 'particle';
                        particle.style.left = Math.random() * 100 + '%';
                        particle.style.bottom = '0px';
                        particle.style.animation = `particleUp ${2 + Math.random() * 3}s ease-in forwards`;
                        
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        particle.style.background = color;
                        particle.style.boxShadow = `0 0 10px ${color}`;

                        canvas.appendChild(particle);
                        
                        setTimeout(() => {
                            particle.remove();
                        }, 5000);
                    }, Math.random() * 2000);
                }
            };

            createParticles();
            const intervalId = setInterval(createParticles, 3000);

            return () => {
                clearInterval(intervalId);
            };
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [gameState]);

    // Initialiser Street View quand la partie commence ou change de manche
    useEffect(() => {
        console.log(`[Host] useEffect SV: gameState=${gameState}, location=${correctLocation?.city || 'null'}, mapsReady=${googleMapsReadyRef.current}, round=${currentRound}`);
        if (gameState === 'PLAYING' && correctLocation && googleMapsReadyRef.current) {
            console.log(`[Host] → Condition OK, setTimeout 300ms pour initStreetView`);
            const timeoutId = setTimeout(() => {
                if (gameStateRef.current === 'PLAYING') {
                    console.log(`[Host] → setTimeout fired, streetViewRef=${!!streetViewRef.current}, calling initStreetView`);
                    initStreetView();
                } else {
                    console.log(`[Host] → setTimeout fired mais gameState=${gameStateRef.current}, skip`);
                }
            }, 300);
            return () => clearTimeout(timeoutId);
        }
    }, [gameState, currentRound, correctLocation, googleMapsReady]);

    const initStreetView = () => {
        if (!window.google?.maps?.StreetViewService) {
            console.error('[Host] initStreetView: google.maps not available');
            return;
        }
        const location = correctLocationRef.current;
        if (!location || !streetViewRef.current) {
            console.warn('[Host] initStreetView: missing location or DOM ref');
            return;
        }

        console.log(`[Host] initStreetView for ${location.city}`);
        const streetViewService = new window.google.maps.StreetViewService();
        streetViewService.getPanorama(
            { location: { lat: location.lat, lng: location.lng }, radius: 500 },
            (data, status) => {
                if (gameStateRef.current !== 'PLAYING') return;
                if (status === 'OK') {
                    console.log('[Host] Coverage OK');
                    initPanorama(data.location.latLng);
                } else {
                    console.warn('[Host] No coverage, status:', status);
                    requestNewLocation();
                }
            }
        );
    };

    const requestNewLocation = () => {
        if (isRequestingLocationRef.current) return;
        isRequestingLocationRef.current = true;

        const currentRoomCode = roomCodeRef.current || roomCode;
        console.log('[Host] Requesting new location');
        socket.emit('geo-request-new-location', { roomCode: currentRoomCode }, (response) => {
            isRequestingLocationRef.current = false;
            if (response.success && response.location) {
                console.log('[Host] New location:', response.location.city);
                setCorrectLocation(response.location);
                correctLocationRef.current = response.location;
                // useEffect [correctLocation] re-trigger initStreetView automatiquement
            } else {
                console.error('[Host] Failed to get new location:', response.error);
            }
        });
    };

    // Initialiser ou repositionner le panorama après vérification de coverage
    const initPanorama = (verifiedPosition) => {
        if (!streetViewRef.current) return;

        // Cancel rotation existante
        if (rotationRef.current) {
            cancelAnimationFrame(rotationRef.current);
            rotationRef.current = null;
        }

        const initialHeading = Math.random() * 360;

        if (panoramaInstance.current) {
            // Round 2+ : réutiliser le panorama existant
            console.log('[Host] setPosition sur panorama existant');
            panoramaInstance.current.setPosition(verifiedPosition);
            panoramaInstance.current.setPov({ heading: initialHeading, pitch: 5 });
            panoramaInstance.current.setVisible(true);
        } else {
            // Round 1 : créer le panorama
            console.log('[Host] Création du panorama');
            panoramaInstance.current = new window.google.maps.StreetViewPanorama(
                streetViewRef.current,
                {
                    position: verifiedPosition,
                    pov: { heading: initialHeading, pitch: 5 },
                    zoom: 0,
                    addressControl: false,
                    showRoadLabels: false,
                    linksControl: false,
                    panControl: false,
                    clickToGo: false,
                    draggable: false,
                    zoomControl: false,
                    enableCloseButton: false,
                    fullscreenControl: false,
                    motionTracking: false,
                    motionTrackingControl: false,
                    visible: true
                }
            );
        }

        // Rotation automatique lente
        let heading = initialHeading;
        const rotateCamera = () => {
            if (panoramaInstance.current && gameStateRef.current === 'PLAYING') {
                heading = (heading + 0.15) % 360;
                panoramaInstance.current.setPov({ heading, pitch: 5 });
                rotationRef.current = requestAnimationFrame(rotateCamera);
            }
        };
        rotationRef.current = requestAnimationFrame(rotateCamera);
    };

    // Init map pour les résultats
    useEffect(() => {
        if (gameState === 'ROUND_END' && window.google && mapRef.current && correctLocation) {
            initResultsMap();
        }
    }, [gameState, roundResults, googleMapsReady]);

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
                    if (this.div.parentNode) {
                        this.div.parentNode.removeChild(this.div);
                    }
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
            zoomControl: true, // Réactiver le zoom uniquement
            gestureHandling: 'greedy' // Pinch-to-zoom sur mobile
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
        if (isStarting) return; // Protection double-clic
        setIsStarting(true);

        const currentRoomCode = roomCodeRef.current || roomCode;
        socket.emit('geo-update-settings', { roomCode: currentRoomCode, settings });

        socket.emit('geo-start-game', { roomCode: currentRoomCode, settings }, (response) => {
            if (response?.success) {
                console.log('[Host] startGame callback OK, timer sera géré par geo-game-started');
            } else {
                console.error('Erreur démarrage:', response?.error);
                setIsStarting(false); // Réactiver le bouton en cas d'erreur
            }
        });
    };

    // Unique fonction timer — utilisée par geo-game-started ET geo-next-round
    const setupHostTimer = (duration, roundStartTime) => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        roundStartTimeRef.current = roundStartTime || Date.now();
        timerDurationRef.current = duration;

        const elapsed = roundStartTime ? Math.floor((Date.now() - roundStartTime) / 1000) : 0;
        setTimeLeft(Math.max(0, duration - elapsed));

        timerRef.current = setInterval(() => {
            setTimeLeft(() => {
                const startTime = roundStartTimeRef.current;
                const dur = timerDurationRef.current;
                const elapsedNow = Math.floor((Date.now() - startTime) / 1000);
                const remaining = Math.max(0, dur - elapsedNow);

                if (remaining <= 10 && remaining > 0) soundManager.playTick();

                let shouldEnd = remaining <= 0;
                if (!shouldEnd && allPlayersAnsweredRef.current && allPlayersAnsweredTimeRef.current) {
                    const sinceAllAnswered = Math.floor((Date.now() - allPlayersAnsweredTimeRef.current) / 1000);
                    if (sinceAllAnswered >= 3) shouldEnd = true;
                }

                if (shouldEnd) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    if (gameStateRef.current === 'PLAYING') endRound();
                    return 0;
                }
                return remaining;
            });
        }, 1000);
    };

    const endRound = () => {
        // Protection contre les doubles appels
        if (isEndingRound || isEndingRoundRef.current) {
            console.log('[GEO] endRound already in progress, skipping');
            return;
        }
        setIsEndingRound(true);
        isEndingRoundRef.current = true; // Set ref for socket listener

        // Safety timeout: unlock after 10s if no response
        const safetyTimeout = setTimeout(() => {
            if (isEndingRoundRef.current) {
                console.warn('[GEO] endRound timed out, resetting locks');
                setIsEndingRound(false);
                isEndingRoundRef.current = false;
            }
        }, 10000);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Use roomCodeRef.current to avoid stale closure issues
        const currentRoomCode = roomCodeRef.current || roomCode;
        console.log('[GEO] endRound called with roomCode:', currentRoomCode);

        socket.emit('geo-end-round', { roomCode: currentRoomCode }, (response) => {
            clearTimeout(safetyTimeout);
            console.log('[GEO] endRound callback received:', response);
            if (!response || response.error === 'Room not found') {
                console.error('[GEO] Room not found — session expirée, retour accueil');
                setIsEndingRound(false);
                isEndingRoundRef.current = false;
                localStorage.removeItem('geoHostSession');
                navigate('/');
                return;
            }
            if (response.success) {
                // Stop rotation animation
                if (rotationRef.current) {
                    cancelAnimationFrame(rotationRef.current);
                    rotationRef.current = null;
                }

                // Reset the ending flag NOW, not in nextRound
                // This allows endRound to be called again in the next round
                setIsEndingRound(false);
                isEndingRoundRef.current = false;

                setGameState('ROUND_END');
                setRoundResults(response.results);
                setPlayers(prevPlayers => prevPlayers.map(p => {
                    const res = response.results.find(r => r.id === p.id);
                    return res ? { ...p, totalScore: res.totalScore } : p;
                }));
                setCorrectLocation(response.correctLocation);
                soundManager.play('end');

                // Start auto-next countdown (8 seconds)
                setAutoNextCountdown(8);
                if (autoNextRef.current) {
                    clearInterval(autoNextRef.current);
                }
                autoNextRef.current = setInterval(() => {
                    setAutoNextCountdown(prev => {
                        if (prev <= 1) {
                            clearInterval(autoNextRef.current);
                            autoNextRef.current = null;
                            nextRound();
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                console.error('[GEO] End round error:', response.error);
                setIsEndingRound(false);
                isEndingRoundRef.current = false;
            }
        });
    };

    const nextRound = () => {
        console.log('[GEO] nextRound called');

        // Prevent double skipping - if next round is already pending, do nothing
        if (isNextRoundPendingRef.current) {
            console.log('[GEO] nextRound already pending, skipping');
            return;
        }

        // Clear auto-next timer if manually called
        if (autoNextRef.current) {
            clearInterval(autoNextRef.current);
            autoNextRef.current = null;
        }
        setAutoNextCountdown(null);

        const currentRoomCode = roomCodeRef.current || roomCode;
        isNextRoundPendingRef.current = true;

        const safetyTimeout = setTimeout(() => {
            if (isNextRoundPendingRef.current) {
                console.warn('[GEO] nextRound timed out, resetting locks');
                isNextRoundPendingRef.current = false;
            }
        }, 10000);

        socket.emit('geo-next-round', { roomCode: currentRoomCode }, (response) => {
            clearTimeout(safetyTimeout);
            console.log('[GEO] nextRound response:', response);
            if (!response || response.error === 'Room not found') {
                isNextRoundPendingRef.current = false;
                console.error('[GEO] Room not found — session expirée, retour accueil');
                localStorage.removeItem('geoHostSession');
                navigate('/');
                return;
            }
            if (response.gameOver) {
                isNextRoundPendingRef.current = false;
                setGameState('GAME_END');
                setFinalResults(response.results);
                if (response.awards) setAwards(response.awards);
                // soundManager.play('win');
                triggerConfetti();
            } else if (response.success) {
                // Le timer et l'état sont gérés par l'événement 'geo-next-round'
                // broadcasté par le serveur à toute la room (y compris le host).
                console.log('[Host] nextRound callback OK, timer sera géré par geo-next-round event');
            } else {
                isNextRoundPendingRef.current = false;
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
            const currentRoomCode = roomCodeRef.current || roomCode;
            socket.emit('geo-kick-player', { roomCode: currentRoomCode, playerId }, (response) => {
                if (response?.error) console.error(response.error);
            });
        }
    };

    const handleQuitGame = () => {
        const currentRoomCode = roomCodeRef.current || roomCode;
        if (currentRoomCode) {
            socket.emit('geo-delete-room', { roomCode: currentRoomCode });
        }
        localStorage.removeItem('geoHostSession');
        navigate('/');
    };

    const restartGame = () => {
        const currentRoomCode = roomCodeRef.current || roomCode;
        socket.emit('geo-restart-game', { roomCode: currentRoomCode }, (response) => {
            if (response.success) {
                setGameState('LOBBY');
                setCurrentRound(0);
                setRoundResults(null);
                setFinalResults(null);
                setGuessedPlayers(new Set());
                setCorrectLocation(null);
                setShowConfetti(false);
            }
        });
    };

    // === ANIMATION HELPERS ===

    // Start 3-2-1-GO! countdown
    const startCountdown = (callback) => {
        setShowCountdown(true);
        setCountdownNumber(3);

        let count = 3;
        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                setCountdownNumber(count);
            } else if (count === 0) {
                setCountdownNumber('GO!');
            } else {
                clearInterval(countdownInterval);
                setShowCountdown(false);
                if (callback) callback();
            }
        }, 1000);
    };

    // Trigger confetti animation
    const triggerConfetti = () => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
    };

    // Get timer class based on time left
    const getTimerClass = () => {
        if (timeLeft <= 5) return 'danger';
        if (timeLeft <= 10) return 'warning';
        return '';
    };

    // Confetti component
    const ConfettiEffect = () => {
        if (!showConfetti) return null;

        const confettiPieces = [];
        for (let i = 0; i < 50; i++) {
            confettiPieces.push(
                <div
                    key={i}
                    className="confetti"
                    style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 2}s`,
                        animationDuration: `${3 + Math.random() * 2}s`
                    }}
                />
            );
        }
        return <div className="confetti-container">{confettiPieces}</div>;
    };

    // Countdown overlay component
    const CountdownOverlay = () => {
        if (!showCountdown) return null;

        return (
            <div className="countdown-overlay">
                <div className={`countdown-number ${countdownNumber === 'GO!' ? 'go' : ''}`}>
                    {countdownNumber}
                </div>
            </div>
        );
    };

    // Persistent QR Code component (visible during PLAYING, ROUND_END, GAME_END)
    const PersistentQRCode = () => {
        if (gameState === 'INIT' || gameState === 'LOBBY') return null;

        const joinUrl = window.location.origin;
        const qrUrl = `${joinUrl}/geo/play/${roomCode}`;

        return (
            <div className="geo-persistent-qr">
                {showQRCode ? (
                    <div className="geo-qr-panel">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`}
                            alt={`QR Code pour rejoindre — code ${roomCode}`}
                        />
                        <div className="geo-qr-panel-info">
                            <div className="geo-qr-panel-code">{roomCode}</div>
                            <div className="geo-qr-panel-hint">Scannez pour rejoindre</div>
                        </div>
                        <button
                            className="geo-qr-toggle-btn mt-2 w-100 justify-content-center"
                            onClick={() => setShowQRCode(false)}
                            aria-label="Masquer le QR code"
                        >
                            ✕ Masquer
                        </button>
                    </div>
                ) : (
                    <div
                        className="geo-qr-compact"
                        onClick={() => setShowQRCode(true)}
                        role="button"
                        tabIndex={0}
                        title="Afficher le QR code pour rejoindre"
                        aria-label={`Afficher le QR code — PIN: ${roomCode}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowQRCode(true); } }}
                    >
                        <span className="geo-qr-compact-icon" aria-hidden="true">📱</span>
                        <span className="geo-qr-compact-pin">PIN: {roomCode}</span>
                    </div>
                )}
            </div>
        );
    };

    // RENDER LOBBY
    if (gameState === 'LOBBY') {
        const joinUrl = window.location.origin;
        const qrUrl = `${joinUrl}/geo/play/${roomCode}`;

        return (
            <div 
                className="pop-culture-lobby-bg font-body-md h-screen w-screen overflow-hidden flex selection:bg-primary-container selection:text-white relative"
                style={{
                    backgroundColor: '#0a0e27',
                    backgroundImage: 'linear-gradient(rgba(10, 14, 39, 0.8), rgba(10, 14, 39, 0.8)), url("https://cdn.midjourney.com/bf9bd72c-442b-474a-a98e-2c19ea87ddd1/0_2.png")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                {/* Pop Dots pattern overlay */}
                <div className="pop-dots"></div>

                {/* Floating decorative pop art stickers */}
                <div className="sticker bg-secondary text-white absolute top-28 left-12 -rotate-12 floating select-none" style={{ '--rot': '-12deg' }}>GEO-PRO</div>
                <div className="sticker bg-primary-container text-on-primary-container absolute bottom-24 left-16 rotate-6 floating select-none" style={{ '--rot': '6deg', 'animationDelay': '1s' }}>READY?</div>
                <div className="sticker bg-tertiary text-white absolute top-1/2 right-12 -rotate-6 floating select-none" style={{ '--rot': '-6deg', 'animationDelay': '2s' }}>EXPLORE!</div>

                {/* Main Canvas */}
                <main className="flex-grow h-full overflow-y-auto overflow-x-hidden relative flex flex-col z-10">
                    <div className="max-w-[1280px] mx-auto w-full h-full p-8 flex flex-col gap-6 relative">
                        {/* Header */}
                        <header className="flex justify-between items-end flex-shrink-0">
                            <div>
                                <span className="inline-block bg-tertiary text-white text-[10px] font-bold font-headline-sm px-3 py-1 border-2 border-on-background uppercase tracking-widest -rotate-2 mb-2">
                                    Initialisation
                                </span>
                                <h1 className="text-4xl md:text-5xl font-black font-headline-xl text-white uppercase italic tracking-tighter">LE SALON</h1>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 border-2 border-white/20 hover:border-white/30 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold font-headline-sm uppercase tracking-wider backdrop-blur-md active:scale-95"
                                    onClick={() => setShowSettings(true)}
                                >
                                    <span className="material-symbols-outlined text-[16px]">settings</span>
                                    Paramètres
                                </button>
                                <button 
                                    className="bg-red-500/10 hover:bg-red-500/25 text-red-300 px-4 py-2 border-2 border-red-500/25 hover:border-red-500/40 rounded-full transition-all flex items-center gap-1.5 text-xs font-bold font-headline-sm uppercase tracking-wider backdrop-blur-md active:scale-95"
                                    onClick={handleQuitGame}
                                >
                                    <span className="material-symbols-outlined text-[16px]">logout</span>
                                    Quitter
                                </button>
                                <div className="bg-white/10 px-4 py-2 rounded-full border-2 border-white/25 flex items-center gap-2 backdrop-blur-md">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping"></span>
                                    <span className="font-headline-sm text-white/80 text-[10px] uppercase font-bold tracking-wider">Réseau Stable</span>
                                </div>
                            </div>
                        </header>

                        {/* Bento Grid Layout */}
                        <div className="grid grid-cols-12 gap-6 flex-grow items-stretch">
                            {/* Access Code & QR Card (Top Left) */}
                            <div className="col-span-12 xl:col-span-8 glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group transition-colors">
                                {/* Accent Strip */}
                                <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-[#ffd700]"></div>
                                <div className="flex-col flex gap-4">
                                    <h2 className="font-headline-sm text-white/60 uppercase tracking-widest text-[11px]">Code d'Expédition</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="text-6xl md:text-7xl leading-none font-black font-headline-xl text-white tracking-[0.1em] select-all uppercase">
                                            {roomCode}
                                        </span>
                                    </div>
                                    <p className="font-body-md text-white/70 max-w-md text-sm">
                                        Partagez ce code avec votre équipe ou demandez-leur de scanner le code QR pour rejoindre le jeu.
                                    </p>
                                </div>
                                {/* QR Code Container */}
                                <div className="w-44 h-44 bg-white border-[3px] border-on-background rounded-xl p-2 shadow-sm flex-shrink-0 relative overflow-hidden flex items-center justify-center neo-shadow-sm">
                                    <img 
                                        alt="Join QR Code" 
                                        className="w-full h-full object-contain mix-blend-multiply" 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`}
                                    />
                                    {/* Scanning line effect */}
                                    <div className="absolute top-0 left-0 w-full h-[3px] bg-primary-container opacity-80 shadow-[0_0_10px_#ffd700] animate-[scan_2s_ease-in-out_infinite]"></div>
                                </div>
                            </div>

                            {/* Game Configuration Panel (Right Column) */}
                            <div className="col-span-12 xl:col-span-4 xl:row-span-2 glass-panel rounded-2xl p-6 flex flex-col justify-between shadow-sm">
                                <div>
                                    <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-3">
                                        <span className="material-symbols-outlined text-[#ffd700]">tune</span>
                                        <h3 className="text-lg font-headline-md font-bold text-white uppercase tracking-wide">Paramètres</h3>
                                    </div>
                                    <div className="flex flex-col gap-5">
                                        {/* Region Setting */}
                                        <div className="flex flex-col gap-2">
                                            <label className="font-headline-sm text-white/60 uppercase text-[10px] tracking-wider">Secteur Géographique</label>
                                            <div className="flex flex-wrap gap-2">
                                                <span className="px-3.5 py-1.5 border-2 border-[#ffd700] bg-[#ffd700]/15 text-[#ffd700] font-headline-sm text-[11px] uppercase font-black tracking-wider">
                                                    {settings.mapType.join(', ')}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Rounds Setting */}
                                        <div className="flex flex-col gap-2">
                                            <label className="font-headline-sm text-white/60 uppercase flex justify-between text-[10px] tracking-wider">
                                                <span>Nombre de Cycles</span>
                                                <span className="font-black text-[#ffd700] text-xs">{settings.roundsCount}</span>
                                            </label>
                                            <input 
                                                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#ffd700]" 
                                                max="20" min="1" 
                                                type="range" 
                                                value={settings.roundsCount}
                                                onChange={(e) => updateSettings({ ...settings, roundsCount: parseInt(e.target.value) })}
                                            />
                                        </div>
                                        {/* Time Setting */}
                                        <div className="flex flex-col gap-2">
                                            <label className="font-headline-sm text-white/60 uppercase flex justify-between text-[10px] tracking-wider">
                                                <span>Fenêtre Temporelle</span>
                                                <span className="font-black text-[#ffd700] text-xs">{settings.timePerRound}s</span>
                                            </label>
                                            <div className="flex border-2 border-white/20 rounded-md overflow-hidden bg-white/5">
                                                <button 
                                                    className="w-10 h-10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
                                                    onClick={() => updateSettings({ ...settings, timePerRound: Math.max(10, settings.timePerRound - 10) })}
                                                >
                                                    <span className="material-symbols-outlined">remove</span>
                                                </button>
                                                <div className="flex-1 flex items-center justify-center font-headline-sm text-white border-x-2 border-white/20 bg-white/5 font-black text-sm">{settings.timePerRound}</div>
                                                <button 
                                                    className="w-10 h-10 flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors"
                                                    onClick={() => updateSettings({ ...settings, timePerRound: Math.min(300, settings.timePerRound + 10) })}
                                                >
                                                    <span className="material-symbols-outlined">add</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Start Action Button */}
                                <div className="mt-6 p-1 marching-ants rounded-lg">
                                    <button 
                                        className="w-full bg-[#ffd700] text-[#161a33] py-4 rounded-lg font-headline-lg text-[22px] font-black uppercase italic tracking-tighter hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(22,26,51,1)] shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center gap-3 border-[3px] border-[#161a33]"
                                        onClick={startGame} 
                                        disabled={players.length === 0 || isStarting}
                                    >
                                        <span>{isStarting ? 'INITIALISATION...' : 'LANCER LA PARTIE'}</span>
                                        <span className="material-symbols-outlined text-[24px]">play_arrow</span>
                                    </button>
                                </div>
                            </div>

                            {/* Connected Players Grid (Bottom Left) */}
                            <div className="col-span-12 xl:col-span-8 glass-panel rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
                                <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-shrink-0">
                                    <h3 className="text-lg font-headline-md font-bold text-white uppercase tracking-wide">Agents Connectés</h3>
                                    <div className="bg-[#ffd700]/15 text-[#ffd700] px-3.5 py-1 border-2 border-[#ffd700]/25 font-headline-sm text-xs font-bold tracking-wider uppercase">
                                        {players.length} CONNECTÉ{players.length > 1 ? 'S' : ''}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto pr-1 max-h-[360px] custom-scrollbar flex-grow content-start">
                                    {players.map((player) => (
                                        <div key={player.id} className="bg-white border-2 border-on-background p-4 flex flex-col items-center gap-2 hover:translate-y-[-4px] transition-transform duration-200 group relative overflow-hidden neo-shadow-sm">
                                            {/* Kick Player button */}
                                            <button
                                                className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 border-2 border-on-background text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md opacity-100 transition-all duration-200 z-20 cursor-pointer active:scale-95"
                                                onClick={(e) => { e.stopPropagation(); kickPlayer(player.id); }}
                                                title="Exclure ce joueur"
                                                aria-label={`Exclure ${player.name}`}
                                            >
                                                <span className="material-symbols-outlined text-[14px] font-bold">close</span>
                                            </button>
                                            
                                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-on-background bg-surface-variant flex-shrink-0">
                                                {player.avatar ? (
                                                    <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-surface-variant flex items-center justify-center text-primary/70">
                                                        <span className="material-symbols-outlined text-2xl">person</span>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-headline-sm text-[13px] text-on-background truncate w-full text-center font-bold">{player.name}</span>
                                            <span className="bg-primary-container text-on-primary-container font-headline-sm px-2.5 py-0.5 border-2 border-on-background text-[10px] uppercase shadow-[2px_2px_0px_0px_#161a33]">PRÊT</span>
                                        </div>
                                    ))}
                                    
                                    {/* Empty Slots */}
                                    {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, idx) => (
                                        <div key={`empty-${idx}`} className="border-2 border-dashed border-white/20 bg-white/5 rounded-xl p-4 flex flex-col items-center justify-center gap-2 opacity-40">
                                            <div className="w-16 h-16 rounded-full border border-dashed border-white/25 flex items-center justify-center text-white/30">
                                                <span className="material-symbols-outlined">person_add</span>
                                            </div>
                                            <span className="font-headline-sm text-white/50 text-[10px] uppercase font-bold tracking-wider">En attente</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                {/* SETTINGS MODAL */}
                {showSettings && (
                    <div className="geo-settings-backdrop" style={{ zIndex: 1000 }} onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
                        <div className="glass-panel text-on-surface rounded-xl p-8 max-w-lg w-full border border-primary/30 shadow-[0_0_30px_rgba(0,0,0,0.1)] relative" onClick={(e) => e.stopPropagation()}>
                            <h3 className="font-headline-md text-xl text-primary text-center mb-6 uppercase tracking-widest border-b border-primary/20 pb-4 flex items-center justify-center gap-2 font-bold">
                                <span className="material-symbols-outlined text-primary">tune</span> CONFIGURATION DE LA SALLE
                            </h3>

                            <div className="settings-section mb-6">
                                <label className="font-label-caps text-xs text-primary/70 block mb-2" htmlFor="setting-rounds">Nombre de manches</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        id="setting-rounds"
                                        type="range"
                                        className="w-full accent-primary-container"
                                        min="1" max="20"
                                        value={settings.roundsCount}
                                        onChange={(e) => updateSettings({ ...settings, roundsCount: parseInt(e.target.value) })}
                                    />
                                    <span className="font-code-data text-lg text-primary min-w-[30px] text-right font-bold">{settings.roundsCount}</span>
                                </div>
                            </div>

                            <div className="settings-section mb-6">
                                <label className="font-label-caps text-xs text-primary/70 block mb-2" htmlFor="setting-time">Temps par manche (secondes)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        id="setting-time"
                                        type="range"
                                        className="w-full accent-primary-container"
                                        min="10" max="300" step="10"
                                        value={settings.timePerRound}
                                        onChange={(e) => updateSettings({ ...settings, timePerRound: parseInt(e.target.value) })}
                                    />
                                    <span className="font-code-data text-lg text-primary min-w-[45px] text-right font-bold">{settings.timePerRound}s</span>
                                </div>
                            </div>

                            <div className="settings-section mb-6">
                                <div className="font-label-caps text-xs text-primary/70 block mb-3">Régions de jeu</div>
                                <div className="grid grid-cols-3 gap-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
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
                                        { id: 'themeparks', name: 'Parcs d\'Attractions', icon: '🎢' },
                                        { id: 'beaches', name: 'Plages Célèbres', icon: '🏖️' },
                                        { id: 'markets', name: 'Marchés Célèbres', icon: '🛍️' },
                                    ].map(region => {
                                        const isSelected = settings.mapType.includes(region.id);
                                        return (
                                            <button
                                                key={region.id}
                                                className={`p-2 rounded border flex flex-col items-center justify-center text-center transition-all duration-200 active:scale-95 ${
                                                    isSelected 
                                                        ? 'border-primary bg-primary/20 text-primary shadow-[0_0_10px_rgba(255,107,53,0.25)] font-bold' 
                                                        : 'border-white/10 bg-white/5 text-on-surface-variant hover:border-white/30'
                                                }`}
                                                onClick={() => {
                                                    let newTypes;
                                                    if (region.id === 'world') {
                                                        newTypes = ['world'];
                                                    } else {
                                                        newTypes = settings.mapType.filter(t => t !== 'world');
                                                        if (isSelected) {
                                                            newTypes = newTypes.filter(t => t !== region.id);
                                                        } else {
                                                            newTypes.push(region.id);
                                                        }
                                                        if (newTypes.length === 0) newTypes = ['world'];
                                                    }
                                                    updateSettings({ ...settings, mapType: newTypes });
                                                }}
                                            >
                                                <span className="text-xl mb-1">{region.icon}</span>
                                                <span className="font-body-sm text-[10px] uppercase font-bold text-truncate w-full">{region.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-primary/20 pt-4 flex flex-col items-center">
                                <div className="font-label-caps text-xs text-primary/70 mb-2 flex items-center gap-1">
                                    <span className="material-symbols-outlined text-sm">phone_android</span> Télécommande Admin
                                </div>
                                <div className="relative group p-1.5 bg-white rounded-lg border border-primary/20">
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(joinUrl + '/geo/remote/' + roomCode + (remoteToken ? '?rt=' + remoteToken : ''))}`}
                                        alt="QR Code Télécommande"
                                        className="w-[100px] h-[100px] object-contain rounded"
                                    />
                                </div>
                                <p className="text-on-surface-variant/60 font-body-sm text-[10px] mt-2">Contrôlez le jeu depuis votre téléphone</p>
                            </div>

                            <div className="text-center mt-6">
                                <button 
                                    className="bg-primary-container text-white font-bold font-headline-md px-8 py-2.5 rounded-full hover:bg-primary transition-all duration-200 active:scale-95 shadow-[0_4px_10px_rgba(255,107,53,0.3)]"
                                    onClick={() => setShowSettings(false)}
                                >
                                    VALIDER
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // RENDER PLAYING + ROUND_END : div Street View PERSISTANT
    if (gameState === 'PLAYING' || gameState === 'ROUND_END') {
        const isPlaying = gameState === 'PLAYING';
        const isRoundEnd = gameState === 'ROUND_END';

        return (
            <div className="h-screen w-screen relative font-body-md text-on-background bg-background overflow-hidden flex flex-col pop-culture-theme">
                {/* Pop Dots Pattern globally visible in host canvas */}
                <div className="pop-dots"></div>

                {/* Div Street View persistant — créé une seule fois, déplacé entre les slots par useEffect */}
                <div ref={streetViewWrapperRef}>
                    <div
                        ref={streetViewRef}
                        className="geo-host-sv-persistent"
                        style={{ width: '100%', height: '100%', display: isPlaying ? 'block' : 'none' }}
                    ></div>
                </div>

                {/* ===== VUE PLAYING ===== */}
                {isPlaying && (
                    <div className="absolute inset-0 z-0 flex flex-col h-full w-full overflow-hidden">
                        {/* Background Panorama Container */}
                        <div className="absolute inset-0 z-0">
                            <div ref={streetViewPlayingSlotRef} className="w-full h-full"></div>
                            <div className="absolute inset-0 bg-[#161a33]/15 mix-blend-multiply pointer-events-none"></div>
                        </div>

                        {/* Top Navigation */}
                        <header className="absolute top-0 left-0 w-full z-20 px-6 py-4">
                            <div className="max-w-[1280px] mx-auto flex justify-between items-center glass-panel rounded-full px-6 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-black font-headline-xl text-secondary uppercase italic">GeoTrackr</span>
                                    <span className="text-on-background/20 font-bold">|</span>
                                    <span className="text-xs font-bold font-headline-sm text-on-background uppercase tracking-wide">SALON: {roomCode}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="bg-[#ffd700]/15 border border-[#ffd700]/30 px-4 py-1.5 rounded-full flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#705d00] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
                                        <span className="text-[10px] font-bold font-headline-sm text-[#705d00] uppercase tracking-wider">
                                            {players.filter(p => !p.disconnected).length} EN JEU
                                        </span>
                                    </div>
                                    <button 
                                        className="bg-white/10 hover:bg-white/20 border border-white/20 p-2 rounded-full transition-colors active:scale-90"
                                        onClick={() => setShowSettings(true)}
                                    >
                                        <span className="material-symbols-outlined text-white">settings</span>
                                    </button>
                                </div>
                            </div>
                        </header>

                        {/* Main Game HUD */}
                        <main className="absolute inset-0 z-10 flex flex-col items-center justify-between pointer-events-none p-6 pt-24 pb-12">
                            {/* Top Center: Round Info & Score */}
                            <div className="glass-panel px-8 py-3 rounded-full flex items-center gap-6 pointer-events-auto">
                                <div className="flex flex-col items-center">
                                    <span className="font-headline-sm text-on-background/60 uppercase tracking-widest text-[9px]">Manche</span>
                                    <span className="text-lg font-black font-headline-md text-on-background">{currentRound} <span className="text-on-background/30">/</span> {totalRounds}</span>
                                </div>
                                <div className="h-8 w-[2px] bg-on-background/10"></div>
                                <div className="flex flex-col items-center">
                                    <span className="font-headline-sm text-on-background/60 uppercase tracking-widest text-[9px]">Lieu</span>
                                    <span className="text-xs font-black font-headline-sm text-[#705d00] flex items-center gap-1 uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-[16px]">public</span> {settings.mapType.join(', ')}
                                    </span>
                                </div>
                            </div>

                            {/* Center: Large Timer Overlay */}
                            <div className="flex-grow flex items-center justify-center">
                                <div 
                                    className={`glass-panel rounded-full w-48 h-48 flex flex-col items-center justify-center timer-glow pointer-events-auto cursor-pointer relative ${timeLeft <= 10 ? 'border-error/50 shadow-[0_0_15px_rgba(186,26,26,0.3)]' : ''}`}
                                    id="timer-container"
                                >
                                    {/* Radial Progress Ring SVG */}
                                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" fill="none" r="46" stroke="rgba(22, 26, 51, 0.15)" strokeWidth="4"></circle>
                                        <circle 
                                            className="transition-all duration-1000 ease-linear" 
                                            cx="50" cy="50" 
                                            fill="none" 
                                            id="timer-progress" 
                                            r="46" 
                                            stroke={timeLeft <= 10 ? '#ba1a1a' : '#ffd700'} 
                                            strokeDasharray="289" 
                                            strokeDashoffset={289 - (timeLeft / (settings.timePerRound || 60)) * 289} 
                                            strokeWidth="4"
                                        ></circle>
                                    </svg>
                                    <span className={`text-[56px] font-black font-headline-xl relative z-10 ${timeLeft <= 10 ? 'text-error animate-pulse' : 'text-on-background'}`}>
                                        {formatTime(timeLeft)}
                                    </span>
                                    <span className="font-headline-sm text-on-background/60 relative z-10 mt-1 uppercase tracking-widest text-[9px]">RESTANT</span>
                                </div>
                            </div>

                            {/* Bottom: Player Status & Actions */}
                            <div className="w-full max-w-[1280px] mx-auto flex justify-between items-end pointer-events-auto gap-6">
                                {/* Player Response Status Card */}
                                <div className="bg-white/80 backdrop-blur-md border-[3px] border-on-background p-5 rounded-2xl w-80 flex flex-col gap-2 neo-shadow-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="font-headline-sm font-black text-secondary text-xs uppercase tracking-wider">Réponses</span>
                                        <span className="font-headline-sm font-black text-on-background text-sm">{guessedPlayers.size} / {players.filter(p => !p.disconnected).length}</span>
                                    </div>
                                    <div className="w-full bg-[#dee0ff] rounded-full h-3 border-2 border-on-background overflow-hidden">
                                        <div 
                                            className="bg-secondary h-full transition-all duration-500" 
                                            style={{ width: `${players.filter(p => !p.disconnected).length > 0 ? (guessedPlayers.size / players.filter(p => !p.disconnected).length) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex -space-x-1.5 mt-2 overflow-x-auto py-1 max-w-full">
                                        {players.map(player => {
                                            const hasGuessed = guessedPlayers.has(player.id);
                                            return (
                                                <div 
                                                    key={player.id} 
                                                    className={`relative w-8 h-8 rounded-full border-2 border-on-background flex-shrink-0 overflow-hidden cursor-pointer hover:scale-115 hover:z-30 hover:opacity-100 transition-all ${hasGuessed ? 'ring-2 ring-primary-container shadow-md' : 'opacity-60'}`}
                                                    title={`${player.name} (${hasGuessed ? 'Prêt' : 'Réfléchit...'}) - Cliquer pour exclure`}
                                                    onClick={() => kickPlayer(player.id)}
                                                >
                                                    {player.avatar ? (
                                                        <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-surface-variant flex items-center justify-center text-primary/70">
                                                            <span className="material-symbols-outlined text-xs">person</span>
                                                        </div>
                                                    )}
                                                    {/* Small indicator */}
                                                    {hasGuessed && (
                                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-on-background flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[7px] text-white font-bold">check</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Host Controls */}
                                <div className="flex gap-4">
                                    <button 
                                        className="bg-white hover:bg-surface-container-low text-on-background font-headline-sm text-xs font-black px-6 py-4 border-[3px] border-on-background rounded-xl transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none neo-shadow-sm flex items-center gap-1.5"
                                        onClick={endRound}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">skip_next</span>
                                        PASSER
                                    </button>
                                    <button 
                                        className="bg-primary-container hover:bg-primary-container/90 text-on-primary-container font-headline-sm text-xs font-black px-6 py-4 border-[3px] border-on-background rounded-xl transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none neo-shadow-sm flex items-center gap-1.5"
                                        onClick={endRound}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                                        TERMINER MANCHE
                                    </button>
                                </div>
                            </div>
                        </main>

                        {/* Floating reactions from users */}
                        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden" id="emoji-container">
                            {reactions.map(reaction => (
                                <div
                                    key={reaction.id}
                                    className="floating-emoji"
                                    style={{ 
                                        left: `${reaction.xPos}vw`,
                                        animationDuration: '4s',
                                        opacity: 1
                                    }}
                                >
                                    <span className="block text-4xl">{reaction.emoji}</span>
                                    <span className="block text-[10px] text-on-background font-bold bg-white border-2 border-on-background px-2 py-0.5 rounded-md transform -translate-y-2 max-w-[80px] truncate shadow-sm">
                                        {reaction.playerName}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== VUE ROUND END ===== */}
                {isRoundEnd && (
                    <div className="absolute inset-0 z-0 flex flex-col h-full w-full overflow-hidden">
                        {/* Background Results Map (Google Maps instance bound here) */}
                        <div className="absolute inset-0 z-0">
                            <div ref={mapRef} className="w-full h-full"></div>
                            {/* Overlay transparent blue to match style */}
                            <div className="absolute inset-0 bg-secondary/5 mix-blend-multiply pointer-events-none"></div>
                        </div>

                        {/* Top Info Banner overlay */}
                        <div className="absolute top-6 left-6 z-20">
                            <div className="glass-panel rounded-xl p-4 flex flex-col gap-1 border border-surface-variant/40 shadow-md">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">target</span>
                                    <h2 className="text-headline-md font-headline-md text-on-surface font-bold text-lg">
                                        Résultats de la Manche {currentRound}
                                    </h2>
                                </div>
                                <div className="flex items-center gap-3 text-on-surface-variant">
                                    <span className="flex items-center gap-1 font-code-data text-xs bg-surface-container/50 px-2.5 py-1 rounded-full font-semibold border border-surface-variant/30">
                                        <span className="material-symbols-outlined text-[14px]">location_on</span>
                                        Cible : {correctLocation?.city}, {correctLocation?.country}
                                    </span>
                                    {correctLocation?.lat && (
                                        <span className="flex items-center gap-1 font-code-data text-xs bg-surface-container/50 px-2.5 py-1 rounded-full font-semibold border border-surface-variant/30">
                                            {Math.abs(correctLocation.lat).toFixed(4)}° {correctLocation.lat >= 0 ? 'N' : 'S'}, {Math.abs(correctLocation.lng).toFixed(4)}° {correctLocation.lng >= 0 ? 'E' : 'W'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Leaderboard Side Panel */}
                        <div className="absolute top-6 right-6 bottom-6 w-96 z-20 flex flex-col">
                            <div className="glass-panel rounded-2xl h-full flex flex-col overflow-hidden shadow-lg border border-surface-variant/40">
                                <div className="p-4 border-b border-surface-variant/30 bg-white/40 flex justify-between items-center flex-shrink-0">
                                    <h3 className="text-base font-headline-md text-on-surface font-bold">Classement Global</h3>
                                    <div className="text-[10px] font-label-caps text-secondary bg-secondary-container/20 px-3 py-1 rounded-full border border-secondary/20 font-bold uppercase">
                                        Manche {currentRound} / {totalRounds}
                                    </div>
                                </div>
                                <div className="flex-grow overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                    {roundResults?.filter(r => players.some(p => p.id === r.id)).map((result, index) => {
                                        const isFirst = index === 0;
                                        return (
                                            <div 
                                                key={result.id}
                                                className={`relative bg-white border rounded-lg p-3 flex items-center gap-3 hover:border-secondary/40 transition-colors shadow-sm ${
                                                    isFirst ? 'border-primary/20 shadow-md ring-1 ring-primary-container/10' : 'border-surface-variant/30'
                                                }`}
                                            >
                                                {isFirst && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container"></div>}
                                                <div className={`flex-shrink-0 w-6 text-center font-headline-md font-bold ${isFirst ? 'text-primary' : 'text-on-surface-variant'}`}>
                                                    {index + 1}
                                                </div>
                                                <div className="w-8 h-8 rounded-full border border-surface-variant/50 overflow-hidden bg-surface flex-shrink-0 flex items-center justify-center">
                                                    {result.avatar ? (
                                                        <img src={result.avatar} alt={result.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-xs text-on-surface-variant">person</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-body-md text-on-surface truncate font-semibold">{result.name}</div>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="bg-surface-container px-2 py-0.5 rounded text-code-data text-[10px] flex items-center gap-1 text-on-surface-variant font-medium">
                                                            <span className="material-symbols-outlined text-[12px]">straighten</span> 
                                                            {formatDistance(result.distance)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <div>
                                                        <div className="font-code-data text-sm text-primary font-bold">+{result.roundScore?.toLocaleString()}</div>
                                                        <div className="text-[10px] font-label-caps text-on-surface-variant">{result.totalScore?.toLocaleString()} PTS</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="bg-red-100 hover:bg-red-500 border border-red-200 text-red-650 hover:text-white w-5 h-5 rounded-full flex items-center justify-center transition-all z-20 cursor-pointer active:scale-95 ml-2"
                                                        onClick={(e) => { e.stopPropagation(); kickPlayer(result.id); }}
                                                        title={`Exclure ${result.name}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[10px] font-bold">close</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-4 border-t border-surface-variant/30 bg-surface-container-low/85 backdrop-blur-md flex-shrink-0 flex flex-col gap-2">
                                    <button 
                                        className="w-full bg-primary-container text-white font-label-caps text-xs py-3.5 px-4 rounded-lg hover:bg-primary transition-colors flex items-center justify-center gap-2 shadow-md active:scale-95 font-bold tracking-widest"
                                        onClick={nextRound}
                                    >
                                        <span>{currentRound >= totalRounds ? 'RÉSULTATS FINAUX' : `LANCER LA MANCHE ${currentRound + 1}`}</span>
                                        <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                    </button>
                                    {autoNextCountdown && (
                                        <div className="text-center font-label-caps text-[9px] text-primary/70 tracking-wider animate-pulse">
                                            ⏱️ TRANSITION AUTOMATIQUE DANS {autoNextCountdown}S...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <PersistentQRCode />
            </div>
        );
    }

    // RENDER GAME END
    if (gameState === 'GAME_END') {
        const podiumOrder = [1, 0, 2]; // Affichage : 2ème (gauche), 1er (centre), 3ème (droite)

        return (
            <div 
                id="main-canvas" 
                className="pop-culture-lobby-bg h-screen w-screen overflow-hidden flex flex-col relative font-body-md text-white selection:bg-primary-container selection:text-white"
                style={{
                    backgroundColor: '#0a0e27',
                    backgroundImage: 'linear-gradient(rgba(10, 14, 39, 0.85), rgba(10, 14, 39, 0.85)), url("https://cdn.midjourney.com/bf9bd72c-442b-474a-a98e-2c19ea87ddd1/0_2.png")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                }}
            >
                {/* Pop Dots pattern overlay */}
                <div className="pop-dots"></div>

                {/* Top Navigation */}
                <header className="absolute top-0 left-0 w-full z-20 px-6 py-4 pointer-events-none">
                    <div className="max-w-[1280px] mx-auto flex justify-between items-center glass-panel rounded-full px-6 py-2 pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-black font-headline-xl text-secondary uppercase italic">GeoTrackr</span>
                            <span className="text-on-background/20 font-bold">|</span>
                            <span className="text-xs font-bold font-headline-sm text-on-background uppercase tracking-wide">FIN DE PARTIE : {roomCode}</span>
                        </div>
                        <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            <span className="font-headline-sm text-white/80 text-[10px] uppercase font-bold tracking-wider">Mission Accomplie</span>
                        </div>
                    </div>
                </header>

                <main className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 pt-24 pb-12 overflow-y-auto">
                    <div className="max-w-[1280px] w-full mx-auto flex flex-col items-center gap-6">
                        {/* Header Section */}
                        <div className="text-center flex flex-col items-center">
                            <span className="inline-block bg-tertiary text-white text-[10px] font-bold font-headline-sm px-3 py-1 border-2 border-on-background uppercase tracking-widest -rotate-2 mb-3">
                                CLASSEMENT GLOBAL
                            </span>
                            <h2 className="text-4xl md:text-5xl font-black font-headline-xl text-white uppercase italic tracking-tighter comic-glow mb-2">
                                RÉSULTATS FINAUX
                            </h2>
                            <p className="text-sm font-semibold text-white/80 max-w-2xl text-center">
                                La mission d'exploration est terminée ! Félicitations à tous les agents.
                            </p>
                        </div>

                        {/* Podium Section */}
                        <div className="relative w-full max-w-2xl mx-auto flex items-end justify-center h-[280px] mt-6 gap-4 md:gap-8">
                            {/* Stickers decorations inside podium */}
                            <div className="sticker bg-secondary text-white absolute -top-8 -left-6 rotate-6 floating text-[10px] px-2 py-0.5" style={{ '--rot': '6deg' }}>TOP AGENT</div>
                            <div className="sticker bg-tertiary text-white absolute -top-10 -right-4 -rotate-12 floating text-[10px] px-2 py-0.5" style={{ '--rot': '-12deg' }}>BOOM!</div>
                            
                            {podiumOrder.map((rankIndex, displayIndex) => {
                                const resultsArray = Array.isArray(finalResults) ? finalResults : [];
                                const result = resultsArray[rankIndex];
                                const isFirst = rankIndex === 0;
                                const isSecond = rankIndex === 1;
                                const isThird = rankIndex === 2;
                                
                                // Column heights & styles
                                let columnHeight = "h-[85px]"; // 2nd
                                let columnBg = "bg-secondary"; // Electric Violet
                                let stickerText = "CHALLENGER";
                                let columnLabel = "2";

                                if (isFirst) {
                                    columnHeight = "h-[135px]"; // 1st
                                    columnBg = "bg-primary-container"; // Acid Yellow
                                    stickerText = "CHAMPION!";
                                    columnLabel = "1";
                                } else if (isThird) {
                                    columnHeight = "h-[60px]"; // 3rd
                                    columnBg = "bg-tertiary"; // Flashy Pink
                                    stickerText = "RECRUE";
                                    columnLabel = "3";
                                }

                                return (
                                    <div 
                                        key={rankIndex}
                                        className="flex flex-col items-center justify-end w-1/3 max-w-[150px] z-10"
                                    >
                                        {result ? (
                                            <>
                                                <div className="relative mb-3 flex flex-col items-center">
                                                    {isFirst && (
                                                        <div className="absolute -top-7 text-primary-container animate-bounce">
                                                            <span className="material-symbols-outlined text-3xl font-black" style={{ fontVariationSettings: "'FILL' 1" }}>trophy</span>
                                                        </div>
                                                    )}
                                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] border-on-background overflow-hidden bg-white shadow-md relative z-20">
                                                        {result.avatar ? (
                                                            <img src={result.avatar} alt={result.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full bg-surface-variant flex items-center justify-center text-on-background/60">
                                                                <span className="material-symbols-outlined text-3xl">person</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="absolute -bottom-2 bg-white text-on-background w-6 h-6 rounded-full flex items-center justify-center font-black text-xs border-2 border-on-background z-30 shadow-sm">
                                                        {columnLabel}
                                                    </div>
                                                </div>
                                                
                                                <div className="text-center mb-2 px-1 w-full z-10">
                                                    <h3 className="text-xs font-headline-md font-bold text-white truncate max-w-full">{result.name}</h3>
                                                    <p className="text-[10px] font-black font-code-data text-primary-container mt-0.5">{result.totalScore?.toLocaleString()} PTS</p>
                                                </div>
                                                
                                                <div className={`w-full ${columnHeight} ${columnBg} border-[3px] border-on-background rounded-t-xl relative overflow-hidden flex flex-col items-center justify-center neo-shadow-sm`}>
                                                    <span className="font-headline-xl font-black text-on-background/15 text-5xl select-none">{columnLabel}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-white/20 py-8">
                                                <span className="material-symbols-outlined text-2xl">person</span>
                                                <span className="text-[9px] font-label-caps mt-1">VIDE</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Special Awards Bento Grid */}
                        {Array.isArray(awards) && awards.length > 0 && (
                            <div className="w-full max-w-3xl mx-auto mt-6">
                                <h3 className="text-xs font-headline-sm font-black text-white/60 mb-3 text-center uppercase tracking-widest">Distinctions Spéciales</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {awards.slice(0, 3).map((award, index) => {
                                        // Style d'award
                                        const styles = [
                                            { bg: 'bg-secondary/15 border-secondary/35 text-secondary', icon: 'search', title: 'Sherlock', iconColor: 'text-[#aa30fa]' },
                                            { bg: 'bg-[#ffd700]/15 border-[#ffd700]/35 text-[#ffd700]', icon: 'rocket_launch', title: 'L\'Astronaute', iconColor: 'text-[#ffd700]' },
                                            { bg: 'bg-tertiary/15 border-tertiary/35 text-tertiary', icon: 'bolt', title: 'L\'Éclair', iconColor: 'text-[#ffccdf]' }
                                        ];
                                        const currentStyle = styles[index % styles.length];

                                        return (
                                            <div key={index} className="glass-panel rounded-xl p-4 flex flex-col items-center text-center relative overflow-hidden group hover:border-[#ffd700]/50 transition-colors border border-white/10 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-[#ffd700]"></div>
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${currentStyle.bg} border border-white/10`}>
                                                    <span className={`material-symbols-outlined text-lg ${currentStyle.iconColor}`}>{currentStyle.icon}</span>
                                                </div>
                                                <h4 className="text-xs font-headline-sm font-black text-white mb-1">{award.title}</h4>
                                                <p className="text-[10px] text-white/70 mb-3 min-h-[28px] line-clamp-2">{award.value}</p>
                                                <div className="mt-auto flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                                                    <span className="text-[10px] font-code-data text-[#ffd700] font-black">{award.playerName}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-8 flex gap-4 pointer-events-auto">
                            <button 
                                className="bg-[#ffd700] text-[#161a33] font-black py-3 px-6 border-[3px] border-[#161a33] rounded-xl hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(22,26,51,1)] shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-2 text-xs font-headline-sm uppercase tracking-wider"
                                onClick={restartGame}
                            >
                                <span>NOUVELLE PARTIE</span>
                                <span className="material-symbols-outlined text-sm font-black">autorenew</span>
                            </button>
                            <button 
                                className="bg-white text-[#161a33] font-black py-3 px-6 border-[3px] border-[#161a33] rounded-xl hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(22,26,51,1)] shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-2 text-xs font-headline-sm uppercase tracking-wider"
                                onClick={handleQuitGame}
                            >
                                <span>QUITTER LE SALON</span>
                                <span className="material-symbols-outlined text-sm font-black">logout</span>
                            </button>
                        </div>
                    </div>
                </main>

                {/* Confetti Container */}
                {showConfetti && (
                    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden shadow-none" id="confetti-container">
                        {Array.from({ length: 50 }).map((_, idx) => {
                            const colors = ['#ffd700', '#8d00d9', '#ac2471', '#fbf8ff'];
                            const left = Math.random() * 100;
                            const animationDuration = Math.random() * 3 + 2;
                            const color = colors[Math.floor(Math.random() * colors.length)];
                            const size = Math.random() * 8 + 4;
                            return (
                                <div
                                    key={idx}
                                    className="confetti"
                                    style={{
                                        left: `${left}vw`,
                                        top: `-20px`,
                                        backgroundColor: color,
                                        width: `${size}px`,
                                        height: `${size}px`,
                                        animationDuration: `${animationDuration}s`,
                                        borderRadius: Math.random() > 0.5 ? '50%' : '0'
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // INIT State
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-on-surface font-body-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 font-headline-md text-sm text-on-surface-variant">Création du salon...</p>
            <button
                className="mt-6 border border-surface-variant text-on-surface-variant hover:bg-surface-container-low text-xs px-4 py-2 rounded transition-all active:scale-95"
                onClick={() => {
                    localStorage.removeItem('geoHostSession');
                    window.location.reload();
                }}
            >
                Réinitialiser
            </button>
        </div>
    );
}

export default GeoHostView;

