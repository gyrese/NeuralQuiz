import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function GeoHostView() {
    const navigate = useNavigate();
    const [roomCode, setRoomCode] = useState(null);
    const [players, setPlayers] = useState([]);
    const [gameState, setGameState] = useState('INIT'); // INIT, LOBBY, PLAYING, ROUND_END, GAME_END
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [roundResults, setRoundResults] = useState(null);
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
    const rotationRef = useRef(null); // Animation de rotation auto
    const autoNextRef = useRef(null); // Timer for auto next round
    const roomCodeRef = useRef(null); // Ref for roomCode to avoid stale closures
    const isNextRoundPendingRef = useRef(false); // Flag to prevent double nextRound processing
    const isEndingRoundRef = useRef(false); // Ref mirror of isEndingRound for socket listener
    const correctLocationRef = useRef(null); // Ref for correctLocation to avoid stale closures
    const gameStateRef = useRef(gameState); // Ref pour accéder à gameState dans les callbacks
    const streetViewWatchdogRef = useRef(null); // Watchdog pour vérifier que Street View est visible
    const streetViewLoadedRef = useRef(false); // Flag pour savoir si Street View est chargée

    // Synchroniser gameStateRef et nettoyer les timers quand on sort de PLAYING
    useEffect(() => {
        gameStateRef.current = gameState;
        // Si on sort de PLAYING, nettoyer le timer et le watchdog
        if (gameState !== 'PLAYING') {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (streetViewWatchdogRef.current) {
                clearInterval(streetViewWatchdogRef.current);
                streetViewWatchdogRef.current = null;
            }
            streetViewLoadedRef.current = false;
        }
    }, [gameState]);

    useEffect(() => {
        // Créer la room au montage
        socket.emit('geo-create-room', { settings }, (response) => {
            if (response.roomCode) {
                setRoomCode(response.roomCode);
                roomCodeRef.current = response.roomCode; // Keep ref in sync
                setGameState('LOBBY');
            }
        });

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

        socket.on('geo-all-guessed', () => {
            // Accélérer la fin du round (3 secondes restantes)
            setTimeLeft(prev => Math.min(prev, 3));
        });

        // Listen for emoji reactions from players
        socket.on('geo-reaction', ({ emoji, playerName, playerId }) => {
            const reactionId = Date.now() + Math.random();
            setReactions(prev => [...prev, { id: reactionId, emoji, playerName }]);
            // Remove after animation (3s)
            setTimeout(() => {
                setReactions(prev => prev.filter(r => r.id !== reactionId));
            }, 3000);
        });

        // === SYNC EVENTS FROM REMOTE ===
        // When remote triggers game start
        socket.on('geo-game-started', (data) => {
            console.log('[Host] Game started event received from remote:', data);
            // Reset panorama for fresh start
            if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
            rotationRef.current = null;
            panoramaInstance.current = null;

            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total);
            setCorrectLocation(data.location);
            correctLocationRef.current = data.location; // Sync ref for initStreetView
            setGuessedPlayers(new Set());
            setIsEndingRound(false);
            soundManager.play('start');

            // Start timer synchronized with server's roundStartTime
            const duration = data.timePerRound || 60;
            let initialTimeLeft = duration;

            // Calculate elapsed time based on server's roundStartTime
            if (data.roundStartTime) {
                const elapsed = Math.floor((Date.now() - data.roundStartTime) / 1000);
                initialTimeLeft = Math.max(0, duration - elapsed);
                console.log(`[Host] Timer sync: duration=${duration}, elapsed=${elapsed}, starting at ${initialTimeLeft}s`);
            }

            setTimeLeft(initialTimeLeft);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 10 && prev > 0) soundManager.playTick();
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        timerRef.current = null;
                        // Auto-end round when timer expires
                        setTimeout(() => {
                            if (gameStateRef.current === 'PLAYING') {
                                endRound();
                            }
                        }, 100);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
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

        // When remote triggers next round
        socket.on('geo-next-round', (data) => {
            console.log('[Host] Next round event received:', data);
            // Skip if we triggered this ourselves (to avoid double processing)
            if (isNextRoundPendingRef.current) {
                console.log('[Host] Skipping geo-next-round - we triggered this ourselves');
                isNextRoundPendingRef.current = false;
                return;
            }
            // Clear all timers
            if (autoNextRef.current) {
                clearInterval(autoNextRef.current);
                autoNextRef.current = null;
            }
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            // Reset panorama for fresh round
            if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
            rotationRef.current = null;
            panoramaInstance.current = null;

            setAutoNextCountdown(null);
            setIsEndingRound(false);
            isEndingRoundRef.current = false;
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setCorrectLocation(data.location);
            correctLocationRef.current = data.location; // Sync ref for initStreetView
            setRoundResults(null);
            setGuessedPlayers(new Set());
            soundManager.play('start');

            // Start timer synchronized with server's roundStartTime
            const duration = data.timePerRound || 60;
            setTimeout(() => {
                let initialTimeLeft = duration;

                // Calculate elapsed time based on server's roundStartTime
                if (data.roundStartTime) {
                    const elapsed = Math.floor((Date.now() - data.roundStartTime) / 1000);
                    initialTimeLeft = Math.max(0, duration - elapsed);
                    console.log(`[Host] Next round timer sync: duration=${duration}, elapsed=${elapsed}, starting at ${initialTimeLeft}s`);
                }

                setTimeLeft(initialTimeLeft);
                timerRef.current = setInterval(() => {
                    setTimeLeft(prev => {
                        if (prev <= 10 && prev > 0) soundManager.playTick();
                        if (prev <= 1) {
                            clearInterval(timerRef.current);
                            timerRef.current = null;
                            setTimeout(() => {
                                if (gameStateRef.current === 'PLAYING') {
                                    endRound();
                                }
                            }, 100);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            }, 200);

            // Force init Street View after DOM is ready
            setTimeout(() => {
                console.log('[HOST] Force initializing Street View from geo-next-round');
                initStreetView();
            }, 500);
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
            soundManager.play('win');
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

        return () => {
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
            if (timerRef.current) clearInterval(timerRef.current);
            if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
            if (autoNextRef.current) clearInterval(autoNextRef.current);
        };
    }, []);

    // Détection automatique "Tous ont répondu"
    useEffect(() => {
        if (gameState === 'PLAYING' && players.length > 0 && guessedPlayers.size === players.length) {
            // Force le timer à 3 secondes max si tous ont répondu
            setTimeLeft(prev => Math.min(prev, 3));
        }
    }, [guessedPlayers, players.length, gameState]);

    // Charger Google Maps API et initialiser Street View
    // Trigger on PLAYING (during game) and ROUND_END (to show results)
    useEffect(() => {
        if ((gameState === 'PLAYING' || gameState === 'ROUND_END') && correctLocation) {
            // Delay to ensure DOM is rendered before initializing Street View
            const timeoutId = setTimeout(() => {
                if (!window.google) {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initGeoHost`;
                    script.async = true;
                    window.initGeoHost = () => initStreetView();
                    document.head.appendChild(script);
                } else {
                    initStreetView();
                }
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [gameState, currentRound, correctLocation]);

    const initStreetView = (retryCount = 0) => {
        // Use ref to get the latest correctLocation value
        const location = correctLocationRef.current;
        if (!location || !streetViewRef.current) {
            console.log('[Host] initStreetView called but missing location or ref', { location, ref: !!streetViewRef.current, retryCount });
            // Retry up to 3 times with increasing delay
            if (retryCount < 3) {
                setTimeout(() => initStreetView(retryCount + 1), 300);
            }
            return;
        }

        console.log('[Host] Checking Street View coverage for:', location.city, location.lat, location.lng);

        // Use StreetViewService to check if coverage exists
        const streetViewService = new window.google.maps.StreetViewService();
        const position = { lat: location.lat, lng: location.lng };

        // Use 500m radius for better coverage (50m was too restrictive)
        streetViewService.getPanorama({ location: position, radius: 500 }, (data, status) => {
            if (status === 'OK') {
                console.log('[Host] Street View coverage found, initializing panorama');
                initPanorama(location, data.location.latLng);
            } else {
                console.warn('[Host] No Street View coverage for this location, status:', status);
                // Only request new location during PLAYING state, not during ROUND_END
                if (gameState === 'PLAYING') {
                    requestNewLocation();
                } else {
                    console.log('[Host] In ROUND_END state, cannot request new location');
                }
            }
        });
    };

    // Request a new location from the server when current one has no Street View
    const requestNewLocation = () => {
        const currentRoomCode = roomCodeRef.current || roomCode;
        console.log('[Host] Requesting new location from server');
        socket.emit('geo-request-new-location', { roomCode: currentRoomCode }, (response) => {
            if (response.success && response.location) {
                console.log('[Host] Received new location:', response.location.city);
                setCorrectLocation(response.location);
                correctLocationRef.current = response.location;
                // Re-verify with the new location
                setTimeout(() => initStreetView(), 200);
            } else {
                console.error('[Host] Failed to get new location:', response.error);
            }
        });
    };

    // Actually initialize the panorama after coverage is verified
    const initPanorama = (location, verifiedPosition) => {
        if (!streetViewRef.current) return;

        console.log('[Host] Initializing Street View for location:', location.city, verifiedPosition.lat(), verifiedPosition.lng());

        // Nettoyer l'ancienne animation
        if (rotationRef.current) {
            cancelAnimationFrame(rotationRef.current);
            rotationRef.current = null;
        }

        const initialHeading = Math.random() * 360;

        // ALWAYS create a new instance because the DOM element (streetViewRef.current) 
        // might have been destroyed/recreated by React between rounds/states.
        console.log('[Host] Creating new panorama instance');
        panoramaInstance.current = new window.google.maps.StreetViewPanorama(
            streetViewRef.current,
            {
                position: verifiedPosition, // Use the SNAPPED position from StreetViewService
                pov: { heading: initialHeading, pitch: 5 },
                zoom: 0,
                addressControl: false,
                showRoadLabels: false,
                linksControl: false,
                panControl: false,
                zoomControl: false,
                enableCloseButton: false,
                fullscreenControl: false,
                motionTracking: false,
                motionTrackingControl: false,
                visible: true // Explicitly set visible
            }
        );

        // Animation de rotation lente automatique
        let heading = initialHeading;
        const rotateCamera = () => {
            if (panoramaInstance.current) {
                heading = (heading + 0.15) % 360; // Rotation slightly faster
                panoramaInstance.current.setPov({
                    heading: heading,
                    pitch: 5
                });
                rotationRef.current = requestAnimationFrame(rotateCamera);
            }
        };
        rotationRef.current = requestAnimationFrame(rotateCamera);

        // Mark Street View as loaded
        streetViewLoadedRef.current = true;

        // Start watchdog to verify Street View stays visible
        startStreetViewWatchdog();
    };

    // Watchdog: Vérifie périodiquement que la Street View est bien visible et la recharge sinon
    const startStreetViewWatchdog = () => {
        // Clear any existing watchdog
        if (streetViewWatchdogRef.current) {
            clearInterval(streetViewWatchdogRef.current);
        }

        let failCount = 0;
        const MAX_FAILS = 3;

        streetViewWatchdogRef.current = setInterval(() => {
            // Only check during PLAYING state
            if (gameStateRef.current !== 'PLAYING') {
                clearInterval(streetViewWatchdogRef.current);
                streetViewWatchdogRef.current = null;
                return;
            }

            // Check if panorama exists and has valid position
            if (!panoramaInstance.current) {
                failCount++;
                console.warn(`[Host Watchdog] No panorama instance (fail ${failCount}/${MAX_FAILS})`);
            } else {
                try {
                    const pos = panoramaInstance.current.getPosition();
                    const visible = panoramaInstance.current.getVisible();
                    if (!pos || !visible) {
                        failCount++;
                        console.warn(`[Host Watchdog] Panorama not visible or no position (fail ${failCount}/${MAX_FAILS})`);
                    } else {
                        // Reset fail count on success
                        failCount = 0;
                    }
                } catch (e) {
                    failCount++;
                    console.warn(`[Host Watchdog] Error checking panorama: ${e.message} (fail ${failCount}/${MAX_FAILS})`);
                }
            }

            // If too many fails, try to reload Street View
            if (failCount >= MAX_FAILS) {
                console.log('[Host Watchdog] Too many fails, reloading Street View...');
                failCount = 0;
                streetViewLoadedRef.current = false;
                initStreetView();
            }
        }, 2000); // Check every 2 seconds
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
                // Reset panorama for fresh start (like nextRound does)
                if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
                rotationRef.current = null;
                panoramaInstance.current = null;

                setGameState('PLAYING');
                setCurrentRound(response.round);
                setTotalRounds(response.total);
                setCorrectLocation(response.location);
                correctLocationRef.current = response.location; // Sync ref for initStreetView
                setGuessedPlayers(new Set());
                setIsEndingRound(false);
                soundManager.play('start');

                // Start timer synchronized with server's roundStartTime
                const duration = response.timePerRound || settings.timePerRound || 60;
                setTimeout(() => {
                    let initialTimeLeft = duration;

                    // Calculate elapsed time based on server's roundStartTime
                    if (response.roundStartTime) {
                        const elapsed = Math.floor((Date.now() - response.roundStartTime) / 1000);
                        initialTimeLeft = Math.max(0, duration - elapsed);
                        console.log(`[Host] Start game timer sync: duration=${duration}, elapsed=${elapsed}, starting at ${initialTimeLeft}s`);
                    }

                    setTimeLeft(initialTimeLeft);
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = setInterval(() => {
                        setTimeLeft(prev => {
                            if (prev <= 10 && prev > 0) soundManager.playTick();
                            if (prev <= 1) {
                                clearInterval(timerRef.current);
                                timerRef.current = null;
                                setTimeout(() => {
                                    if (gameStateRef.current === 'PLAYING') {
                                        endRound();
                                    }
                                }, 100);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }, 200);

                // Force init Street View after DOM is ready (like nextRound does)
                setTimeout(() => {
                    console.log('[HOST] Force initializing Street View for Game Start');
                    initStreetView();
                }, 500);
            } else {
                console.error('Erreur démarrage:', response.error);
            }
        });
    };

    const startTimer = () => {
        const duration = settings.timePerRound || 60;
        console.log('[GEO] startTimer called, duration:', duration);
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
                    // Vérifier qu'on est toujours en PLAYING avant d'appeler endRound
                    setTimeout(() => {
                        if (gameStateRef.current === 'PLAYING') {
                            endRound();
                        } else {
                            console.log('[GEO] Timer expired but not in PLAYING state, skipping endRound');
                        }
                    }, 100);
                    return 0;
                }
                return prev - 1;
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

        // Use roomCodeRef.current to avoid stale closure issues
        const currentRoomCode = roomCodeRef.current || roomCode;

        // Mark that we're triggering this ourselves so the socket listener ignores the broadcast
        isNextRoundPendingRef.current = true;

        // Safety timeout: unlock after 10s if no response
        const safetyTimeout = setTimeout(() => {
            if (isNextRoundPendingRef.current) {
                console.warn('[GEO] nextRound timed out, resetting locks');
                isNextRoundPendingRef.current = false;
            }
        }, 10000);

        socket.emit('geo-next-round', { roomCode: currentRoomCode }, (response) => {
            clearTimeout(safetyTimeout);
            console.log('[GEO] nextRound response:', response);
            if (response.gameOver) {
                setGameState('GAME_END');
                setFinalResults(response.results);
                soundManager.play('win');
            } else if (response.success) {
                setIsEndingRound(false);
                isEndingRoundRef.current = false; // Reset ref for next round

                // Reset graphic/animation refs
                if (rotationRef.current) cancelAnimationFrame(rotationRef.current);
                rotationRef.current = null;
                panoramaInstance.current = null; // Force new instance creation

                setGameState('PLAYING');
                setCurrentRound(response.round);
                setCorrectLocation(response.location);
                correctLocationRef.current = response.location; // Sync ref for initStreetView
                setRoundResults(null);
                setGuessedPlayers(new Set());
                soundManager.play('start');

                // Délai pour s'assurer que le state est mis à jour et que le DOM est prêt
                setTimeout(() => startTimer(), 200);
                // Force re-init Street View with a slightly longer delay to ensure DOM mount
                setTimeout(() => {
                    console.log('[HOST] Force initializing Street View for Next Round');
                    initStreetView();
                }, 500);
            } else {
                console.error('[GEO] nextRound error:', response.error);
            }
            // Reset pending flag
            isNextRoundPendingRef.current = false;
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
        const qrUrl = `${joinUrl}?code=${roomCode}`;

        return (
            <div className="geo-persistent-qr">
                {showQRCode ? (
                    <div className="geo-qr-panel">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl)}`}
                            alt="QR Code"
                        />
                        <div className="geo-qr-panel-info">
                            <div className="geo-qr-panel-code">{roomCode}</div>
                            <div className="geo-qr-panel-hint">Scannez pour rejoindre</div>
                        </div>
                        <button
                            className="geo-qr-toggle-btn mt-2 w-100 justify-content-center"
                            onClick={() => setShowQRCode(false)}
                        >
                            ✕ Masquer
                        </button>
                    </div>
                ) : (
                    <div
                        className="geo-qr-compact"
                        onClick={() => setShowQRCode(true)}
                        title="Afficher le QR code pour rejoindre"
                    >
                        <span className="geo-qr-compact-icon">📱</span>
                        <span className="geo-qr-compact-pin">PIN: {roomCode}</span>
                    </div>
                )}
            </div>
        );
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
                    <div className="d-flex gap-3">
                        <div className="kahoot-qr">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl + '?code=' + roomCode)}`} alt="QR Code Joueur" />
                        </div>
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
                                            { id: 'themeparks', name: 'Parcs d\'Attractions', icon: '🎢' },
                                            { id: 'beaches', name: 'Plages Célèbres', icon: '🏖️' },
                                            { id: 'markets', name: 'Marchés Célèbres', icon: '🛍️' },
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

                                {/* Remote Control QR Code */}
                                <div className="settings-section" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', marginTop: '20px' }}>
                                    <div className="settings-label">📱 Télécommande Admin</div>
                                    <div className="text-center">
                                        <img
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(joinUrl + '?code=' + roomCode + '&mode=remote')}`}
                                            alt="QR Code Télécommande"
                                            style={{ borderRadius: '8px', border: '2px solid var(--neon-blue)' }}
                                        />
                                        <p className="text-muted small mt-2 mb-0">Scannez pour contrôler depuis votre téléphone</p>
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

    // RENDER PLAYING - Vue avec Street View dans une fenêtre + infos latérales
    if (gameState === 'PLAYING') {
        return (
            <div className="geo-lobby-background">
                <div className="geo-playing-layout">
                    {/* Header avec timer et infos */}
                    <div className="geo-playing-header">
                        <div className="geo-playing-badge">
                            <span className="badge-icon">🎯</span>
                            <span className="badge-text">MANCHE {currentRound}/{totalRounds}</span>
                        </div>
                        <div className={`geo-playing-timer ${timeLeft <= 10 ? 'danger' : ''}`}>
                            <span className="timer-icon">⏱️</span>
                            <span className="timer-value">{formatTime(timeLeft)}</span>
                        </div>
                        <div className="geo-playing-badge">
                            <span className="badge-icon">📍</span>
                            <span className="badge-text">PIN: {roomCode}</span>
                        </div>
                    </div>

                    {/* Contenu principal */}
                    <div className="geo-playing-content">
                        {/* Street View dans une fenêtre stylisée */}
                        <div className="geo-playing-streetview-panel">
                            <div className="streetview-frame">
                                <div
                                    key={`sv-${currentRound}`}
                                    ref={streetViewRef}
                                    className="geo-playing-streetview"
                                ></div>
                            </div>

                            {/* Message si tous ont répondu */}
                            {guessedPlayers.size === players.length && players.length > 0 && (
                                <div className="geo-all-answered-banner">
                                    ✅ Tous les joueurs ont répondu !
                                </div>
                            )}
                        </div>

                        {/* Sidebar avec joueurs et scores */}
                        <div className="geo-playing-sidebar">
                            <div className="sidebar-section">
                                <div className="sidebar-header">
                                    <span>👥 Joueurs</span>
                                    <span className="player-count">{guessedPlayers.size}/{players.length}</span>
                                </div>
                                <div className="players-list">
                                    {players.map(player => {
                                        const hasGuessed = guessedPlayers.has(player.id);
                                        return (
                                            <div
                                                key={player.id}
                                                className={`player-row ${player.disconnected ? 'disconnected' : hasGuessed ? 'answered' : 'waiting'}`}
                                            >
                                                <div className="player-avatar">
                                                    {player.avatar ? (
                                                        <img src={player.avatar} alt="" />
                                                    ) : <span>👤</span>}
                                                </div>
                                                <div className="player-info">
                                                    <span className="player-name">{player.name}</span>
                                                    <span className="player-score">{player.totalScore?.toLocaleString() || 0} pts</span>
                                                </div>
                                                <div className="player-status">
                                                    {player.disconnected ? '⚠️' : hasGuessed ? '✅' : '⏳'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Réactions flottantes */}
                            <div className="sidebar-reactions">
                                {reactions.slice(-5).map(reaction => (
                                    <div key={reaction.id} className="reaction-bubble">
                                        <span className="reaction-emoji">{reaction.emoji}</span>
                                        <span className="reaction-player">{reaction.playerName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <PersistentQRCode />
            </div>
        );
    }

    // RENDER ROUND END - Vue améliorée avec Street View + Map + Classement
    if (gameState === 'ROUND_END') {
        return (
            <div className="geo-lobby-background">
                <div className="geo-round-end-layout">
                    {/* Header avec infos principales */}
                    <div className="geo-round-end-header">
                        <div className="geo-round-badge">
                            <span className="badge-icon">🎯</span>
                            <span className="badge-text">MANCHE {currentRound}/{totalRounds}</span>
                        </div>
                        <div className="geo-location-reveal">
                            <span className="location-label">C'était</span>
                            <span className="location-name">{correctLocation?.city}</span>
                            <span className="location-country">{correctLocation?.country}</span>
                        </div>
                        <div className="geo-round-pin">
                            <span className="pin-label">PIN</span>
                            <span className="pin-code">{roomCode}</span>
                        </div>
                    </div>

                    {/* Contenu principal en 3 colonnes */}
                    <div className="geo-round-end-content">
                        {/* Colonne gauche: Street View */}
                        <div className="geo-round-streetview-panel">
                            <div className="panel-header">
                                <span>📍 Vue Street View</span>
                            </div>
                            <div ref={streetViewRef} className="geo-round-streetview"></div>
                        </div>

                        {/* Colonne centrale: Map avec marqueurs */}
                        <div className="geo-round-map-panel">
                            <div className="panel-header">
                                <span>🗺️ Carte des réponses</span>
                            </div>
                            <div ref={mapRef} className="geo-round-map"></div>
                        </div>

                        {/* Colonne droite: Classement */}
                        <div className="geo-round-ranking-panel">
                            <div className="panel-header">
                                <span>🏆 Classement</span>
                            </div>
                            <div className="geo-ranking-list">
                                {roundResults?.map((result, index) => {
                                    // Calculate max score for bar width percentage
                                    const maxScore = roundResults[0]?.roundScore || 1;
                                    const barWidth = Math.max(10, (result.roundScore / maxScore) * 100);
                                    // Assign emojis based on position
                                    const positionEmoji = index === 0 ? '🔥' : index === 1 ? '💪' : index === 2 ? '⭐' : '✨';

                                    return (
                                        <div
                                            key={result.id}
                                            className={`geo-ranking-item ${index === 0 ? 'winner' : ''}`}
                                            style={{ animationDelay: `${index * 0.15}s` }}
                                        >
                                            <div className="ranking-position">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                            </div>
                                            <div className="ranking-avatar">
                                                {result.avatar ? (
                                                    <img src={result.avatar} alt="" />
                                                ) : <span>👤</span>}
                                            </div>
                                            <div className="ranking-info">
                                                <div className="ranking-name">
                                                    {result.name}
                                                    <span className={`ranking-emoji delay-${index % 4}`}>{positionEmoji}</span>
                                                </div>
                                                <div className="ranking-score-bar-container">
                                                    <div
                                                        className="ranking-score-bar"
                                                        style={{
                                                            '--target-width': `${barWidth}%`,
                                                            animationDelay: `${0.3 + index * 0.2}s`
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="ranking-distance">{formatDistance(result.distance)}</div>
                                            </div>
                                            <div className="ranking-scores">
                                                <div className="score-round">+{result.roundScore?.toLocaleString()}</div>
                                                <div className="score-total">{result.totalScore?.toLocaleString()} pts</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Bouton manche suivante */}
                            <div className="geo-next-round-btn-container">
                                <button className="geo-next-round-btn" onClick={nextRound}>
                                    {currentRound >= totalRounds ? '🏁 Résultats finaux' : '➡️ Manche suivante'}
                                </button>
                                {autoNextCountdown && (
                                    <div className="auto-next-timer">
                                        ⏱️ Auto dans {autoNextCountdown}s...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <PersistentQRCode />
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
                                {finalResults?.slice(0, 3).map((result, index) => {
                                    const emoji = index === 0 ? '🏆' : index === 1 ? '🥈' : '🥉';
                                    return (
                                        <div key={result.id} className={`geo-podium-place place-${index + 1} podium-animated`}>
                                            <div className="geo-podium-avatar">
                                                {result.avatar ? (
                                                    <img src={result.avatar} alt="" />
                                                ) : '🌐'}
                                            </div>
                                            <div className="geo-podium-medal">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                                            </div>
                                            <div className="geo-podium-name">
                                                {result.name}
                                                <span className={`ranking-emoji delay-${index + 1}`}>{emoji}</span>
                                            </div>
                                            <div className="geo-podium-score">{result.totalScore?.toLocaleString()} pts</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Awards */}
                            {awards && awards.length > 0 && (
                                <div className="geo-awards mb-5">
                                    <h3 className="text-center mb-3 text-warning" style={{ fontFamily: 'var(--font-display)' }}>🌟 Hall of Fame</h3>
                                    <div className="row justify-content-center g-3">
                                        {awards.map((award, index) => (
                                            <div key={index} className="col-md-4">
                                                <div className="card p-3 h-100 text-center" style={{ border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.4)' }}>
                                                    <div className="display-4 mb-2">{award.icon}</div>
                                                    <h5 className="mb-1" style={{ color: award.type === 'fastest' ? '#ffc107' : award.type === 'astronaut' ? '#bd00ff' : '#aaa' }}>{award.title}</h5>
                                                    <div className="my-2">
                                                        {award.avatar ? (
                                                            <img src={award.avatar} alt="" className="rounded-circle" style={{ width: 50, height: 50, objectFit: 'cover', border: '2px solid white' }} />
                                                        ) : <span className="fs-2">👤</span>}
                                                    </div>
                                                    <div className="fw-bold">{award.playerName}</div>
                                                    <div className="small text-muted">{award.value}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Full Leaderboard */}
                            <div className="card p-4 geo-final-ranking-container">
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
                                <button className="btn btn-outline-secondary btn-lg" onClick={() => navigate('/')}>
                                    🏠 Retour au menu
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <PersistentQRCode />
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
