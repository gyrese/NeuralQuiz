import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { playCountdownSound, playSuccessSound, playFailSound, playWinnerSound } from '../../utils/audio';
import './DrawStyles.css';

// Avatars partagés avec GeoTrackr (60 webp)
const ALL_AVATARS = Array.from({ length: 60 }, (_, i) => `/avatars/avatar_${i + 1}.webp`);

const COLORS = [
    { name: 'Noir',   value: '#000000' },
    { name: 'Rouge',  value: '#e71d36' },
    { name: 'Orange', value: '#ff9f1c' },
    { name: 'Jaune',  value: '#ffe66d' },
    { name: 'Vert',   value: '#00d26a' },
    { name: 'Bleu',   value: '#4ecdc4' },
    { name: 'Violet', value: '#9b59b6' },
    { name: 'Marron', value: '#8b4513' },
    { name: 'Blanc',  value: '#ffffff' },
];

const BRUSH_SIZES = [3, 8, 16, 30];

function DrawPlayerView() {
    const navigate = useNavigate();
    const { roomCode: urlRoomCode } = useParams();

    const [playerName, setPlayerName] = useState('');
    const [avatar, setAvatar] = useState(ALL_AVATARS[0]);
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [isJoined, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    const [gameState, setGameState] = useState('LOBBY');
    const [isDrawer, setIsDrawer] = useState(false);
    const [currentRound, setCurrentRound] = useState(0);
    const [totalRounds, setTotalRounds] = useState(0);
    const [drawerName, setDrawerName] = useState('');
    const [wordCategory, setWordCategory] = useState('');
    const [wordLength, setWordLength] = useState(0);
    const [myWord, setMyWord] = useState(null);
    const [timer, setTimer] = useState(0);
    const [timePerRound, setTimePerRound] = useState(90);

    const [guess, setGuess] = useState('');
    const [hasGuessed, setHasGuessed] = useState(false);
    const [guessResult, setGuessResult] = useState(null);
    const [myScore, setMyScore] = useState(0);
    const [shakeGuess, setShakeGuess] = useState(false);

    const [selectedColor, setSelectedColor] = useState('#000000');
    const [brushSize, setBrushSize] = useState(8);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState([]);
    const [isEraser, setIsEraser] = useState(false);
    const [countdownVal, setCountdownVal] = useState(0);

    const [revealedWord, setRevealedWord] = useState(null);
    const [finalResults, setFinalResults] = useState([]);
    const [awards, setAwards] = useState([]);

    const canvasRef = useRef(null);
    const canvasContextRef = useRef(null);
    const timerRef = useRef(null);
    const guessInputRef = useRef(null);
    const strokesHistoryRef = useRef([]);
    const countdownIntervalRef = useRef(null);

    // Reuse doJoin for mount, manually joining, and silent socket reconnects
    const doJoin = (code, name, userAvatar, silent = false) => {
        if (!name.trim() || !code.trim()) return;
        if (!silent) setError('');
        
        socket.emit('draw-join-room', { 
            roomCode: code.toUpperCase(), 
            playerName: name.trim(), 
            avatar: userAvatar 
        }, (response) => {
            if (response.error) {
                if (!silent) {
                    setError(response.error);
                    localStorage.removeItem('draw-session');
                }
            } else {
                setIsJoined(true);
                localStorage.setItem('draw-session', JSON.stringify({ 
                    name: name.trim(), 
                    avatar: userAvatar, 
                    roomCode: code.toUpperCase(), 
                    isJoined: true 
                }));
                
                if (response.gameState === 'PLAYING') {
                    setGameState('PLAYING');
                    setCurrentRound(response.currentRound);
                    setTotalRounds(response.totalRounds);
                    setDrawerName(response.currentDrawerName || '');
                    if (response.currentWord) {
                        setWordCategory(response.currentWord.category);
                        setWordLength(response.currentWord.wordLength);
                    }
                    setTimePerRound(response.timePerRound);
                    setIsDrawer(response.currentDrawerId === socket.id);
                    
                    if (response.hasGuessed) {
                        setHasGuessed(true);
                    }
                    if (response.myScore !== undefined) {
                        setMyScore(response.myScore);
                    }

                    if (response.canvasHistory) {
                        setTimeout(() => {
                            clearCanvas(true);
                            response.canvasHistory.forEach(s => drawStroke(s, true));
                        }, 100);
                    }
                    startTimer(response.timePerRound, response.roundStartTime);
                } else {
                    setGameState(response.gameState || 'LOBBY');
                }
            }
        });
    };

    // Load stored session & handle auto-join on mount
    useEffect(() => {
        const stored = localStorage.getItem('draw-session');
        if (stored) {
            try {
                const session = JSON.parse(stored);
                if (session.name) setPlayerName(session.name);
                if (session.avatar) setAvatar(session.avatar);

                const rc = urlRoomCode || session.roomCode;
                if (rc) setRoomCode(rc.toUpperCase());

                if (session.isJoined && rc && session.name) {
                    console.log('[DRAW] Auto-rejoining session on mount...');
                    doJoin(rc, session.name, session.avatar);
                }
            } catch { /* ignore */ }
        } else {
            if (urlRoomCode) setRoomCode(urlRoomCode.toUpperCase());
        }
    }, [urlRoomCode]);

    // Handle connection/reconnection flow (style GeoTrackr)
    useEffect(() => {
        const handleConnect = () => {
            const stored = localStorage.getItem('draw-session');
            if (stored) {
                try {
                    const session = JSON.parse(stored);
                    if (session.isJoined && session.roomCode && session.name) {
                        console.log('[DRAW] Auto-rejoining silently on socket reconnect...');
                        doJoin(session.roomCode, session.name, session.avatar, true);
                    }
                } catch { /* ignore */ }
            }
        };

        socket.on('connect', handleConnect);
        return () => {
            socket.off('connect', handleConnect);
        };
    }, []);

    useEffect(() => {
        document.body.classList.add('comic-theme');
        return () => {
            document.body.classList.remove('comic-theme');
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, []);

    // Socket listeners
    useEffect(() => {
        if (!isJoined) return;

        const handleGameStarted = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setTimePerRound(data.timePerRound);
            setIsDrawer(data.drawerId === socket.id);
            setHasGuessed(false);
            setGuessResult(null);
            setMyWord(null);
            clearCanvas(true);
            
            const elapsed = Date.now() - data.roundStartTime;
            if (elapsed < 3000) {
                triggerRoundCountdown();
            }
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleYourWord = (data) => { setMyWord(data); setIsDrawer(true); };

        const handleNextRound = (data) => {
            setGameState('PLAYING');
            setCurrentRound(data.round);
            setTotalRounds(data.totalRounds);
            setDrawerName(data.drawerName);
            setWordCategory(data.wordCategory);
            setWordLength(data.wordLength);
            setTimePerRound(data.timePerRound);
            setIsDrawer(data.drawerId === socket.id);
            setHasGuessed(false);
            setGuessResult(null);
            setMyWord(null);
            clearCanvas(true);

            const elapsed = Date.now() - data.roundStartTime;
            if (elapsed < 3000) {
                triggerRoundCountdown();
            }
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleStroke = (stroke) => drawStroke(stroke, true);
        const handleClear = () => clearCanvas(true);
        
        const handleUndoStroke = () => {
            strokesHistoryRef.current.pop();
            clearCanvas(false);
            strokesHistoryRef.current.forEach(s => drawStroke(s, false));
        };

        const handleWordSkipped = (data) => { 
            setWordCategory(data.wordCategory); 
            setWordLength(data.wordLength); 
            clearCanvas(true); 
        };

        const handleRoundEnded = (data) => {
            setGameState('ROUND_END');
            setRevealedWord(data.word);
            if (timerRef.current) clearInterval(timerRef.current);
            const me = data.results.find(p => p.id === socket.id);
            if (me) setMyScore(me.score);
            if (data.drawerLeft) {
                setError("Le dessinateur s'est déconnecté ! Passage au tour suivant...");
                setTimeout(() => setError(''), 4000);
            }
        };

        const handleGameOver = (data) => {
            setGameState('GAME_END');
            setFinalResults(data.results);
            setAwards(data.awards || []);
            if (timerRef.current) clearInterval(timerRef.current);
            const me = data.results.find(p => p.id === socket.id);
            if (me) setMyScore(me.score);
            
            // Clean draw session on game over
            const stored = localStorage.getItem('draw-session');
            if (stored) {
                try {
                    const session = JSON.parse(stored);
                    session.isJoined = false;
                    localStorage.setItem('draw-session', JSON.stringify(session));
                } catch {}
            }
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
            localStorage.removeItem('draw-session');
        };

        socket.on('draw-game-started', handleGameStarted);
        socket.on('draw-your-word', handleYourWord);
        socket.on('draw-next-round', handleNextRound);
        socket.on('draw-stroke', handleStroke);
        socket.on('draw-clear', handleClear);
        socket.on('draw-undo-stroke', handleUndoStroke);
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
            socket.off('draw-undo-stroke', handleUndoStroke);
            socket.off('draw-word-skipped', handleWordSkipped);
            socket.off('draw-round-ended', handleRoundEnded);
            socket.off('draw-game-over', handleGameOver);
            socket.off('draw-game-restarted', handleGameRestarted);
            socket.off('draw-kicked', handleKicked);
        };
    }, [isJoined, roomCode]);

    const triggerRoundCountdown = () => {
        setCountdownVal(3);
        playCountdownSound();
        
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        let currentVal = 3;
        countdownIntervalRef.current = setInterval(() => {
            currentVal--;
            if (currentVal <= 0) {
                clearInterval(countdownIntervalRef.current);
                setCountdownVal(0);
            } else {
                setCountdownVal(currentVal);
                playCountdownSound();
            }
        }, 1000);
    };

    // Init canvas — ResizeObserver pour éviter le canvas étiré sur mobile
    useEffect(() => {
        if (!canvasRef.current || gameState !== 'PLAYING') return;
        const canvas = canvasRef.current;

        const initCanvas = (w, h) => {
            if (w < 10 || h < 10) return;
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, w, h);
            canvasContextRef.current = ctx;
        };

        const ro = new ResizeObserver(entries => {
            for (const e of entries) {
                initCanvas(e.contentRect.width, e.contentRect.height);
                strokesHistoryRef.current.forEach(s => drawStroke(s, false));
            }
        });
        ro.observe(canvas);

        requestAnimationFrame(() => {
            const r = canvas.getBoundingClientRect();
            initCanvas(r.width, r.height);
            strokesHistoryRef.current.forEach(s => drawStroke(s, false));
        });

        return () => ro.disconnect();
    }, [gameState]);

    const startTimer = (duration, startTime) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const update = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            setTimer(Math.max(0, Math.ceil(duration - elapsed)));
        };
        update();
        timerRef.current = setInterval(update, 1000);
    };

    const joinRoom = () => {
        if (!playerName.trim()) { setError('Entrez votre nom'); return; }
        if (!roomCode.trim()) { setError('Entrez le code du salon'); return; }
        doJoin(roomCode, playerName, avatar);
    };

    const drawStroke = (stroke, saveToHistory = true) => {
        if (!canvasContextRef.current || !canvasRef.current) return;
        if (saveToHistory) {
            const strokePointsStr = JSON.stringify(stroke.points);
            if (!strokesHistoryRef.current.some(s => JSON.stringify(s.points) === strokePointsStr)) {
                strokesHistoryRef.current.push(stroke);
            }
        }
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.beginPath();
        stroke.points.forEach((pt, i) => {
            const x = pt.x * canvas.width;
            const y = pt.y * canvas.height;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    };

    const clearCanvas = (clearHistory = true) => {
        if (clearHistory) {
            strokesHistoryRef.current = [];
        }
        if (!canvasContextRef.current || !canvasRef.current) return;
        const ctx = canvasContextRef.current;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const getCanvasCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) / rect.width,
            y: (src.clientY - rect.top) / rect.height
        };
    };

    const handleDrawStart = (e) => {
        if (!isDrawer || countdownVal > 0) return;
        e.preventDefault();
        setIsDrawing(true);
        const coords = getCanvasCoords(e);
        setCurrentStroke([coords]);
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.moveTo(coords.x * canvas.width, coords.y * canvas.height);
        ctx.lineTo(coords.x * canvas.width + 0.1, coords.y * canvas.height + 0.1);
        ctx.stroke();
    };

    const handleDrawMove = (e) => {
        if (!isDrawing || !isDrawer || countdownVal > 0) return;
        e.preventDefault();
        const coords = getCanvasCoords(e);
        const prev = currentStroke[currentStroke.length - 1];
        if (!prev) return;
        setCurrentStroke(s => [...s, coords]);
        const ctx = canvasContextRef.current;
        const canvas = canvasRef.current;
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = brushSize;
        ctx.beginPath();
        ctx.moveTo(prev.x * canvas.width, prev.y * canvas.height);
        ctx.lineTo(coords.x * canvas.width, coords.y * canvas.height);
        ctx.stroke();
    };

    const handleDrawEnd = () => {
        if (!isDrawing || !isDrawer) return;
        setIsDrawing(false);
        if (currentStroke.length > 0) {
            const stroke = { color: selectedColor, size: brushSize, points: currentStroke };
            strokesHistoryRef.current.push(stroke);
            socket.emit('draw-stroke', { roomCode, stroke });
        }
        setCurrentStroke([]);
    };

    const handleClearCanvas = () => { 
        clearCanvas(true); 
        socket.emit('draw-clear', { roomCode }); 
    };

    const handleUndo = () => {
        if (!isDrawer) return;
        if (strokesHistoryRef.current.length > 0) {
            strokesHistoryRef.current.pop();
            clearCanvas(false);
            strokesHistoryRef.current.forEach(s => drawStroke(s, false));
            socket.emit('draw-undo', { roomCode });
        }
    };

    const handleSkipWord = () => {
        socket.emit('draw-skip-word', { roomCode }, (r) => {
            if (r.success) { 
                setMyWord({ word: r.word, category: r.category, hint: r.hint }); 
                clearCanvas(true); 
            }
        });
    };

    const submitGuess = () => {
        if (!guess.trim() || hasGuessed || countdownVal > 0) return;
        socket.emit('draw-submit-guess', { roomCode, guess: guess.trim() }, (r) => {
            if (r.correct) {
                setHasGuessed(true);
                setGuessResult({ correct: true, points: r.points, rank: r.rank });
                setMyScore(prev => prev + r.points);
                playSuccessSound();
                
                // Update score in local storage
                const stored = localStorage.getItem('draw-session');
                if (stored) {
                    try {
                        const session = JSON.parse(stored);
                        session.myScore = myScore + r.points;
                        localStorage.setItem('draw-session', JSON.stringify(session));
                    } catch {}
                }
            } else if (r.closeMatch) {
                setGuessResult({ closeMatch: true, message: r.message });
                setShakeGuess(true);
                setTimeout(() => { setShakeGuess(false); setGuessResult(null); }, 1500);
            }
            setGuess('');
        });
    };

    const timerPct = timePerRound > 0 ? (timer / timePerRound) * 100 : 0;
    const timerClass = timer <= 10 ? 'timer-danger' : timer <= 30 ? 'timer-warning' : '';

    // ── JOIN ──────────────────────────────────────────────────────────
    if (!isJoined) {
        return (
            <div className="min-h-screen flex flex-col bg-[#FFFBF0] overflow-auto">
                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-4 relative">
                    <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
                        {/* Header */}
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF3B30] border-[3px] border-[#161a33] shadow-[3px_3px_0px_0px_#161a33] mb-3">
                                <span className="text-3xl">🎨</span>
                            </div>
                            <h1 className="text-4xl font-black uppercase italic text-[#161a33] tracking-tight">DrawUp</h1>
                            <p className="text-[10px] font-black text-[#FF3B30] uppercase tracking-widest mt-1">Rejoindre une partie</p>
                        </div>

                        {error && (
                            <div className="bg-[#FFD60A] border-[3px] border-[#161a33] rounded-xl p-3 text-[#161a33] text-xs font-black text-center shadow-[3px_3px_0px_0px_#161a33]">
                                {error}
                            </div>
                        )}

                        {/* Form */}
                        <div className="sk-box p-6 flex flex-col gap-4">
                            {/* Code */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Code du salon</label>
                                <input
                                    type="text"
                                    className="sk-input text-center text-2xl uppercase tracking-[0.3em] font-black placeholder:text-[#161a33]/30"
                                    placeholder="ABCDE1"
                                    value={roomCode}
                                    onChange={(e) => !urlRoomCode && setRoomCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    readOnly={!!urlRoomCode}
                                />
                            </div>

                            {/* Pseudo */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Ton pseudo</label>
                                <input
                                    type="text"
                                    className="sk-input text-xs"
                                    placeholder="Picasso"
                                    value={playerName}
                                    onChange={(e) => setPlayerName(e.target.value)}
                                    maxLength={20}
                                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                                />
                            </div>

                            {/* Avatars */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Avatar</label>
                                <div className="grid grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1 border-2 border-[#161a33]/15 rounded-xl bg-[#FFFBF0]">
                                    {ALL_AVATARS.slice(0, 30).map((url) => (
                                        <button
                                            key={url}
                                            type="button"
                                            onClick={() => setAvatar(url)}
                                            className={`aspect-square sk-ava ${avatar === url ? 'active' : ''}`}
                                            style={{ width: '100%', height: 'auto' }}
                                        >
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={joinRoom}
                                className="sk-btn sk-btn-warning w-full py-3.5 flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-base">brush</span>
                                Rejoindre la Partie
                            </button>
                        </div>

                        <button onClick={() => navigate('/draw')} className="sk-btn sk-btn-secondary py-2 flex items-center justify-center gap-1 mx-auto text-xs">
                            <span className="material-symbols-outlined text-sm">arrow_back</span> Retour
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── LOBBY ─────────────────────────────────────────────────────────
    if (gameState === 'LOBBY') {
        return (
            <div className="min-h-screen flex flex-col bg-[#FFFBF0] overflow-hidden">
                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                    <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs w-full">
                        <div className="w-24 h-24 sk-ava">
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="text-center">
                            <h2 className="text-2xl sk-h text-[#161a33]">{playerName}</h2>
                            <div className="text-xs font-black text-[#FF3B30] uppercase mt-1">Salon : {roomCode}</div>
                        </div>
                        <div className="sk-box p-6 text-center w-full bg-white flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[#FF3B30] text-3xl animate-pulse">hourglass_empty</span>
                            <p className="text-sm font-black text-[#161a33] uppercase">En attente du lancement...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── PLAYING — DESSINATEUR ─────────────────────────────────────────
    if (gameState === 'PLAYING' && isDrawer) {
        return (
            <div className="h-screen flex flex-col overflow-hidden bg-[#FFFBF0] relative"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                
                {countdownVal > 0 && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFBF0]/95 backdrop-blur-sm">
                        <div className="text-8xl font-black text-[#FF3B30] animate-bounce">{countdownVal}</div>
                        <div className="text-lg font-black uppercase tracking-wider text-[#161a33] mt-4">Prépare-toi à dessiner !</div>
                    </div>
                )}

                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-white border-b-3 border-[#161a33] flex-shrink-0">
                    <div className={`font-black text-xl tabular-nums ${timerClass} text-[#161a33]`}>{timer}</div>
                    <div className="flex-1 h-3 bg-[#161a33]/10 border-2 border-[#161a33] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-[#FF3B30]' : timer <= 30 ? 'bg-[#ff9f1c]' : 'bg-[#FFD60A]'}`}
                             style={{ width: `${timerPct}%` }} />
                    </div>
                    <div className="sk-pill sk-pill-blue py-1 px-3 text-[10px]">{currentRound}/{totalRounds}</div>
                </div>

                {/* Word banner */}
                {myWord && (
                    <div className="px-4 py-2.5 bg-[#FF3B30] border-b-3 border-[#161a33] flex-shrink-0 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-[9px] font-black uppercase text-white/80">À toi de dessiner :</div>
                            <div className="text-xl font-black uppercase italic text-white tracking-tight">{myWord.word}</div>
                            {myWord.hint && <div className="text-[9px] text-white/80 font-bold">💡 {myWord.hint}</div>}
                        </div>
                        <button onClick={handleSkipWord}
                            className="sk-btn sk-btn-warning text-[10px] py-1 px-2.5 flex-shrink-0">
                            🔄 Passer
                        </button>
                    </div>
                )}

                {/* Canvas */}
                <div className="flex-1 min-h-0 flex items-center justify-center p-3 relative">
                    <div className="canvas-container-4-3">
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

                {/* Tools */}
                <div className="flex-shrink-0 px-3 pb-3 flex flex-col gap-2">
                    {/* Colors */}
                    <div className="sk-box p-2 flex justify-center gap-1.5 bg-white">
                        {COLORS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => { setSelectedColor(c.value); setIsEraser(false); }}
                                className={`w-8 h-8 rounded-full border-2 border-[#161a33] transition-transform duration-100 ${
                                    selectedColor === c.value && !isEraser
                                        ? 'scale-125 shadow-[2px_2px_0px_0px_#161a33]'
                                        : 'hover:scale-110'
                                 }`}
                                style={{ backgroundColor: c.value, boxShadow: c.value === '#ffffff' ? 'inset 0 0 0 1px #ccc' : undefined }}
                                title={c.name}
                            />
                        ))}
                    </div>

                    {/* Sizes + actions */}
                    <div className="sk-box p-2.5 flex items-center justify-center gap-2 bg-white">
                        {BRUSH_SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => { setBrushSize(size); setIsEraser(false); }}
                                className={`w-9 h-9 rounded-lg border-2 border-[#161a33] flex items-center justify-center transition-colors ${
                                    brushSize === size && !isEraser
                                        ? 'bg-[#FFD60A]'
                                        : 'bg-[#FFFBF0] hover:bg-[#C2DCFF]'
                                }`}
                            >
                                <div className="rounded-full bg-[#161a33]"
                                    style={{ width: Math.min(size * 0.7, 20), height: Math.min(size * 0.7, 20) }} />
                            </button>
                        ))}
                        <div className="w-0.5 h-6 bg-[#161a33]/20" />
                        <button
                            onClick={() => {
                                const nextEraser = !isEraser;
                                setIsEraser(nextEraser);
                                if (nextEraser) {
                                    setSelectedColor('#ffffff');
                                    setBrushSize(30);
                                } else {
                                    setSelectedColor('#000000');
                                    setBrushSize(8);
                                }
                            }}
                            className={`w-9 h-9 rounded-lg border-2 border-[#161a33] flex items-center justify-center transition-colors ${
                                isEraser
                                    ? 'bg-[#FFD60A]'
                                    : 'bg-[#FFFBF0] hover:bg-[#FFE0DC]'
                             }`}
                            title="Gomme"
                        >
                            <span className="material-symbols-outlined text-base text-[#161a33]">ink_eraser</span>
                        </button>
                        <button
                            onClick={handleUndo}
                            disabled={strokesHistoryRef.current.length === 0}
                            className="sk-btn sk-btn-secondary w-9 h-9 p-0 flex items-center justify-center disabled:opacity-40"
                            title="Annuler"
                            style={{ boxShadow: '2px 2px 0px 0px #161a33' }}
                        >
                            <span className="material-symbols-outlined text-base">undo</span>
                        </button>
                        <button
                            onClick={handleClearCanvas}
                            className="sk-btn sk-btn-danger w-9 h-9 p-0 flex items-center justify-center"
                            title="Effacer tout"
                            style={{ boxShadow: '2px 2px 0px 0px #161a33' }}
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── PLAYING — DEVINEUR ────────────────────────────────────────────
    if (gameState === 'PLAYING' && !isDrawer) {
        return (
            <div className="h-screen flex flex-col overflow-hidden bg-[#FFFBF0] relative"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

                {countdownVal > 0 && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#FFFBF0]/95 backdrop-blur-sm">
                        <div className="text-8xl font-black text-[#FF3B30] animate-bounce">{countdownVal}</div>
                        <div className="text-lg font-black uppercase tracking-wider text-[#161a33] mt-4">Prépare-toi à deviner !</div>
                    </div>
                )}

                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-white border-b-3 border-[#161a33] flex-shrink-0">
                    <div className={`font-black text-xl tabular-nums ${timerClass} text-[#161a33]`}>{timer}</div>
                    <div className="flex-1 h-3 bg-[#161a33]/10 border-2 border-[#161a33] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-[#FF3B30]' : timer <= 30 ? 'bg-[#ff9f1c]' : 'bg-[#FFD60A]'}`}
                             style={{ width: `${timerPct}%` }} />
                    </div>
                    <div className="sk-pill sk-pill-blue py-1 px-3 text-[10px]">{currentRound}/{totalRounds}</div>
                    <div className="font-black text-sm text-[#161a33]">{myScore} pts</div>
                </div>

                {/* Drawer info + word blanks */}
                <div className="flex items-center justify-center gap-3 px-4 py-2.5 bg-[#C2DCFF] border-b-3 border-[#161a33] flex-shrink-0">
                    <div className="text-[10px] font-bold text-[#161a33]">
                        🎨 <span className="font-black text-[#FF3B30]">{drawerName}</span> dessine...
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        <span className="sk-pill sk-pill-active py-0.5 px-2.5 text-[9px]">{wordCategory}</span>
                        {Array.from({ length: wordLength }).map((_, i) => (
                            <div key={i} className="w-3.5 h-1 bg-[#161a33] rounded-full" />
                        ))}
                        <span className="text-[9px] font-black text-[#161a33]/50">({wordLength})</span>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 min-h-0 flex items-center justify-center p-3 relative">
                    <div className={`canvas-container-4-3 draw-canvas-viewer ${hasGuessed ? 'opacity-85' : ''}`}>
                        <canvas ref={canvasRef} className="draw-canvas" />
                        {hasGuessed && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FFD60A]/85 backdrop-blur-sm">
                                <div className="text-5xl mb-2 animate-bounce">✅</div>
                                <h3 className="text-3xl sk-h text-[#161a33]">Bravo !</h3>
                                <div className="sk-pill sk-pill-active py-1 px-4 text-xs mt-2">
                                    +{guessResult?.points} pts — #{guessResult?.rank}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Guess input */}
                {!hasGuessed && (
                    <div className="flex-shrink-0 px-3 pb-3">
                        {guessResult?.closeMatch && (
                            <div className="text-center text-[10px] font-black text-[#ff9f1c] uppercase mb-1.5 animate-pulse">
                                🔥 Très proche ! Vérifie l'orthographe
                            </div>
                        )}
                        <div className={`sk-box p-2.5 flex gap-2 bg-white ${shakeGuess ? 'shake-input border-[#ff9f1c]' : ''}`}>
                            <input
                                ref={guessInputRef}
                                type="text"
                                className="sk-input flex-1 py-2 text-sm"
                                placeholder="Tape ta réponse..."
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                                disabled={hasGuessed || countdownVal > 0}
                                autoComplete="off"
                            />
                            <button
                                onClick={submitGuess}
                                disabled={hasGuessed || !guess.trim() || countdownVal > 0}
                                className="sk-btn sk-btn-warning py-2.5 px-4 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── ROUND END ─────────────────────────────────────────────────────
    if (gameState === 'ROUND_END') {
        return (
            <div className="min-h-screen flex flex-col bg-[#FFFBF0] overflow-hidden">
                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                    <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-4">
                        <div className="bg-[#FF3B30] border-3 border-[#161a33] rounded-xl p-5 shadow-[4px_4px_0_#161a33] text-center w-full -rotate-1">
                            <div className="text-[9px] font-black uppercase text-white/80 tracking-wider">Le mot était</div>
                            <h2 className="text-3xl sk-h text-white">{revealedWord?.word}</h2>
                        </div>
                        <div className="sk-box p-5 text-center w-full bg-white">
                            <div className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider mb-1">Ton score</div>
                            <div className="text-5xl font-black text-[#161a33]">{myScore}</div>
                            <div className="text-[10px] text-[#161a33]/50 font-bold mt-1">points</div>
                        </div>
                        <p className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider animate-pulse mt-2">
                            Prochain tour bientôt...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── GAME END ──────────────────────────────────────────────────────
    if (gameState === 'GAME_END') {
        const myRank = finalResults.findIndex(p => p.id === socket.id) + 1;
        const winner = finalResults[0];
        const medals = ['🥇', '🥈', '🥉'];

        return (
            <div className="min-h-screen flex flex-col bg-[#FFFBF0] overflow-auto">
                {/* Simulated status bar */}
                <div className="flex items-center justify-between px-6 py-2 text-xs font-black text-[#161a33]/60 border-b-2 border-[#161a33]/10 flex-shrink-0 w-full select-none bg-[#FFFBF0]">
                    <span className="flex items-center gap-1">9:41 <span className="material-symbols-outlined text-xs">edit</span></span>
                    <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">signal_cellular_alt</span>
                        <span className="material-symbols-outlined text-sm">battery_charging_full</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                    <div className="relative z-10 w-full max-w-xs flex flex-col gap-4">
                        {/* My result */}
                        <div className={`border-3 border-[#161a33] rounded-xl p-5 shadow-[4px_4px_0_#161a33] text-center -rotate-1 ${
                            myRank === 1 ? 'bg-[#FFD60A]' : myRank === 2 ? 'bg-[#C2DCFF]' : myRank === 3 ? 'bg-[#FFE0DC]' : 'bg-white'
                        }`}>
                            <div className="text-4xl mb-2">{medals[myRank - 1] || '🎨'}</div>
                            <h2 className="text-2xl sk-h text-[#161a33]">
                                {myRank === 1 ? 'Victoire !' : `#${myRank}`}
                            </h2>
                            <div className="text-3xl font-black text-[#161a33] mt-1">{myScore} pts</div>
                            {myRank !== 1 && (
                                <div className="text-[10px] font-bold text-[#161a33]/60 mt-1">
                                    Vainqueur : <span className="font-black text-[#FF3B30]">{winner?.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Full ranking */}
                        <div className="sk-box p-4 bg-white">
                            <div className="text-[10px] font-black uppercase text-[#FF3B30] mb-2.5 tracking-wider">Classement final</div>
                            <div className="flex flex-col gap-1.5">
                                {finalResults.map((p, i) => (
                                    <div key={p.id} className={`flex items-center gap-2 p-1.5 rounded-lg border-2 text-xs ${
                                        p.id === socket.id ? 'border-[#FF3B30] bg-[#FF3B30]/10 font-black' : 'border-[#161a33]/10 bg-[#FFFBF0] font-bold'
                                    }`}>
                                        <span className="w-6 text-center font-black text-[#161a33]">{medals[i] || `#${i + 1}`}</span>
                                        <span className="flex-1 truncate text-[#161a33]">{p.name}</span>
                                        <span className="font-black text-[#161a33]">{p.score} pts</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Awards */}
                        {awards.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {awards.map((a, i) => (
                                    <div key={i} className="sk-box p-3 text-center bg-white">
                                        <div className="text-2xl mb-1">{a.icon}</div>
                                        <div className="text-[9px] font-black uppercase text-[#FF3B30]">{a.title}</div>
                                        <div className="text-[10px] font-bold text-[#161a33] truncate">{a.playerName}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button onClick={() => navigate('/')}
                            className="sk-btn sk-btn-warning w-full py-3 flex items-center justify-center gap-2 text-xs">
                            🏠 Retour au menu
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default DrawPlayerView;
