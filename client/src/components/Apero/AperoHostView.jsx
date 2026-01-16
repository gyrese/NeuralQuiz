import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './AperoStyles.css';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

// Thèmes
const THEMES = {
    'dark': { background: '#1a1a2e', text: '#ffffff' },
    'gradient-purple': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#ffffff' },
    'gradient-blue': { background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', text: '#ffffff' },
    'gradient-green': { background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', text: '#ffffff' },
    'gradient-orange': { background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)', text: '#ffffff' },
    'gradient-pink': { background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)', text: '#ffffff' },
    'neon': { background: '#0f0f23', text: '#00ff88' },
    'retro': { background: '#2d1b69', text: '#ff71ce' },
    'gold': { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', text: '#ffd700' }
};

function AperoHostView() {
    const navigate = useNavigate();

    // Game State
    const [gameState, setGameState] = useState('SELECT_QUIZ');
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [roomCode, setRoomCode] = useState('');
    const [teams, setTeams] = useState([]);

    // Slide State
    const [currentSlide, setCurrentSlide] = useState(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [questionState, setQuestionState] = useState('idle');
    const [timer, setTimer] = useState(0);
    const [answeredCount, setAnsweredCount] = useState(0);
    const [answerStats, setAnswerStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    // Scaling State for Safe Zone
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            // Calculate scale to fit 1280x720 into window while preserving aspect ratio (contain)
            const scaleX = window.innerWidth / 1280;
            const scaleY = window.innerHeight / 720;
            setScale(Math.min(scaleX, scaleY));
        };
        window.addEventListener('resize', handleResize);
        handleResize(); // Init
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initial Load & Session Recovery
    useEffect(() => {
        loadQuizzes();
        const savedSession = sessionStorage.getItem('apero_host_session');
        if (savedSession) {
            try {
                const { roomCode: savedCode } = JSON.parse(savedSession);
                if (savedCode && socket.connected) {
                    socket.emit('apero-host-reconnect', { roomCode: savedCode });
                }
            } catch (e) {
                console.error('Invalid session data');
            }
        }
    }, []);

    // Socket Event Listeners (Simplified for brevity - kept logic)
    useEffect(() => {
        const events = {
            'apero-room-created': ({ roomCode: code, quiz }) => {
                setRoomCode(code);
                setGameState('LOBBY');
                sessionStorage.setItem('apero_host_session', JSON.stringify({ roomCode: code, quizId: quiz.id }));
            },
            'apero-teams-updated': ({ teams: updatedTeams }) => setTeams(updatedTeams),
            'apero-game-started': ({ slide }) => {
                setGameState('PLAYING');
                setCurrentSlide(slide);
                setCurrentSlideIndex(0);
            },
            'apero-slide-changed': ({ slideIndex, slide }) => {
                setCurrentSlide(slide);
                setCurrentSlideIndex(slideIndex);
                setQuestionState('idle');
                setAnsweredCount(0);
                setAnswerStats(null);
            },
            'apero-question-opened': ({ timer: questionTimer }) => {
                setQuestionState('active');
                setTimer(questionTimer);
                setAnsweredCount(0);
            },
            'apero-answers-updated': ({ answeredCount: count }) => setAnsweredCount(count),
            'apero-question-closed': ({ results, answerStats: stats }) => {
                setQuestionState('reveal');
                setAnswerStats(stats);
                setLeaderboard(results);
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            },
            'apero-game-ended': ({ leaderboard: finalLeaderboard }) => {
                setLeaderboard(finalLeaderboard);
                setQuestionState('gameOver');
                confetti({ particleCount: 500, spread: 100, origin: { y: 0.6 } });
            },
            'apero-game-restored': (state) => {
                setRoomCode(state.roomCode);
                setGameState(state.gameState);
                setCurrentSlideIndex(state.currentSlideIndex || 0);
                if (state.quiz) setSelectedQuiz(state.quiz);
                if (state.teams) setTeams(state.teams);
                if (state.currentSlide) setCurrentSlide(state.currentSlide);
                if (state.leaderboard) setLeaderboard(state.leaderboard);
            },
            'apero-error': ({ message }) => alert('Erreur: ' + message)
        };
        Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));
        return () => Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
    }, []);

    // Timer Logic
    useEffect(() => {
        if (questionState !== 'active' || timer <= 0) return;
        const interval = setInterval(() => {
            setTimer(t => {
                if (t <= 1) {
                    socket.emit('apero-host-close-question');
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [questionState, timer]);

    // Keyboard Controls
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (gameState !== 'PLAYING') return;
            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                    if (questionState === 'active') socket.emit('apero-host-close-question');
                    else socket.emit('apero-host-next-slide');
                    break;
                case 'ArrowLeft': socket.emit('apero-host-prev-slide'); break;
                case 'Enter':
                    if (questionState === 'idle' && currentSlide?.type === 'question') socket.emit('apero-host-open-question');
                    else if (questionState === 'active') socket.emit('apero-host-close-question');
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, questionState, currentSlide]);

    const loadQuizzes = async () => {
        try {
            const res = await fetch(`${API_URL}/quizzes`);
            setQuizzes(await res.json());
        } catch (error) { console.error(error); }
    };

    const selectQuiz = async (quizId) => {
        try {
            if (!socket || !socket.connected) return alert('Socket déconnecté');
            const res = await fetch(`${API_URL}/quizzes/${quizId}`);
            const quiz = await res.json();
            setSelectedQuiz(quiz);
            socket.emit('apero-host-create', { quizId: quiz.id });
        } catch (e) { alert(e.message); }
    };

    const startGame = () => socket.emit('apero-host-start');
    const getJoinUrl = () => `${window.location.origin}/apero/play/${roomCode}`;

    if (gameState === 'SELECT_QUIZ') {
        return (
            <div className="apero-host p-5">
                <h2 className="text-warning mb-5">🍻 Sélectionnez un Quiz</h2>
                <div className="row g-4">
                    {quizzes.map(quiz => (
                        <div key={quiz.id} className="col-md-4">
                            <div className="card bg-dark border-secondary h-100" onClick={() => selectQuiz(quiz.id)} style={{ cursor: 'pointer' }}>
                                <div className="card-body text-center p-4">
                                    <h4 className="text-white">{quiz.title}</h4>
                                    <p className="text-muted">{quiz.slideCount} slides</p>
                                    <button className="btn btn-warning w-100 round-pill">Lancer</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    } // (Simplified Select Quiz Render)

    if (gameState === 'LOBBY') {
        return (
            <div className="apero-host d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', background: '#1a1a2e' }}>
                <h1 className="text-warning mb-4 fw-bold">{selectedQuiz?.title}</h1>
                <div className="bg-white p-4 rounded-4 shadow-lg mb-5"><QRCodeSVG value={getJoinUrl()} size={250} /></div>
                <h2 className="text-white mb-2">Code: <span className="text-info">{roomCode}</span></h2>
                <div className="d-flex flex-wrap gap-3 justify-content-center mt-5">
                    {teams.map(team => <span key={team.name} className="badge bg-info fs-5 px-4 py-3 rounded-pill">{team.name}</span>)}
                </div>
                <button className="btn btn-success btn-lg px-5 py-3 mt-5 rounded-pill shadow" onClick={startGame} disabled={teams.length === 0}>🚀 Lancer</button>
            </div>
        );
    }

    // PLAYING - RENDER SAFE ZONE
    return (
        <div className="apero-host-fullscreen" style={{ position: 'relative', overflow: 'hidden', height: '100vh', backgroundColor: '#000' }}>

            {/* BACKGROUND LAYER (Cover) */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={`bg-${currentSlide?.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                >
                    {currentSlide?.background?.type === 'image' ? (
                        <>
                            <div style={{
                                position: 'absolute', inset: 0,
                                backgroundImage: `url("${currentSlide.background.value}")`,
                                backgroundSize: 'cover', backgroundPosition: 'center'
                            }} />
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
                        </>
                    ) : (
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: currentSlide?.background?.value || THEMES[currentSlide?.theme]?.background || '#1a1a2e'
                        }} />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* SAFE ZONE CONTAINER (Contain 1280x720) */}
            <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: '1280px', height: '720px',
                transform: `translate(-50%, -50%) scale(${scale})`,
                transformOrigin: 'center center',
                zIndex: 10,
                // border: '1px dashed rgba(255,255,255,0.1)' // Debug outline
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`content-${currentSlide?.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ width: '100%', height: '100%', position: 'relative' }}
                    >
                        {/* 1. FREE ELEMENTS (WYSIWYG) */}
                        {currentSlide?.elements?.map(el => (
                            <motion.div
                                key={el.id}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
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
                                    <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.style.borderRadius }} />
                                )}
                            </motion.div>
                        ))}

                        {/* 2. STANDARD CONTENT LAYOUT (Fallback / Core Game Info) */}
                        {/* Only show if NO free elements OR if specifically standard slide type */}
                        {(!currentSlide?.elements || currentSlide.elements.length === 0) && (
                            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center p-5">
                                {currentSlide?.type === 'title' && (
                                    <>
                                        <h1 style={{ fontSize: '5rem', fontWeight: 'bold' }}>{currentSlide.title}</h1>
                                        <h3 className="mt-4" style={{ fontSize: '2.5rem' }}>{currentSlide.subtitle}</h3>
                                    </>
                                )}
                                {currentSlide?.type === 'question' && (
                                    <>
                                        <span className="badge bg-light text-dark fs-3 mb-4">Question {currentSlideIndex + 1}</span>
                                        <h2 style={{ fontSize: '3.5rem', fontWeight: 'bold' }}>{currentSlide.questionText}</h2>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 3. GAME HUD (Timer, Options, Leaderboard) - ALWAYS ON TOP */}
                        {/* QCM Options (Bottom Overlay) */}
                        {currentSlide?.type === 'question' && currentSlide.questionType === 'qcm' && (
                            <div style={{ position: 'absolute', bottom: '40px', left: '40px', right: '40px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                                {currentSlide.options?.map((opt, i) => (
                                    <div key={i} style={{ flex: '1 1 40%' }} className={`card p-3 d-flex flex-row align-items-center gap-3 ${questionState === 'reveal' && opt.label === currentSlide.correctAnswer ? 'bg-success text-white' : 'bg-white text-dark'
                                        }`}>
                                        <div className="rounded-circle bg-light d-flex align-items-center justify-content-center fw-bold fs-3" style={{ width: 50, height: 50, color: 'black' }}>{opt.label}</div>
                                        <div className="fs-3 fw-bold">{opt.text}</div>
                                        {questionState === 'reveal' && <div className="ms-auto fw-bold">{answerStats?.[opt.label] || 0}</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* TIMER */}
                        {questionState === 'active' && (
                            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                                <div className="bg-dark text-warning border border-warning rounded-circle d-flex align-items-center justify-content-center fs-2 fw-bold" style={{ width: 80, height: 80 }}>
                                    {timer}
                                </div>
                            </div>
                        )}
                        {/* Reveal Answer (Text/Estim) */}
                        {(currentSlide?.questionType === 'estimation' || currentSlide?.questionType === 'text') && questionState === 'reveal' && (
                            <div className="position-absolute top-50 start-50 translate-middle bg-dark p-5 rounded-5 border border-success shadow-lg text-center" style={{ zIndex: 100 }}>
                                <h3 className="text-white-50">Réponse</h3>
                                <div className="display-1 text-success fw-bold">{currentSlide.correctAnswer}</div>
                            </div>
                        )}

                        {/* SCOREBOARD */}
                        {currentSlide?.type === 'score' && (
                            <div className="d-flex flex-column gap-3 mt-5 align-items-center w-100">
                                <h1 className="text-warning display-3 fw-bold mb-5">{currentSlide.title || 'Classement'}</h1>
                                {leaderboard.slice(0, 5).map((team, i) => (
                                    <div key={team.name} className="bg-white text-dark p-3 rounded-4 w-75 d-flex justify-content-between px-5 shadow" style={{ transform: i === 0 ? 'scale(1.1)' : 'scale(1)', border: i === 0 ? '3px solid gold' : 'none' }}>
                                        <div className="fs-2">#{i + 1} <span className="fw-bold ms-3">{team.name}</span></div>
                                        <div className="fs-2 fw-bold text-primary">{team.totalScore}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export default AperoHostView;
