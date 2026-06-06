import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { playCountdownSound, playTickSound, playSuccessSound, playFailSound, playWinnerSound } from '../../utils/audio';
import './DrawStyles.css';

function DrawHostView() {
    const navigate = useNavigate();
    const [gameState, setGameState] = useState('CREATING');
    const [roomCode, setRoomCode] = useState('');
    const [players, setPlayers] = useState([]);
    const [settings, setSettings] = useState({ roundsPerPlayer: 2, timePerRound: 90, categories: ['all'] });

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
    const [copied, setCopied] = useState(false);
    const [availableCategories, setAvailableCategories] = useState([]);

    const [countdownVal, setCountdownVal] = useState(0);
    const [drawerLeftWarning, setDrawerLeftWarning] = useState(false);

    const canvasRef = useRef(null);
    const canvasContextRef = useRef(null);
    const timerRef = useRef(null);
    const countdownRef = useRef(null);
    const strokesHistoryRef = useRef([]);
    const countdownIntervalRef = useRef(null);

    useEffect(() => {
        document.body.classList.add('comic-theme');
        return () => document.body.classList.remove('comic-theme');
    }, []);

    useEffect(() => {
        socket.emit('draw-create-room', { settings }, (response) => {
            if (response.roomCode) {
                setRoomCode(response.roomCode);
                setGameState('LOBBY');
            }
        });
        // Charger les catégories disponibles
        socket.emit('draw-get-categories', {}, (response) => {
            if (response.categories) setAvailableCategories(response.categories);
        });
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, []);

    const triggerRoundCountdown = () => {
        setCountdownVal(3);
        playCountdownSound();
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        let val = 3;
        countdownIntervalRef.current = setInterval(() => {
            val--;
            if (val <= 0) {
                clearInterval(countdownIntervalRef.current);
                setCountdownVal(0);
            } else {
                setCountdownVal(val);
                playCountdownSound();
            }
        }, 1000);
    };

    const triggerConfetti = () => {
        confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    const triggerPodiumConfetti = () => {
        playWinnerSound();
        const end = Date.now() + (5 * 1000);
        const colors = ['#FFD60A', '#FF3B30', '#C2DCFF', '#FFE0DC'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    useEffect(() => {
        const handlePlayerJoined = (list) => setPlayers(list);
        const handlePlayerLeft = (list) => setPlayers(list);

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
            setDrawerLeftWarning(false);
            clearCanvas(true);
            
            const elapsed = Date.now() - data.roundStartTime;
            if (elapsed < 3000) {
                triggerRoundCountdown();
            }
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
            setDrawerLeftWarning(false);
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

        const handlePlayerGuessed = (data) => {
            setGuessedPlayers(prev => new Set([...prev, data.playerId]));
            setGuessFeed(prev => [{ type: 'correct', playerName: data.playerName, rank: data.rank, points: data.points, id: Date.now() }, ...prev]);
        };
        const handleCloseGuess = (data) => {
            setGuessFeed(prev => [{ type: 'close', playerName: data.playerName, id: Date.now() }, ...prev]);
        };
        const handleIncorrectGuess = (data) => {
            setGuessFeed(prev => [{ type: 'incorrect', playerName: data.playerName, guess: data.guess, id: Date.now() }, ...prev]);
        };
        const handleAllGuessed = () => endRound();

        const handleRoundEnded = (data) => {
            setGameState('ROUND_END');
            setRevealedWord(data.word);
            setRoundResults(data.results);
            if (timerRef.current) clearInterval(timerRef.current);
            
            if (data.drawerLeft) {
                setDrawerLeftWarning(true);
                playFailSound();
            } else {
                setDrawerLeftWarning(false);
                const anyoneGuessed = data.results.some(p => !p.wasDrawer && p.guessedThisRound);
                if (anyoneGuessed) {
                    playSuccessSound();
                    triggerConfetti();
                } else {
                    playFailSound();
                }
            }

            setNextRoundCountdown(8);
            countdownRef.current = setInterval(() => {
                setNextRoundCountdown(prev => {
                    if (prev <= 1) { clearInterval(countdownRef.current); nextRound(); return 0; }
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
            triggerPodiumConfetti();
        };

        const handleWordSkipped = (data) => { setWordCategory(data.wordCategory); setWordLength(data.wordLength); clearCanvas(true); };
        const handleGameRestarted = () => { setGameState('LOBBY'); setCurrentRound(0); setGuessedPlayers(new Set()); setGuessFeed([]); };

        socket.on('draw-player-joined', handlePlayerJoined);
        socket.on('draw-player-left', handlePlayerLeft);
        socket.on('draw-game-started', handleGameStarted);
        socket.on('draw-next-round', handleNextRound);
        socket.on('draw-stroke', handleStroke);
        socket.on('draw-clear', handleClear);
        socket.on('draw-undo-stroke', handleUndoStroke);
        socket.on('draw-player-guessed', handlePlayerGuessed);
        socket.on('draw-close-guess', handleCloseGuess);
        socket.on('draw-incorrect-guess', handleIncorrectGuess);
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
            socket.off('draw-undo-stroke', handleUndoStroke);
            socket.off('draw-player-guessed', handlePlayerGuessed);
            socket.off('draw-close-guess', handleCloseGuess);
            socket.off('draw-incorrect-guess', handleIncorrectGuess);
            socket.off('draw-all-guessed', handleAllGuessed);
            socket.off('draw-round-ended', handleRoundEnded);
            socket.off('draw-game-over', handleGameOver);
            socket.off('draw-word-skipped', handleWordSkipped);
            socket.off('draw-game-restarted', handleGameRestarted);
        };
    }, [roomCode]);

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

        // Fallback : forcer après un cycle de layout
        requestAnimationFrame(() => {
            const r = canvas.getBoundingClientRect();
            initCanvas(r.width, r.height);
            strokesHistoryRef.current.forEach(s => drawStroke(s, false));
        });

        return () => ro.disconnect();
    }, [gameState]);

    const startTimer = (duration, startTime) => {
        if (timerRef.current) clearInterval(timerRef.current);
        let lastLoggedTick = -1;
        const update = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            const ceilRemaining = Math.ceil(remaining);
            setTimer(ceilRemaining);
            
            if (ceilRemaining <= 10 && ceilRemaining > 0 && ceilRemaining !== lastLoggedTick) {
                lastLoggedTick = ceilRemaining;
                playTickSound();
            }

            if (remaining <= 0) { 
                clearInterval(timerRef.current); 
                endRound(); 
            }
        };
        update();
        timerRef.current = setInterval(update, 1000);
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

    const startGame = () => {
        if (players.length < 2) return;
        socket.emit('draw-start-game', { roomCode, settings }, (response) => {
            if (response.error) console.error('[DRAW] Start game error:', response.error);
        });
    };

    const endRound = () => socket.emit('draw-end-round', { roomCode }, (r) => { if (r.error) console.error(r.error); });
    const nextRound = () => socket.emit('draw-next-round', { roomCode }, (r) => { if (r.error) console.error(r.error); });
    const restartGame = () => socket.emit('draw-restart-game', { roomCode }, (r) => { if (r.success) setGameState('LOBBY'); });

    const CATEGORY_LABELS = {
        actions: '🏃 Actions', animals: '🐾 Animaux', celebrities: '⭐ Célébrités',
        expressions: '😄 Expressions', jobs: '💼 Métiers', movies: '🎬 Films',
        objects_easy: '📦 Objets Facile', objects_medium: '🧩 Objets Moyen',
        places: '🌍 Lieux', sports: '⚽ Sports',
    };

    const toggleCategory = (key) => {
        setSettings(s => {
            const current = s.categories.filter(c => c !== 'all');
            if (current.includes(key)) {
                const next = current.filter(c => c !== key);
                return { ...s, categories: next.length === 0 ? ['all'] : next };
            }
            return { ...s, categories: [...current, key] };
        });
    };

    const getSortedPlayers = () => [...players].sort((a, b) => b.score - a.score);
    const timerPct = settings.timePerRound > 0 ? (timer / settings.timePerRound) * 100 : 0;
    const timerClass = timer <= 10 ? 'timer-danger' : timer <= 30 ? 'timer-warning' : '';

    const copyCode = () => {
        navigator.clipboard?.writeText(roomCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const joinUrl = `${window.location.origin}/draw/play/${roomCode}`;

    // ── CREATING ──────────────────────────────────────────────────────
    if (gameState === 'CREATING') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl font-black text-on-background uppercase italic mb-4">🎨 DrawUp</div>
                    <div className="text-[#FF3B30] font-bold uppercase text-sm">Création du salon...</div>
                </div>
            </div>
        );
    }

    // ── LOBBY ─────────────────────────────────────────────────────────
    if (gameState === 'LOBBY') {
        return (
            <div className="min-h-screen flex flex-col p-4 text-on-background relative overflow-auto">

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between mb-4">
                    <button onClick={() => navigate('/draw')} className="text-[10px] font-black text-[#FF3B30] uppercase tracking-wide flex items-center gap-1 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-sm">arrow_back</span> Retour
                    </button>
                    <div className="bg-[#FF3B30] text-white font-black text-sm uppercase italic px-4 py-1.5 border-[3px] border-on-background rounded-full neo-shadow-sm">
                        🎨 DrawUp
                    </div>
                    <div className="w-16" />
                </div>

                <div className="relative z-10 w-full max-w-2xl mx-auto flex flex-col gap-4">
                    {/* Code + QR */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-5 neo-shadow flex flex-col sm:flex-row items-center gap-5">
                        <div className="flex-1 text-center sm:text-left">
                            <div className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider mb-1">Code du salon</div>
                            <div className="text-6xl font-black text-on-background tracking-widest uppercase select-all leading-none mb-3">
                                {roomCode}
                            </div>
                            <button
                                onClick={copyCode}
                                className="flex items-center gap-1.5 bg-[#C2DCFF] text-on-background font-black text-[11px] uppercase px-3 py-1.5 border-2 border-on-background rounded-lg hover:bg-[#FFD60A] transition-colors neo-shadow-sm"
                            >
                                <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                                {copied ? 'Copié !' : 'Copier'}
                            </button>
                        </div>
                        <div className="bg-white border-[3px] border-on-background rounded-lg p-2 neo-shadow-sm">
                            <QRCodeSVG value={joinUrl} size={110} />
                        </div>
                    </div>

                    {/* Players */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow">
                        <div className="flex items-center justify-between mb-3 border-b-2 border-on-background pb-2">
                            <h2 className="text-xs font-black uppercase text-[#FF3B30]">Joueurs ({players.length})</h2>
                            <span className="material-symbols-outlined text-sm text-[#FF3B30] animate-pulse">groups</span>
                        </div>
                        {players.length === 0 ? (
                            <p className="text-[11px] text-[#FF3B30] font-bold italic text-center py-3">En attente de joueurs...</p>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {players.map(p => (
                                    <div key={p.id} className="flex flex-col items-center gap-1 bg-[#FFFBF0] border-2 border-on-background/20 rounded-lg p-2">
                                        <div className="w-10 h-10 rounded-full border-2 border-on-background overflow-hidden">
                                            {p.avatar?.startsWith('/') ? (
                                                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xl bg-[#C2DCFF]">{p.avatar || '👤'}</div>
                                            )}
                                        </div>
                                        <span className="text-[9px] font-black uppercase truncate w-full text-center">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Settings */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow">
                        <div className="flex items-center gap-2 mb-3 border-b-2 border-on-background pb-2">
                            <span className="material-symbols-outlined text-sm text-[#FF3B30]">tune</span>
                            <h2 className="text-xs font-black uppercase text-[#FF3B30]">Paramètres</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <div className="text-[9px] font-black uppercase text-[#FF3B30]/80 mb-1">Tours / joueur</div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSettings(s => ({ ...s, roundsPerPlayer: Math.max(1, s.roundsPerPlayer - 1) }))}
                                        className="w-8 h-8 bg-[#FFE0DC] border-2 border-on-background rounded-lg font-black text-sm flex items-center justify-center hover:bg-[#FFD60A] transition-colors neo-shadow-sm active:translate-y-px">−</button>
                                    <span className="font-black text-lg text-on-background min-w-[2rem] text-center">{settings.roundsPerPlayer}</span>
                                    <button onClick={() => setSettings(s => ({ ...s, roundsPerPlayer: Math.min(5, s.roundsPerPlayer + 1) }))}
                                        className="w-8 h-8 bg-[#FFE0DC] border-2 border-on-background rounded-lg font-black text-sm flex items-center justify-center hover:bg-[#FFD60A] transition-colors neo-shadow-sm active:translate-y-px">+</button>
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] font-black uppercase text-[#FF3B30]/80 mb-1">Temps / tour</div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setSettings(s => ({ ...s, timePerRound: Math.max(30, s.timePerRound - 15) }))}
                                        className="w-8 h-8 bg-[#C2DCFF] border-2 border-on-background rounded-lg font-black text-sm flex items-center justify-center hover:bg-[#FFD60A] transition-colors neo-shadow-sm active:translate-y-px">−</button>
                                    <span className="font-black text-lg text-on-background min-w-[3rem] text-center">{settings.timePerRound}s</span>
                                    <button onClick={() => setSettings(s => ({ ...s, timePerRound: Math.min(180, s.timePerRound + 15) }))}
                                        className="w-8 h-8 bg-[#C2DCFF] border-2 border-on-background rounded-lg font-black text-sm flex items-center justify-center hover:bg-[#FFD60A] transition-colors neo-shadow-sm active:translate-y-px">+</button>
                                </div>
                            </div>
                        </div>

                        {/* Catégories */}
                        {availableCategories.length > 0 && (
                            <div>
                                <div className="text-[9px] font-black uppercase text-[#FF3B30]/80 mb-2 flex items-center justify-between">
                                    <span>Thèmes de mots</span>
                                    <button
                                        onClick={() => setSettings(s => ({ ...s, categories: ['all'] }))}
                                        className="text-[8px] font-black text-[#FF3B30]/60 hover:text-[#FF3B30] transition-colors"
                                    >
                                        {settings.categories.includes('all') ? '✓ Tous' : 'Tout sélectionner'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableCategories.map(key => {
                                        const isAll = settings.categories.includes('all');
                                        const isActive = isAll || settings.categories.includes(key);
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => toggleCategory(key)}
                                                className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border-2 transition-all active:scale-95 ${
                                                    isActive
                                                        ? 'border-on-background bg-[#FF3B30] text-white shadow-[1.5px_1.5px_0px_0px_rgba(22,26,51,1)]'
                                                        : 'border-on-background/30 bg-[#FFFBF0] text-on-background/60 hover:border-on-background'
                                                }`}
                                            >
                                                {CATEGORY_LABELS[key] || key}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Start */}
                    <button
                        onClick={startGame}
                        disabled={players.length < 2}
                        className="w-full bg-[#FFD60A] text-on-background font-black py-4 border-[3px] border-on-background rounded-xl shadow-[4px_4px_0px_0px_#161a33] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#161a33] transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed active:translate-y-px active:shadow-none"
                    >
                        <span className="material-symbols-outlined">play_arrow</span>
                        {players.length < 2 ? `Minimum 2 joueurs (${players.length}/2)` : '🎨 Lancer la Partie'}
                    </button>
                </div>
            </div>
        );
    }

    // ── PLAYING ───────────────────────────────────────────────────────
    if (gameState === 'PLAYING') {
        const guessersCount = guessedPlayers.size;
        const nonDrawers = players.filter(p => p.id !== currentDrawerId).length;

        return (
            <div className="h-screen flex flex-col overflow-hidden comic-theme relative">
                {countdownVal > 0 && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="comic-countdown-container scale-in">
                            <div className="comic-countdown-text font-black italic text-8xl">
                                {countdownVal}
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-white border-b-[3px] border-on-background flex-shrink-0">
                    <div className="bg-[#FF3B30] text-white font-black text-xs uppercase px-3 py-1 rounded-full border-2 border-on-background">
                        🎨 DrawUp
                    </div>
                    <div className="bg-[#C2DCFF] text-on-background font-black text-xs uppercase px-3 py-1 rounded-full border-2 border-on-background">
                        Manche {currentRound}/{totalRounds}
                    </div>

                    {/* Word blanks */}
                    <div className="flex-1 flex items-center justify-center gap-1 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-[#FF3B30] mr-1">{wordCategory}</span>
                        {Array.from({ length: wordLength }).map((_, i) => (
                            <div key={i} className="w-5 h-0.5 bg-on-background rounded-full" />
                        ))}
                        <span className="text-[9px] text-on-background/50 ml-1">({wordLength} lettres)</span>
                    </div>

                    {/* Timer */}
                    <div className={`flex flex-col items-center ${timerClass}`}>
                        <span className="font-black text-2xl leading-none text-on-background tabular-nums">{timer}</span>
                        <div className="w-16 h-1.5 bg-on-background/10 rounded-full overflow-hidden mt-1">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-[#e71d36]' : timer <= 30 ? 'bg-[#ff9f1c]' : 'bg-[#FFD60A]'}`}
                                style={{ width: `${timerPct}%` }}
                            />
                        </div>
                    </div>

                    {/* Score fin de manche */}
                    <button onClick={endRound} className="bg-[#FFE0DC] text-on-background font-black text-[9px] uppercase px-2 py-1.5 border-2 border-on-background rounded-lg neo-shadow-sm hover:bg-[#FFD60A] transition-colors active:translate-y-px">
                        ⏹ Terminer
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0 gap-3 p-3">
                    {/* Canvas area */}
                    <div className="flex-1 flex flex-col min-w-0 gap-2">
                        <div className="bg-[#C2DCFF] border-[3px] border-on-background rounded-xl px-4 py-2 flex items-center gap-2 neo-shadow-sm">
                            <div className="w-7 h-7 rounded-full border-2 border-on-background overflow-hidden flex-shrink-0 bg-[#FFFBF0]">
                                {players.find(p => p.id === currentDrawerId)?.avatar?.startsWith('/') ? (
                                    <img src={players.find(p => p.id === currentDrawerId)?.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-sm">
                                        {players.find(p => p.id === currentDrawerId)?.avatar || '🎨'}
                                    </div>
                                )}
                            </div>
                            <span className="font-black text-xs uppercase text-on-background">
                                <span className="text-[#FF3B30]">{drawerName}</span> dessine...
                            </span>
                            <div className="ml-auto text-[10px] font-black text-on-background/60">
                                {guessersCount}/{nonDrawers} ont trouvé
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 flex items-center justify-center p-2 relative">
                            <div className="canvas-container-4-3">
                                <canvas ref={canvasRef} className="draw-canvas" />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-56 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
                        {/* Leaderboard */}
                        <div className="bg-white border-[3px] border-on-background rounded-xl p-3 neo-shadow">
                            <h3 className="text-[10px] font-black uppercase text-[#FF3B30] mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">leaderboard</span> Classement
                            </h3>
                            <div className="flex flex-col gap-1.5">
                                {getSortedPlayers().map((p, i) => (
                                    <div key={p.id} className={`flex items-center gap-1.5 p-1.5 rounded-lg border-2 text-[10px] ${
                                        p.id === currentDrawerId
                                            ? 'border-[#FF3B30] bg-[#FF3B30]/15'
                                            : guessedPlayers.has(p.id)
                                                ? 'border-[#ffe16d] bg-[#FFD60A]/20'
                                                : 'border-on-background/20 bg-[#FFFBF0]'
                                    }`}>
                                        <span className="font-black text-on-background w-4 text-center">{i + 1}</span>
                                        <div className="w-5 h-5 rounded-full border border-on-background/30 overflow-hidden flex-shrink-0 bg-[#C2DCFF]">
                                            {p.avatar?.startsWith('/') ? (
                                                <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[9px]">{p.avatar || '👤'}</div>
                                            )}
                                        </div>
                                        <span className="flex-1 font-bold truncate text-on-background">{p.name}</span>
                                        <span className="font-black text-on-background">{p.score}</span>
                                        <span className="text-sm">{p.id === currentDrawerId ? '🎨' : guessedPlayers.has(p.id) ? '✅' : '💭'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Guess feed */}
                        <div className="bg-white border-[3px] border-on-background rounded-xl p-3 neo-shadow flex-1 flex flex-col min-h-0">
                            <h3 className="text-[10px] font-black uppercase text-[#FF3B30] mb-2 flex items-center gap-1">
                                <span className="material-symbols-outlined text-xs">chat</span> Réponses
                            </h3>
                            <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
                                {guessFeed.slice(0, 20).map(g => (
                                    <div key={g.id} className={`text-[10px] p-1.5 rounded-lg border ${
                                        g.type === 'correct'
                                            ? 'bg-[#FFD60A]/30 border-[#ffe16d] font-black text-[#161a33]'
                                            : g.type === 'close'
                                                ? 'bg-[#FFE0DC]/20 border-[#ffc2eb] font-bold text-[#ff3b30]'
                                                : 'bg-on-background/5 border-on-background/10 text-on-background/60 font-medium'
                                    }`}>
                                        {g.type === 'correct'
                                            ? `✅ ${g.playerName} a trouvé ! (+${g.points})`
                                            : g.type === 'close'
                                                ? `🔥 ${g.playerName} s'approche...`
                                                : `${g.playerName}: ${g.guess}`
                                        }
                                    </div>
                                ))}
                                {guessFeed.length === 0 && (
                                    <p className="text-[9px] text-on-background/40 italic text-center py-2">En attente...</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── ROUND END ─────────────────────────────────────────────────────
    if (gameState === 'ROUND_END') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden comic-theme">
                <div className="relative z-10 w-full max-w-lg flex flex-col gap-4">
                    {drawerLeftWarning && (
                        <div className="bg-[#FFE0DC] border-[3px] border-[#FF3B30] text-[#FF3B30] font-black text-sm uppercase p-4 text-center rounded-xl animate-pulse neo-shadow-sm">
                            ⚠️ Le dessinateur s'est déconnecté ! Passage au tour suivant...
                        </div>
                    )}

                    {/* Word reveal — style bulle BD */}
                    <div className="bg-[#FF3B30] border-[4px] border-on-background p-5 shadow-[6px_6px_0_#1a1a1a] text-center -rotate-1">
                        <div className="text-[10px] font-black uppercase text-white/80 tracking-wider mb-1">Le mot était</div>
                        <div className="text-5xl font-black uppercase italic text-white tracking-tight">{revealedWord?.word}</div>
                        <div className="text-[10px] font-bold text-white/70 uppercase mt-1">{revealedWord?.category}</div>
                    </div>

                    {/* Results */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow flex flex-col gap-2">
                        {roundResults.map(p => (
                            <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg border-2 ${
                                p.wasDrawer ? 'border-[#FF3B30] bg-[#FF3B30]/15' :
                                p.guessedThisRound ? 'border-[#ffe16d] bg-[#FFD60A]/20' :
                                'border-on-background/20 bg-[#FFFBF0]'
                            }`}>
                                <div className="w-8 h-8 rounded-full border-2 border-on-background overflow-hidden flex-shrink-0 bg-[#C2DCFF]">
                                    {p.avatar?.startsWith('/') ? (
                                        <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-base">{p.avatar || '👤'}</div>
                                    )}
                                </div>
                                <span className="flex-1 font-black text-xs uppercase text-on-background">{p.name}</span>
                                <span className="text-xs font-bold text-on-background/70">
                                    {p.wasDrawer ? '🎨 Dessinateur' : p.guessedThisRound ? '✅ Trouvé !' : '❌ Pas trouvé'}
                                </span>
                                <span className="font-black text-sm text-on-background">{p.score} pts</span>
                            </div>
                        ))}
                    </div>

                    {/* Countdown */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow text-center flex flex-col items-center gap-2">
                        <div className="text-[10px] font-black uppercase text-[#FF3B30] tracking-wider">Prochain tour dans</div>
                        <div className="text-5xl font-black text-on-background">{nextRoundCountdown}</div>
                        <button
                            onClick={() => { if (countdownRef.current) clearInterval(countdownRef.current); nextRound(); }}
                            className="bg-[#FFE0DC] text-on-background font-black text-xs uppercase px-4 py-2 border-2 border-on-background rounded-lg neo-shadow-sm hover:bg-[#FFD60A] transition-colors active:translate-y-px"
                        >
                            ⏭ Passer maintenant
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── GAME END ──────────────────────────────────────────────────────
    if (gameState === 'GAME_END') {
        const winner = finalResults[0];
        const podium = finalResults.slice(0, 3);
        const rest = finalResults.slice(3);

        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden comic-theme">
                <div className="relative z-10 w-full max-w-lg flex flex-col gap-4">
                    {/* Winner */}
                    <div className="bg-[#FFD60A] border-[4px] border-on-background p-5 shadow-[6px_6px_0_#1a1a1a] text-center -rotate-1">
                        <div className="text-4xl mb-2">👑</div>
                        <div className="text-2xl font-black uppercase italic text-on-background">{winner?.name}</div>
                        <div className="text-sm font-bold text-on-background/70 mt-1">{winner?.score} points</div>
                    </div>

                    {/* Podium */}
                    <div className="bg-white border-[3px] border-on-background rounded-xl p-4 neo-shadow">
                        <div className="flex items-end justify-center gap-3">
                            {/* 2nd */}
                            {podium[1] && (
                                <div className="flex flex-col items-center gap-2 flex-1">
                                    <div className="w-12 h-12 rounded-full border-[3px] border-on-background overflow-hidden bg-[#C2DCFF]">
                                        {podium[1].avatar?.startsWith('/') ? <img src={podium[1].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">{podium[1].avatar || '👤'}</div>}
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-center truncate w-full">{podium[1].name}</div>
                                    <div className="text-xs font-black text-[#FF3B30]">{podium[1].score} pts</div>
                                    <div className="bg-[#C2DCFF] border-2 border-on-background rounded-t-lg w-full h-12 flex items-center justify-center font-black text-lg neo-shadow-sm">🥈</div>
                                </div>
                            )}
                            {/* 1st */}
                            {podium[0] && (
                                <div className="flex flex-col items-center gap-2 flex-1">
                                    <div className="w-14 h-14 rounded-full border-[3px] border-on-background overflow-hidden bg-[#FFD60A]">
                                        {podium[0].avatar?.startsWith('/') ? <img src={podium[0].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">{podium[0].avatar || '👤'}</div>}
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-center truncate w-full">{podium[0].name}</div>
                                    <div className="text-xs font-black text-[#FF3B30]">{podium[0].score} pts</div>
                                    <div className="bg-[#FFD60A] border-2 border-on-background rounded-t-lg w-full h-16 flex items-center justify-center font-black text-xl neo-shadow-sm">🥇</div>
                                </div>
                            )}
                            {/* 3rd */}
                            {podium[2] && (
                                <div className="flex flex-col items-center gap-2 flex-1">
                                    <div className="w-12 h-12 rounded-full border-[3px] border-on-background overflow-hidden bg-[#FFE0DC]">
                                        {podium[2].avatar?.startsWith('/') ? <img src={podium[2].avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">{podium[2].avatar || '👤'}</div>}
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-center truncate w-full">{podium[2].name}</div>
                                    <div className="text-xs font-black text-[#FF3B30]">{podium[2].score} pts</div>
                                    <div className="bg-[#FFE0DC] border-2 border-on-background rounded-t-lg w-full h-9 flex items-center justify-center font-black text-base neo-shadow-sm">🥉</div>
                                </div>
                            )}
                        </div>
                        {rest.length > 0 && (
                            <div className="mt-3 flex flex-col gap-1 border-t-2 border-on-background/20 pt-3">
                                {rest.map((p, i) => (
                                    <div key={p.id} className="flex items-center gap-2 text-[10px]">
                                        <span className="font-black text-on-background/50 w-4">#{i + 4}</span>
                                        <span className="flex-1 font-bold text-on-background truncate">{p.name}</span>
                                        <span className="font-black text-on-background">{p.score} pts</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Awards */}
                    {awards.length > 0 && (
                        <div className="grid grid-cols-2 gap-3">
                            {awards.map((a, i) => (
                                <div key={i} className="bg-white border-[3px] border-on-background rounded-xl p-3 neo-shadow text-center">
                                    <div className="text-2xl mb-1">{a.icon}</div>
                                    <div className="text-[10px] font-black uppercase text-[#FF3B30]">{a.title}</div>
                                    <div className="text-xs font-bold text-on-background truncate">{a.playerName}</div>
                                    <div className="text-[9px] text-on-background/60 font-bold mt-0.5">{a.value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button onClick={restartGame}
                            className="flex-1 bg-[#FFD60A] text-on-background font-black py-3 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#161a33] transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-1 active:translate-y-px active:shadow-none">
                            🔄 Rejouer
                        </button>
                        <button onClick={() => navigate('/')}
                            className="flex-1 bg-white text-[#FF3B30] font-black py-3 border-[3px] border-on-background rounded-xl shadow-[3px_3px_0px_0px_#161a33] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#161a33] transition-all text-xs uppercase tracking-wide flex items-center justify-center gap-1 active:translate-y-px active:shadow-none">
                            🏠 Menu
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default DrawHostView;
