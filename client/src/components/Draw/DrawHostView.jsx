import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../../socket';
import { QRCodeSVG } from 'qrcode.react';
import './DrawStyles.css';

function DrawHostView({ onBack }) {
    const [gameState, setGameState] = useState('CREATING'); // CREATING, LOBBY, PLAYING, ROUND_END, GAME_END
    const [roomCode, setRoomCode] = useState('');
    const [players, setPlayers] = useState([]);
    const [settings, setSettings] = useState({
        roundsPerPlayer: 2,
        timePerRound: 90,
        categories: ['all']
    });

    // Game state
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);
    const [currentDrawerId, setCurrentDrawerId] = useState(null);
    const [drawerName, setDrawerName] = useState('');
    const [wordCategory, setWordCategory] = useState('');
    const [wordLength, setWordLength] = useState(0);
    const [revealedWord, setRevealedWord] = useState(null);
    const [timer, setTimer] = useState(0);
    const [roundStartTime, setRoundStartTime] = useState(null);
    const [guessedPlayers, setGuessedPlayers] = useState(new Set());
    const [guessFeed, setGuessFeed] = useState([]);
    const [roundResults, setRoundResults] = useState([]);
    const [finalResults, setFinalResults] = useState([]);
    const [awards, setAwards] = useState([]);
    const [nextRoundCountdown, setNextRoundCountdown] = useState(0);

    // Canvas refs
    const canvasRef = useRef(null);
    const canvasContextRef = useRef(null);

    // Timer interval ref
    const timerRef = useRef(null);
    const countdownRef = useRef(null);

    // Create room on mount
    useEffect(() => {
        socket.emit('draw-create-room', { settings }, (response) => {
            if (response.roomCode) {
                setRoomCode(response.roomCode);
                setGameState('LOBBY');
            }
        });

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, []);

    // Socket event listeners
    useEffect(() => {
        const handlePlayerJoined = (playerList) => {
            console.log('[DRAW HOST] Players updated:', playerList);
            setPlayers(playerList);
        };

        const handlePlayerLeft = (playerList) => {
            setPlayers(playerList);
        };

        const handleGameStarted = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setCurrentDrawerId(data.drawerId);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setRoundStartTime(data.roundStartTime);
            setTimer(data.timePerRound);
            setGuessedPlayers(new Set());
            setGuessFeed([]);
            clearCanvas();
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleNextRound = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setCurrentDrawerId(data.drawerId);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setRoundStartTime(data.roundStartTime);
            setTimer(data.timePerRound);
            setGuessedPlayers(new Set());
            setGuessFeed([]);
            clearCanvas();
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleStroke = (stroke) => {
            drawStroke(stroke);
        };

        const handleClear = () => {
            clearCanvas();
        };

        const handlePlayerGuessed = (data) => {
            setGuessedPlayers(prev => new Set([...prev, data.playerId]));
            setGuessFeed(prev => [{
                type: 'correct',
                playerName: data.playerName,
                rank: data.rank,
                points: data.points,
                id: Date.now()
            }, ...prev]);
        };

        const handleCloseGuess = (data) => {
            setGuessFeed(prev => [{
                type: 'close',
                playerName: data.playerName,
                id: Date.now()
            }, ...prev]);
        };

        const handleAllGuessed = () => {
            // Everyone guessed, end round early
            endRound();
        };

        const handleRoundEnded = (data) => {
            setGameState('ROUND_END');
            setRevealedWord(data.word);
            setRoundResults(data.results);
            if (timerRef.current) clearInterval(timerRef.current);

            // Start next round countdown
            setNextRoundCountdown(8);
            countdownRef.current = setInterval(() => {
                setNextRoundCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownRef.current);
                        nextRound();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        const handleGameOver = (data) => {
            setGameState('GAME_END');
            setFinalResults(data.results);
            setAwards(data.awards || []);
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };

        const handleWordSkipped = (data) => {
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            clearCanvas();
        };

        const handleGameRestarted = () => {
            setGameState('LOBBY');
            setCurrentRound(0);
            setGuessedPlayers(new Set());
            setGuessFeed([]);
        };

        socket.on('draw-player-joined', handlePlayerJoined);
        socket.on('draw-player-left', handlePlayerLeft);
        socket.on('draw-game-started', handleGameStarted);
        socket.on('draw-next-round', handleNextRound);
        socket.on('draw-stroke', handleStroke);
        socket.on('draw-clear', handleClear);
        socket.on('draw-player-guessed', handlePlayerGuessed);
        socket.on('draw-close-guess', handleCloseGuess);
        socket.on('draw-all-guessed', handleAllGuessed);
        socket.on('draw-round-ended', handleRoundEnded);
        socket.on('draw-game-over', handleGameOver);
        socket.on('draw-word-skipped', handleWordSkipped);
        socket.on('draw-game-restarted', handleGameRestarted);

        return () => {
            socket.off('draw-player-joined', handlePlayerJoined);
            socket.off('draw-player-left', handlePlayerLeft);
            socket.off('draw-game-started', handleGameStarted);
            socket.off('draw-next-round', handleNextRound);
            socket.off('draw-stroke', handleStroke);
            socket.off('draw-clear', handleClear);
            socket.off('draw-player-guessed', handlePlayerGuessed);
            socket.off('draw-close-guess', handleCloseGuess);
            socket.off('draw-all-guessed', handleAllGuessed);
            socket.off('draw-round-ended', handleRoundEnded);
            socket.off('draw-game-over', handleGameOver);
            socket.off('draw-word-skipped', handleWordSkipped);
            socket.off('draw-game-restarted', handleGameRestarted);
        };
    }, [roomCode]);

    // Initialize canvas
    useEffect(() => {
        if (canvasRef.current && (gameState === 'PLAYING' || gameState === 'ROUND_END')) {
            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            const ctx = canvas.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            canvasContextRef.current = ctx;
        }
    }, [gameState]);

    const startTimer = (duration, startTime) => {
        if (timerRef.current) clearInterval(timerRef.current);

        const updateTimer = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            setTimer(Math.ceil(remaining));

            if (remaining <= 0) {
                clearInterval(timerRef.current);
                endRound();
            }
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);
    };

    const drawStroke = (stroke) => {
        if (!canvasContextRef.current || !canvasRef.current) return;
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;

        ctx.beginPath();
        stroke.points.forEach((point, index) => {
            const x = point.x * canvas.width;
            const y = point.y * canvas.height;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    };

    const clearCanvas = () => {
        if (!canvasContextRef.current || !canvasRef.current) return;
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const startGame = () => {
        console.log('[DRAW] Starting game with players:', players.length, 'roomCode:', roomCode);
        console.log('[DRAW] Socket connected:', socket.connected, 'socket.id:', socket.id);
        console.log('[DRAW] Players list:', players);
        if (players.length < 2) {
            alert('Minimum 2 joueurs requis');
            return;
        }
        console.log('[DRAW] Emitting draw-start-game event...');
        socket.emit('draw-start-game', { roomCode, settings }, (response) => {
            console.log('[DRAW] Start game response:', response);
            if (response.error) {
                alert(response.error);
            }
        });
    };

    const endRound = () => {
        socket.emit('draw-end-round', { roomCode }, (response) => {
            if (response.error) {
                console.error(response.error);
            }
        });
    };

    const nextRound = () => {
        socket.emit('draw-next-round', { roomCode }, (response) => {
            if (response.error) {
                console.error(response.error);
            }
        });
    };

    const restartGame = () => {
        socket.emit('draw-restart-game', { roomCode }, (response) => {
            if (response.success) {
                setGameState('LOBBY');
            }
        });
    };

    const getWordBlanks = () => {
        if (!wordLength) return '';
        return '_ '.repeat(wordLength).trim();
    };

    const getTimerClass = () => {
        if (timer <= 10) return 'draw-timer danger';
        if (timer <= 30) return 'draw-timer warning';
        return 'draw-timer';
    };

    const getSortedPlayers = () => {
        return [...players].sort((a, b) => b.score - a.score);
    };

    // Get join URL
    const joinUrl = `${window.location.origin}?code=${roomCode}&game=draw`;

    // LOBBY STATE
    if (gameState === 'LOBBY') {
        return (
            <div className="draw-lobby">
                <button className="btn btn-outline-secondary position-absolute" style={{ top: 20, left: 20 }} onClick={onBack}>
                    ← Retour
                </button>

                <h1 className="draw-title">🎨 DRAW UP</h1>
                <p className="draw-subtitle">Le jeu du dessin en temps réel</p>

                <div className="text-center">
                    <div className="draw-room-code">
                        <div className="draw-room-code-label">Code du salon</div>
                        <div className="draw-room-code-value">{roomCode}</div>
                    </div>
                </div>

                <div className="text-center mb-4">
                    <div className="draw-qr-container">
                        <QRCodeSVG value={joinUrl} size={150} />
                    </div>
                    <div className="draw-join-url">{joinUrl}</div>
                </div>

                <div className="draw-players-grid">
                    {players.map(player => (
                        <div key={player.id} className="draw-player-card">
                            <div className="draw-player-avatar">
                                {player.avatar || '👤'}
                            </div>
                            <div className="draw-player-name">{player.name}</div>
                        </div>
                    ))}
                    {players.length === 0 && (
                        <div className="text-center text-muted" style={{ gridColumn: '1 / -1' }}>
                            En attente de joueurs...
                        </div>
                    )}
                </div>

                <div className="draw-settings">
                    <h3>⚙️ Paramètres</h3>

                    <div className="draw-setting-row">
                        <span className="draw-setting-label">Tours par joueur</span>
                        <div className="draw-setting-value">
                            <button className="draw-setting-btn" onClick={() => setSettings(s => ({ ...s, roundsPerPlayer: Math.max(1, s.roundsPerPlayer - 1) }))}>−</button>
                            <span className="draw-setting-number">{settings.roundsPerPlayer}</span>
                            <button className="draw-setting-btn" onClick={() => setSettings(s => ({ ...s, roundsPerPlayer: Math.min(5, s.roundsPerPlayer + 1) }))}>+</button>
                        </div>
                    </div>

                    <div className="draw-setting-row">
                        <span className="draw-setting-label">Temps par tour (sec)</span>
                        <div className="draw-setting-value">
                            <button className="draw-setting-btn" onClick={() => setSettings(s => ({ ...s, timePerRound: Math.max(30, s.timePerRound - 15) }))}>−</button>
                            <span className="draw-setting-number">{settings.timePerRound}</span>
                            <button className="draw-setting-btn" onClick={() => setSettings(s => ({ ...s, timePerRound: Math.min(180, s.timePerRound + 15) }))}>+</button>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <button
                        className="draw-start-btn"
                        onClick={startGame}
                        disabled={players.length < 2}
                    >
                        🎨 Lancer la Partie
                    </button>
                    {players.length < 2 && (
                        <p className="text-muted mt-2">Minimum 2 joueurs requis ({players.length}/2)</p>
                    )}
                    {/* DEBUG: Test button to check if clicks work */}
                    <button
                        style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#333', color: 'white', border: 'none', borderRadius: '8px' }}
                        onClick={() => {
                            console.log('[DEBUG] Test button clicked!');
                            console.log('[DEBUG] players:', players);
                            console.log('[DEBUG] roomCode:', roomCode);
                            console.log('[DEBUG] socket.connected:', socket.connected);
                        }}
                    >
                        🔧 Debug Info
                    </button>
                </div>
            </div>
        );
    }

    // PLAYING STATE
    if (gameState === 'PLAYING') {
        return (
            <div className="draw-game-container">
                <div className="draw-main-area">
                    <div className="draw-header">
                        <div className="draw-round-info">
                            Round <span className="draw-round-number">{currentRound}</span> / {totalRounds}
                        </div>
                        <div className="draw-word-hint">
                            <span className="draw-category-badge">{wordCategory}</span>
                            <span className="draw-word-blanks">{getWordBlanks()}</span>
                        </div>
                        <div className={getTimerClass()}>
                            {timer}
                        </div>
                    </div>

                    <div className="draw-canvas-container">
                        <div className="draw-drawer-banner">
                            🎨 <span className="drawer-name">{drawerName}</span> dessine...
                        </div>
                        <canvas ref={canvasRef} className="draw-canvas" />
                    </div>
                </div>

                <div className="draw-sidebar">
                    <div className="draw-leaderboard">
                        <h3>🏆 Classement</h3>
                        <div className="draw-leaderboard-list">
                            {getSortedPlayers().map((player, index) => (
                                <div
                                    key={player.id}
                                    className={`draw-leaderboard-item ${guessedPlayers.has(player.id) ? 'guessed' : ''} ${player.id === currentDrawerId ? 'drawing' : ''}`}
                                >
                                    <div className={`draw-leaderboard-rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>
                                        {index + 1}
                                    </div>
                                    <span className="draw-leaderboard-name">{player.name}</span>
                                    <span className="draw-leaderboard-score">{player.score}</span>
                                    <span className="draw-leaderboard-status">
                                        {player.id === currentDrawerId ? '🎨' : guessedPlayers.has(player.id) ? '✅' : '💭'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="draw-guesses-feed">
                        <h3>💬 Dernières réponses</h3>
                        {guessFeed.slice(0, 10).map(guess => (
                            <div key={guess.id} className={`draw-guess-item ${guess.type}`}>
                                {guess.type === 'correct' ? (
                                    <>✅ <span className="draw-guess-name">{guess.playerName}</span> a trouvé ! (+{guess.points} pts)</>
                                ) : (
                                    <>🔥 <span className="draw-guess-name">{guess.playerName}</span> est très proche !</>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ROUND END STATE
    if (gameState === 'ROUND_END') {
        return (
            <div className="draw-round-end">
                <div className="draw-round-end-word">
                    <div className="draw-round-end-label">Le mot était</div>
                    <div className="draw-round-end-answer">{revealedWord?.word}</div>
                </div>

                <div className="draw-round-results">
                    {roundResults.map(player => (
                        <div
                            key={player.id}
                            className={`draw-result-card ${player.guessedThisRound ? 'guessed' : ''} ${player.wasDrawer ? 'drawer' : ''}`}
                        >
                            <div className="draw-result-avatar">
                                {player.avatar || '👤'}
                            </div>
                            <div className="draw-result-info">
                                <div className="draw-result-name">{player.name}</div>
                                <div className={`draw-result-status ${player.wasDrawer ? 'drawer' : player.guessedThisRound ? 'guessed' : 'missed'}`}>
                                    {player.wasDrawer ? '🎨 Dessinateur' : player.guessedThisRound ? '✅ Trouvé !' : '❌ Pas trouvé'}
                                </div>
                            </div>
                            <div className="draw-result-score">{player.score}</div>
                        </div>
                    ))}
                </div>

                <div className="draw-next-countdown">
                    <div className="draw-next-countdown-text">Prochain tour dans</div>
                    <div className="draw-next-countdown-number">{nextRoundCountdown}</div>
                </div>
            </div>
        );
    }

    // GAME END STATE
    if (gameState === 'GAME_END') {
        const winner = finalResults[0];
        const podium = finalResults.slice(0, 3);

        return (
            <div className="draw-game-end">
                <div className="draw-winner-crown">👑</div>
                <div className="draw-winner-name">{winner?.name}</div>
                <div className="draw-winner-score">{winner?.score} points</div>

                <div className="draw-podium">
                    {podium[1] && (
                        <div className="draw-podium-item second">
                            <div className="draw-podium-avatar">{podium[1].avatar || '👤'}</div>
                            <div className="draw-podium-name">{podium[1].name}</div>
                            <div className="draw-podium-score">{podium[1].score} pts</div>
                            <div className="draw-podium-stand">2</div>
                        </div>
                    )}
                    {podium[0] && (
                        <div className="draw-podium-item first">
                            <div className="draw-podium-avatar">{podium[0].avatar || '👤'}</div>
                            <div className="draw-podium-name">{podium[0].name}</div>
                            <div className="draw-podium-score">{podium[0].score} pts</div>
                            <div className="draw-podium-stand">1</div>
                        </div>
                    )}
                    {podium[2] && (
                        <div className="draw-podium-item third">
                            <div className="draw-podium-avatar">{podium[2].avatar || '👤'}</div>
                            <div className="draw-podium-name">{podium[2].name}</div>
                            <div className="draw-podium-score">{podium[2].score} pts</div>
                            <div className="draw-podium-stand">3</div>
                        </div>
                    )}
                </div>

                {awards.length > 0 && (
                    <div className="draw-awards">
                        {awards.map((award, index) => (
                            <div key={index} className="draw-award">
                                <div className="draw-award-icon">{award.icon}</div>
                                <div className="draw-award-title">{award.title}</div>
                                <div className="draw-award-player">{award.playerName}</div>
                                <div className="draw-award-value">{award.value}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="draw-end-buttons">
                    <button className="draw-btn draw-btn-primary" onClick={restartGame}>
                        🔄 Rejouer
                    </button>
                    <button className="draw-btn draw-btn-secondary" onClick={onBack}>
                        🏠 Menu
                    </button>
                </div>
            </div>
        );
    }

    // CREATING STATE (loading)
    return (
        <div className="draw-lobby" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="text-center">
                <div className="draw-title">🎨 DRAW UP</div>
                <p className="text-muted">Création du salon...</p>
            </div>
        </div>
    );
}

export default DrawHostView;
