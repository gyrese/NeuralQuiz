import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    const [searchParams] = useSearchParams();
    const urlRemoteToken = searchParams.get('rt') || '';
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

    // Bug #8 fix: déclaration de roomCodeRef AVANT son utilisation dans handleReconnect
    const roomCodeRef = useRef(roomCode);
    useEffect(() => {
        roomCodeRef.current = roomCode;
    }, [roomCode]);

    // Token secret de la télécommande (issu du QR de l'hôte), conservé pour les reconnexions
    const remoteTokenRef = useRef(urlRemoteToken);

    // Garder stepRef synchronisé
    useEffect(() => {
        stepRef.current = step;
        // Nettoyer le timer si on n'est plus en PLAYING
        if (step !== 'PLAYING' && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [step]);

    // Activer la classe du thème pop culture sur le body
    useEffect(() => {
        document.body.classList.add('pop-culture-theme');
        return () => {
            document.body.classList.remove('pop-culture-theme');
        };
    }, []);

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

            // Bug #4 fix: synchroniser le timer avec roundStartTime du serveur
            const duration = data.timePerRound || 60;
            if (data.roundStartTime) {
                const elapsed = Math.floor((Date.now() - data.roundStartTime) / 1000);
                const remaining = Math.max(0, duration - elapsed);
                startTimer(remaining);
            } else {
                startTimer(duration);
            }
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
            // Sync timer from server's roundStartTime
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
            console.log('[Remote] Game over event received:', data);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setStep('GAME_END');
            setFinalResults(data.results);
            setError(''); // Clear any previous errors
            // soundManager.play('win');
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

        // Auto-reconnect: if socket reconnects while already in a room, re-join
        const handleReconnect = () => {
            const savedCode = roomCodeRef.current;
            if (savedCode) {
                console.log('[Remote] Socket reconnected, re-joining room:', savedCode);
                connectWithCode(savedCode);
            }
        };
        socket.on('connect', handleReconnect);

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
            socket.off('connect', handleReconnect);
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

        socket.emit('geo-join-remote', { roomCode: code, remoteToken: remoteTokenRef.current }, (response) => {
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
                
                if (response.results) {
                    if (response.gameState === 'GAME_END') {
                        setFinalResults(response.results);
                    } else {
                        setRoundResults(response.results);
                    }
                }

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
    // Bug #8 fix: déjà déclaré plus haut pour être disponible dans handleReconnect

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
                    // Le serveur gère le auto-end round via son timer de sécurité
                    // Le remote n'envoie plus geo-end-round pour éviter les race conditions
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
            <div className="min-h-screen w-full relative overflow-hidden bg-background flex flex-col justify-center items-center p-4">
                <div className="pop-dots"></div>
                <div className="w-full max-w-[340px] flex flex-col gap-4 relative z-10">
                    
                    {/* Title */}
                    <div className="w-full text-center mb-2 flex flex-col items-center">
                        <h2 className="text-2xl font-black text-on-background text-center uppercase italic tracking-tighter mb-1 rotate-[-2deg] font-headline-xl">
                            📱 TÉLÉCOMMANDE
                        </h2>
                        <p className="text-[10px] text-center font-bold text-secondary uppercase tracking-wider">
                            Contrôle le jeu depuis ton mobile
                        </p>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="bg-white border-[3px] border-on-background p-6 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-secondary tracking-wider" htmlFor="roomCode">Code du Salon</label>
                            <input
                                className="w-full p-2.5 border-[3px] border-on-background font-bold text-center text-lg uppercase placeholder:text-on-background/30 focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg tracking-widest"
                                id="roomCode"
                                maxLength={6}
                                placeholder="EX: X7Z9"
                                type="text"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            />
                        </div>

                        <button
                            className="w-full bg-[#ffe16d] text-on-background font-black py-3 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            onClick={connectToRoom}
                            disabled={isConnecting}
                        >
                            {isConnecting ? (
                                <>
                                    <div className="w-4 h-4 rounded-full border-2 border-on-background border-t-transparent animate-spin"></div>
                                    <span className="text-xs font-black uppercase tracking-wider">CONNEXION...</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-xs font-black uppercase tracking-wider">🎮 CONNECTER</span>
                                </>
                            )}
                        </button>
                    </div>

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
    }

    // LOBBY Screen
    if (step === 'LOBBY') {
        const activePlayers = players.filter(p => !p.disconnected);

        return (
            <div className="min-h-screen w-full relative overflow-hidden bg-background flex flex-col p-4">
                <div className="pop-dots"></div>
                <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 relative z-10 flex-grow">
                    
                    {/* Header info */}
                    <div className="bg-[#bd00ff] text-white border-[3px] border-on-background p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#161a33] rotate-[-1deg] flex-shrink-0 flex items-center justify-between">
                        <h1 className="text-xs font-black uppercase tracking-widest italic font-headline-lg">
                            📱 TÉLÉCOMMANDE
                        </h1>
                        <span className="bg-[#ffe16d] text-on-background font-black text-[10px] px-2.5 py-0.5 border-2 border-on-background rounded-full shadow-[2px_2px_0px_0px_rgba(22,26,51,1)]">
                            PIN: {roomCode}
                        </span>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Players list Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-secondary">Joueurs connectés ({activePlayers.length})</h2>
                            <span className="material-symbols-outlined text-sm text-secondary animate-pulse">groups</span>
                        </div>
                        {activePlayers.length === 0 ? (
                            <p className="text-[10px] text-secondary font-black italic text-center py-2">En attente de joueurs...</p>
                        ) : (
                            <div className="flex flex-wrap gap-2 py-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                                {activePlayers.map((player, idx) => (
                                    <div 
                                        key={player.id || idx} 
                                        className="flex items-center gap-1.5 bg-[#dee0ff] text-on-background font-bold text-[10px] uppercase px-2.5 py-1 border-2 border-on-background rounded-full shadow-[2px_2px_0px_0px_rgba(22,26,51,1)]"
                                    >
                                        {player.avatar ? (
                                            <img src={player.avatar} alt="" className="w-4 h-4 rounded-full object-cover border border-on-background" />
                                        ) : (
                                            <span className="material-symbols-outlined text-[10px]">person</span>
                                        )}
                                        <span className="truncate max-w-[80px]">{player.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settings Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-secondary">Configuration de la partie</h2>
                            <span className="material-symbols-outlined text-sm text-secondary">tune</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase text-secondary/80">Manches</label>
                                <select
                                    className="w-full p-2 border-2 border-on-background font-bold text-[11px] uppercase focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg"
                                    value={settings.roundsCount}
                                    onChange={(e) => updateSettings({ ...settings, roundsCount: parseInt(e.target.value) })}
                                >
                                    {[3, 5, 7, 10, 15, 20].map(n => (
                                        <option key={n} value={n}>{n} Manches</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black uppercase text-secondary/80">Temps / Manche</label>
                                <select
                                    className="w-full p-2 border-2 border-on-background font-bold text-[11px] uppercase focus:outline-none focus:ring-0 bg-[#fbf8ff] rounded-lg"
                                    value={settings.timePerRound}
                                    onChange={(e) => updateSettings({ ...settings, timePerRound: parseInt(e.target.value) })}
                                >
                                    {[15, 30, 45, 60, 90, 120, 180, 240, 300].map(n => (
                                        <option key={n} value={n}>{n}s</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Region selector within settings */}
                        <div className="flex flex-col gap-1.5 mt-2">
                            <label className="text-[9px] font-black uppercase text-secondary/80">Régions de jeu ({settings.mapType.length})</label>
                            <div className="grid grid-cols-3 gap-1 max-h-[110px] overflow-y-auto custom-scrollbar border-2 border-on-background/10 p-1.5 bg-[#fbf8ff] rounded-lg">
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
                                    { id: 'themeparks', name: 'Parcs', icon: '🎢' },
                                    { id: 'beaches', name: 'Plages', icon: '🏖️' },
                                    { id: 'markets', name: 'Marchés', icon: '🛍️' },
                                ].map(region => {
                                    const isSelected = settings.mapType.includes(region.id);
                                    return (
                                        <button
                                            key={region.id}
                                            type="button"
                                            className={`p-1.5 rounded-lg border-2 flex flex-col items-center justify-center text-center transition-all duration-150 active:scale-95 ${
                                                isSelected 
                                                    ? 'border-on-background bg-[#ffc2eb] text-on-background font-bold shadow-[1.5px_1.5px_0px_0px_rgba(22,26,51,1)]' 
                                                    : 'border-on-background/10 bg-white text-secondary'
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
                                            <span className="text-sm mb-0.5">{region.icon}</span>
                                            <span className="text-[7.5px] uppercase font-bold tracking-tight truncate w-full">{region.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Launch Game button */}
                    <button
                        className="w-full mt-auto bg-[#ffe16d] text-on-background font-black py-4 border-[3px] border-on-background rounded-xl shadow-[4px_4px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        onClick={startGame}
                        disabled={activePlayers.length === 0}
                    >
                        <span className="text-sm font-black uppercase tracking-widest">🚀 LANCER LA PARTIE</span>
                    </button>
                </div>
            </div>
        );
    }

    // PLAYING Screen
    if (step === 'PLAYING') {
        const activePlayers = players.filter(p => !p.disconnected);

        return (
            <div className="min-h-screen w-full relative overflow-hidden bg-background flex flex-col p-4">
                <div className="pop-dots"></div>
                <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 relative z-10 flex-grow">
                    
                    {/* Header Info */}
                    <div className="flex justify-between items-center bg-[#dee0ff] border-[3px] border-on-background p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#161a33] rotate-[-1deg] flex-shrink-0">
                        <span className="bg-on-background text-white font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase">
                            Manche {currentRound}/{totalRounds}
                        </span>
                        
                        <div className={`text-xl font-black font-headline-xl uppercase tracking-tighter ${
                            timeLeft <= 10 ? 'text-error animate-pulse scale-105' : 'text-on-background'
                        }`}>
                            {formatTime(timeLeft)}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Progress Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-2">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-secondary">
                            <span>Réponses enregistrées</span>
                            <span>{guessedCount} / {activePlayers.length}</span>
                        </div>
                        
                        {/* Custom Pop Progress Bar */}
                        <div className="w-full h-4 bg-background border-2 border-on-background rounded-full overflow-hidden p-0.5 shadow-[1.5px_1.5px_0px_0px_rgba(22,26,51,1)]">
                            <div 
                                className="h-full bg-[#ffc2eb] border border-on-background rounded-full transition-all duration-300"
                                style={{ width: `${(guessedCount / (activePlayers.length || 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Current Standing Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3 flex-grow overflow-hidden">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-secondary">Classement Général</h2>
                            <span className="material-symbols-outlined text-sm text-secondary">leaderboard</span>
                        </div>
                        
                        <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar py-1">
                            {[...players]
                                .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                                .map((player, idx) => {
                                    const medals = ['🥇', '🥈', '🥉'];
                                    return (
                                        <div 
                                            key={player.id || idx} 
                                            className="flex justify-between items-center bg-[#fbf8ff] border-2 border-on-background p-2 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black">
                                                    {idx < 3 ? medals[idx] : `#${idx + 1}`}
                                                </span>
                                                <span className="text-[10px] font-black uppercase text-on-background truncate max-w-[120px]">
                                                    {player.name}
                                                    {player.disconnected && <span className="text-secondary/50 font-normal"> (deco)</span>}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-secondary">
                                                {(player.totalScore || 0).toLocaleString()} pts
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* End round button */}
                    <button
                        className="w-full bg-[#ffe16d] text-on-background font-black py-4 border-[3px] border-on-background rounded-xl shadow-[4px_4px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2"
                        onClick={endRound}
                    >
                        <span className="text-sm font-black uppercase tracking-widest">⏹️ TERMINER LA MANCHE</span>
                    </button>
                </div>
            </div>
        );
    }

    // ROUND_END Screen
    if (step === 'ROUND_END') {
        return (
            <div className="min-h-screen w-full relative overflow-hidden bg-background flex flex-col p-4">
                <div className="pop-dots"></div>
                <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 relative z-10 flex-grow">
                    
                    {/* Header Title */}
                    <div className="bg-[#ffc2eb] border-[3px] border-on-background p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#161a33] rotate-[1deg] flex-shrink-0 flex items-center justify-center">
                        <h1 className="text-xs font-black uppercase tracking-widest italic font-headline-lg text-on-background">
                            📊 RÉSULTATS DE LA MANCHE {currentRound}
                        </h1>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Results List Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3 flex-grow overflow-hidden">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-secondary">Résultats des Joueurs</h2>
                            <span className="material-symbols-outlined text-sm text-secondary">tour</span>
                        </div>
                        
                        <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar py-1">
                            {roundResults?.map((result, idx) => {
                                const medals = ['🥇', '🥈', '🥉'];
                                return (
                                    <div 
                                        key={result.id || idx} 
                                        className="flex justify-between items-center bg-[#fbf8ff] border-2 border-on-background p-2.5 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black">
                                                {idx < 3 ? medals[idx] : `#${idx + 1}`}
                                            </span>
                                            <span className="text-[10px] font-black uppercase text-on-background truncate max-w-[100px]">
                                                {result.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[9px] font-bold text-secondary bg-[#dee0ff] px-2 py-0.5 rounded-full border border-on-background/20">
                                                {formatDistance(result.distance)}
                                            </span>
                                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-300 rounded-md">
                                                +{(result.roundScore || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Next action button */}
                    <button
                        className="w-full bg-[#ffe16d] text-on-background font-black py-4 border-[3px] border-on-background rounded-xl shadow-[4px_4px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2"
                        onClick={nextRound}
                    >
                        <span className="text-sm font-black uppercase tracking-widest">
                            {currentRound < totalRounds ? '▶️ MANCHE SUIVANTE' : '🏆 VOIR LES RÉSULTATS'}
                        </span>
                    </button>
                </div>
            </div>
        );
    }

    // GAME_END Screen
    if (step === 'GAME_END') {
        return (
            <div className="min-h-screen w-full relative overflow-hidden bg-background flex flex-col p-4">
                <div className="pop-dots"></div>
                <div className="w-full max-w-[360px] mx-auto flex flex-col gap-4 relative z-10 flex-grow">
                    
                    {/* Header Title */}
                    <div className="bg-[#ffe16d] border-[3px] border-on-background p-3.5 rounded-xl shadow-[4px_4px_0px_0px_#161a33] rotate-[-1deg] flex-shrink-0 flex items-center justify-center">
                        <h1 className="text-xs font-black uppercase tracking-widest italic font-headline-lg text-on-background">
                            🏆 PARTIE TERMINÉE !
                        </h1>
                    </div>

                    {error && (
                        <div className="bg-error/15 border-[3px] border-error text-error text-[10px] rounded-xl p-2.5 text-center font-bold" role="alert">
                            {error}
                        </div>
                    )}

                    {/* Final Standing Bento */}
                    <div className="bg-white border-[3px] border-on-background p-4 rounded-xl shadow-[4px_4px_0px_0px_#161a33] flex flex-col gap-3 flex-grow overflow-hidden">
                        <div className="flex items-center justify-between border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-secondary">Podium Final</h2>
                            <span className="material-symbols-outlined text-sm text-secondary">military_tech</span>
                        </div>
                        
                        <div className="flex flex-col gap-2.5 overflow-y-auto custom-scrollbar py-1">
                            {finalResults?.map((result, idx) => {
                                const medals = ['🥇', '🥈', '🥉'];
                                const isPodium = idx < 3;
                                return (
                                    <div 
                                        key={result.id || idx} 
                                        className={`flex justify-between items-center p-3 rounded-lg border-2 border-on-background ${
                                            idx === 0 
                                                ? 'bg-[#ffe16d]/30 shadow-[2px_2px_0px_0px_rgba(22,26,51,1)]' 
                                                : idx === 1 
                                                    ? 'bg-[#dee0ff]/30' 
                                                    : idx === 2 
                                                        ? 'bg-[#ffc2eb]/30' 
                                                        : 'bg-[#fbf8ff]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-sm font-black">
                                                {isPodium ? medals[idx] : `#${idx + 1}`}
                                            </span>
                                            <span className="text-[10px] font-black uppercase text-on-background truncate max-w-[120px]">
                                                {result.name}
                                            </span>
                                        </div>
                                        <span className="text-xs font-black text-on-background">
                                            {(result.totalScore || 0).toLocaleString()} pts
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="flex flex-col gap-2.5 mt-auto">
                        <button
                            className="w-full bg-[#ffc2eb] text-on-background font-black py-3.5 border-[3px] border-on-background rounded-xl shadow-[4px_4px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2"
                            onClick={restartGame}
                        >
                            <span className="text-xs font-black uppercase tracking-wider">🔄 REJOUER UNE PARTIE</span>
                        </button>
                        <button
                            className="w-full bg-white text-secondary font-black py-3 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-px active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2"
                            onClick={() => navigate('/geo')}
                        >
                            <span className="text-xs font-black uppercase tracking-wider">🏠 RETOUR AU MENU</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default GeoRemoteView;
