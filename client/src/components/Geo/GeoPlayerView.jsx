import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const ALL_60_AVATARS = Array.from({ length: 60 }, (_, i) => 
    `/avatars/avatar_${i + 1}.webp`
);

function GeoPlayerView() {
    const navigate = useNavigate();
    const [predefinedAvatars, setPredefinedAvatars] = useState([]);

    // Toggle pop-culture-theme class on body & load random avatars
    useEffect(() => {
        document.body.classList.add('pop-culture-theme');

        // Tirer au sort 6 avatars parmi les 60
        const shuffled = [...ALL_60_AVATARS].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 6);
        setPredefinedAvatars(selected);

        // Si aucun avatar n'est déjà défini par une session, on sélectionne le premier par défaut
        setAvatar(prev => {
            if (!prev) return selected[0];
            return prev;
        });

        return () => {
            document.body.classList.remove('pop-culture-theme');
        };
    }, []);

    const { roomCode: urlRoomCode } = useParams();
    const [step, setStep] = useState('JOIN'); // JOIN, WAITING, PLAYING, GUESSED, ROUND_END, GAME_END
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [pseudo, setPseudo] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [error, setError] = useState('');

    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [currentLocation, setCurrentLocation] = useState(null);

    const [guessMarker, setGuessMarker] = useState(null);
    const [myScore, setMyScore] = useState(0);
    const [myRoundScore, setMyRoundScore] = useState(0);
    const [myDistance, setMyDistance] = useState(null);
    const [roundResults, setRoundResults] = useState(null);
    const [correctLocation, setCorrectLocation] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [awards, setAwards] = useState([]);
    const [selectedRegions, setSelectedRegions] = useState(['world']); // Regions from host settings

    // New states for neo-brutalism design
    const [players, setPlayers] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [activeTab, setActiveTab] = useState('Explore');

    // UX States
    const [isLoading, setIsLoading] = useState(false);
    const [isJoining, setIsJoining] = useState(false); // Loading state for join button
    const [isRestoring, setIsRestoring] = useState(false); // Restoring session from localStorage
    const [pointsAnimation, setPointsAnimation] = useState(null); // { score: 1000 }
    const [reactionCooldown, setReactionCooldown] = useState(false); // Cooldown for emoji reactions
    const [showMap, setShowMap] = useState(false); // Toggle Street View / Map plein écran
    const [performanceMode, setPerformanceMode] = useState(() => {
        return localStorage.getItem('geoPerformanceMode') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('geoPerformanceMode', performanceMode);
    }, [performanceMode]);

    const streetViewRef = useRef(null);
    const mapRef = useRef(null);
    const resultsMapRef = useRef(null);
    const panoramaInstance = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const timerRef = useRef(null);
    const roundStartTimeRef = useRef(null); // For smooth timer interpolation
    const timerDurationRef = useRef(null); // For smooth timer interpolation
    
    // Global flags for reliable API loading
    const googleMapsLoadingRef = useRef(false);
    const googleMapsReadyRef = useRef(false);
    const stepRef = useRef('JOIN'); // Miroir de step pour les callbacks socket (pas de stale closure)

    // Restore session and handle connections
    useEffect(() => {
        // 1. Handle URL Params (QR Code Priority)
        const urlParams = new URLSearchParams(window.location.search);
        const urlCode = urlParams.get('code');
        const isNewGame = urlParams.get('newgame') === '1';

        // 2. Clear session if explicit newgame
        if (isNewGame) {
            localStorage.removeItem('geoSession');
            if (urlCode) setRoomCode(urlCode.toUpperCase());
            return;
        }

        // 3. Check LocalStorage
        const savedSession = localStorage.getItem('geoSession');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);

                // CRITICAL: If URL code is different from stored code, user scanned a NEW QR.
                if (urlCode && session.roomCode !== urlCode.toUpperCase()) {
                    console.log('[Player] New room code in URL, ignoring saved session room');
                    setRoomCode(urlCode.toUpperCase());
                    if (session.pseudo) setPseudo(session.pseudo);
                    if (session.avatar) setAvatar(session.avatar);
                    return;
                }

                // Otherwise, try to restore session (Auto-Rejoin)
                if (session.roomCode && session.pseudo) {
                    setIsRestoring(true);
                    setRoomCode(session.roomCode);
                    setPseudo(session.pseudo);
                    if (session.avatar) setAvatar(session.avatar);
                    if (session.myScore !== undefined) setMyScore(session.myScore);

                    // Bug #2 fix: attendre que le socket soit connecté avant d'émettre
                    if (socket.connected) {
                        doJoin(session.roomCode, session.pseudo, session.avatar);
                    } else {
                        socket.once('connect', () => {
                            doJoin(session.roomCode, session.pseudo, session.avatar);
                        });
                    }
                }
            } catch (e) {
                console.error('[Player] Session parse error', e);
                localStorage.removeItem('geoSession');
                if (urlCode) setRoomCode(urlCode.toUpperCase());
            }
        } else if (urlCode) {
            setRoomCode(urlCode.toUpperCase());
        }

        // 4. Socket Reconnection Handling (Mobile Stability)
        // Bug #3 fix: on ignore handleConnect sur le premier connect si socket.once est déjà enregistré
        // On utilise stepRef pour ne rejoindre silencieusement que si on était déjà dans le jeu
        const handleConnect = () => {
            console.log('[Player] Socket connected/reconnected');
            // Ignorer si on n'est pas encore entré dans le jeu (JOIN ou WAITING = pas de session active)
            const currentStep = stepRef.current;
            if (currentStep === 'JOIN') return;

            // Reconnexion après une déconnexion socket (on était en partie)
            const currentSession = localStorage.getItem('geoSession');
            if (currentSession) {
                try {
                    const s = JSON.parse(currentSession);
                    if (s.roomCode && s.pseudo) {
                        console.log('[Player] Auto-rejoining after reconnect...');
                        doJoin(s.roomCode, s.pseudo, s.avatar, true);
                    }
                } catch {}
            }
        };

        socket.on('connect', handleConnect);

        return () => {
            socket.off('connect', handleConnect);
        };
    }, []);

    // Helper to join room (refactored to be reusable)
    const doJoin = (code, name, userAvatar, silent = false) => {
        if (!silent) setIsJoining(true);

        socket.emit('geo-join-room', {
            roomCode: code.toUpperCase(),
            playerName: name,
            avatar: userAvatar
        }, (response) => {
            if (!silent) {
                setIsJoining(false);
                setIsRestoring(false);
            }

            if (response.error) {
                if (!silent) {
                    console.error('[Player] Join error:', response.error);
                    setError('Session expirée ou invalide.');
                    localStorage.removeItem('geoSession');
                }
            } else if (response.reconnected || response.success) {
                // Success
                setStep(response.gameState);
                setCurrentRound(response.currentRound);
                setTotalRounds(response.totalRounds);
                setCurrentLocation(response.location);
                if (response.myScore !== undefined) setMyScore(response.myScore);

                // Re-sync timer with smooth interpolation
                if (response.gameState === 'PLAYING' && response.roundStartTime && response.timePerRound) {
                    startTimer(response.timePerRound, response.roundStartTime);
                } else if (response.gameState === 'PLAYING') {
                    startTimer(60);
                }
            } else {
                if (!silent) setStep('WAITING');
            }
        });
    };

    // Sync stepRef with step state (needed for socket callbacks without stale closures)
    useEffect(() => {
        stepRef.current = step;
    }, [step]);

    useEffect(() => {
        // Game events
        socket.on('geo-game-started', (data) => {
            setStep('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total);
            setCurrentLocation(data.location);
            setGuessMarker(null);
            setMyRoundScore(0);
            markerInstance.current = null;
            setIsLoading(true);
            setSelectedRegions(data.mapType || ['world']);
            setShowMap(false);
            soundManager.play('start');

            // Calculate remaining time based on server's roundStartTime
            const duration = data.timePerRound || 60;
            if (data.roundStartTime) {
                startTimer(duration, data.roundStartTime);
            } else {
                startTimer(duration);
            }
        });

        socket.on('geo-round-ended', (data) => {
            if (timerRef.current) clearInterval(timerRef.current);
            setStep('ROUND_END');
            setRoundResults(data.results);
            setCorrectLocation(data.correctLocation);

            // Trouver mes résultats
            const myResult = data.results?.find(r => r.id === socket.id);
            if (myResult) {
                setMyScore(myResult.totalScore);
                setMyRoundScore(myResult.roundScore);
                setMyDistance(myResult.distance);
                // Persist score in localStorage for reconnection
                const session = JSON.parse(localStorage.getItem('geoSession') || '{}');
                if (session.roomCode) {
                    session.myScore = myResult.totalScore;
                    localStorage.setItem('geoSession', JSON.stringify(session));
                }
            }
            soundManager.play('end');
        });

        socket.on('geo-next-round', (data) => {
            setStep('PLAYING');
            setCurrentRound(data.round);
            setCurrentLocation(data.location);
            setGuessMarker(null);
            setMyRoundScore(0);
            markerInstance.current = null;
            setIsLoading(true);
            setShowMap(false);
            soundManager.play('start');

            // Calculate remaining time based on server's roundStartTime
            const duration = data.timePerRound || 60;
            if (data.roundStartTime) {
                startTimer(duration, data.roundStartTime);
            } else {
                startTimer(duration);
            }
        });

        // When host requests a new location (no Street View coverage)
        socket.on('geo-location-changed', (data) => {
            console.log('[Player] Location changed:', data.location?.city);
            setCurrentLocation(data.location);
            setIsLoading(true); // Re-trigger loading
        });

        socket.on('geo-game-over', (data) => {
            if (timerRef.current) clearInterval(timerRef.current);
            setStep('GAME_END');
            setFinalResults(data.results);
            setAwards(data.awards || []);
            // soundManager.play('win');
            // Clear session on game over
            localStorage.removeItem('geoSession');
            setChatMessages([]);
        });

        socket.on('geo-host-disconnected', () => {
            setError('L\'hôte a quitté la partie');
            setStep('JOIN');
            localStorage.removeItem('geoSession');
        });

        socket.on('geo-kicked', () => {
            setStep('JOIN');
            setError('Vous avez été exclu de la partie par l\'hôte.');
            setRoomCode('');
            localStorage.removeItem('geoSession');
        });

        socket.on('geo-game-restarted', () => {
            setStep('WAITING');
            setMyScore(0);
            setMyRoundScore(0);
            setMyDistance(null);
            setRoundResults(null);
            setFinalResults(null);
            setAwards([]);
            setGuessMarker(null);
            setPointsAnimation(null);
            setChatMessages([]);
        });

        socket.on('geo-player-joined', (playersList) => {
            console.log('[Player] geo-player-joined:', playersList);
            setPlayers(playersList || []);
        });

        socket.on('geo-player-left', (playersList) => {
            console.log('[Player] geo-player-left:', playersList);
            setPlayers(playersList || []);
        });

        socket.on('geo-chat-message', (msg) => {
            setChatMessages(prev => [...prev, msg].slice(-50));
            setTimeout(() => {
                const chatContainer = document.getElementById('chat-messages-container');
                if (chatContainer) {
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            }, 50);
        });

        return () => {
            socket.off('geo-game-started');
            socket.off('geo-round-ended');
            socket.off('geo-next-round');
            socket.off('geo-location-changed');
            socket.off('geo-game-over');
            socket.off('geo-host-disconnected');
            socket.off('geo-kicked');
            socket.off('geo-game-restarted');
            socket.off('geo-player-joined');
            socket.off('geo-player-left');
            socket.off('geo-chat-message');
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Load Google Maps API with guarantee that window.google.maps is available
    useEffect(() => {
        const loadGoogleMapsAPI = async () => {
            // Already loaded or loading
            if (googleMapsReadyRef.current) {
                console.log('[Player] Google Maps API already ready');
                return;
            }
            if (googleMapsLoadingRef.current) {
                console.log('[Player] Google Maps API already loading');
                return;
            }

            googleMapsLoadingRef.current = true;

            // Check if already present
            if (window.google?.maps?.StreetViewService) {
                console.log('[Player] Google Maps API already available on window');
                googleMapsReadyRef.current = true;
                googleMapsLoadingRef.current = false;
                return;
            }

            console.log('[Player] Starting Google Maps API load...');
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
            script.async = true;

            return new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('[Player] Google Maps script loaded, waiting for window.google.maps...');
                    
                    // Poll for window.google.maps.StreetViewService
                    let attempts = 0;
                    const checkInterval = setInterval(() => {
                        attempts++;
                        if (window.google?.maps?.StreetViewService) {
                            clearInterval(checkInterval);
                            console.log('[Player] ✓ window.google.maps.StreetViewService is ready after', attempts, 'checks');
                            googleMapsReadyRef.current = true;
                            googleMapsLoadingRef.current = false;
                            resolve();
                        } else if (attempts > 50) { // Timeout after 5 seconds (50 * 100ms)
                            clearInterval(checkInterval);
                            console.error('[Player] ✗ Timeout waiting for window.google.maps.StreetViewService');
                            googleMapsLoadingRef.current = false;
                            reject(new Error('Google Maps API timeout'));
                        }
                    }, 100);
                };

                script.onerror = () => {
                    console.error('[Player] ✗ Failed to load Google Maps API script');
                    googleMapsLoadingRef.current = false;
                    reject(new Error('Failed to load Google Maps API'));
                };

                document.head.appendChild(script);
            }).catch(error => {
                console.error('[Player] Google Maps loading error:', error);
                googleMapsLoadingRef.current = false;
            });
        };

        loadGoogleMapsAPI();
    }, []);

    // Init Street View when playing (only when API is ready)
    useEffect(() => {
        let timeoutId;

        if (step === 'PLAYING' && currentLocation && googleMapsReadyRef.current) {
            // Delay to ensure DOM is ready
            timeoutId = setTimeout(() => {
                initMaps();
            }, 100);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [step, currentLocation, currentRound]);

    // Prevent iOS Safari page scroll/bounce when dragging the guess map or streetview
    useEffect(() => {
        if (step === 'PLAYING') {
            const originalOverflow = document.body.style.overflow;
            const originalPosition = document.body.style.position;
            const originalWidth = document.body.style.width;
            const originalHeight = document.body.style.height;

            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.width = '100%';
            document.body.style.height = '100%';

            const preventDefaultScroll = (e) => {
                // Allow touch gestures inside map and streetview
                const isInsideMap = e.target.closest('.geo-player-map') || e.target.closest('.gm-style');
                const isInsideStreetView = e.target.closest('.geo-player-streetview') || e.target.closest('#streetview-container');
                
                if (!isInsideMap && !isInsideStreetView) {
                    if (e.cancelable) e.preventDefault();
                }
            };

            document.addEventListener('touchmove', preventDefaultScroll, { passive: false });

            return () => {
                document.body.style.overflow = originalOverflow;
                document.body.style.position = originalPosition;
                document.body.style.width = originalWidth;
                document.body.style.height = originalHeight;
                document.removeEventListener('touchmove', preventDefaultScroll);
            };
        }
    }, [step]);

    // Keep screen awake (Wake Lock)
    useEffect(() => {
        let wakeLock = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    if (wakeLock && !wakeLock.released) {
                        return; // already active
                    }
                    wakeLock = await navigator.wakeLock.request('screen');
                    console.log('[Player] Wake Lock acquired successfully');
                }
            } catch (err) {
                console.warn('[Player] Wake Lock request failed:', err.message);
            }
        };

        if (step !== 'JOIN') {
            requestWakeLock();
        }

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible' && step !== 'JOIN') {
                await requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) {
                wakeLock.release().then(() => {
                    wakeLock = null;
                    console.log('[Player] Wake Lock released');
                });
            }
        };
    }, [step]);

    // Confetti celebration animation for GAME_END
    useEffect(() => {
        if (step !== 'GAME_END' || performanceMode) return; // Désactiver si mode performance actif

        const container = document.getElementById('confetti-container');
        if (!container) return;

        const colors = ['#ffd700', '#8d00d9', '#ac2471', '#aa30fa', '#e9c400', '#161a33'];
        const shapes = ['★', '◆', '●', '▲', '■'];
        const activePieces = [];
        let intervalId;

        const createPiece = () => {
            const piece = document.createElement('div');
            const size = Math.random() * 20 + 10;
            piece.className = 'confetti-particle flex items-center justify-center font-bold select-none';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.top = '-5vh';
            piece.style.color = colors[Math.floor(Math.random() * colors.length)];
            piece.style.fontSize = size + 'px';
            piece.style.opacity = Math.random().toString();
            piece.innerText = shapes[Math.floor(Math.random() * shapes.length)];
            
            const duration = Math.random() * 3 + 4;
            piece.style.animation = `confetti-fall ${duration}s linear forwards`;
            
            container.appendChild(piece);
            activePieces.push(piece);
            
            setTimeout(() => {
                piece.remove();
                const index = activePieces.indexOf(piece);
                if (index > -1) activePieces.splice(index, 1);
            }, duration * 1000);
        };

        // Initial burst
        for (let i = 0; i < 30; i++) {
            setTimeout(createPiece, Math.random() * 2000);
        }

        // Continuous stream
        intervalId = setInterval(createPiece, 300);

        return () => {
            clearInterval(intervalId);
            activePieces.forEach(p => p.remove());
        };
    }, [step, performanceMode]);

    // Init results map (only when API is ready)
    useEffect(() => {
        if (step === 'ROUND_END' && googleMapsReadyRef.current && resultsMapRef.current && correctLocation) {
            initResultsMap();
        }
    }, [step, roundResults]);

    // Init guess map for GUESSED view (only when API is ready)
    useEffect(() => {
        if (step === 'GUESSED' && googleMapsReadyRef.current && mapRef.current && guessMarker) {
            const map = new window.google.maps.Map(mapRef.current, {
                center: { lat: guessMarker.lat, lng: guessMarker.lng },
                zoom: 5,
                mapTypeId: 'hybrid',
                disableDefaultUI: true,
                gestureHandling: 'none'
            });

            new window.google.maps.Marker({
                position: { lat: guessMarker.lat, lng: guessMarker.lng },
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }
            });
        }
    }, [step, guessMarker]);

    const initMaps = () => {
        // Verify API is loaded
        if (!window.google?.maps?.StreetViewService) {
            console.warn('[Player] initMaps called but google.maps not ready, will retry');
            setTimeout(() => {
                if (step === 'PLAYING' && googleMapsReadyRef.current) {
                    initMaps();
                }
            }, 500);
            return;
        }

        // Street View - use StreetViewService to find nearest coverage
        if (streetViewRef.current && currentLocation) {
            const streetViewService = new window.google.maps.StreetViewService();
            const position = { lat: currentLocation.lat, lng: currentLocation.lng };

            // Check for Street View coverage within 500m radius
            streetViewService.getPanorama({ location: position, radius: 500 }, (data, status) => {
                if (status === 'OK') {
                    const verifiedPosition = data.location.latLng;
                    console.log('[Player] ✓ Street View coverage found at:', verifiedPosition.lat(), verifiedPosition.lng());

                    // Create or update panorama with verified position
                    if (panoramaInstance.current && streetViewRef.current.hasChildNodes()) {
                        panoramaInstance.current.setPosition(verifiedPosition);
                        panoramaInstance.current.setPov({
                            heading: Math.random() * 360,
                            pitch: 0
                        });
                        panoramaInstance.current.setVisible(true);
                    } else {
                        console.log('[Player] Creating new StreetViewPanorama instance with interactive controls');
                        panoramaInstance.current = new window.google.maps.StreetViewPanorama(
                            streetViewRef.current,
                            {
                                position: verifiedPosition,
                                pov: { heading: Math.random() * 360, pitch: 0 },
                                zoom: 1,
                                addressControl: false,
                                showRoadLabels: false,
                                linksControl: false,
                                panControl: true,
                                zoomControl: false,
                                enableCloseButton: false,
                                fullscreenControl: false,
                                visible: true,
                                motionTracking: false,
                                motionTrackingControl: false,
                                disableDefaultUI: true
                            }
                        );
                    }
                    setIsLoading(false);
                } else {
                    console.warn('[Player] ✗ No Street View coverage, status:', status);
                    // Fallback: try with original position anyway
                    if (!panoramaInstance.current) {
                        panoramaInstance.current = new window.google.maps.StreetViewPanorama(
                            streetViewRef.current,
                            {
                                position: position,
                                pov: { heading: Math.random() * 360, pitch: 0 },
                                zoom: 1,
                                addressControl: false,
                                showRoadLabels: false,
                                linksControl: false,
                                panControl: true,
                                zoomControl: false,
                                enableCloseButton: false,
                                fullscreenControl: false,
                                visible: true,
                                motionTracking: false,
                                motionTrackingControl: false,
                                disableDefaultUI: true
                            }
                        );
                    }
                    setIsLoading(false);
                }
            });
        }

        // Mini map for guessing - center on selected region
        if (mapRef.current) {
            // Define region bounds
            const regionBounds = {
                world: { center: { lat: 20, lng: 0 }, zoom: 1 },
                europe: { center: { lat: 50, lng: 10 }, zoom: 3 },
                asia: { center: { lat: 35, lng: 100 }, zoom: 3 },
                africa: { center: { lat: 5, lng: 20 }, zoom: 3 },
                americas: { center: { lat: 10, lng: -80 }, zoom: 2 },
                oceania: { center: { lat: -25, lng: 140 }, zoom: 3 },
                france: { center: { lat: 46.5, lng: 2.5 }, zoom: 5 },
                usa: { center: { lat: 39, lng: -98 }, zoom: 4 },
                reunion: { center: { lat: -21.1, lng: 55.5 }, zoom: 9 }
            };

            // Get center/zoom from first selected region (or world if multiple)
            const firstRegion = selectedRegions.length === 1 ? selectedRegions[0] : 'world';
            const bounds = regionBounds[firstRegion] || regionBounds.world;

            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: bounds.center,
                zoom: bounds.zoom,
                mapTypeId: 'hybrid', // Vue satellite avec labels
                disableDefaultUI: true,
                zoomControl: false, // Disable zoom buttons to fix mini map overlap
                gestureHandling: 'greedy'
            });

            mapInstance.current.addListener('click', (e) => {
                if (step !== 'PLAYING') return;

                const lat = e.latLng.lat();
                const lng = e.latLng.lng();

                setGuessMarker({ lat, lng });

                // Update or create marker
                if (markerInstance.current) {
                    markerInstance.current.setPosition({ lat, lng });
                } else {
                    markerInstance.current = new window.google.maps.Marker({
                        position: { lat, lng },
                        map: mapInstance.current,
                        icon: {
                            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                        },
                        draggable: true
                    });

                    markerInstance.current.addListener('dragend', (de) => {
                        setGuessMarker({
                            lat: de.latLng.lat(),
                            lng: de.latLng.lng()
                        });
                    });
                }
            });
        }
    };

    const initResultsMap = () => {
        const bounds = new window.google.maps.LatLngBounds();

        const map = new window.google.maps.Map(resultsMapRef.current, {
            center: { lat: correctLocation.lat, lng: correctLocation.lng },
            zoom: 3,
            // styles: darkMapStyle
        });

        // Correct location marker
        new window.google.maps.Marker({
            position: { lat: correctLocation.lat, lng: correctLocation.lng },
            map: map,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
            },
            title: `${correctLocation.city}, ${correctLocation.country}`
        });
        bounds.extend({ lat: correctLocation.lat, lng: correctLocation.lng });

        // My guess
        const myResult = roundResults?.find(r => r.id === socket.id);
        if (myResult?.guess) {
            new window.google.maps.Marker({
                position: { lat: myResult.guess.lat, lng: myResult.guess.lng },
                map: map,
                icon: {
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                },
                title: 'Ma réponse'
            });
            bounds.extend({ lat: myResult.guess.lat, lng: myResult.guess.lng });

            // Line
            new window.google.maps.Polyline({
                path: [
                    { lat: myResult.guess.lat, lng: myResult.guess.lng },
                    { lat: correctLocation.lat, lng: correctLocation.lng }
                ],
                map: map,
                strokeColor: '#ff0055',
                strokeOpacity: 0.8,
                strokeWeight: 3
            });
        }

        map.fitBounds(bounds, 50);
    };

    const startTimer = (duration, roundStartTime = null) => {
        // Store refs for smooth interpolation
        roundStartTimeRef.current = roundStartTime || Date.now();
        timerDurationRef.current = duration;

        // Set initial time
        if (roundStartTime) {
            const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
            setTimeLeft(Math.max(0, duration - elapsed));
        } else {
            setTimeLeft(duration);
        }

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                // Use server time for smooth interpolation to avoid jitter
                const startTime = roundStartTimeRef.current || Date.now();
                const dur = timerDurationRef.current || duration;
                
                if (startTime && dur) {
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.max(0, dur - elapsed);
                    
                    if (remaining <= 10 && remaining > 0) soundManager.playTick();
                    if (remaining <= 0) {
                        clearInterval(timerRef.current);
                        return 0;
                    }
                    return remaining;
                } else {
                    // Fallback to simple decrement
                    if (prev <= 10 && prev > 0) soundManager.playTick();
                    if (prev <= 1) {
                        clearInterval(timerRef.current);
                        return 0;
                    }
                    return prev - 1;
                }
            });
        }, 1000);
    };

    const joinRoom = () => {
        if (!roomCode || !pseudo) {
            setError('Code et pseudo requis');
            return;
        }

        setIsJoining(true); // Start loading
        setError('');

        socket.emit('geo-join-room', {
            roomCode: roomCode.toUpperCase(),
            playerName: pseudo,
            avatar
        }, (response) => {
            setIsJoining(false); // Stop loading

            if (response.error) {
                setError(response.error);
            } else if (response.reconnected) {
                // Gestion de la reconnexion
                setStep(response.gameState); // PLAYING ou ROUND_END normalement
                setCurrentRound(response.currentRound);
                setTotalRounds(response.totalRounds);
                setCurrentLocation(response.location);
                setError(null);

                // Save session for future refresh
                localStorage.setItem('geoSession', JSON.stringify({
                    roomCode: roomCode.toUpperCase(),
                    pseudo,
                    avatar
                }));

                // Si on est en PLAYING, on relance le timer synchronisé
                if (response.gameState === 'PLAYING' && response.roundStartTime && response.timePerRound) {
                    const elapsed = Math.floor((Date.now() - response.roundStartTime) / 1000);
                    const remaining = Math.max(0, response.timePerRound - elapsed);
                    startTimer(remaining);
                } else if (response.gameState === 'PLAYING') {
                    startTimer(60);
                }
            } else if (response.lateJoin) {
                console.log('[Player] Late join - joining game in progress');
                setStep(response.gameState);
                setCurrentRound(response.currentRound);
                setTotalRounds(response.totalRounds);
                setCurrentLocation(response.location);
                setError(null);

                // Save session
                localStorage.setItem('geoSession', JSON.stringify({
                    roomCode: roomCode.toUpperCase(),
                    pseudo,
                    avatar
                }));

                // Si on rejoint pendant PLAYING, démarrer le timer synchronisé
                if (response.gameState === 'PLAYING' && response.roundStartTime && response.timePerRound) {
                    const elapsed = Math.floor((Date.now() - response.roundStartTime) / 1000);
                    const remaining = Math.max(0, response.timePerRound - elapsed);
                    startTimer(remaining);
                    soundManager.play('start');
                }
            } else {
                setStep('WAITING');
                setError(null);

                // Save session for future refresh
                localStorage.setItem('geoSession', JSON.stringify({
                    roomCode: roomCode.toUpperCase(),
                    pseudo,
                    avatar
                }));
            }
        });
    };

    const leaveGame = () => {
        if (window.confirm('Voulez-vous vraiment quitter la partie ?')) {
            localStorage.removeItem('geoSession');
            setStep('JOIN');
            setRoomCode('');
            setPseudo('');
            setAvatar(predefinedAvatars[0] || ALL_60_AVATARS[0]);
            setMyScore(0);
            setCurrentRound(0);
            setRoundResults(null);
            setFinalResults(null);
            setAwards([]);
            setCurrentLocation(null);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const returnToSalon = () => {
        localStorage.removeItem('geoSession');
        setStep('JOIN');
        setRoomCode('');
        setPseudo('');
        setAvatar(predefinedAvatars[0] || ALL_60_AVATARS[0]);
        setMyScore(0);
        setCurrentRound(0);
        setRoundResults(null);
        setFinalResults(null);
        setAwards([]);
        setCurrentLocation(null);
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const submitGuess = () => {
        if (!guessMarker) {
            setError('Cliquez sur la carte pour placer votre réponse!');
            return;
        }

        socket.emit('geo-submit-guess', {
            roomCode: roomCode.toUpperCase(),
            lat: guessMarker.lat,
            lng: guessMarker.lng
        }, (response) => {
            if (response.success) {
                setStep('GUESSED');
                setMyDistance(response.distance);
                setMyRoundScore(response.score);
                setMyScore(prev => prev + response.score);
                setShowMap(false); // Revenir sur Street View pour voir l'animation

                // Show points animation
                setPointsAnimation({
                    score: response.score,
                    bonus: response.breakdown?.time
                });
                soundManager.play('pop');
                setTimeout(() => setPointsAnimation(null), 3000);
            }
        });
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Bug #15 fix: redimensionner à 128x128 pour éviter les gros transferts socket
                const MAX = 128;
                const canvas = document.createElement('canvas');
                const scale = Math.min(MAX / img.width, MAX / img.height, 1);
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setAvatar(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDistance = (km) => {
        if (km === null || km === undefined) return '-';
        if (km < 1) return `${Math.round(km * 1000)} m`;
        return `${Math.round(km)} km`;
    };

    const sendChatMessage = () => {
        if (!chatInput.trim()) return;
        socket.emit('geo-chat-message', {
            roomCode: roomCode.toUpperCase(),
            playerName: pseudo,
            message: chatInput.trim()
        });
        setChatInput('');
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'GeoTrackr',
                text: `Rejoins ma partie GeoTrackr ! Mon score : ${myScore} PTS`,
                url: window.location.href,
            }).catch(err => console.log(err));
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert('Lien de partage copié dans le presse-papier !');
        }
    };

    const [roundEndCountdown, setRoundEndCountdown] = useState(15);

    useEffect(() => {
        if (step === 'ROUND_END') {
            setRoundEndCountdown(15);
            const interval = setInterval(() => {
                setRoundEndCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [step]);

    const renderJoinScreen = () => {
        return (
            <div className="w-full flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-[340px] flex flex-col gap-4">
                    {/* Title */}
                    <div className="w-full text-center mt-2 flex flex-col items-center">
                        <h2 className="text-2xl font-black text-on-background text-center uppercase italic tracking-tighter mb-1 rotate-[-2deg] font-headline-xl">
                            REJOINDRE LA PARTIE
                        </h2>
                        <p className="text-[10px] text-center font-bold text-secondary uppercase tracking-wider">
                            Entre tes infos pour entrer dans l'arène
                        </p>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold shadow-sm" role="alert">
                            {error}
                        </div>
                    )}

                    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); joinRoom(); }}>
                        {/* Box 1: Room Code */}
                        <div className="bg-white border-[3px] border-on-background p-4 neo-shadow rounded-xl flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-secondary tracking-wider" htmlFor="roomCode">Code de la Room</label>
                            <input 
                                className="w-full p-2.5 border-[3px] border-on-background font-bold text-xs uppercase placeholder:text-on-background/30 focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg" 
                                id="roomCode" 
                                maxLength={6}
                                placeholder="EX: X7Z-99" 
                                type="text"
                                value={roomCode}
                                onChange={(e) => !urlRoomCode && setRoomCode(e.target.value.toUpperCase())}
                                readOnly={!!urlRoomCode}
                                style={urlRoomCode ? { cursor: 'not-allowed', opacity: 0.7 } : {}}
                            />
                        </div>

                        {/* Box 2: Pseudo */}
                        <div className="bg-white border-[3px] border-on-background p-4 neo-shadow rounded-xl flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-secondary tracking-wider" htmlFor="pseudo">Ton Pseudo</label>
                            <input 
                                className="w-full p-2.5 border-[3px] border-on-background font-bold text-xs placeholder:text-on-background/30 focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg" 
                                id="pseudo" 
                                placeholder="PLAYER_ONE" 
                                type="text"
                                value={pseudo}
                                onChange={(e) => setPseudo(e.target.value)}
                            />
                        </div>

                        {/* Box 3: Avatar selection */}
                        <div className="bg-white border-[3px] border-on-background p-4 neo-shadow rounded-xl flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-secondary tracking-wider">Choisis ton Avatar</label>
                            <div className="grid grid-cols-3 gap-2">
                                {predefinedAvatars.map((url, idx) => {
                                    const isActive = avatar === url;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            className={`aspect-square border-[3px] border-on-background rounded-lg bg-[#fbf8ff] overflow-hidden p-1 transition-all relative ${
                                                isActive
                                                    ? 'border-[#ffe16d] ring-4 ring-[#ffe16d] scale-105 shadow-[3px_3px_0px_0px_rgba(22,26,51,1)]'
                                                    : 'hover:scale-105 shadow-[2px_2px_0px_0px_rgba(22,26,51,1)]'
                                            }`}
                                            onClick={() => setAvatar(url)}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover rounded-md" />
                                        </button>
                                    );
                                })}
                            </div>
                            
                            {/* Custom upload option */}
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-outline-variant">
                                <span className="text-[9px] font-bold text-on-background/70 uppercase">Ou image perso :</span>
                                <label className="cursor-pointer bg-white border-2 border-on-background text-on-background hover:bg-on-background hover:text-white transition-all text-[9px] font-black py-1 px-2 rounded flex items-center gap-1 active:translate-y-[1px]">
                                    <span className="material-symbols-outlined text-xs font-black">add_photo_alternate</span>
                                    Image
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleAvatarUpload}
                                    />
                                </label>
                            </div>
                            {avatar && !ALL_60_AVATARS.includes(avatar) && (
                                <div className="mt-1 flex items-center gap-2 bg-surface-container-low p-1.5 rounded-lg border-2 border-on-background w-fit">
                                    <img src={avatar} alt="Perso" className="w-6 h-6 rounded-full object-cover border border-secondary" />
                                    <span className="text-[9px] text-on-background font-bold uppercase">Image perso importée</span>
                                </div>
                            )}
                        </div>

                        {/* Box 4: Performance Mode */}
                        <div className="bg-white border-[3px] border-on-background p-4 neo-shadow rounded-xl flex items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                                <label className="text-[10px] font-black uppercase text-secondary tracking-wider" htmlFor="perfMode">Mode Performance</label>
                                <span className="text-[8px] text-on-background/70 font-semibold uppercase">Désactive les confettis et animations pour les vieux téléphones</span>
                            </div>
                            <input 
                                id="perfMode"
                                type="checkbox"
                                className="w-5 h-5 accent-secondary border-2 border-on-background rounded cursor-pointer"
                                checked={performanceMode}
                                onChange={(e) => setPerformanceMode(e.target.checked)}
                            />
                        </div>

                        {/* Submit button */}
                        <button 
                            className="btn-join w-full bg-[#ffe16d] text-on-background font-black py-3.5 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            type="submit"
                            disabled={isJoining}
                        >
                            {isJoining ? (
                                <>
                                    <div className="w-4 h-4 rounded-full border-2 border-on-background border-t-transparent animate-spin"></div>
                                    <span className="text-xs font-black uppercase tracking-wider">CONNEXION...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-xs font-black uppercase tracking-wider">REJOINDRE LA PARTIE</span>
                                    <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    <button 
                        type="button"
                        className="text-[9px] font-black text-secondary hover:text-secondary/80 transition-colors flex items-center justify-center gap-1 mx-auto uppercase tracking-wide mt-2"
                        onClick={() => navigate('/geo')}
                    >
                        <span className="material-symbols-outlined text-xs font-bold">arrow_back</span>
                        Retour au menu
                    </button>
                </div>
            </div>
        );
    };

    const renderWaitingScreen = () => {
        return (
            <div className="w-full flex flex-col justify-between p-3 gap-4 overflow-y-auto">
                {/* Status Banner */}
                <div className="bg-[#bd00ff] text-white border-[3px] border-on-background p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#161a33] rotate-[-2deg] flex-shrink-0 flex items-center justify-center">
                    <h1 className="text-base font-black text-center uppercase tracking-widest italic font-headline-lg">
                        EN ATTENTE DU LANCEMENT
                    </h1>
                </div>

                {/* Main Content Bento */}
                <div className="flex flex-col gap-4">
                    {/* User Profile Card */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-3">
                            <h2 className="text-xs font-black uppercase text-secondary">Ton Profil</h2>
                            <span className="bg-[#ffc2eb] text-on-background font-bold text-[9px] px-2 py-0.5 border-2 border-on-background rounded-full">
                                PIN: {roomCode}
                            </span>
                        </div>
                        <div className="flex flex-col items-center py-2">
                            <div className="w-20 h-20 rounded-full border-[3px] border-on-background bg-[#dee0ff] mb-3 overflow-hidden shadow-sm">
                                {avatar ? (
                                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-base flex items-center justify-center h-full">person</span>
                                )}
                            </div>
                            <span className="text-sm font-black uppercase text-on-background">{pseudo}</span>
                            <div className="mt-1.5 bg-on-background text-white text-[9px] font-bold px-3 py-0.5 rounded-full uppercase">
                                Agent de Terrain
                            </div>
                        </div>
                        <div className="space-y-2 mb-2">
                            <div className="flex justify-between items-center bg-white border-2 border-on-background p-2 rounded-lg font-black text-xs">
                                <span className="text-[10px] font-black uppercase">Compétences</span>
                                <span className="material-symbols-outlined text-sm">bolt</span>
                            </div>
                            <div className="flex justify-between items-center bg-white border-2 border-on-background p-2 rounded-lg font-black text-xs">
                                <span className="text-[10px] font-black uppercase">Équipement</span>
                                <span className="material-symbols-outlined text-sm">backpack</span>
                            </div>
                        </div>

                        {/* Interactive Stickers (Moved from Players List) */}
                        <div className="flex gap-3 justify-center border-t border-dashed border-outline-variant pt-3 mt-1">
                            <button 
                                type="button"
                                className="bg-[#ffe16d] text-on-background text-[10px] font-black px-4 py-2 border-[3px] border-on-background rounded-xl rotate-[-2deg] shadow-[3px_3px_0px_0px_#161a33] active:translate-y-[1px]"
                                onClick={() => socket.emit('geo-reaction', { roomCode, emoji: '👍', playerName: pseudo })}
                            >
                                READY?
                            </button>
                            <button 
                                type="button"
                                className="bg-[#ffc2eb] text-on-background text-[10px] font-black px-4 py-2 border-[3px] border-on-background rounded-xl rotate-[2deg] shadow-[3px_3px_0px_0px_#161a33] active:translate-y-[1px]"
                                onClick={() => socket.emit('geo-reaction', { roomCode, emoji: '🔥', playerName: pseudo })}
                            >
                                LET'S GO!
                            </button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3">
                        <div id="chat-messages-container" className="h-24 overflow-y-auto space-y-2 text-[10px] border-b border-on-background/10 pb-2">
                            {chatMessages.length === 0 ? (
                                <p className="text-secondary font-black italic">SYSTEM: Discutez avec les autres joueurs en attendant le lancement...</p>
                            ) : (
                                chatMessages.map((msg) => (
                                    <p key={msg.id} className="leading-tight">
                                        <span className="font-black text-secondary">{msg.playerName}:</span> <span className="font-medium text-on-background">{msg.message}</span>
                                    </p>
                                ))
                            )}
                        </div>
                        <form 
                            className="flex gap-2"
                            onSubmit={(e) => {
                                e.preventDefault();
                                sendChatMessage();
                            }}
                        >
                            <input 
                                className="flex-grow border-2 border-on-background p-2 text-[10px] font-bold focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg" 
                                placeholder="Écris un message..." 
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                            />
                            <button 
                                className="bg-on-background text-white px-4 py-2 border-2 border-on-background font-black text-[10px] uppercase rounded-lg hover:bg-on-background/90"
                                type="submit"
                            >
                                OK
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    };

    const renderPlayingScreen = () => {
        return (
            <div className="h-full w-full relative overflow-hidden bg-background">
                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40 z-10">
                    <span className="material-symbols-outlined text-white text-[48px]" style={{ fontVariationSettings: "'wght' 100" }}>add</span>
                </div>

                {/* HUD Panel Overlay */}
                <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-1.5">
                    {/* Time Counter */}
                    <div className="bg-white rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-sm border-[2px] border-on-background pointer-events-auto">
                        <span className={`material-symbols-outlined text-base ${timeLeft <= 10 ? 'text-error animate-pulse' : 'text-primary'}`} style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                        <span className={`text-xs font-black ${timeLeft <= 10 ? 'text-error' : 'text-on-background'}`}>
                            {formatTime(timeLeft)}
                        </span>
                    </div>
                </div>

                {/* Panorama street view container */}
                <div className="absolute inset-0 z-0 bg-surface-container-lowest">
                    {isLoading && (
                        <div className="absolute inset-0 bg-background/95 z-20 flex flex-col items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3"></div>
                            <div className="text-[10px] font-black uppercase tracking-widest animate-pulse">CHARGEMENT DES PANORAMAS...</div>
                        </div>
                    )}
                    <div ref={streetViewRef} className="w-full h-full"></div>
                </div>

                {/* Floating Emojis / Reactions drawer if React active */}
                {activeTab === 'React' && (
                    <div className="absolute bottom-20 left-4 z-40 bg-white border-[3px] border-on-background p-2 shadow-[4px_4px_0px_0px_#161a33] rounded-xl flex gap-2 overflow-x-auto max-w-[calc(100vw-32px)]">
                        {['😎', '🤯', '👏', '🔥', '🤔', '😂', '😱', '🎉'].map((emoji, idx) => (
                            <button
                                key={idx}
                                className="w-10 h-10 bg-[#fbf8ff] rounded-full flex items-center justify-center text-xl border-[2px] border-on-background active:scale-90"
                                onClick={() => {
                                    socket.emit('geo-reaction', { roomCode, emoji, playerName: pseudo });
                                    setActiveTab('Explore'); // Go back
                                }}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* Mini-map Container */}
                <div 
                    className={`absolute bottom-20 right-4 border-[3px] border-on-background bg-background rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_#161a33] transition-all duration-300 z-30 ${
                        showMap ? 'w-[calc(100vw-32px)] h-[calc(100%-80px)] top-4 left-4 right-4 bottom-20' : 'w-32 h-32'
                    }`}
                >
                    <div className="relative w-full h-full">
                        {/* Map Header when expanded */}
                        {showMap && (
                            <div className="w-full bg-white border-b-2 border-on-background px-2 py-1 flex justify-between items-center z-10">
                                <span className="text-[9px] font-black text-on-background uppercase tracking-wide">Placer votre marqueur</span>
                                <button className="p-0.5 rounded text-on-background flex items-center justify-center animate-none" type="button" onClick={() => setShowMap(false)}>
                                    <span className="material-symbols-outlined text-sm">close_fullscreen</span>
                                </button>
                            </div>
                        )}
                        <div 
                            ref={mapRef} 
                            className="w-full h-full cursor-crosshair"
                            style={{ minHeight: showMap ? '200px' : '100%' }}
                            onClick={!showMap ? () => setShowMap(true) : undefined}
                        ></div>
                        {!showMap && (
                            <div className="absolute -top-3 -left-3 bg-[#ffe16d] border border-on-background px-2 py-0.5 text-[8px] font-black neo-shadow-sm rotate-[-3deg] pointer-events-none">
                                MAP
                            </div>
                        )}
                    </div>
                </div>

                {/* Zoom buttons */}
                {!showMap && (
                    <div className="absolute bottom-20 left-4 flex flex-col gap-1.5 z-30">
                        <button 
                            className="w-9 h-9 bg-white border-2 border-on-background flex items-center justify-center rounded-lg neo-shadow-sm active:translate-y-px active:translate-x-px active:shadow-none"
                            onClick={() => panoramaInstance.current?.setZoom(Math.min(4, (panoramaInstance.current?.getZoom() || 1) + 1))}
                        >
                            <span className="material-symbols-outlined text-sm font-black">zoom_in</span>
                        </button>
                        <button 
                            className="w-9 h-9 bg-white border-2 border-on-background flex items-center justify-center rounded-lg neo-shadow-sm active:translate-y-px active:translate-x-px active:shadow-none"
                            onClick={() => panoramaInstance.current?.setZoom(Math.max(1, (panoramaInstance.current?.getZoom() || 1) - 1))}
                        >
                            <span className="material-symbols-outlined text-sm font-black">zoom_out</span>
                        </button>
                    </div>
                )}

                {/* Main Valider button */}
                <div className="absolute bottom-2 left-0 w-full px-4 flex justify-center z-40">
                    <button 
                        className={`w-full max-w-xs py-3.5 rounded-xl border-3 border-on-background font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                            guessMarker 
                                ? 'bg-[#ffe16d] text-on-background hover:shadow-md active:translate-y-px' 
                                : 'bg-[#dee0ff] text-on-background/40 cursor-not-allowed opacity-80'
                        }`}
                        onClick={submitGuess}
                        disabled={!guessMarker}
                    >
                        <span>VALIDER MON GUESS</span>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </button>
                </div>
            </div>
        );
    };

    const renderGuessedScreen = () => {
        const roundPrecision = Math.max(0, Math.min(100, Math.round((myRoundScore / 5000) * 100)));

        return (
            <div className="w-full flex flex-col justify-between p-3 gap-4 overflow-y-auto">
                <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                    {/* Comic Bubble Success Title */}
                    <div className="relative w-full mt-2">
                        <div className="bg-[#ffe16d] border-[4px] border-on-background p-5 comic-bubble neo-shadow-primary transform -rotate-2 rounded-xl">
                            <h2 className="text-2xl font-black text-on-background leading-none uppercase italic text-center font-headline-xl">
                                BOOM! <br/> GUESS ENVOYÉ
                            </h2>
                        </div>
                        {/* Decorative Star */}
                        <div className="absolute -top-4 -right-1 bg-[#ffc2eb] border-2 border-on-background w-10 h-10 flex items-center justify-center rounded-full shadow-sm transform rotate-12">
                            <span className="material-symbols-outlined text-on-background text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                        </div>
                    </div>

                    {/* Result Cards Bento Grid */}
                    <div className="grid grid-cols-1 gap-3 w-full">
                        {/* Distance Card */}
                        <div className="bg-white border-[3px] border-on-background p-4 shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] flex flex-col items-center justify-center rounded-xl">
                            <span className="text-[10px] font-black text-on-background/60 uppercase mb-1">TOTALS</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-on-background font-headline-xl">{formatDistance(myDistance).split(' ')[0]}</span>
                                <span className="text-xs font-black text-on-background">{formatDistance(myDistance).split(' ')[1] || 'km'}</span>
                            </div>
                        </div>

                        {/* Precision Card */}
                        <div className="bg-white border-[3px] border-on-background p-4 shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] flex flex-col items-center justify-center rounded-xl">
                            <span className="text-[10px] font-black text-on-background/60 uppercase mb-1">PRÉCISION</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black text-on-background font-headline-xl">{roundPrecision}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Live Reactions Section */}
                    <div className="w-full flex flex-col gap-2 mt-2">
                        <h3 className="text-xs font-black text-on-background uppercase tracking-tight flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[#bd00ff] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>add_reaction</span>
                            RÉACTIONS LIVE
                        </h3>
                        <div className="flex justify-between items-center w-full gap-2">
                            {/* Reaction Button 1 */}
                            <button 
                                type="button"
                                className="bg-white border-[3px] border-on-background w-1/3 py-3 flex flex-col items-center justify-center rounded-xl shadow-[3px_3px_0px_0px_rgba(22,26,51,1)] active:translate-y-px transition-all hover:bg-[#dee0ff]"
                                onClick={() => {
                                    socket.emit('geo-reaction', { roomCode, emoji: '🔥', playerName: pseudo });
                                    soundManager.play('pop');
                                }}
                            >
                                <span className="text-3xl mb-1">🔥</span>
                                <span className="text-[8px] font-black uppercase">BRÛLANT</span>
                            </button>
                            {/* Reaction Button 2 */}
                            <button 
                                type="button"
                                className="bg-white border-[3px] border-on-background w-1/3 py-3 flex flex-col items-center justify-center rounded-xl shadow-[3px_3px_0px_0px_rgba(22,26,51,1)] active:translate-y-px transition-all hover:bg-[#dee0ff]"
                                onClick={() => {
                                    socket.emit('geo-reaction', { roomCode, emoji: '😂', playerName: pseudo });
                                    soundManager.play('pop');
                                }}
                            >
                                <span className="text-3xl mb-1">😂</span>
                                <span className="text-[8px] font-black uppercase">LOL</span>
                            </button>
                            {/* Reaction Button 3 */}
                            <button 
                                type="button"
                                className="bg-white border-[3px] border-on-background w-1/3 py-3 flex flex-col items-center justify-center rounded-xl shadow-[3px_3px_0px_0px_rgba(22,26,51,1)] active:translate-y-px transition-all hover:bg-[#dee0ff]"
                                onClick={() => {
                                    socket.emit('geo-reaction', { roomCode, emoji: '😱', playerName: pseudo });
                                    soundManager.play('pop');
                                }}
                            >
                                <span className="text-3xl mb-1">😱</span>
                                <span className="text-[8px] font-black uppercase">QUOI !?</span>
                            </button>
                        </div>
                    </div>

                    {/* Map Summary */}
                    <div className="w-full bg-white border-[3px] border-on-background p-1 shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] rounded-xl overflow-hidden relative h-36">
                        <div ref={mapRef} className="w-full h-full"></div>
                        <div className="absolute top-2 left-2 z-10">
                            <div className="bg-[#161a33] text-[#ffe16d] font-black text-[9px] px-2 py-0.5 border-2 border-on-background rounded-md uppercase tracking-wider">
                                {correctLocation ? `${correctLocation.city.toUpperCase()}, ${correctLocation.country.toUpperCase()}` : 'PARIS, FRANCE'}
                            </div>
                        </div>
                    </div>

                    {/* Next Button */}
                    <button type="button" className="w-full bg-[#bd00ff] text-white font-black text-xs py-3.5 uppercase border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all">
                        Prochaine Étape
                    </button>
                </div>
            </div>
        );
    };

    const renderRoundEndScreen = () => {
        const myRank = roundResults?.findIndex(r => r.id === socket.id) + 1 || 1;

        return (
            <div className="w-full flex flex-col justify-between p-3 gap-4 overflow-y-auto">
                <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
                    {/* Result Map Container */}
                    <div className="relative w-full h-44 rounded-xl border-[3px] border-on-background bg-[#dee0ff] overflow-hidden shadow-[4px_4px_0px_0px_#bd00ff] flex-shrink-0">
                        <div ref={resultsMapRef} className="w-full h-full"></div>
                        <div className="absolute top-2 left-2 bg-[#ffe16d] text-on-background px-2.5 py-0.5 border-2 border-on-background font-black text-[8px] rounded-md tracking-wider">
                            {correctLocation ? `${correctLocation.city.toUpperCase()}, ${correctLocation.country.toUpperCase()}` : 'CIBLE LOCALISÉE'}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Rank Block */}
                        <div className="bg-[#ffe16d] p-3 border-[3px] border-on-background shadow-[3px_3px_0px_0px_#161a33] flex flex-col items-center justify-center rotate-[-1deg] rounded-xl">
                            <span className="text-[8px] font-black text-on-background uppercase tracking-widest">Global Rank</span>
                            <span className="text-3xl font-black text-on-background font-headline-xl">#{myRank}</span>
                        </div>
                        {/* Points Block */}
                        <div className="bg-[#bd00ff] p-3 border-[3px] border-on-background shadow-[3px_3px_0px_0px_#161a33] flex flex-col items-center justify-center rotate-[1deg] rounded-xl text-white">
                            <span className="text-[8px] font-black text-white uppercase tracking-widest">Points</span>
                            <span className="text-3xl font-black text-white font-headline-xl">+{myRoundScore}</span>
                        </div>
                        {/* Distance Block */}
                        <div className="col-span-2 bg-[#ffc2eb] p-4 border-[3px] border-on-background shadow-[3px_3px_0px_0px_#161a33] flex flex-row items-center justify-between rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[8px] font-black text-on-background uppercase tracking-widest">Accuracy Gap</span>
                                <span className="text-lg font-black text-on-background">{formatDistance(myDistance)}</span>
                            </div>
                            <div className="w-12 h-12 bg-[#8c0058] rounded-full border-2 border-on-background flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
                            </div>
                        </div>
                    </div>

                    {/* Countdown Pulsating Action */}
                    <div className="bg-white border-[3px] border-on-background p-3 rounded-xl shadow-[4px_4px_0px_0px_#ffe16d] flex justify-between items-center relative overflow-hidden">
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-on-background/50 uppercase tracking-tight">Prepare for the next location</span>
                            <span className="text-xs font-black text-on-background uppercase tracking-wider mt-0.5">NEXT ROUND IN...</span>
                        </div>
                        <div className="bg-[#ffe16d] border-[2.5px] border-on-background px-3 py-1 font-black text-base rounded-md rotate-[2deg] shadow-sm">
                            {roundEndCountdown > 0 ? `${String(roundEndCountdown).padStart(2, '0')}s` : 'Soon'}
                        </div>
                    </div>

                    {/* Share & Gallery Cards (Horizontal layout) */}
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                        <button 
                            type="button"
                            className="min-w-[140px] h-24 bg-white border-[3px] border-on-background p-3 shadow-[3px_3px_0px_0px_#8c0058] flex flex-col justify-between items-start text-left rounded-xl active:translate-y-px"
                            onClick={handleShare}
                        >
                            <span className="material-symbols-outlined text-[#8c0058] text-2xl font-black">arrow_back</span>
                            <span className="text-[9px] font-black uppercase">BRAG TO SQUAD</span>
                        </button>
                        <button 
                            type="button"
                            className="min-w-[140px] h-24 bg-white border-[3px] border-on-background p-3 shadow-[3px_3px_0px_0px_#2f004c] flex flex-col justify-between items-start text-left rounded-xl active:translate-y-px"
                            onClick={() => alert('Feature coming soon!')}
                        >
                            <span className="material-symbols-outlined text-[#bd00ff] text-2xl">copy_all</span>
                            <span className="text-[9px] font-black uppercase">STREET VIEW CLIP</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderGameEndScreen = () => {
        const resultsArray = Array.isArray(finalResults) ? finalResults : [];
        const myFinalResult = resultsArray.find(r => r.id === socket.id);
        const myFinalRankIndex = resultsArray.findIndex(r => r.id === socket.id);
        const myFinalRank = myFinalRankIndex !== -1 ? myFinalRankIndex + 1 : 1;
        const totalRoundsCount = totalRounds || 5;
        const precisionFinal = myFinalResult ? Math.max(0, Math.min(100, Math.round((myFinalResult.totalScore / (5000 * totalRoundsCount)) * 100))) : 0;

        return (
            <div className={`h-full w-full flex flex-col justify-between p-3 gap-4 overflow-y-auto ${performanceMode ? 'bg-[#fbf8ff]' : 'bg-animated'}`}>
                {/* Confetti Container */}
                <div className="fixed inset-0 pointer-events-none overflow-hidden z-40" id="confetti-container"></div>

                <div className="flex-grow flex flex-col items-center justify-between py-1 gap-4 max-w-sm mx-auto w-full min-h-0">
                    {/* Header Sticker */}
                    <div className="text-center flex flex-col items-center mt-2 flex-shrink-0">
                        <div className="inline-block px-3 py-1 bg-[#ffc2eb] text-on-background border-2 border-on-background font-black text-[9px] rounded-full mb-1 uppercase rotate-[-2deg]">
                            Tableau d'Honneur
                        </div>
                        <h2 className="text-2xl font-black text-on-background leading-none uppercase italic font-headline-xl">
                            MISSION <span className="text-[#bd00ff]">ACCOMPLIE!</span>
                        </h2>
                    </div>

                    {/* Leaderboard Section */}
                    <div className="w-full flex flex-col gap-2 max-h-[220px] overflow-y-auto mb-4 border-[3px] border-on-background p-3 rounded-xl bg-white shadow-[4px_4px_0px_0px_#161a33]">
                        <h3 className="text-xs font-black uppercase text-[#bd00ff] border-b-2 border-on-background pb-1.5 mb-2 flex justify-between items-center">
                            <span>Classement Général</span>
                            <span className="text-[10px] text-on-background/60 normal-case">{resultsArray.length} joueurs</span>
                        </h3>
                        <div className="flex flex-col gap-2">
                            {resultsArray.map((p, idx) => {
                                const isMe = p.id === socket.id;
                                const rank = idx + 1;
                                return (
                                    <div 
                                        key={p.id || idx} 
                                        className={`flex items-center justify-between p-2 border-2 border-on-background rounded-lg ${
                                            isMe ? 'bg-[#ffe16d] shadow-sm' : 'bg-[#dee0ff]/40'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 flex items-center justify-center font-black text-xs bg-on-background text-white rounded-md">
                                                {rank}
                                            </span>
                                            <div className="w-7 h-7 rounded-full border-2 border-on-background overflow-hidden bg-white">
                                                {p.avatar ? (
                                                    <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-xs flex items-center justify-center h-full">person</span>
                                                )}
                                            </div>
                                            <span className="font-bold text-xs truncate max-w-[120px] uppercase text-on-background">
                                                {p.name} {isMe && '(Toi)'}
                                            </span>
                                        </div>
                                        <span className="font-black text-xs text-on-background">
                                            {p.totalScore?.toLocaleString()} pts
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="w-full grid grid-cols-2 gap-2 flex-shrink-0">
                        {/* Accuracy Card */}
                        <div className="bg-white border-2 border-on-background p-2.5 shadow-[3px_3px_0px_0px_#161a33] rounded-xl flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="material-symbols-outlined text-[#bd00ff] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
                                <span className="text-[8px] font-black text-on-background/60 uppercase">Précision</span>
                            </div>
                            <div className="text-base font-black text-on-background">{precisionFinal}%</div>
                        </div>

                        {/* Speed Card */}
                        <div className="bg-white border-2 border-on-background p-2.5 shadow-[3px_3px_0px_0px_#161a33] rounded-xl flex flex-col items-center justify-center">
                            <div className="flex items-center gap-1 mb-0.5">
                                <span className="material-symbols-outlined text-[#bd00ff] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                                <span className="text-[8px] font-black text-on-background/60 uppercase">Vitesse</span>
                            </div>
                            <div className="text-base font-black text-on-background">+{myRoundScore}</div>
                        </div>

                        {/* Rank Card */}
                        <div className="col-span-2 bg-[#161a33] text-white border-2 border-on-background p-3 shadow-[4px_4px_0px_0px_#161a33] flex justify-between items-center rounded-xl overflow-hidden relative">
                            <div className="relative z-10 flex flex-col">
                                <div className="text-[8px] font-black text-white/50 uppercase">Rang Global</div>
                                <div className="text-sm text-[#ffe16d] font-black uppercase">#{myFinalRank} SUR {resultsArray.length || 1}</div>
                            </div>
                            <div className="bg-[#bd00ff] px-3 py-1 rounded-lg rotate-[2deg] border-2 border-white relative z-10 text-[8px] font-black text-white uppercase shadow-sm">
                                {myFinalRank === 1 ? 'LÉGENDAIRE' : 'EXPLORATEUR'}
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 w-full mt-1 flex-shrink-0">
                        <button 
                            className="w-full py-3.5 bg-[#ffe16d] text-on-background font-black text-xs border-[3px] border-on-background shadow-[3px_3px_0px_0px_#161a33] rounded-xl hover:translate-y-px active:translate-y-[1px] active:shadow-none transition-all uppercase tracking-widest"
                            onClick={returnToSalon}
                        >
                            RETOURNER AU SALON
                        </button>
                        
                        <div className="flex gap-2 justify-center">
                            <button 
                                className="p-2.5 bg-white border-2 border-on-background rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-px"
                                onClick={handleShare}
                            >
                                <span className="material-symbols-outlined text-base">share</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderHeader = () => {
        const displayScore = step === 'JOIN' || step === 'WAITING' ? 0 : myScore;
        const displayRound = step === 'JOIN' || step === 'WAITING' ? 2 : currentRound; // mock default 02 if JOIN
        const displayTotal = step === 'JOIN' || step === 'WAITING' ? 5 : totalRounds;
        
        const formattedRound = String(displayRound).padStart(2, '0');
        const formattedTotal = String(displayTotal).padStart(2, '0');
        const formattedScore = displayScore.toLocaleString();

        return (
            <header className="flex justify-between items-center w-full px-4 py-2.5 z-50 bg-[#fbf8ff] border-b-[3px] border-on-background">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full border-[3px] border-[#ffe16d] overflow-hidden bg-[#dee0ff] flex-shrink-0 shadow-sm">
                        {avatar ? (
                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-xs flex items-center justify-center h-full">person</span>
                        )}
                    </div>
                    <span className="font-bold text-base text-[#bd00ff] tracking-tighter italic uppercase">
                        GEOTRACKR
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className={`w-8 h-8 rounded-lg border-2 border-on-background flex items-center justify-center transition-all ${
                            performanceMode ? 'bg-[#ffc2eb] shadow-sm' : 'bg-white'
                        }`}
                        onClick={() => setPerformanceMode(prev => !prev)}
                        title={performanceMode ? "Mode Performance Activé (Animations Réduites)" : "Activer le Mode Performance"}
                    >
                        <span className="material-symbols-outlined text-xs font-black">
                            {performanceMode ? 'bolt' : 'bolt_disabled'}
                        </span>
                    </button>
                    <div className="font-bold text-[10px] text-on-background bg-[#ffe16d] px-3 py-1 border-[3px] border-on-background rounded-full shadow-sm flex items-center justify-center tracking-tight">
                        {formattedScore} PTS • {formattedRound}/{formattedTotal}
                    </div>
                </div>
            </header>
        );
    };

    const getEffectiveActiveTab = () => {
        if (step === 'JOIN') return 'Stats';
        if (step === 'WAITING') return 'React';
        if (step === 'GUESSED') return 'React';
        if (step === 'ROUND_END') return 'Map';
        if (step === 'GAME_END') return 'React';
        // PLAYING
        if (showMap) return 'Map';
        return activeTab; // 'Explore', 'Map', 'Stats', 'React'
    };

    const renderBottomNav = () => {
        const currentActiveTab = getEffectiveActiveTab();
        
        const tabItems = [
            { id: 'Explore', icon: 'explore', label: 'Explore' },
            { id: 'Map', icon: 'map', label: 'Map' },
            { id: 'Stats', icon: 'analytics', label: 'Stats' },
            { id: 'React', icon: 'add_reaction', label: 'React' }
        ];

        return (
            <nav className="w-full flex justify-around items-center px-4 py-2 pb-safe bg-white border-t-[3px] border-on-background z-50">
                {tabItems.map((tab) => {
                    const isActive = currentActiveTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className={`flex flex-col items-center justify-center p-1.5 transition-all duration-100 flex-1 ${
                                isActive
                                    ? 'bg-[#ffe16d] text-on-background rounded-xl border-[3px] border-on-background shadow-[2px_2px_0px_0px_rgba(22,26,51,1)] scale-105 mx-1.5'
                                    : 'text-on-background/70 hover:text-on-background'
                            }`}
                            onClick={() => {
                                if (step === 'PLAYING') {
                                    if (tab.id === 'Explore') {
                                        setActiveTab('Explore');
                                        setShowMap(false);
                                    } else if (tab.id === 'Map') {
                                        setActiveTab('Map');
                                        setShowMap(true);
                                    }
                                } else {
                                    setActiveTab(tab.id);
                                }
                            }}
                        >
                            <span className="material-symbols-outlined text-lg font-bold">{tab.icon}</span>
                            <span className="font-bold text-[9px] uppercase tracking-wider mt-0.5">{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        );
    };

    return (
        <div className="h-screen w-screen overflow-hidden bg-background text-on-background font-body-md relative flex flex-col justify-between select-none">
            <div className="pop-dots"></div>

            {renderHeader()}

            <div className={`flex-grow w-full ${step === 'PLAYING' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
                {step === 'JOIN' && renderJoinScreen()}
                {step === 'WAITING' && renderWaitingScreen()}
                {step === 'PLAYING' && renderPlayingScreen()}
                {step === 'GUESSED' && renderGuessedScreen()}
                {step === 'ROUND_END' && renderRoundEndScreen()}
                {step === 'GAME_END' && renderGameEndScreen()}
            </div>

            {renderBottomNav()}
        </div>
    );
}

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f23' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] }
];

export default GeoPlayerView;
