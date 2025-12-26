import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../../socket';
import './DrawStyles.css';

// Drawing colors available
const COLORS = [
    { name: 'black', value: '#000000' },
    { name: 'red', value: '#e71d36' },
    { name: 'orange', value: '#ff9f1c' },
    { name: 'yellow', value: '#ffe66d' },
    { name: 'green', value: '#00d26a' },
    { name: 'blue', value: '#4ecdc4' },
    { name: 'purple', value: '#9b59b6' },
    { name: 'brown', value: '#8b4513' },
];

const BRUSH_SIZES = [5, 10, 20, 35];

function DrawPlayerView({ onBack, initialRoomCode }) {
    // Connection state
    const [playerName, setPlayerName] = useState('');
    const [avatar, setAvatar] = useState('🎨');
    const [roomCode, setRoomCode] = useState(initialRoomCode || '');
    const [isJoined, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    // Game state
    const [gameState, setGameState] = useState('LOBBY');
    const [isDrawer, setIsDrawer] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);
    const [drawerName, setDrawerName] = useState('');
    const [wordCategory, setWordCategory] = useState('');
    const [wordLength, setWordLength] = useState(0);
    const [myWord, setMyWord] = useState(null);
    const [timer, setTimer] = useState(0);
    const [roundStartTime, setRoundStartTime] = useState(null);
    const [timePerRound, setTimePerRound] = useState(90);

    // Guessing state
    const [guess, setGuess] = useState('');
    const [hasGuessed, setHasGuessed] = useState(false);
    const [guessResult, setGuessResult] = useState(null);
    const [myScore, setMyScore] = useState(0);

    // Drawing state
    const [selectedColor, setSelectedColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(10);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState([]);

    // Round end state
    const [revealedWord, setRevealedWord] = useState(null);
    const [roundResults, setRoundResults] = useState([]);
    const [finalResults, setFinalResults] = useState([]);
    const [awards, setAwards] = useState([]);

    // Canvas refs
    const canvasRef = useRef(null);
    const canvasContextRef = useRef(null);
    const timerRef = useRef(null);

    // Load stored session
    useEffect(() => {
        const stored = localStorage.getItem('draw-session');
        if (stored) {
            try {
                const { name, avatar: storedAvatar, roomCode: storedRoom } = JSON.parse(stored);
                if (name) setPlayerName(name);
                if (storedAvatar) setAvatar(storedAvatar);
                // Only use stored room if no initial code provided
                if (!initialRoomCode && storedRoom) setRoomCode(storedRoom);
            } catch (e) {
                console.error('Error parsing stored session:', e);
            }
        }
    }, [initialRoomCode]);

    // Socket event listeners
    useEffect(() => {
        if (!isJoined) return;

        const handleGameStarted = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setRoundStartTime(data.roundStartTime);
            setTimePerRound(data.timePerRound);
            setIsDrawer(data.drawerId === socket.id);
            setHasGuessed(false);
            setGuessResult(null);
            setMyWord(null);
            clearCanvas();
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleYourWord = (data) => {
            setMyWord(data);
            setIsDrawer(true);
        };

        const handleNextRound = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setRoundStartTime(data.roundStartTime);
            setIsDrawer(data.drawerId === socket.id);
            setHasGuessed(false);
            setGuessResult(null);
            setMyWord(null);
            clearCanvas();
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleStroke = (stroke) => {
            drawStroke(stroke);
        };

        const handleClear = () => {
            clearCanvas();
        };

        const handleWordSkipped = (data) => {
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            clearCanvas();
        };

        const handleRoundEnded = (data) => {
            setGameState('ROUND_END');
            setRevealedWord(data.word);
            setRoundResults(data.results);
            if (timerRef.current) clearInterval(timerRef.current);

            // Update my score
            const me = data.results.find(p => p.id === socket.id);
            if (me) setMyScore(me.score);
        };

        const handleGameOver = (data) => {
            setGameState('GAME_END');
            setFinalResults(data.results);
            setAwards(data.awards || []);
            if (timerRef.current) clearInterval(timerRef.current);

            const me = data.results.find(p => p.id === socket.id);
            if (me) setMyScore(me.score);
        };

        const handleGameRestarted = () => {
            setGameState('LOBBY');
            setCurrentRound(0);
            setMyScore(0);
            setHasGuessed(false);
            setIsDrawer(false);
            setMyWord(null);
        };

        const handleKicked = () => {
            setIsJoined(false);
            setError('Vous avez été expulsé de la partie');
        };

        socket.on('draw-game-started', handleGameStarted);
        socket.on('draw-your-word', handleYourWord);
        socket.on('draw-next-round', handleNextRound);
        socket.on('draw-stroke', handleStroke);
        socket.on('draw-clear', handleClear);
        socket.on('draw-word-skipped', handleWordSkipped);
        socket.on('draw-round-ended', handleRoundEnded);
        socket.on('draw-game-over', handleGameOver);
        socket.on('draw-game-restarted', handleGameRestarted);
        socket.on('draw-kicked', handleKicked);

        return () => {
            socket.off('draw-game-started', handleGameStarted);
            socket.off('draw-your-word', handleYourWord);
            socket.off('draw-next-round', handleNextRound);
            socket.off('draw-stroke', handleStroke);
            socket.off('draw-clear', handleClear);
            socket.off('draw-word-skipped', handleWordSkipped);
            socket.off('draw-round-ended', handleRoundEnded);
            socket.off('draw-game-over', handleGameOver);
            socket.off('draw-game-restarted', handleGameRestarted);
            socket.off('draw-kicked', handleKicked);
        };
    }, [isJoined, roomCode]);

    // Initialize canvas
    useEffect(() => {
        if (canvasRef.current && gameState === 'PLAYING') {
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
    }, [gameState, isDrawer]);

    const startTimer = (duration, startTime) => {
        if (timerRef.current) clearInterval(timerRef.current);

        const updateTimer = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            setTimer(Math.ceil(remaining));
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);
    };

    const joinRoom = () => {
        if (!playerName.trim()) {
            setError('Entrez votre nom');
            return;
        }
        if (!roomCode.trim()) {
            setError('Entrez le code du salon');
            return;
        }

        socket.emit('draw-join-room', {
            roomCode: roomCode.toUpperCase(),
            playerName: playerName.trim(),
            avatar
        }, (response) => {
            if (response.error) {
                setError(response.error);
            } else {
                setIsJoined(true);
                setError('');
                localStorage.setItem('draw-session', JSON.stringify({
                    name: playerName,
                    avatar,
                    roomCode: roomCode.toUpperCase()
                }));

                if (response.gameState === 'PLAYING') {
                    setGameState('PLAYING');
                    setCurrentRound(response.currentRound);
                    setIsDrawer(response.currentDrawerId === socket.id);
                    if (response.canvasHistory) {
                        // Replay canvas history
                        setTimeout(() => {
                            response.canvasHistory.forEach(stroke => drawStroke(stroke));
                        }, 100);
                    }
                }
            }
        });
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

    // Drawing handlers
    const getCanvasCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if (e.touches) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    };

    const handleDrawStart = (e) => {
        if (!isDrawer) return;
        e.preventDefault();

        setIsDrawing(true);
        const coords = getCanvasCoordinates(e);
        setCurrentStroke([coords]);

        // Draw point
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.moveTo(coords.x * canvas.width, coords.y * canvas.height);
        ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
        ctx.stroke();
    };

    const handleDrawMove = (e) => {
        if (!isDrawing || !isDrawer) return;
        e.preventDefault();

        const coords = getCanvasCoordinates(e);
        const newStroke = [...currentStroke, coords];
        setCurrentStroke(newStroke);

        // Draw line segment
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        const prevCoords = currentStroke[currentStroke.length - 1];

        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.moveTo(prevCoords.x * canvas.width, prevCoords.y * canvas.height);
        ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
        ctx.stroke();
    };

    const handleDrawEnd = () => {
        if (!isDrawing || !isDrawer) return;
        setIsDrawing(false);

        // Send stroke to server
        if (currentStroke.length > 0) {
            socket.emit('draw-stroke', {
                roomCode,
                stroke: {
                    color: selectedColor,
                    size: brushSize,
                    points: currentStroke
                }
            });
        }
        setCurrentStroke([]);
    };

    const handleClearCanvas = () => {
        clearCanvas();
        socket.emit('draw-clear', { roomCode });
    };

    const handleSkipWord = () => {
        socket.emit('draw-skip-word', { roomCode }, (response) => {
            if (response.success) {
                setMyWord({
                    word: response.word,
                    category: response.category,
                    hint: response.hint
                });
                clearCanvas();
            }
        });
    };

    // Guess submission
    const submitGuess = () => {
        if (!guess.trim() || hasGuessed) return;

        socket.emit('draw-submit-guess', { roomCode, guess: guess.trim() }, (response) => {
            if (response.correct) {
                setHasGuessed(true);
                setGuessResult({
                    correct: true,
                    points: response.points,
                    rank: response.rank
                });
                setMyScore(prev => prev + response.points);
            } else if (response.closeMatch) {
                setGuessResult({
                    correct: false,
                    closeMatch: true,
                    message: response.message
                });
                // Clear after a moment
                setTimeout(() => setGuessResult(null), 2000);
            }
            setGuess('');
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

    // JOIN SCREEN
    if (!isJoined) {
        return (
            <div className="draw-player-view" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ maxWidth: 400, width: '100%', padding: '0 1rem' }}>
                    <h1 className="draw-title" style={{ fontSize: '2.5rem' }}>🎨 DRAW UP</h1>
                    <p className="draw-subtitle">Rejoindre une partie</p>

                    {error && (
                        <div style={{ background: 'rgba(231, 29, 54, 0.2)', border: '1px solid var(--draw-danger)', borderRadius: 10, padding: '0.75rem', marginBottom: '1rem', color: 'var(--draw-danger)', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', display: 'block' }}>Code du salon</label>
                        <input
                            type="text"
                            className="draw-guess-input"
                            placeholder="ABCD12"
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                            style={{ textAlign: 'center', letterSpacing: 5, fontSize: '1.5rem' }}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', display: 'block' }}>Ton pseudo</label>
                        <input
                            type="text"
                            className="draw-guess-input"
                            placeholder="Ton nom"
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            maxLength={20}
                        />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', display: 'block' }}>Ton avatar</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {['🎨', '🖌️', '✏️', '🖍️', '🎭', '🌟', '🔥', '💎', '🦄', '🐱', '🐶', '🦊'].map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => setAvatar(emoji)}
                                    style={{
                                        width: 50,
                                        height: 50,
                                        fontSize: '1.5rem',
                                        border: avatar === emoji ? '3px solid var(--draw-secondary)' : '2px solid rgba(255,255,255,0.2)',
                                        borderRadius: 10,
                                        background: avatar === emoji ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255,255,255,0.05)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className="draw-start-btn" onClick={joinRoom} style={{ width: '100%' }}>
                        Rejoindre
                    </button>

                    <button
                        className="draw-btn draw-btn-secondary"
                        onClick={onBack}
                        style={{ width: '100%', marginTop: '1rem' }}
                    >
                        ← Retour
                    </button>
                </div>
            </div>
        );
    }

    // LOBBY STATE
    if (gameState === 'LOBBY') {
        return (
            <div className="draw-player-view" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="text-center">
                    <div className="draw-player-avatar" style={{ width: 100, height: 100, fontSize: '3rem', margin: '0 auto 1rem' }}>
                        {avatar}
                    </div>
                    <h2 style={{ color: 'white' }}>{playerName}</h2>
                    <p style={{ color: 'var(--draw-secondary)' }}>Salon: {roomCode}</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '2rem' }}>
                        ⏳ En attente du lancement de la partie...
                    </p>
                </div>
            </div>
        );
    }

    // PLAYING STATE - DRAWER VIEW
    if (gameState === 'PLAYING' && isDrawer) {
        return (
            <div className="draw-player-view">
                <div className="draw-header" style={{ borderRadius: 15, marginBottom: '0.5rem' }}>
                    <div className="draw-round-info">
                        Round <span className="draw-round-number">{currentRound}</span> / {totalRounds}
                    </div>
                    <div className={getTimerClass()}>
                        {timer}
                    </div>
                </div>

                {myWord && (
                    <div className="draw-your-word">
                        <div className="draw-your-word-label">À toi de dessiner :</div>
                        <div className="draw-your-word-text">{myWord.word}</div>
                        {myWord.hint && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>💡 {myWord.hint}</div>}
                        <button className="draw-skip-btn" onClick={handleSkipWord}>
                            🔄 Passer ce mot
                        </button>
                    </div>
                )}

                <div className="draw-tools">
                    {COLORS.map(color => (
                        <button
                            key={color.name}
                            className={`draw-tool-btn draw-color-btn ${color.name} ${selectedColor === color.value ? 'active' : ''}`}
                            style={{ background: color.value }}
                            onClick={() => setSelectedColor(color.value)}
                        />
                    ))}
                </div>

                <div className="draw-tools">
                    {BRUSH_SIZES.map(size => (
                        <button
                            key={size}
                            className={`draw-tool-btn draw-size-btn ${brushSize === size ? 'active' : ''}`}
                            onClick={() => setBrushSize(size)}
                        >
                            {size}
                        </button>
                    ))}
                    <button
                        className="draw-tool-btn draw-action-btn clear"
                        onClick={handleClearCanvas}
                    >
                        🗑️
                    </button>
                </div>

                <div className="draw-canvas-container" style={{ flex: 1 }}>
                    <canvas
                        ref={canvasRef}
                        className="draw-canvas"
                        onMouseDown={handleDrawStart}
                        onMouseMove={handleDrawMove}
                        onMouseUp={handleDrawEnd}
                        onMouseLeave={handleDrawEnd}
                        onTouchStart={handleDrawStart}
                        onTouchMove={handleDrawMove}
                        onTouchEnd={handleDrawEnd}
                    />
                </div>
            </div>
        );
    }

    // PLAYING STATE - GUESSER VIEW
    if (gameState === 'PLAYING' && !isDrawer) {
        return (
            <div className="draw-player-view">
                <div className="draw-header" style={{ borderRadius: 15, marginBottom: '0.5rem' }}>
                    <div className="draw-round-info">
                        Round <span className="draw-round-number">{currentRound}</span> / {totalRounds}
                    </div>
                    <div className={getTimerClass()}>
                        {timer}
                    </div>
                </div>

                <div style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                    <span className="draw-category-badge">{wordCategory}</span>
                    <span className="draw-word-blanks" style={{ marginLeft: '1rem' }}>{getWordBlanks()}</span>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        🎨 {drawerName} dessine...
                    </p>
                </div>

                <div className="draw-canvas-viewer" style={{ flex: 1, position: 'relative' }}>
                    <canvas ref={canvasRef} className="draw-canvas" style={{ pointerEvents: 'none' }} />

                    {hasGuessed && (
                        <div className="draw-guessed-overlay">
                            <div className="draw-guessed-icon">✅</div>
                            <div className="draw-guessed-text">Bien joué !</div>
                            <div className="draw-guessed-points">+{guessResult?.points} points (#{guessResult?.rank})</div>
                        </div>
                    )}
                </div>

                <div className="draw-guess-container">
                    {guessResult?.closeMatch && (
                        <div style={{ color: 'var(--draw-warning)', marginBottom: '0.5rem', textAlign: 'center' }}>
                            🔥 {guessResult.message}
                        </div>
                    )}
                    <div className="draw-guess-input-wrapper">
                        <input
                            type="text"
                            className={`draw-guess-input ${guessResult?.closeMatch ? 'close-match' : ''}`}
                            placeholder="Tape ta réponse..."
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && submitGuess()}
                            disabled={hasGuessed}
                        />
                        <button
                            className="draw-guess-submit"
                            onClick={submitGuess}
                            disabled={hasGuessed || !guess.trim()}
                        >
                            ✓
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ROUND END STATE
    if (gameState === 'ROUND_END') {
        return (
            <div className="draw-player-view" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="draw-round-end-word" style={{ marginBottom: '2rem' }}>
                    <div className="draw-round-end-label">Le mot était</div>
                    <div className="draw-round-end-answer" style={{ fontSize: '2.5rem' }}>{revealedWord?.word}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Ton score</div>
                    <div style={{ color: 'var(--draw-accent)', fontSize: '3rem', fontWeight: 900 }}>{myScore}</div>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Prochain tour bientôt...</p>
            </div>
        );
    }

    // GAME END STATE
    if (gameState === 'GAME_END') {
        const myRank = finalResults.findIndex(p => p.id === socket.id) + 1;
        const winner = finalResults[0];

        return (
            <div className="draw-player-view" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <div className="text-center">
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
                        {myRank === 1 ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎨'}
                    </div>

                    <div style={{ fontSize: '1.5rem', color: 'white', marginBottom: '0.5rem' }}>
                        Tu es <span style={{ color: 'var(--draw-secondary)', fontWeight: 700 }}>#{myRank}</span>
                    </div>

                    <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--draw-accent)' }}>
                        {myScore} pts
                    </div>

                    {myRank === 1 && (
                        <div style={{ marginTop: '1rem', fontSize: '1.2rem', color: 'var(--draw-success)' }}>
                            🎉 Tu as gagné !
                        </div>
                    )}

                    {myRank !== 1 && (
                        <div style={{ marginTop: '1rem', color: 'rgba(255,255,255,0.6)' }}>
                            Vainqueur : <span style={{ color: 'var(--draw-primary)' }}>{winner?.name}</span>
                        </div>
                    )}

                    <button
                        className="draw-btn draw-btn-secondary"
                        onClick={onBack}
                        style={{ marginTop: '2rem' }}
                    >
                        🏠 Menu
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default DrawPlayerView;
