import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

const THEME = {
    bg: 'radial-gradient(circle at top, #2b1055 0%, #000000 100%)',
    text: '#fff',
    font: "'Segoe UI', sans-serif"
};

const QCM_COLORS = {
    A: { bg: 'linear-gradient(135deg, #ff0f7b 0%, #f89b29 100%)', shadow: '0 0 20px rgba(255, 15, 123, 0.5)' },
    B: { bg: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', shadow: '0 0 20px rgba(0, 198, 255, 0.5)' },
    C: { bg: 'linear-gradient(135deg, #f09819 0%, #edde5d 100%)', shadow: '0 0 20px rgba(240, 152, 25, 0.5)' },
    D: { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', shadow: '0 0 20px rgba(67, 233, 123, 0.5)' }
};

const ICONS = { A: '▲', B: '◆', C: '●', D: '■' };

const AVATARS = ['👽', '🤖', '👾', '🦄', '😎', '🍕', '🍻', '🎮', '💀', '🤡', '🤠', '🎃']; // Fallback/Legacy

function AperoPlayerView() {
    const { roomCode: urlRoomCode } = useParams();
    const [gameState, setGameState] = useState('JOIN');
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [teamName, setTeamName] = useState('');
    // Avatar Seed for DiceBear (Random Robot)
    const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
    const [isJoined, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    const [questionNumber, setQuestionNumber] = useState(0);
    const [questionType, setQuestionType] = useState('qcm');
    const [timer, setTimer] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [isCorrect, setIsCorrect] = useState(null);
    const [points, setPoints] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [rank, setRank] = useState(0);

    const getAvatarUrl = (seed) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}`;

    // Socket Logic (Kept identical)
    useEffect(() => {
        const events = {
            'apero-team-joined': ({ roomCode: code, teamName: name, avatar: sAvatar }) => {
                setIsJoined(true);
                setRoomCode(code);
                setTeamName(name);
                // If sAvatar is a URL (contains http), we might want to extract seed, but simply storing it is fine if we handle display logic
                // But for simplicity, let's keep using our local seed if we are the one joining, or update if provided
                if (sAvatar && sAvatar.includes('dicebear')) {
                    // Extract seed if needed, or just rely on the fact that we sent it
                }
                setGameState('WAITING');
                setError('');
            },
            'apero-game-started': () => setGameState('WAITING'),
            'apero-slide-changed': () => {
                setGameState('WAITING');
                setSelectedAnswer(null);
                setInputValue('');
                setIsCorrect(null);
            },
            'apero-question-opened': ({ questionNumber: qNum, questionType: qType, timer: qTimer }) => {
                setQuestionNumber(qNum);
                setQuestionType(qType);
                setTimer(qTimer);
                setGameState('QUESTION');
                setSelectedAnswer(null);
                setInputValue('');
                if (navigator.vibrate) navigator.vibrate(200);
            },
            'apero-answer-confirmed': ({ answer }) => {
                setSelectedAnswer(answer);
                setGameState('ANSWERED');
            },
            'apero-question-closed': ({ results }) => {
                setGameState('REVEAL');
                const ourResult = results.find(r => r.teamName === teamName);
                if (ourResult) {
                    setIsCorrect(ourResult.correct);
                    setPoints(ourResult.points);
                    setTotalScore(ourResult.totalScore);
                    setRank(results.findIndex(r => r.teamName === teamName) + 1);
                    if (navigator.vibrate) navigator.vibrate(ourResult.correct ? [100, 50, 100] : [300]);
                    if (ourResult.correct) {
                        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
                    }
                }
            },
            'apero-game-ended': () => setGameState('ENDED'),
            'apero-game-restarted': () => {
                setGameState('WAITING');
                setTotalScore(0);
                setSelectedAnswer(null);
            },
            'apero-room-closed': () => {
                setGameState('JOIN');
                setIsJoined(false);
                setError('Le salon a été fermé par l\'hôte');
            },
            'apero-error': ({ message }) => setError(message)
        };

        Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));
        return () => Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
    }, [teamName]);

    useEffect(() => {
        if (gameState !== 'QUESTION' || timer <= 0) return;
        const interval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(interval);
    }, [gameState, timer]);

    const handleJoin = (e) => {
        e.preventDefault();
        if (!roomCode.trim() || !teamName.trim()) return setError('Remplissez tout !');

        socket.emit('apero-team-join', {
            roomCode: roomCode.toUpperCase(),
            teamName: teamName.trim(),
            avatar: getAvatarUrl(avatarSeed)
        }, (response) => {
            if (response.error) {
                setError(response.error);
            } else {
                setIsJoined(true);
                setRoomCode(response.roomCode || roomCode.toUpperCase());
                // Event apero-team-joined will likely fire too, but we handle immediate success here
                setGameState('WAITING');
                setError('');
            }
        });
    };

    const handleAnswer = (answer) => {
        if (gameState !== 'QUESTION' || selectedAnswer) return;
        if (navigator.vibrate) navigator.vibrate(50);
        socket?.emit('team:answer', { answer });
    };

    const handleSubmitInput = (e) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;
        if (navigator.vibrate) navigator.vibrate(50);
        socket?.emit('team:answer', { answer: inputValue.trim() });
    };

    // --- STYLED COMPONENTS (Inline for now) ---
    const pageStyle = {
        minHeight: '100vh',
        background: THEME.bg,
        color: THEME.text,
        fontFamily: THEME.font,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflow: 'hidden'
    };

    // ========== JOIN SCREEN ==========
    if (!isJoined) {
        return (
            <div style={pageStyle}>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}
                >
                    <div style={{ fontSize: 60, marginBottom: 20, filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }}>🍻</div>
                    <h1 style={{
                        fontSize: 40, fontWeight: 900, marginBottom: 40,
                        background: 'linear-gradient(to right, #00c6ff, #0072ff)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase', letterSpacing: 2
                    }}>APÉRO QUIZ</h1>

                    <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Avatar Generator */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{
                                width: 100, height: 100, borderRadius: '50%', overflow: 'hidden',
                                background: '#fff', border: '4px solid #fff', boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                                position: 'relative'
                            }}>
                                <img
                                    src={getAvatarUrl(avatarSeed)}
                                    alt="Avatar"
                                    style={{ width: '100%', height: '100%' }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(20);
                                    setAvatarSeed(Math.random().toString(36).substring(7));
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#fff', padding: '5px 15px', borderRadius: 20, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5, fontSize: 14
                                }}
                            >
                                <span>🎲</span> Aléatoire
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="CODE SALON"
                            value={roomCode}
                            onChange={e => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
                            maxLength={6}
                            style={{
                                padding: 20, borderRadius: 15, border: 'none', background: '#fff',
                                fontSize: 24, textAlign: 'center', fontWeight: 'bold', letterSpacing: 4,
                                color: '#333', boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Pseudo"
                            value={teamName}
                            onChange={e => { setTeamName(e.target.value); setError(''); }}
                            maxLength={20}
                            style={{
                                padding: 20, borderRadius: 15, border: 'none', background: '#fff',
                                fontSize: 20, textAlign: 'center',
                                color: '#333', boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
                            }}
                        />
                        {error && <div style={{ color: '#ff4b2b', background: 'rgba(255, 75, 43, 0.1)', padding: 10, borderRadius: 10 }}>{error}</div>}

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            style={{
                                padding: 20, borderRadius: 15, border: 'none',
                                background: 'linear-gradient(45deg, #fbc2eb 0%, #a6c1ee 100%)',
                                color: '#333', fontSize: 20, fontWeight: 900,
                                boxShadow: '0 10px 20px rgba(166, 193, 238, 0.4)',
                                cursor: 'pointer', textTransform: 'uppercase'
                            }}
                        >
                            REJOINDRE
                        </motion.button>
                    </form>
                </motion.div>
            </div>
        );
    }

    // ========== WAITING SCREEN ==========
    if (gameState === 'WAITING') {
        return (
            <div style={pageStyle}>
                <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', padding: '5px 15px', borderRadius: 20 }}>
                    {totalScore} pts
                </div>
                <div style={{ textAlign: 'center' }}>
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        style={{ marginBottom: 30, display: 'inline-block' }}
                    >
                        <img
                            src={getAvatarUrl(avatarSeed)}
                            alt="Avatar"
                            style={{ width: 120, height: 120, borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 0 30px rgba(255,255,255,0.3)' }}
                        />
                    </motion.div>
                    <h2 style={{ fontSize: 32, marginBottom: 10 }}>{teamName}</h2>
                    <p style={{ opacity: 0.6 }}>Regardez l'écran ! La question arrive...</p>
                </div>
            </div>
        );
    }

    // ========== QUESTION SCREEN (QCM) ==========
    if (gameState === 'QUESTION' && questionType === 'qcm') {
        return (
            <div style={{ ...pageStyle, justifyContent: 'flex-start', padding: 10 }}>
                {/* Header Timer */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 40 }}>
                    <div style={{ fontWeight: 900, fontSize: 24, opacity: 0.5 }}>Q{questionNumber}</div>
                    <div style={{
                        width: 60, height: 60, borderRadius: '50%', background: '#333',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '4px solid #fff', fontSize: 24, fontWeight: 'bold'
                    }}>
                        {timer}
                    </div>
                </div>

                {/* Grid */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15,
                    width: '100%', height: 'calc(100vh - 150px)'
                }}>
                    {['A', 'B', 'C', 'D'].map(letter => (
                        <motion.button
                            key={letter}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleAnswer(letter)}
                            style={{
                                border: 'none', borderRadius: 20,
                                background: QCM_COLORS[letter].bg,
                                boxShadow: QCM_COLORS[letter].shadow,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                color: '#fff', fontSize: 40, cursor: 'pointer', borderBottom: '6px solid rgba(0,0,0,0.2)'
                            }}
                        >
                            <span style={{ fontSize: 60, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.2))' }}>{ICONS[letter]}</span>
                        </motion.button>
                    ))}
                </div>
            </div>
        );
    }

    // ========== QUESTION SCREEN (True/False) ==========
    if (gameState === 'QUESTION' && questionType === 'truefalse') {
        return (
            <div style={{ ...pageStyle, justifyContent: 'flex-start', padding: 10 }}>
                {/* Header Timer */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 40 }}>
                    <div style={{ fontWeight: 900, fontSize: 24, opacity: 0.5 }}>Q{questionNumber}</div>
                    <div style={{
                        width: 60, height: 60, borderRadius: '50%', background: '#333',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '4px solid #fff', fontSize: 24, fontWeight: 'bold'
                    }}>
                        {timer}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', height: 'calc(100vh - 150px)', justifyContent: 'center' }}>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAnswer('Vrai')}
                        style={{ flex: 1, border: 'none', borderRadius: 20, fontSize: 40, fontWeight: 'bold', color: '#fff', cursor: 'pointer', background: '#2ecc71', boxShadow: '0 5px 15px rgba(46, 204, 113, 0.4)' }}
                    >
                        VRAI
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAnswer('Faux')}
                        style={{ flex: 1, border: 'none', borderRadius: 20, fontSize: 40, fontWeight: 'bold', color: '#fff', cursor: 'pointer', background: '#e74c3c', boxShadow: '0 5px 15px rgba(231, 76, 60, 0.4)' }}
                    >
                        FAUX
                    </motion.button>
                </div>
            </div>
        );
    }

    // ========== QUESTION SCREEN (Input) ==========
    if (gameState === 'QUESTION') {
        return (
            <div style={pageStyle}>
                <div style={{ width: '100%', maxWidth: 400 }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <div style={{ fontSize: 40, fontWeight: 'bold' }}>{timer}s</div>
                        <h3 style={{ opacity: 0.8 }}>Entrez votre réponse</h3>
                    </div>
                    <form onSubmit={handleSubmitInput} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <input
                            type={questionType === 'estimation' ? 'number' : (questionType === 'date' ? 'date' : 'text')}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            autoFocus
                            placeholder="Votre réponse..."
                            style={{
                                width: '100%', padding: 20, fontSize: 24, borderRadius: 15, border: 'none', textAlign: 'center'
                            }}
                        />
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            style={{
                                padding: 20, background: '#333', color: '#fff', border: 'none', borderRadius: 15,
                                fontSize: 20, fontWeight: 'bold', textTransform: 'uppercase'
                            }}
                        >
                            Envoyer
                        </motion.button>
                    </form>
                </div>
            </div>
        );
    }

    // ========== ANSWERED SCREEN ==========
    if (gameState === 'ANSWERED') {
        return (
            <div style={pageStyle}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 100, marginBottom: 20 }}>
                    👍
                </motion.div>
                <h2>Réponse envoyée !</h2>
                <p style={{ opacity: 0.6 }}>On croise les doigts...</p>
            </div>
        );
    }

    // ========== REVEAL SCREEN ==========
    if (gameState === 'REVEAL') {
        return (
            <div style={{ ...pageStyle, background: isCorrect ? '#26aba3' : '#e24e42' }}>
                <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }}
                    style={{ fontSize: 120, marginBottom: 20, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))' }}
                >
                    {isCorrect ? '🏆' : '💩'}
                </motion.div>
                <h1 style={{ fontSize: 40, fontWeight: 900, textTransform: 'uppercase', marginBottom: 10 }}>
                    {isCorrect ? 'BRAVO !' : 'RATE !'}
                </h1>
                {isCorrect && <div style={{ fontSize: 30, background: 'rgba(0,0,0,0.2)', padding: '5px 20px', borderRadius: 50 }}>+{points} pts</div>}

                <div style={{ marginTop: 40, background: 'rgba(0,0,0,0.1)', padding: 20, borderRadius: 20, width: '100%', maxWidth: 300 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span>Score Total</span>
                        <span style={{ fontWeight: 'bold' }}>{totalScore}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Classement</span>
                        <span style={{ fontWeight: 'bold' }}>#{rank}</span>
                    </div>
                </div>
            </div>
        );
    }

    // ========== ENDED SCREEN ==========
    if (gameState === 'ENDED') {
        return (
            <div style={pageStyle}>
                <h1 style={{ fontSize: 40, fontWeight: 900, marginBottom: 20 }}>FIN DU JEU</h1>
                <div style={{ background: '#fff', color: '#333', padding: 40, borderRadius: 30, width: '100%', maxWidth: 350, textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>Classement Final</div>
                    <div style={{ fontSize: 80, fontWeight: 900, color: '#00c6ff', lineHeight: 1 }}>{rank}</div>
                    <div style={{ fontSize: 24, marginTop: -10, marginBottom: 30 }}>ème</div>

                    <div style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
                        <div style={{ opacity: 0.6 }}>Score Final</div>
                        <div style={{ fontSize: 32, fontWeight: 'bold' }}>{totalScore} pts</div>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    style={{ marginTop: 40, background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '10px 30px', borderRadius: 50 }}
                >
                    Quitter
                </button>
            </div>
        );
    }

    return null;
}

export default AperoPlayerView;
