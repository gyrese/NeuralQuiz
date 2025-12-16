import { useState, useEffect, useRef } from 'react';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function GeoPlayerView({ onBack, initialRoomCode }) {
    const [step, setStep] = useState('JOIN'); // JOIN, WAITING, PLAYING, GUESSED, ROUND_END, GAME_END
    const [roomCode, setRoomCode] = useState(initialRoomCode || '');
    const [pseudo, setPseudo] = useState('');
    const [avatar, setAvatar] = useState(null);
    const [error, setError] = useState('');

    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [currentLocation, setCurrentLocation] = useState(null);

    const [guessMarker, setGuessMarker] = useState(null);
    const [myScore, setMyScore] = useState(0);
    const [myDistance, setMyDistance] = useState(null);
    const [roundResults, setRoundResults] = useState(null);
    const [correctLocation, setCorrectLocation] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [selectedRegions, setSelectedRegions] = useState(['world']); // Regions from host settings

    // UX States
    const [isLoading, setIsLoading] = useState(false);
    const [isJoining, setIsJoining] = useState(false); // Loading state for join button
    const [isRestoring, setIsRestoring] = useState(false); // Restoring session from localStorage
    const [pointsAnimation, setPointsAnimation] = useState(null); // { score: 1000 }
    const [reactionCooldown, setReactionCooldown] = useState(false); // Cooldown for emoji reactions

    const streetViewRef = useRef(null);
    const mapRef = useRef(null);
    const resultsMapRef = useRef(null);
    const panoramaInstance = useRef(null);
    const mapInstance = useRef(null);
    const markerInstance = useRef(null);
    const timerRef = useRef(null);

    // Restore session from localStorage on mount
    useEffect(() => {
        // Check for newgame parameter - if present, clear previous session
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('newgame') === '1' || urlParams.get('newgame') === 'true') {
            localStorage.removeItem('geoSession');
            console.log('[Player] New game requested, cleared previous session');
            return; // Don't attempt to restore
        }

        const savedSession = localStorage.getItem('geoSession');
        if (savedSession) {
            try {
                const session = JSON.parse(savedSession);
                if (session.roomCode && session.pseudo) {
                    // Show restoring screen immediately
                    setIsRestoring(true);
                    setRoomCode(session.roomCode);
                    setPseudo(session.pseudo);
                    if (session.avatar) setAvatar(session.avatar);
                    if (session.myScore) setMyScore(session.myScore);

                    // Attempt to rejoin
                    setIsJoining(true);
                    socket.emit('geo-join-room', {
                        roomCode: session.roomCode.toUpperCase(),
                        playerName: session.pseudo,
                        avatar: session.avatar
                    }, (response) => {
                        setIsJoining(false);
                        setIsRestoring(false);
                        if (response.error) {
                            // Session invalide, on affiche le formulaire
                            localStorage.removeItem('geoSession');
                            setError('Session expirée. Reconnectez-vous.');
                        } else if (response.reconnected) {
                            setStep(response.gameState);
                            setCurrentRound(response.currentRound);
                            setTotalRounds(response.totalRounds);
                            setCurrentLocation(response.location);
                            if (response.myScore !== undefined) setMyScore(response.myScore);

                            // Calculate remaining time based on roundStartTime
                            if (response.gameState === 'PLAYING' && response.roundStartTime && response.timePerRound) {
                                const elapsed = Math.floor((Date.now() - response.roundStartTime) / 1000);
                                const remaining = Math.max(0, response.timePerRound - elapsed);
                                startTimer(remaining);
                            } else if (response.gameState === 'PLAYING') {
                                startTimer(60); // Fallback
                            }
                        } else {
                            setStep('WAITING');
                        }
                    });
                }
            } catch (e) {
                localStorage.removeItem('geoSession');
            }
        }
    }, []);

    useEffect(() => {
        // Game events
        socket.on('geo-game-started', (data) => {
            setStep('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total);
            setCurrentLocation(data.location);
            setGuessMarker(null);
            markerInstance.current = null;
            setIsLoading(true); // Start loading new street view
            setSelectedRegions(data.mapType || ['world']);
            soundManager.play('start');

            // Calculate remaining time based on server's roundStartTime
            const duration = data.timePerRound || 60;
            if (data.roundStartTime) {
                const elapsed = Math.floor((Date.now() - data.roundStartTime) / 1000);
                const remaining = Math.max(0, duration - elapsed);
                startTimer(remaining);
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
            markerInstance.current = null;
            setIsLoading(true); // Start loading
            soundManager.play('start');

            // Calculate remaining time based on server's roundStartTime
            const duration = data.timePerRound || 60;
            if (data.roundStartTime) {
                const elapsed = Math.floor((Date.now() - data.roundStartTime) / 1000);
                const remaining = Math.max(0, duration - elapsed);
                startTimer(remaining);
            } else {
                startTimer(duration);
            }
        });

        socket.on('geo-game-over', (data) => {
            if (timerRef.current) clearInterval(timerRef.current);
            setStep('GAME_END');
            setFinalResults(data.results);
            soundManager.play('win');
            // Clear session on game over
            localStorage.removeItem('geoSession');
        });

        socket.on('geo-host-disconnected', () => {
            setError('L\'hôte a quitté la partie');
            setStep('JOIN');
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
            setMyDistance(null);
            setRoundResults(null);
            setFinalResults(null);
            setGuessMarker(null);
            setPointsAnimation(null);
        });

        return () => {
            socket.off('geo-game-started');
            socket.off('geo-round-ended');
            socket.off('geo-next-round');
            socket.off('geo-game-over');
            socket.off('geo-host-disconnected');
            socket.off('geo-kicked');
            socket.off('geo-game-restarted');
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Init Street View when playing
    useEffect(() => {
        let timeoutId;

        if (step === 'PLAYING' && currentLocation) {
            const startMap = () => {
                // Délai de sécurité pour s'assurer que le DOM est prêt
                timeoutId = setTimeout(() => {
                    if (window.google) {
                        initMaps();
                    }
                }, 100);
            };

            if (!window.google) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initGeoPlayer`;
                script.async = true;
                window.initGeoPlayer = () => startMap();
                document.head.appendChild(script);
            } else {
                startMap();
            }
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [step, currentLocation, currentRound]);

    // Init results map
    useEffect(() => {
        if (step === 'ROUND_END' && window.google && resultsMapRef.current && correctLocation) {
            initResultsMap();
        }
    }, [step, roundResults]);

    const initMaps = () => {
        // Street View
        if (streetViewRef.current && currentLocation) {
            // Vérifier si le div contient déjà le panorama
            const isMounted = streetViewRef.current.hasChildNodes();

            if (panoramaInstance.current && isMounted) {
                // Si l'instance existe ET qu'elle est toujours dans le DOM -> update
                panoramaInstance.current.setPosition({
                    lat: currentLocation.lat,
                    lng: currentLocation.lng
                });
                panoramaInstance.current.setPov({
                    heading: Math.random() * 360,
                    pitch: 0
                });
                panoramaInstance.current.setVisible(true);
                setIsLoading(false); // Loaded
            } else {
                // Sinon (re)créer l'instance
                panoramaInstance.current = new window.google.maps.StreetViewPanorama(
                    streetViewRef.current,
                    {
                        position: { lat: currentLocation.lat, lng: currentLocation.lng },
                        pov: { heading: Math.random() * 360, pitch: 0 },
                        zoom: 1,
                        addressControl: false,
                        showRoadLabels: false,
                        linksControl: true,
                        panControl: true,
                        enableCloseButton: false,
                        fullscreenControl: false,
                        visible: true
                    }
                );

                // Add listener to know when it's ready (approximate)
                window.google.maps.event.addListenerOnce(panoramaInstance.current, 'status_changed', () => {
                    setIsLoading(false);
                });
            }
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
                styles: darkMapStyle,
                disableDefaultUI: true,
                zoomControl: true,
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
            styles: darkMapStyle
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

    const startTimer = (duration) => {
        setTimeLeft(duration);
        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 10 && prev > 0) {
                    soundManager.playTick();
                }
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
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

                // Si on est en PLAYING, on relance (sans le timer exact car on ne l'a pas sync ici, mais c'est pas grave)
                if (response.gameState === 'PLAYING') {
                    startTimer(60); // Valeur par défaut, l'host gère le vrai temps
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
                setMyScore(prev => prev + response.score);

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
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setAvatar(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDistance = (km) => {
        if (km === null || km === undefined) return '-';
        if (km < 1) return `${Math.round(km * 1000)} m`;
        return `${Math.round(km).toLocaleString()} km`;
    };

    // RESTORING Screen - shown while attempting to reconnect
    if (isRestoring) {
        const cancelRestore = () => {
            localStorage.removeItem('geoSession');
            setIsRestoring(false);
            setRoomCode('');
            setPseudo('');
            setAvatar(null);
            setMyScore(0);
        };

        return (
            <div className="geo-player-background">
                <div className="container text-center py-5">
                    <div className="card p-5 mx-auto" style={{ maxWidth: '500px' }}>
                        <h2 className="text-primary mb-4" style={{ fontFamily: 'var(--font-display)', letterSpacing: '4px' }}>🌍 GEO_TRACKR</h2>
                        <div className="spinner-border text-primary mb-3" role="status"></div>
                        <p className="fs-4">Reconnexion en cours...</p>
                        <p className="text-muted mb-4">Récupération de votre session</p>
                        <button
                            className="btn btn-outline-danger"
                            onClick={cancelRestore}
                        >
                            ✖ Annuler et nouvelle partie
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // JOIN Screen
    if (step === 'JOIN') {
        return (
            <div className="geo-player-background">
                <div className="container py-4">
                    <button className="btn btn-outline-secondary mb-4" onClick={onBack}>
                        ← RETOUR
                    </button>

                    <div className="row justify-content-center">
                        <div className="col-md-5">
                            <div className="card p-4">
                                <h2 className="text-center mb-4 text-primary" style={{ fontFamily: 'var(--font-display)', letterSpacing: '4px' }}>🌍 GEO_TRACKR</h2>

                                {error && (
                                    <div className="alert alert-danger">{error}</div>
                                )}

                                <div className="mb-3">
                                    <label className="form-label">Code du salon</label>
                                    <input
                                        type="text"
                                        className="form-control text-uppercase text-center fs-4"
                                        placeholder="ABC123"
                                        maxLength={6}
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label">Pseudo</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Votre pseudo"
                                        value={pseudo}
                                        onChange={(e) => setPseudo(e.target.value)}
                                    />
                                </div>

                                <div className="mb-4 text-center">
                                    <label className="form-label d-block">Avatar (optionnel)</label>
                                    {avatar && (
                                        <img src={avatar} alt="Avatar" className="avatar-preview mb-2" />
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="form-control"
                                        onChange={handleAvatarUpload}
                                    />
                                </div>

                                <button
                                    className="btn btn-primary btn-lg w-100"
                                    onClick={joinRoom}
                                    disabled={isJoining}
                                >
                                    {isJoining ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Connexion...</>
                                    ) : (
                                        'REJOINDRE'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // WAITING Screen
    if (step === 'WAITING') {
        return (
            <div className="geo-player-background">
                <div className="container text-center py-5">
                    <div className="card p-5 mx-auto" style={{ maxWidth: '500px' }}>
                        <h2 className="text-primary mb-4" style={{ fontFamily: 'var(--font-display)', letterSpacing: '4px' }}>🌍 GEO_TRACKR</h2>
                        <div className="spinner-border text-primary mb-3" role="status"></div>
                        <p className="fs-4">En attente du lancement...</p>
                        <p className="text-muted">L'hôte va bientôt démarrer la partie</p>
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING Screen
    // GUESSED - Waiting Screen with Emoji Reactions
    if (step === 'GUESSED') {
        const emojis = ['😂', '😱', '🤯', '👏', '🔥', '🎉', '😅', '🤔'];

        const sendReaction = (emoji) => {
            if (reactionCooldown) return;

            socket.emit('geo-reaction', {
                roomCode: roomCode.toUpperCase(),
                emoji,
                playerName: pseudo
            });

            // Cooldown de 1 seconde
            setReactionCooldown(true);
            setTimeout(() => setReactionCooldown(false), 1000);
        };

        return (
            <div className="geo-player-background">
                <div className="container py-4 text-center">
                    {/* Header info */}
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div className="badge bg-dark fs-6">Manche {currentRound}/{totalRounds}</div>
                        <div className="badge bg-primary fs-5">{myScore.toLocaleString()} pts</div>
                    </div>

                    {/* Success message */}
                    <div className="card p-4 mb-4" style={{ background: 'rgba(0,255,65,0.1)', border: '2px solid var(--neon-green)' }}>
                        <div className="fs-1 mb-2">✅</div>
                        <h3 className="text-success mb-2">Réponse envoyée !</h3>
                        <p className="text-muted mb-0">Distance: <strong>{formatDistance(myDistance)}</strong></p>
                    </div>

                    {/* Waiting message */}
                    <div className="mb-4">
                        <div className="spinner-border text-primary mb-2" role="status"></div>
                        <p className="text-muted">En attente des autres joueurs...</p>
                    </div>

                    {/* Emoji reactions */}
                    <div className="card p-4">
                        <h5 className="text-info mb-3">🎉 Envoyez une réaction !</h5>
                        <div className="d-flex flex-wrap justify-content-center gap-2">
                            {emojis.map((emoji, idx) => (
                                <button
                                    key={idx}
                                    className={`btn btn-outline-light btn-lg ${reactionCooldown ? 'opacity-50' : ''}`}
                                    style={{ fontSize: '2rem', padding: '0.5rem 1rem' }}
                                    onClick={() => sendReaction(emoji)}
                                    disabled={reactionCooldown}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        {reactionCooldown && (
                            <p className="text-muted small mt-2 mb-0">Attendez un instant...</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING Screen
    if (step === 'PLAYING') {
        return (
            <div className="geo-player-container">
                {/* Header */}
                <div className="geo-player-header">
                    <div className="geo-round">
                        <div>Manche {currentRound}/{totalRounds}</div>
                        <div style={{ fontSize: '0.8em', color: 'var(--neon-purple)', marginTop: '4px' }}>CODE: {roomCode}</div>
                    </div>
                    <div className={`geo-timer ${timeLeft <= 10 ? 'danger' : ''}`}>
                        {formatTime(timeLeft)}
                    </div>
                    <div className="geo-score">
                        Score: {myScore.toLocaleString()}
                    </div>
                </div>

                {/* Street View */}
                <div style={{ position: 'relative', flex: 1, width: '100%' }}>
                    {isLoading && (
                        <div className="street-view-loader">
                            <div className="globe-spinner">🌍</div>
                            <div className="mt-3 text-white fw-bold">Chargement Street View...</div>
                        </div>
                    )}
                    <div ref={streetViewRef} className="geo-player-streetview" style={{ height: '100%' }}></div>
                    {pointsAnimation && (
                        <div className="points-anim">
                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>+{pointsAnimation.score} PTS</div>
                            {pointsAnimation.bonus > 0 && (
                                <div style={{ fontSize: '1rem', color: '#ffd700', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                                    dont {pointsAnimation.bonus} bonus vitesse ⚡
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mini Map */}
                <div className="geo-minimap-container">
                    <div ref={mapRef} className="geo-minimap"></div>
                    <button
                        className={`btn geo-guess-btn ${guessMarker ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={submitGuess}
                        disabled={!guessMarker}
                    >
                        {guessMarker ? '✓ VALIDER' : 'CLIQUEZ POUR DEVINER'}
                    </button>
                </div>
            </div>
        );
    }

    // ROUND END Screen
    if (step === 'ROUND_END') {
        const myResult = roundResults?.find(r => r.id === socket.id);
        const myRank = roundResults?.findIndex(r => r.id === socket.id) + 1;

        return (
            <div className="container py-4">
                <div className="text-center mb-4">
                    <h2 className="text-primary">📍 Résultats - Manche {currentRound}</h2>
                    <p className="text-info fs-4">
                        C'était <strong>{correctLocation?.city}, {correctLocation?.country}</strong>
                    </p>
                </div>

                <div className="row">
                    <div className="col-md-7">
                        <div ref={resultsMapRef} className="geo-results-map"></div>
                    </div>
                    <div className="col-md-5">
                        <div className="card p-4">
                            <div className="text-center mb-4">
                                <div className="fs-1 mb-2">
                                    {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
                                </div>
                                <div className="fs-4 text-primary">+{myResult?.roundScore?.toLocaleString() || 0} pts</div>
                                <div className="text-muted">{formatDistance(myResult?.distance)}</div>
                            </div>

                            <hr />

                            <h6 className="text-info mb-3">Classement du round</h6>
                            {roundResults?.slice(0, 5).map((result, index) => (
                                <div key={result.id} className={`geo-result-mini ${result.id === socket.id ? 'me' : ''}`}>
                                    <span>#{index + 1} {result.name}</span>
                                    <span>+{result.roundScore?.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-4">
                            <p className="text-muted">En attente de la manche suivante...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // GAME END Screen
    if (step === 'GAME_END') {
        const myFinalResult = finalResults?.find(r => r.id === socket.id);
        const myFinalRank = finalResults?.findIndex(r => r.id === socket.id) + 1;

        return (
            <div className="container py-4">
                <div className="text-center mb-5">
                    <h1 className="display-3 text-primary glitch-text" data-text="PARTIE TERMINÉE">
                        🏆 PARTIE TERMINÉE
                    </h1>
                </div>

                <div className="row justify-content-center">
                    <div className="col-md-6">
                        <div className="card p-5 text-center">
                            <div className="mb-4">
                                <div className="fs-1">
                                    {myFinalRank === 1 ? '🥇' : myFinalRank === 2 ? '🥈' : myFinalRank === 3 ? '🥉' : `#${myFinalRank}`}
                                </div>
                                <h3 className="text-primary mt-2">{pseudo}</h3>
                            </div>

                            <div className="fs-2 text-info mb-4">
                                {myFinalResult?.totalScore?.toLocaleString() || 0} points
                            </div>

                            <hr />

                            <h5 className="text-muted mb-3">Classement final</h5>
                            {finalResults?.map((result, index) => (
                                <div key={result.id} className={`geo-final-mini-row ${result.id === socket.id ? 'me' : ''}`}>
                                    <span>
                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                        {' '}{result.name}
                                    </span>
                                    <span>{result.totalScore?.toLocaleString()} pts</span>
                                </div>
                            ))}
                        </div>

                        <div className="text-center mt-4">
                            <button className="btn btn-outline-secondary btn-lg" onClick={onBack}>
                                🏠 Retour au menu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

// Dark map style
const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f23' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a4a' }] }
];

export default GeoPlayerView;
