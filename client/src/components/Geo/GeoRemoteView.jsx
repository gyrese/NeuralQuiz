import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { soundManager } from '../../utils/soundManager';
import './GeoStyles.css';

/**
 * GeoRemoteView - Mobile Remote Control for GeoTrackr
 * Allows the host to control the game from their phone while
 * the main display is shown on a TV.
 */
function GeoRemoteView() {
    const navigate = useNavigate();
    const { roomCode: urlRoomCode } = useParams();
    const [step, setStep] = useState('CONNECT'); // CONNECT, LOBBY, PLAYING, ROUND_END, GAME_END
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [error, setError] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);

    // Game state
    const [players, setPlayers] = useState([]);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(5);
    const [timeLeft, setTimeLeft] = useState(60);
    const [timePerRound, setTimePerRound] = useState(60);
    const [roundResults, setRoundResults] = useState(null);
    const [finalResults, setFinalResults] = useState(null);
    const [guessedCount, setGuessedCount] = useState(0);

    // Settings for starting game
    const [settings, setSettings] = useState({
        roundsCount: 5,
        timePerRound: 60,
        mapType: ['world']
    });

    const timerRef = useRef(null);
    const hasAutoConnected = useRef(false);
    const stepRef = useRef(step); // Ref pour accéder à step dans les callbacks sans closure stale

    // Garder stepRef synchronisé
    useEffect(() => {
        stepRef.current = step;
        // Nettoyer le timer si on n'est plus en PLAYING
        if (step !== 'PLAYING' && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [step]);

    // Socket event listeners - set up FIRST, then auto-connect
    useEffect(() => {
        // Set up all listeners
        socket.on('geo-player-joined', (playersList) => {
            console.log('[Remote] Player joined event received:', playersList);
            setPlayers(playersList);
        });

        socket.on('geo-player-left', (playersList) => {
            console.log('[Remote] Player left event received:', playersList);
            setPlayers(playersList);
        });

        socket.on('geo-game-started', (data) => {
            console.log('[Remote] Game started event received:', data);
            setStep('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total);
            setTimePerRound(data.timePerRound || 60);
            setGuessedCount(0);
            setError(''); // Clear any previous errors
            soundManager.play('start');
            startTimer(data.timePerRound || 60);
        });

        socket.on('geo-player-guessed', () => {
            setGuessedCount(prev => prev + 1);
        });

        socket.on('geo-all-guessed', () => {
            // All players have guessed
        });

        socket.on('geo-round-ended', (data) => {
            console.log('[Remote] Round ended event received:', data);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setStep('ROUND_END');
            setRoundResults(data.results);
            setPlayers(data.results); // Update with scores
            setCurrentRound(data.currentRound); // Sync current round
            setTotalRounds(data.totalRounds); // Sync total rounds
            setError(''); // Clear any previous errors
            soundManager.play('end');
        });

        socket.on('geo-next-round', (data) => {
            console.log('[Remote] Next round event received:', data);
            setStep('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.total); // Sync total rounds
            setGuessedCount(0);
            setError(''); // Clear any previous errors
            soundManager.play('start');
            startTimer(data.timePerRound || 60);
        });

        socket.on('geo-game-over', (data) => {
            console.log('[Remote] Game over event received:', data);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setStep('GAME_END');
            setFinalResults(data.results);
            setError(''); // Clear any previous errors
            soundManager.play('win');
        });

        socket.on('geo-game-restarted', () => {
            console.log('[Remote] Game restarted event received');
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setStep('LOBBY');
            setCurrentRound(0);
            setGuessedCount(0);
            setRoundResults(null);
            setFinalResults(null);
            setError(''); // Clear any previous errors
        });

        socket.on('geo-host-disconnected', () => {
            setError('L\'hôte principal a quitté la partie');
            setStep('CONNECT');
        });

        // When settings are updated (from host)
        socket.on('geo-settings-updated', (newSettings) => {
            console.log('[Remote] Settings updated event received:', newSettings);
            setSettings(prev => ({
                ...prev,
                roundsCount: newSettings.roundsCount || prev.roundsCount,
                timePerRound: newSettings.timePerRound || prev.timePerRound,
                mapType: newSettings.mapType || prev.mapType
            }));
            setTotalRounds(newSettings.roundsCount || 5);
            setTimePerRound(newSettings.timePerRound || 60);
        });

        // Auto-connect AFTER listeners are set up (only once)
        if (urlRoomCode && !hasAutoConnected.current) {
            hasAutoConnected.current = true;
            // Small delay to ensure socket is connected
            setTimeout(() => {
                if (socket.connected) {
                    setRoomCode(urlRoomCode.toUpperCase());
                    connectWithCode(urlRoomCode.toUpperCase());
                } else {
                    // Wait for socket connection
                    socket.once('connect', () => {
                        setRoomCode(urlRoomCode.toUpperCase());
                        connectWithCode(urlRoomCode.toUpperCase());
                    });
                }
            }, 100);
        }

        return () => {
            socket.off('geo-player-joined');
            socket.off('geo-player-left');
            socket.off('geo-game-started');
            socket.off('geo-player-guessed');
            socket.off('geo-all-guessed');
            socket.off('geo-round-ended');
            socket.off('geo-next-round');
            socket.off('geo-game-over');
            socket.off('geo-game-restarted');
            socket.off('geo-host-disconnected');
            socket.off('geo-settings-updated');
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []); // Empty deps - set up once on mount

    // Connect with a given code (used for auto-connect)
    const connectWithCode = (code) => {
        if (!code) {
            setError('Code du salon requis');
            return;
        }

        setIsConnecting(true);
        setError('');

        console.log('[Remote] Connecting with code:', code);

        socket.emit('geo-join-remote', { roomCode: code }, (response) => {
            setIsConnecting(false);
            if (response.error) {
                setError(response.error);
                console.error('[Remote] Connection error:', response.error);
            } else {
                console.log('[Remote] Connected successfully:', response);
                setStep(response.gameState === 'LOBBY' ? 'LOBBY' : response.gameState);
                setPlayers(response.players || []);
                setCurrentRound(response.currentRound || 0);
                setTotalRounds(response.totalRounds || 5);
                setTimePerRound(response.timePerRound || 60);
                setRoomCode(code);

                if (response.gameState === 'PLAYING' && response.roundStartTime) {
                    const elapsed = Math.floor((Date.now() - response.roundStartTime) / 1000);
                    const remaining = Math.max(0, response.timePerRound - elapsed);
                    startTimer(remaining);
                }
            }
        });
    };

    const connectToRoom = () => {
        if (!roomCode) {
            setError('Code du salon requis');
            return;
        }
        connectWithCode(roomCode.toUpperCase());
    };

    // Use ref to access current roomCode in timer callback (avoids stale closure)
    const roomCodeRef = useRef(roomCode);
    useEffect(() => {
        roomCodeRef.current = roomCode;
    }, [roomCode]);

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
                    timerRef.current = null;
                    // Auto-trigger end round when timer expires
                    // IMPORTANT: Vérifier qu'on est toujours en PLAYING avant d'envoyer
                    if (roomCodeRef.current && stepRef.current === 'PLAYING') {
                        console.log('[Remote] Timer expired, auto-ending round');
                        socket.emit('geo-end-round', { roomCode: roomCodeRef.current.toUpperCase() }, (response) => {
                            if (response.error) {
                                console.error('[Remote] Auto end round error:', response.error);
                            }
                        });
                    } else {
                        console.log('[Remote] Timer expired but not in PLAYING state, skipping auto-end');
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const startGame = () => {
        socket.emit('geo-start-game', {
            roomCode: roomCode.toUpperCase(),
            settings
        }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    const endRound = () => {
        socket.emit('geo-end-round', { roomCode: roomCode.toUpperCase() }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    const nextRound = () => {
        socket.emit('geo-next-round', { roomCode: roomCode.toUpperCase() }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    const restartGame = () => {
        socket.emit('geo-restart-game', { roomCode: roomCode.toUpperCase() }, (response) => {
            if (response.error) {
                setError(response.error);
            }
        });
    };

    // Update settings and broadcast to all clients
    const updateSettings = (newSettings) => {
        setSettings(newSettings);
        if (roomCode) {
            socket.emit('geo-update-settings', {
                roomCode: roomCode.toUpperCase(),
                settings: newSettings
            });
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

    // CONNECT Screen
    if (step === 'CONNECT') {
        return (
            <div className="geo-player-background">
                <div className="container py-4">
                    <button className="btn btn-outline-secondary mb-4" onClick={() => navigate('/geo')}>
                        ← RETOUR
                    </button>

                    <div className="row justify-content-center">
                        <div className="col-md-5">
                            <div className="card p-4">
                                <h2 className="text-center mb-4 text-info" style={{ fontFamily: 'var(--font-display)', letterSpacing: '4px' }}>
                                    📱 TÉLÉCOMMANDE
                                </h2>

                                {error && (
                                    <div className="alert alert-danger">{error}</div>
                                )}

                                <div className="mb-4">
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

                                <button
                                    className="btn btn-info btn-lg w-100"
                                    onClick={connectToRoom}
                                    disabled={isConnecting}
                                >
                                    {isConnecting ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Connexion...</>
                                    ) : (
                                        '🎮 CONNECTER'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // LOBBY Screen
    if (step === 'LOBBY') {
        const activePlayers = players.filter(p => !p.disconnected);

        return (
            <div className="geo-player-background">
                <div className="container py-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h4 className="text-info mb-0">📱 Télécommande</h4>
                        <span className="badge bg-dark fs-6">CODE: {roomCode}</span>
                    </div>

                    {error && <div className="alert alert-danger py-2">{error}</div>}

                    {/* Player list */}
                    <div className="card p-3 mb-3">
                        <h6 className="text-muted mb-2">Joueurs connectés ({activePlayers.length})</h6>
                        {activePlayers.length === 0 ? (
                            <p className="text-muted mb-0">En attente de joueurs...</p>
                        ) : (
                            <div className="d-flex flex-wrap gap-2">
                                {activePlayers.map((player, idx) => (
                                    <div key={player.id || idx} className="badge bg-primary py-2 px-3">
                                        {player.avatar && (
                                            <img src={player.avatar} alt=""
                                                style={{ width: 20, height: 20, borderRadius: '50%', marginRight: 5 }} />
                                        )}
                                        {player.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="card p-3 mb-3">
                        <h6 className="text-muted mb-2">Paramètres</h6>
                        <div className="row g-2">
                            <div className="col-6">
                                <label className="form-label small">Manches</label>
                                <select
                                    className="form-select"
                                    value={settings.roundsCount}
                                    onChange={(e) => updateSettings({ ...settings, roundsCount: parseInt(e.target.value) })}
                                >
                                    {[3, 5, 7, 10].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-6">
                                <label className="form-label small">Temps/manche</label>
                                <select
                                    className="form-select"
                                    value={settings.timePerRound}
                                    onChange={(e) => updateSettings({ ...settings, timePerRound: parseInt(e.target.value) })}
                                >
                                    {[30, 45, 60, 90, 120].map(n => (
                                        <option key={n} value={n}>{n}s</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Start button */}
                    <button
                        className="btn btn-success btn-lg w-100 py-3"
                        onClick={startGame}
                        disabled={activePlayers.length === 0}
                    >
                        🚀 LANCER LA PARTIE
                    </button>
                </div>
            </div>
        );
    }

    // PLAYING Screen
    if (step === 'PLAYING') {
        const activePlayers = players.filter(p => !p.disconnected);

        return (
            <div className="geo-player-background">
                <div className="container py-3">
                    {/* Header */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <span className="badge bg-info fs-6">Manche {currentRound}/{totalRounds}</span>
                        </div>
                        <div className={`fs-2 fw-bold ${timeLeft <= 10 ? 'text-danger' : 'text-warning'}`}>
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    {error && <div className="alert alert-danger py-2">{error}</div>}

                    {/* Guessed count */}
                    <div className="card p-3 mb-3 text-center">
                        <div className="fs-4">
                            <span className="text-success">{guessedCount}</span>
                            <span className="text-muted">/{activePlayers.length}</span>
                        </div>
                        <div className="text-muted small">joueurs ont répondu</div>
                    </div>

                    {/* Player status */}
                    <div className="card p-3 mb-3">
                        <h6 className="text-muted mb-2">Scores actuels</h6>
                        {players.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((player, idx) => (
                            <div key={player.id || idx} className="d-flex justify-content-between align-items-center py-1 border-bottom">
                                <span>
                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    {' '}{player.name}
                                    {player.disconnected && <span className="text-muted"> (déco)</span>}
                                </span>
                                <span className="text-primary fw-bold">{(player.totalScore || 0).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>

                    {/* End round button */}
                    <button
                        className="btn btn-warning btn-lg w-100 py-3"
                        onClick={endRound}
                    >
                        ⏹️ TERMINER LA MANCHE
                    </button>
                </div>
            </div>
        );
    }

    // ROUND_END Screen
    if (step === 'ROUND_END') {
        return (
            <div className="geo-player-background">
                <div className="container py-3">
                    <h4 className="text-center text-primary mb-3">📊 Résultats Manche {currentRound}</h4>

                    {error && <div className="alert alert-danger py-2">{error}</div>}

                    {/* Results */}
                    <div className="card p-3 mb-3">
                        {roundResults?.map((result, idx) => (
                            <div key={result.id || idx} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                <div>
                                    <span className="fw-bold">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    </span>
                                    {' '}{result.name}
                                </div>
                                <div className="text-end">
                                    <div className="text-success fw-bold">+{(result.roundScore || 0).toLocaleString()}</div>
                                    <div className="small text-muted">{formatDistance(result.distance)}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Next round button */}
                    <button
                        className="btn btn-primary btn-lg w-100 py-3"
                        onClick={nextRound}
                    >
                        ▶️ {currentRound < totalRounds ? 'MANCHE SUIVANTE' : 'VOIR RÉSULTATS'}
                    </button>
                </div>
            </div>
        );
    }

    // GAME_END Screen
    if (step === 'GAME_END') {
        return (
            <div className="geo-player-background">
                <div className="container py-3">
                    <h2 className="text-center text-primary mb-4">🏆 Partie Terminée</h2>

                    {error && <div className="alert alert-danger py-2">{error}</div>}

                    {/* Final results */}
                    <div className="card p-3 mb-3">
                        {finalResults?.map((result, idx) => (
                            <div key={result.id || idx} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                                <div>
                                    <span className="fs-5">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                    </span>
                                    {' '}{result.name}
                                </div>
                                <div className="text-primary fw-bold fs-5">
                                    {(result.totalScore || 0).toLocaleString()} pts
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="d-grid gap-2">
                        <button
                            className="btn btn-success btn-lg py-3"
                            onClick={restartGame}
                        >
                            🔄 REJOUER
                        </button>
                        <button
                            className="btn btn-outline-secondary btn-lg"
                            onClick={() => navigate('/')}
                        >
                            🏠 Retour au menu
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default GeoRemoteView;
