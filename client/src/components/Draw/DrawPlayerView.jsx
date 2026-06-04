import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { socket } from '../../socket';
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

    const [revealedWord, setRevealedWord] = useState(null);
    const [finalResults, setFinalResults] = useState([]);
    const [awards, setAwards] = useState([]);

    const canvasRef = useRef(null);
    const canvasContextRef = useRef(null);
    const timerRef = useRef(null);
    const guessInputRef = useRef(null);

    // Load stored session
    useEffect(() => {
        const stored = localStorage.getItem('draw-session');
        if (stored) {
            try {
                const { name, avatar: a, roomCode: rc } = JSON.parse(stored);
                if (name) setPlayerName(name);
                if (a) setAvatar(a);
                if (!urlRoomCode && rc) setRoomCode(rc);
            } catch { /* ignore */ }
        }
    }, [urlRoomCode]);

    useEffect(() => {
        document.body.classList.add('comic-theme');
        return () => {
            document.body.classList.remove('comic-theme');
            if (timerRef.current) clearInterval(timerRef.current);
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
            clearCanvas();
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
            clearCanvas();
            startTimer(data.timePerRound, data.roundStartTime);
        };

        const handleStroke = (stroke) => drawStroke(stroke);
        const handleClear = () => clearCanvas();
        const handleWordSkipped = (data) => { setWordCategory(data.wordCategory); setWordLength(data.wordLength); clearCanvas(); };

        const handleRoundEnded = (data) => {
            setGameState('ROUND_END');
            setRevealedWord(data.word);
            if (timerRef.current) clearInterval(timerRef.current);
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

        const handleKicked = () => { setIsJoined(false); setError('Vous avez été expulsé de la partie'); };

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
            for (const e of entries) initCanvas(e.contentRect.width, e.contentRect.height);
        });
        ro.observe(canvas);

        requestAnimationFrame(() => {
            const r = canvas.getBoundingClientRect();
            initCanvas(r.width, r.height);
        });

        return () => ro.disconnect();
    }, [gameState, isDrawer]);

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
        socket.emit('draw-join-room', { roomCode: roomCode.toUpperCase(), playerName: playerName.trim(), avatar }, (response) => {
            if (response.error) {
                setError(response.error);
            } else {
                setIsJoined(true);
                setError('');
                localStorage.setItem('draw-session', JSON.stringify({ name: playerName, avatar, roomCode: roomCode.toUpperCase() }));
                if (response.gameState === 'PLAYING') {
                    setGameState('PLAYING');
                    setCurrentRound(response.currentRound);
                    setIsDrawer(response.currentDrawerId === socket.id);
                    if (response.canvasHistory) {
                        setTimeout(() => response.canvasHistory.forEach(s => drawStroke(s)), 100);
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
        stroke.points.forEach((pt, i) => {
            const x = pt.x * canvas.width;
            const y = pt.y * canvas.height;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    };

    const clearCanvas = () => {
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
        if (!isDrawer) return;
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
        if (!isDrawing || !isDrawer) return;
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
            socket.emit('draw-stroke', { roomCode, stroke: { color: selectedColor, size: brushSize, points: currentStroke } });
        }
        setCurrentStroke([]);
    };

    const handleClearCanvas = () => { clearCanvas(); socket.emit('draw-clear', { roomCode }); };
    const handleSkipWord = () => {
        socket.emit('draw-skip-word', { roomCode }, (r) => {
            if (r.success) { setMyWord({ word: r.word, category: r.category, hint: r.hint }); clearCanvas(); }
        });
    };

    const submitGuess = () => {
        if (!guess.trim() || hasGuessed) return;
        socket.emit('draw-submit-guess', { roomCode, guess: guess.trim() }, (r) => {
            if (r.correct) {
                setHasGuessed(true);
                setGuessResult({ correct: true, points: r.points, rank: r.rank });
                setMyScore(prev => prev + r.points);
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
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-auto">
                <div className="relative z-10 w-full max-w-sm flex flex-col gap-4">
                    {/* Header */}
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#FF3B30] border-[3px] border-on-background neo-shadow mb-3">
                            <span className="text-3xl">🎨</span>
                        </div>
                        <h1 className="text-3xl font-black uppercase italic text-on-background">DrawUp</h1>
                        <p className="text-[10px] font-bold text-[#FF3B30] uppercase tracking-wider mt-1">Rejoindre une partie</p>
                    </div>

                    {error && (
                        <div className="bg-[#FFD60A] border-[3px] border-on-background rounded-xl p-3 text-on-background text-xs font-black text-center neo-shadow-sm">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-5 neo-shadow flex flex-col gap-4">
                        {/* Code */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Code du salon</label>
                            <input
                                type="text"
                                className="w-full p-3 border-[3px] border-on-background font-black text-center text-2xl uppercase tracking-[0.3em] focus:outline-none focus:ring-0 bg-[#FFFBF0] rounded-lg placeholder:text-on-background/30"
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
                                className="w-full p-2.5 border-[3px] border-on-background font-bold text-xs focus:outline-none focus:ring-0 bg-[#FFFBF0] rounded-lg placeholder:text-on-background/30"
                                placeholder="Picasso"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                maxLength={20}
                                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                            />
                        </div>

                        {/* Avatars — 30 avatars, 5 colonnes, pas de scroll */}
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Avatar</label>
                            <div className="grid grid-cols-5 gap-2">
                                {ALL_AVATARS.slice(0, 30).map((url) => (
                                    <button
                                        key={url}
                                        type="button"
                                        onClick={() => setAvatar(url)}
                                        className={`aspect-square rounded-xl overflow-hidden border-[3px] transition-all active:scale-95 ${
                                            avatar === url
                                                ? 'border-[#FF3B30] shadow-[0_0_0_3px_rgba(189,0,255,0.3)] scale-105'
                                                : 'border-on-background/20 hover:border-[#FF3B30]/50'
                                        }`}
                                    >
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={joinRoom}
                            className="w-full bg-[#FFD60A] text-on-background font-black py-3.5 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-[-1px] active:translate-y-px active:shadow-none transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                        >
                            <span className="material-symbols-outlined text-sm">brush</span>
                            Rejoindre la Partie
                        </button>
                    </div>

                    <button onClick={() => navigate('/draw')} className="text-[9px] font-black text-[#FF3B30] uppercase tracking-wide flex items-center justify-center gap-1 mx-auto">
                        <span className="material-symbols-outlined text-xs">arrow_back</span> Retour
                    </button>
                </div>
            </div>
        );
    }

    // ── LOBBY ─────────────────────────────────────────────────────────
    if (gameState === 'LOBBY') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="relative z-10 flex flex-col items-center gap-5 max-w-xs w-full">
                    <div className="w-20 h-20 rounded-full border-[3px] border-on-background overflow-hidden neo-shadow">
                        <img src={avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black text-on-background uppercase">{playerName}</div>
                        <div className="text-xs font-bold text-[#FF3B30] uppercase mt-1">Salon : {roomCode}</div>
                    </div>
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow text-center w-full">
                        <span className="material-symbols-outlined text-[#FF3B30] text-2xl animate-pulse">hourglass_empty</span>
                        <p className="text-xs font-black text-on-background uppercase mt-2">En attente du lancement...</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── PLAYING — DESSINATEUR ─────────────────────────────────────────
    if (gameState === 'PLAYING' && isDrawer) {
        return (
            <div className="h-screen flex flex-col overflow-hidden comic-player-bg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white border-b-[3px] border-on-background flex-shrink-0">
                    <div className={`font-black text-xl tabular-nums ${timerClass}`}>{timer}</div>
                    <div className="flex-1 h-2 bg-on-background/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-[#e71d36]' : timer <= 30 ? 'bg-[#ff9f1c]' : 'bg-[#FFD60A]'}`}
                            style={{ width: `${timerPct}%` }} />
                    </div>
                    <div className="text-[10px] font-black text-[#FF3B30] uppercase">{currentRound}/{totalRounds}</div>
                </div>

                {/* Word banner */}
                {myWord && (
                    <div className="px-3 py-2 bg-[#FF3B30] flex-shrink-0 flex items-center justify-between gap-2">
                        <div>
                            <div className="text-[9px] font-black uppercase text-white/70">À toi de dessiner :</div>
                            <div className="text-xl font-black uppercase italic text-white tracking-tight">{myWord.word}</div>
                            {myWord.hint && <div className="text-[9px] text-white/70 font-bold">💡 {myWord.hint}</div>}
                        </div>
                        <button onClick={handleSkipWord}
                            className="bg-white/20 text-white font-black text-[9px] uppercase px-2 py-1 rounded-lg border border-white/40 active:scale-95 flex-shrink-0">
                            🔄 Passer
                        </button>
                    </div>
                )}

                {/* Canvas */}
                <div className="flex-1 min-h-0 mx-3 my-2 bg-white border-[3px] border-on-background rounded-xl overflow-hidden neo-shadow">
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

                {/* Tools */}
                <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-2">
                    {/* Colors */}
                    <div className="flex justify-center gap-1.5 bg-white border-[3px] border-on-background rounded-xl p-2 neo-shadow-sm">
                        {COLORS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setSelectedColor(c.value)}
                                className={`w-9 h-9 rounded-full border-[3px] transition-transform active:scale-90 ${
                                    selectedColor === c.value
                                        ? 'border-on-background scale-125 shadow-md'
                                        : 'border-on-background/40 hover:scale-110'
                                }`}
                                style={{ backgroundColor: c.value, boxShadow: c.value === '#ffffff' ? 'inset 0 0 0 1px #ccc' : undefined }}
                                title={c.name}
                            />
                        ))}
                    </div>

                    {/* Sizes + actions */}
                    <div className="flex items-center justify-center gap-2 bg-white border-[3px] border-on-background rounded-xl p-2 neo-shadow-sm">
                        {BRUSH_SIZES.map(size => (
                            <button
                                key={size}
                                onClick={() => setBrushSize(size)}
                                className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors active:scale-95 ${
                                    brushSize === size
                                        ? 'border-on-background bg-[#FFD60A]'
                                        : 'border-on-background/30 bg-[#FFFBF0] hover:bg-[#C2DCFF]'
                                }`}
                            >
                                <div className="rounded-full bg-on-background"
                                    style={{ width: Math.min(size * 0.7, 22), height: Math.min(size * 0.7, 22) }} />
                            </button>
                        ))}
                        <div className="w-px h-6 bg-on-background/20" />
                        <button
                            onClick={handleClearCanvas}
                            className="w-10 h-10 rounded-lg border-2 border-on-background/30 bg-[#FFE0DC] flex items-center justify-center hover:bg-[#ff9f9f] active:scale-95 transition-colors"
                            title="Effacer tout"
                        >
                            <span className="material-symbols-outlined text-base text-on-background">delete</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── PLAYING — DEVINEUR ────────────────────────────────────────────
    if (gameState === 'PLAYING' && !isDrawer) {
        return (
            <div className="h-screen flex flex-col overflow-hidden comic-player-bg"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-white border-b-[3px] border-on-background flex-shrink-0">
                    <div className={`font-black text-xl tabular-nums ${timerClass}`}>{timer}</div>
                    <div className="flex-1 h-2 bg-on-background/10 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-[#e71d36]' : timer <= 30 ? 'bg-[#ff9f1c]' : 'bg-[#FFD60A]'}`}
                            style={{ width: `${timerPct}%` }} />
                    </div>
                    <div className="text-[10px] font-black text-[#FF3B30] uppercase">{currentRound}/{totalRounds}</div>
                    <div className="font-black text-sm text-on-background">{myScore} pts</div>
                </div>

                {/* Drawer info + word blanks */}
                <div className="flex items-center justify-center gap-3 px-3 py-2 bg-[#C2DCFF] border-b-2 border-on-background/20 flex-shrink-0">
                    <div className="text-[10px] font-bold text-on-background">
                        🎨 <span className="font-black text-[#FF3B30]">{drawerName}</span> dessine...
                    </div>
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                        <span className="text-[9px] font-black uppercase bg-[#FF3B30] text-white px-2 py-0.5 rounded-full">{wordCategory}</span>
                        {Array.from({ length: wordLength }).map((_, i) => (
                            <div key={i} className="w-4 h-0.5 bg-on-background rounded-full" />
                        ))}
                        <span className="text-[9px] text-on-background/50">({wordLength})</span>
                    </div>
                </div>

                {/* Canvas */}
                <div className={`flex-1 min-h-0 mx-3 my-2 bg-white border-[3px] border-on-background rounded-xl overflow-hidden neo-shadow relative draw-canvas-viewer ${hasGuessed ? 'opacity-80' : ''}`}>
                    <canvas ref={canvasRef} className="draw-canvas" />
                    {hasGuessed && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FFD60A]/80 backdrop-blur-sm">
                            <div className="text-4xl mb-2">✅</div>
                            <div className="text-xl font-black uppercase italic text-on-background">Bravo !</div>
                            <div className="text-sm font-black text-on-background mt-1">
                                +{guessResult?.points} pts — #{guessResult?.rank}
                            </div>
                        </div>
                    )}
                </div>

                {/* Guess input */}
                {!hasGuessed && (
                    <div className="flex-shrink-0 px-3 pb-2">
                        {guessResult?.closeMatch && (
                            <div className="text-center text-[10px] font-black text-[#ff9f1c] uppercase mb-1 animate-pulse">
                                🔥 Très proche ! Vérifie l'orthographe
                            </div>
                        )}
                        <div className={`flex gap-2 bg-white border-[3px] border-on-background rounded-xl p-2 neo-shadow ${shakeGuess ? 'shake-input border-[#ff9f1c]' : ''}`}>
                            <input
                                ref={guessInputRef}
                                type="text"
                                className="flex-1 p-2 text-sm font-bold text-on-background bg-[#FFFBF0] border-2 border-on-background/20 rounded-lg focus:outline-none focus:border-[#FF3B30] placeholder:text-on-background/40"
                                placeholder="Tape ta réponse..."
                                value={guess}
                                onChange={(e) => setGuess(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && submitGuess()}
                                disabled={hasGuessed}
                                autoComplete="off"
                            />
                            <button
                                onClick={submitGuess}
                                disabled={hasGuessed || !guess.trim()}
                                className="bg-[#FFD60A] text-on-background font-black px-4 py-2 border-[3px] border-on-background rounded-lg shadow-[2px_2px_0px_0px_#161a33] active:shadow-none active:translate-y-px transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
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
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden comic-theme">
                <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-4">
                    <div className="bg-[#FF3B30] border-[4px] border-on-background p-5 shadow-[5px_5px_0_#1a1a1a] text-center w-full -rotate-1">
                        <div className="text-[9px] font-black uppercase text-white/80 tracking-wider">Le mot était</div>
                        <div className="text-4xl font-black uppercase italic text-white">{revealedWord?.word}</div>
                    </div>
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow text-center w-full">
                        <div className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider mb-1">Ton score</div>
                        <div className="text-5xl font-black text-on-background">{myScore}</div>
                        <div className="text-[10px] text-on-background/50 font-bold mt-1">points</div>
                    </div>
                    <p className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider animate-pulse">
                        Prochain tour bientôt...
                    </p>
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
            <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-auto comic-theme">
                <div className="relative z-10 w-full max-w-xs flex flex-col gap-4">
                    {/* My result */}
                    <div className={`border-[3px] border-on-background rounded-xl p-5 neo-shadow text-center -rotate-1 ${
                        myRank === 1 ? 'bg-[#FFD60A]' : myRank === 2 ? 'bg-[#C2DCFF]' : myRank === 3 ? 'bg-[#FFE0DC]' : 'bg-white'
                    }`}>
                        <div className="text-4xl mb-2">{medals[myRank - 1] || '🎨'}</div>
                        <div className="text-2xl font-black uppercase italic text-on-background">
                            {myRank === 1 ? 'Victoire !' : `#${myRank}`}
                        </div>
                        <div className="text-3xl font-black text-on-background mt-1">{myScore} pts</div>
                        {myRank !== 1 && (
                            <div className="text-[10px] font-bold text-on-background/60 mt-1">
                                Vainqueur : <span className="font-black text-[#FF3B30]">{winner?.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Full ranking */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-3 neo-shadow">
                        <div className="text-[10px] font-black uppercase text-[#FF3B30] mb-2 tracking-wider">Classement final</div>
                        <div className="flex flex-col gap-1.5">
                            {finalResults.map((p, i) => (
                                <div key={p.id} className={`flex items-center gap-2 p-1.5 rounded-lg border-2 text-xs ${
                                    p.id === socket.id ? 'border-[#FF3B30] bg-[#FF3B30]/10 font-black' : 'border-on-background/10 bg-[#FFFBF0] font-bold'
                                }`}>
                                    <span className="w-6 text-center font-black">{medals[i] || `#${i + 1}`}</span>
                                    <span className="flex-1 truncate text-on-background">{p.name}</span>
                                    <span className="font-black text-on-background">{p.score} pts</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Awards */}
                    {awards.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                            {awards.map((a, i) => (
                                <div key={i} className="bg-white border-[3px] border-on-background rounded-xl p-3 neo-shadow text-center">
                                    <div className="text-2xl mb-1">{a.icon}</div>
                                    <div className="text-[9px] font-black uppercase text-[#FF3B30]">{a.title}</div>
                                    <div className="text-[10px] font-bold text-on-background truncate">{a.playerName}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <button onClick={() => navigate('/')}
                        className="w-full bg-[#FFD60A] text-on-background font-black py-3 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-[-1px] active:translate-y-px active:shadow-none transition-all text-sm uppercase tracking-wide flex items-center justify-center gap-2">
                        🏠 Retour au menu
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default DrawPlayerView;
