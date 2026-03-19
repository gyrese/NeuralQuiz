import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './AperoPlayer.css';

// Kahoot-style answer colors
const ANSWER_COLORS = {
    A: { bg: '#e21b3c', icon: '▲' },  // Red triangle
    B: { bg: '#1368ce', icon: '◆' },  // Blue diamond
    C: { bg: '#d89e00', icon: '●' },  // Yellow circle
    D: { bg: '#26890c', icon: '■' }   // Green square
};

function AperoPlayerView() {
    const { roomCode: urlRoomCode } = useParams();

    // Connection State
    const [gameState, setGameState] = useState('JOIN'); // JOIN, WAITING, QUESTION, ANSWERED, REVEAL, ENDED
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [teamName, setTeamName] = useState('');
    const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).substring(7));
    const [isJoined, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    // Game State
    const [currentSlide, setCurrentSlide] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(0);
    const [timer, setTimer] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [inputValue, setInputValue] = useState('');

    // Results
    const [isCorrect, setIsCorrect] = useState(null);
    const [points, setPoints] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [rank, setRank] = useState(0);

    const getAvatarUrl = (seed) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${seed}`;

    // Scaling for WYSIWYG Slide Display
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            // Mobile: Fit the 1280px width into the current window width
            // We want the slide to be fully visible at the top
            const targetWidth = 1280;
            const availableWidth = window.innerWidth;
            const newScale = Math.min(availableWidth / targetWidth, 1);
            setScale(newScale);
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init scaling immediately
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ==================== SOCKET EVENTS ====================
    useEffect(() => {
        const events = {
            'apero-team-joined': ({ roomCode: code, teamName: name }) => {
                setIsJoined(true);
                setRoomCode(code);
                setTeamName(name);
                setGameState('WAITING');
                setError('');
            },
            'apero-game-started': () => {
                setGameState('WAITING');
            },
            'apero-slide-changed': () => {
                // Host moved to a new slide - reset player state
                setGameState('WAITING');
                setSelectedAnswer(null);
                setInputValue('');
                setIsCorrect(null);
                setCurrentSlide(null);
            },
            'apero-question-opened': ({ questionNumber: qNum, questionType, timer: qTimer, slide }) => {
                console.log('[PLAYER] Question opened:', { qNum, questionType, slide });
                setQuestionNumber(qNum);
                setCurrentSlide(slide);
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
                setCurrentSlide(null);
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

    // Timer countdown
    useEffect(() => {
        if (gameState !== 'QUESTION' || timer <= 0) return;
        const interval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(interval);
    }, [gameState, timer]);

    // ==================== HANDLERS ====================
    const handleJoin = (e) => {
        e.preventDefault();
        if (!roomCode.trim() || !teamName.trim()) return setError('Remplissez tout !');

        socket.emit('apero-team-join', {
            roomCode: roomCode.toUpperCase(),
            teamName: teamName.trim(),
            avatar: getAvatarUrl(avatarSeed)
        }, (response) => {
            if (response?.error) {
                setError(response.error);
            } else {
                setIsJoined(true);
                setRoomCode(response.roomCode || roomCode.toUpperCase());
                setGameState('WAITING');
                setError('');
            }
        });
    };

    const handleAnswer = (answer) => {
        if (gameState !== 'QUESTION' || selectedAnswer) return;
        if (navigator.vibrate) navigator.vibrate(50);
        socket.emit('apero-team-answer', { answer });
    };

    const handleSubmitInput = (e) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;
        if (navigator.vibrate) navigator.vibrate(50);
        socket.emit('apero-team-answer', { answer: inputValue.trim() });
    };

    // ==================== RENDER: JOIN SCREEN ====================
    if (!isJoined) {
        return (
            <div className="apero-player-page" style={{
                backgroundImage: 'url(/assets/images/mobile_lobby_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                minHeight: '100vh' // Ensure full height on mobile
            }}>
                {/* Dark Overlay for readability using pseudo-element or absolute div logic via CSS class or inline if needed.
                    However, `apero-player-page` usually has styles. Let's add an inline overlay div inside if we can't edit CSS easily,
                    OR simpler: just rely on the card's background opacity.
                */}
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 0 }}></div>

                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="apero-join-card"
                    style={{ position: 'relative', zIndex: 1 }} // Ensure it sits on top of overlay
                >
                    <div className="join-logo">🍻</div>
                    <h1 className="join-title">APÉRO QUIZ</h1>

                    <form onSubmit={handleJoin} className="join-form">
                        {/* Avatar */}
                        <div className="avatar-picker">
                            <div className="avatar-preview">
                                <img src={getAvatarUrl(avatarSeed)} alt="Avatar" />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    if (navigator.vibrate) navigator.vibrate(20);
                                    setAvatarSeed(Math.random().toString(36).substring(7));
                                }}
                                className="avatar-shuffle"
                            >
                                🎲 Aléatoire
                            </button>
                        </div>

                        <input
                            type="text"
                            placeholder="CODE SALON"
                            value={roomCode}
                            onChange={e => { setRoomCode(e.target.value.toUpperCase()); setError(''); }}
                            maxLength={6}
                            className="join-input code-input"
                        />
                        <input
                            type="text"
                            placeholder="Pseudo"
                            value={teamName}
                            onChange={e => { setTeamName(e.target.value); setError(''); }}
                            maxLength={20}
                            className="join-input"
                        />

                        {error && <div className="join-error">{error}</div>}

                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            className="join-button"
                        >
                            REJOINDRE
                        </motion.button>
                    </form>
                </motion.div>
            </div>
        );
    }

    // ==================== RENDER: WAITING SCREEN ====================
    if (gameState === 'WAITING') {
        return (
            <div className="apero-player-page">
                <div className="score-badge">{totalScore} pts</div>
                <div className="waiting-content">
                    <motion.div
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="waiting-avatar"
                    >
                        <img src={getAvatarUrl(avatarSeed)} alt="Avatar" />
                    </motion.div>
                    <h2 className="waiting-name">{teamName}</h2>
                    <p className="waiting-text">Regardez l'écran ! La question arrive...</p>
                </div>
            </div>
        );
    }

    // ==================== RENDER: QUESTION SCREEN ====================
    if (gameState === 'QUESTION' && currentSlide) {
        const questionType = currentSlide.questionType;
        const options = currentSlide.options || [];

        // Background Logic
        const slideBackgroundStyle = {};
        if (currentSlide.background?.type === 'image') {
            slideBackgroundStyle.backgroundImage = `url("${currentSlide.background.value}")`;
            slideBackgroundStyle.backgroundSize = 'cover';
            slideBackgroundStyle.backgroundPosition = 'center';
        } else if (currentSlide.background?.value) {
            slideBackgroundStyle.background = currentSlide.background.value;
        }

        return (
            <div className="apero-player-page question-page">

                {/* Header: Floating Timer + Question Number */}
                <div className="question-header">
                    <div className="question-number">Q{questionNumber}</div>
                    <div className={`question-timer ${timer <= 5 ? 'urgent' : ''}`}>
                        {timer}
                    </div>
                </div>

                {/* 16:9 Slide Preview Scaled - Sticked to Top */}
                <div style={{
                    width: '100%',
                    height: `${720 * scale}px`, // Maintains aspect ratio space
                    position: 'relative',
                    flexShrink: 0,
                    background: '#000',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    zIndex: 1 // Behind header
                }}>
                    <div style={{
                        width: '1280px',
                        height: '720px',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0, left: 0,
                        overflow: 'hidden',
                        ...slideBackgroundStyle
                    }}>
                        {/* WYSIWYG Elements */}
                        {currentSlide.elements?.map(el => (
                            <div
                                key={el.id}
                                style={{
                                    position: 'absolute',
                                    left: el.x, top: el.y,
                                    width: el.width, height: el.height,
                                    zIndex: el.style?.zIndex || 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    ...el.style
                                }}
                            >
                                {el.type === 'text' && el.content}
                                {el.type === 'shape' && el.content}
                                {el.type === 'image' && el.url && (
                                    <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.style.borderRadius }} alt="" />
                                )}
                            </div>
                        ))}

                        {/* Fallback Text if no elements but text exists */}
                        {(!currentSlide.elements || currentSlide.elements.length === 0) && currentSlide.questionText && (
                            <div style={{
                                position: 'absolute',
                                left: 100, top: 100,
                                width: 1080,
                                display: 'flex', justifyContent: 'center', alignItems: 'center',
                                height: 500
                            }}>
                                <h1 style={{
                                    fontSize: '60px',
                                    color: '#fff',
                                    textAlign: 'center',
                                    textShadow: '0 4px 10px rgba(0,0,0,0.8)'
                                }}>
                                    {currentSlide.questionText}
                                </h1>
                            </div>
                        )}
                    </div>
                </div>

                {/* Answer Grid - Fills remaining space */}
                <div className="answer-grid">
                    {questionType === 'qcm' && options.map((opt, idx) => (
                        <motion.button
                            key={opt.label}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: idx * 0.1, type: "spring", stiffness: 300, damping: 20 }}
                            onClick={() => handleAnswer(opt.label)}
                            className="answer-button"
                            style={{ backgroundColor: ANSWER_COLORS[opt.label]?.bg }}
                        >
                            <span className="answer-icon">{ANSWER_COLORS[opt.label]?.icon}</span>
                            <span className="answer-text">{opt.text}</span>
                        </motion.button>
                    ))}

                    {questionType === 'truefalse' && (
                        <>
                            <motion.button
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                onClick={() => handleAnswer('Vrai')}
                                className="answer-button tf-button"
                                style={{ backgroundColor: '#26890c' }}
                            >
                                <span className="answer-icon">✓</span>
                                <span className="answer-text">VRAI</span>
                            </motion.button>
                            <motion.button
                                initial={{ x: 100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                onClick={() => handleAnswer('Faux')}
                                className="answer-button tf-button"
                                style={{ backgroundColor: '#e21b3c' }}
                            >
                                <span className="answer-icon">✗</span>
                                <span className="answer-text">FAUX</span>
                            </motion.button>
                        </>
                    )}

                    {(questionType === 'text' || questionType === 'estimation') && (
                        <form onSubmit={handleSubmitInput} className="input-form">
                            <input
                                type={questionType === 'estimation' ? 'number' : 'text'}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                autoFocus
                                placeholder={questionType === 'estimation' ? 'Entrez un nombre...' : 'Votre réponse...'}
                                className="answer-input"
                            />
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                type="submit"
                                className="submit-button"
                            >
                                Envoyer
                            </motion.button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ==================== RENDER: ANSWERED SCREEN ====================
    if (gameState === 'ANSWERED') {
        return (
            <div className="apero-player-page answered-page">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="answered-icon">
                    👍
                </motion.div>
                <h2>Réponse envoyée !</h2>
                <p className="answered-subtitle">On croise les doigts...</p>
            </div>
        );
    }

    // ==================== RENDER: REVEAL SCREEN ====================
    if (gameState === 'REVEAL') {
        return (
            <div className={`apero-player-page reveal-page ${isCorrect ? 'correct' : 'wrong'}`}>
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1, rotate: 360 }}
                    className="reveal-emoji"
                >
                    {isCorrect ? '🏆' : '💩'}
                </motion.div>
                <h1 className="reveal-title">{isCorrect ? 'BRAVO !' : 'RATÉ !'}</h1>
                {isCorrect && <div className="reveal-points">+{points} pts</div>}

                <div className="reveal-stats">
                    <div className="stat-row">
                        <span>Score Total</span>
                        <span className="stat-value">{totalScore}</span>
                    </div>
                    <div className="stat-row">
                        <span>Classement</span>
                        <span className="stat-value">#{rank}</span>
                    </div>
                </div>
            </div>
        );
    }

    // ==================== RENDER: ENDED SCREEN ====================
    if (gameState === 'ENDED') {
        return (
            <div className="apero-player-page ended-page">
                <h1 className="ended-title">FIN DU JEU</h1>
                <div className="ended-card">
                    <div className="ended-label">Classement Final</div>
                    <div className="ended-rank">{rank}</div>
                    <div className="ended-suffix">ème</div>

                    <div className="ended-score">
                        <span className="score-label">Score Final</span>
                        <span className="score-value">{totalScore} pts</span>
                    </div>
                </div>
                <button onClick={() => window.location.reload()} className="quit-button">
                    Quitter
                </button>
            </div>
        );
    }

    return null;
}

export default AperoPlayerView;
