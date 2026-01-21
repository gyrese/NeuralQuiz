import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './AperoStyles.css';
import './AperoHost.css';

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

    // QCM Progressive Reveal State
    const [visibleOptionsCount, setVisibleOptionsCount] = useState(0);

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
                setVisibleOptionsCount(0); // Reset options visibility
            },
            'apero-question-opened': ({ timer: questionTimer }) => {
                setQuestionState('active');
                setTimer(questionTimer);
                setAnsweredCount(0);
                setVisibleOptionsCount(10); // Ensure all visible if opened manually
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
            if (e.target.tagName === 'INPUT') return;

            // SMART NAVIGATION LOGIC (Reusable)
            const triggerNextStep = () => {
                if (questionState === 'active') {
                    socket.emit('apero-host-close-question');
                } else if (questionState === 'idle' && currentSlide && !['title', 'score'].includes(currentSlide.type) && !['title', 'score'].includes(currentSlide.questionType)) {
                    socket.emit('apero-host-open-question');
                } else {
                    socket.emit('apero-host-next-slide');
                }
            };

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                case 'Enter':
                    if (gameState === 'PLAYING') triggerNextStep();
                    break;
                case 'ArrowLeft':
                    if (gameState === 'PLAYING') socket.emit('apero-host-prev-slide');
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
            <div className="apero-admin container-fluid p-4" style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', overflowY: 'auto' }}>
                <div className="d-flex justify-content-between align-items-center mb-5">
                    <div>
                        <h1 className="fw-bold text-white mb-0">🍻 Apéro Quiz <span className="text-warning">Live</span></h1>
                        <p className="text-secondary fs-5 mb-0" style={{ opacity: 0.8 }}>Choisissez un quiz à lancer</p>
                    </div>
                    <button className="btn btn-outline-light rounded-pill px-4" onClick={() => navigate('/')}>
                        ← Retour
                    </button>
                </div>

                <div className="quiz-grid-masonry">
                    {quizzes.map((quiz, index) => {
                        const isLarge = index % 5 === 0;
                        const isTall = index % 4 === 1 || index % 4 === 3;

                        return (
                            <motion.div
                                key={quiz.id}
                                whileHover={{ y: -8, boxShadow: '0 25px 50px rgba(0,0,0,0.8)' }}
                                className={`quiz-grid-card ${isLarge ? 'quiz-card-large' : ''} ${isTall ? 'quiz-card-tall' : ''}`}
                                onClick={() => selectQuiz(quiz.id)}
                            >
                                {/* Background Thumbnail */}
                                <div className="quiz-card-bg" style={{ overflow: 'hidden' }}>
                                    <div style={{
                                        width: '100%',
                                        height: '100%',
                                        position: 'absolute',
                                        inset: 0,
                                        backgroundColor: quiz.slides?.[0]?.background?.type === 'image' ? '#000' : (quiz.slides?.[0]?.background?.value || '#1a1a2e'),
                                        backgroundImage: quiz.slides?.[0]?.background?.type === 'image' ? `url("${quiz.slides[0].background.value}")` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center'
                                    }}>
                                        {/* Render miniature content SCALED to fit container */}
                                        <div style={{
                                            width: '960px', height: '540px',
                                            transform: `scale(${isLarge ? 0.8 : 0.6})`,
                                            transformOrigin: 'center center',
                                            position: 'absolute',
                                            left: '50%', top: '50%',
                                            marginLeft: '-480px', marginTop: '-270px',
                                            display: quiz.slides?.[0]?.background?.type === 'image' ? 'none' : 'block'
                                        }}>
                                            {quiz.slides?.[0]?.elements?.map((el, idx) => (
                                                <div key={idx} style={{ position: 'absolute', left: el.x, top: el.y, width: el.style?.width || el.width, height: el.style?.height || el.height, ...el.style, zIndex: el.style?.zIndex || 1 }}>
                                                    {el.type === 'text' && <div style={{ width: '100%', height: '100%', padding: '4px', display: 'flex', alignItems: 'center', fontSize: el.style?.fontSize || 24, justifyContent: el.style?.textAlign || 'center' }}>{el.content}</div>}
                                                    {el.type === 'image' && <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                                                    {el.type === 'shape' && <div style={{ width: '100%', height: '100%', backgroundColor: el.style?.backgroundColor }} />}
                                                </div>
                                            ))}
                                            {quiz.slides?.[0]?.type === 'question' && (
                                                <div style={{ position: 'absolute', left: 100, top: 50, width: 760, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, fontWeight: 'bold', padding: '8px', textAlign: 'center', color: '#fff' }}>
                                                    {quiz.slides[0].questionText}
                                                </div>
                                            )}
                                            {quiz.slides?.[0]?.type === 'title' && (
                                                <div style={{ position: 'absolute', left: 80, top: 150, width: 800, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, fontWeight: 900, padding: '8px', textAlign: 'center', color: '#fff' }}>
                                                    {quiz.slides[0].title}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Gradient Overlay */}
                                <div className="quiz-card-overlay"></div>

                                {/* Content */}
                                <div className="quiz-card-content">
                                    <div className="quiz-card-badge">{quiz.slides?.length || 0} slides</div>
                                    <h3 className="quiz-card-title">{quiz.title}</h3>
                                    <p className="quiz-card-subtitle">{quiz.questionCount} questions</p>
                                </div>

                                {/* Play Button Overlay */}
                                <div className="position-absolute top-50 start-50 translate-middle opacity-0 hover-opacity-100 transition-opacity" style={{ zIndex: 20 }}>
                                    <button className="btn btn-warning btn-lg rounded-circle shadow-lg p-4">
                                        ▶️
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        );
    }

    if (gameState === 'LOBBY') {
        const joinUrl = getJoinUrl();

        return (
            <div className="apero-host-lobby" style={{
                minHeight: '100vh',
                backgroundImage: 'url(/assets/images/lobby_bg.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Segoe UI', sans-serif",
                overflow: 'hidden'
            }}>
                {/* Dark Overlay for readability */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 5, 20, 0.8)', backdropFilter: 'blur(3px)' }}></div>

                <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 1400, display: 'flex', gap: 80, alignItems: 'center', justifyContent: 'center', padding: 40 }}>

                    {/* LEFT PANEL: QR & INFO */}
                    <motion.div
                        initial={{ x: -50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="lobby-card"
                        style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            backdropFilter: 'blur(20px)',
                            padding: 50,
                            borderRadius: 40,
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}
                    >
                        <div style={{ background: '#fff', padding: 20, borderRadius: 24, marginBottom: 30, boxShadow: '0 0 30px rgba(255,255,255,0.2)' }}>
                            <QRCodeSVG value={joinUrl} size={300} />
                        </div>

                        <div style={{ color: '#aaa', fontSize: 18, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 2 }}>Scanner ou rejoindre sur</div>
                        <div style={{
                            background: 'rgba(0,0,0,0.4)',
                            padding: '12px 30px',
                            borderRadius: 100,
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#4db5ff',
                            fontSize: 28,
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.3)',
                            textShadow: '0 0 10px rgba(77, 181, 255, 0.5)'
                        }}>
                            {window.location.host}/join
                        </div>
                    </motion.div>

                    {/* RIGHT PANEL: CODE & PLAYERS */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 40 }}>
                        <motion.div
                            initial={{ y: -50, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            style={{ textAlign: 'left' }}
                        >
                            <h2 style={{ color: '#ff71ce', fontSize: 24, textTransform: 'uppercase', letterSpacing: 4, marginBottom: 5, fontWeight: 700 }}>Code de la salle</h2>
                            <h1 style={{
                                fontSize: 140,
                                fontWeight: 900,
                                lineHeight: 1,
                                background: 'linear-gradient(to right, #00c6ff, #0072ff)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                filter: 'drop-shadow(0 0 30px rgba(0,114,255,0.6))',
                                margin: 0,
                                letterSpacing: 5
                            }}>
                                {roomCode}
                            </h1>
                            <h3 style={{ color: '#fff', fontSize: 36, marginTop: 20, fontWeight: 300, opacity: 0.9 }}>
                                <span style={{ color: '#ffd700', marginRight: 10 }}>★</span> {selectedQuiz?.title}
                            </h3>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            style={{ flex: 1 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 25, gap: 15 }}>
                                <div style={{ color: '#fff', fontSize: 24, fontWeight: 600 }}>Joueurs prêts ({teams.length})</div>
                                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }}></div>
                            </div>

                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 15,
                                maxHeight: 400,
                                overflowY: 'auto',
                                paddingRight: 10
                            }}>
                                {teams.map((team, idx) => (
                                    <motion.div
                                        key={team.name}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        style={{
                                            background: `linear-gradient(135deg, hsl(${idx * 45}, 80%, 60%), hsl(${idx * 45}, 80%, 40%))`,
                                            color: '#fff',
                                            padding: '12px 24px',
                                            borderRadius: 50,
                                            fontWeight: 'bold',
                                            fontSize: 18,
                                            boxShadow: '0 5px 15px rgba(0,0,0,0.5)',
                                            border: '2px solid rgba(255,255,255,0.3)',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            textShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                        }}
                                    >
                                        {team.avatar && team.avatar.startsWith('http') ? (
                                            <img src={team.avatar} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: 24 }}>{team.avatar || '👾'}</span>
                                        )}
                                        {team.name}
                                    </motion.div>
                                ))}
                                {teams.length === 0 && (
                                    <div style={{
                                        color: 'rgba(255,255,255,0.3)',
                                        fontSize: 20,
                                        fontStyle: 'italic',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 15
                                    }}>
                                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }}></div>
                                        En attente de connexions...
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={startGame}
                            disabled={teams.length === 0}
                            style={{
                                alignSelf: 'flex-start',
                                background: teams.length > 0 ? 'linear-gradient(45deg, #11998e, #38ef7d)' : 'rgba(255,255,255,0.1)',
                                color: teams.length > 0 ? '#fff' : 'rgba(255,255,255,0.3)',
                                border: 'none',
                                padding: '20px 60px',
                                fontSize: 24,
                                borderRadius: 100,
                                fontWeight: '900',
                                letterSpacing: 1,
                                cursor: teams.length > 0 ? 'pointer' : 'not-allowed',
                                boxShadow: teams.length > 0 ? '0 0 40px rgba(56, 239, 125, 0.6)' : 'none',
                                transition: 'all 0.3s',
                                textTransform: 'uppercase',
                                marginTop: 20
                            }}
                        >
                            {teams.length > 0 ? 'Lancer la Partie 🚀' : 'En attente...'}
                        </motion.button>
                        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                    </div>
                </div>
            </div>
        );
    }

    // PLAYING - RENDER SAFE ZONE
    return (
        <div
            className="apero-host-fullscreen"
            onClick={(e) => {
                if (gameState !== 'PLAYING') return;
                // Ignore clicks on buttons/interactive elements
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

                // SMART NAVIGATION (Click = Advance Step)
                // 1. If active -> Close
                if (questionState === 'active') {
                    socket.emit('apero-host-close-question');
                }
                // 2. If idle and is a question -> Open
                else if (questionState === 'idle' && currentSlide && !['title', 'score'].includes(currentSlide.type) && !['title', 'score'].includes(currentSlide.questionType)) {
                    // QCM: Progressive Reveal Logic
                    if (currentSlide.questionType === 'qcm') {
                        const totalOptions = currentSlide.options?.length || 0;
                        if (visibleOptionsCount < totalOptions) {
                            setVisibleOptionsCount(prev => prev + 1);
                            return; // Stop here, reveal next option
                        }
                    }
                    // If all options visible OR not QCM -> Open Question
                    socket.emit('apero-host-open-question');
                }
                // 3. Else (Reveal or simple slide) -> Next
                else {
                    socket.emit('apero-host-next-slide');
                }
            }}
            style={{ position: 'relative', overflow: 'hidden', height: '100vh', backgroundColor: '#000', cursor: 'pointer' }}
        >

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
                            {/* Remove dark overlay for immersive effect */}
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
                        {/* QUIZ LOGO (Bottom Left) */}
                        {selectedQuiz && (
                            <motion.div
                                initial={{ x: -100, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="host-quiz-logo"
                            >
                                🍻 {selectedQuiz.title}
                            </motion.div>
                        )}

                        {/* FREE ELEMENTS (WYSIWYG) */}
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
                                    <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.style.borderRadius }} alt="" />
                                )}
                            </motion.div>
                        ))}

                        {/* QUESTION SLIDE - CINEMATIC LAYOUT */}
                        {currentSlide?.type === 'question' && (
                            <div className="host-game-zone">
                                {/* Question Bubble (Top Right with Avatar) */}
                                <div className="host-question-container">
                                    <div className="host-question-bubble">
                                        <div className="host-question-avatar">
                                            {/* Placeholder Avatar - Could be dynamic later */}
                                            <img src="https://cdn-icons-png.flaticon.com/512/3400/3400504.png" alt="Quiz Master" />
                                        </div>
                                        <div className="host-question-text">
                                            {currentSlide.questionText}
                                        </div>
                                    </div>
                                </div>

                                {/* QCM Options (Vertical Stack on Right) */}
                                {currentSlide.questionType === 'qcm' && (
                                    <div className="host-answers-stack">
                                        {currentSlide.options?.map((opt, i) => (
                                            <motion.div
                                                key={opt.label}
                                                initial={{ opacity: 0, x: 50 }}
                                                animate={{
                                                    opacity: i < visibleOptionsCount ? 1 : 0,
                                                    x: i < visibleOptionsCount ? 0 : 50
                                                }}
                                                className={`host-answer-row ${questionState === 'reveal' && opt.label === currentSlide.correctAnswer ? 'correct' : ''
                                                    } ${questionState === 'reveal' && opt.label !== currentSlide.correctAnswer ? 'wrong' : ''
                                                    }`}
                                            >
                                                <div className="host-answer-letter">{opt.label}</div>
                                                <div className="host-answer-text">
                                                    {opt.text}
                                                    {/* Player response count if revealing */}
                                                    {questionState === 'reveal' && (
                                                        <span style={{ marginLeft: 'auto', marginRight: '20px', fontSize: '14px', opacity: 0.8 }}>
                                                            {/* Placeholder for count - logic to come */}
                                                            12
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Timer (Bottom Right) */}
                        {questionState === 'active' && (
                            <motion.div
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 200 }}
                                className="host-timer"
                            >
                                <div className="timer-ring">
                                    <svg viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
                                        <circle
                                            cx="50" cy="50" r="45" fill="none"
                                            stroke="#fbbf24"
                                            strokeWidth="6"
                                            strokeDasharray="283"
                                            strokeDashoffset={283 - (283 * (timer / (currentSlide.timer || 20)))}
                                            transform="rotate(-90 50 50)"
                                            style={{ transition: 'stroke-dashoffset 1s linear' }}
                                        />
                                    </svg>
                                </div>
                                <div className="timer-value">{timer}</div>
                            </motion.div>
                        )}

                        {/* Answered Count (Top Left) */}
                        {questionState === 'active' && (
                            <motion.div
                                initial={{ y: -50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="host-answered-count"
                            >
                                <div className="answered-icon">👥</div>
                                <div className="answered-text">{answeredCount} / {teams.length}</div>
                            </motion.div>
                        )}


                        {/* TITLE SLIDE */}
                        {
                            currentSlide?.type === 'title' && (!currentSlide?.elements || currentSlide.elements.length === 0) && (
                                <div className="d-flex flex-column align-items-center justify-content-center h-100 text-center p-5">
                                    <motion.h1
                                        initial={{ y: -50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        style={{ fontSize: '5rem', fontWeight: 'bold', textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
                                    >
                                        {currentSlide.title}
                                    </motion.h1>
                                    <motion.h3
                                        initial={{ y: 50, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="mt-4"
                                        style={{ fontSize: '2.5rem', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                                    >
                                        {currentSlide.subtitle}
                                    </motion.h3>
                                </div>
                            )
                        }
                        {/* Reveal Answer (Text/Estim) */}
                        {
                            (currentSlide?.questionType === 'estimation' || currentSlide?.questionType === 'text') && questionState === 'reveal' && (
                                <div className="position-absolute top-50 start-50 translate-middle bg-dark p-5 rounded-5 border border-success shadow-lg text-center" style={{ zIndex: 100 }}>
                                    <h3 className="text-white-50">Réponse</h3>
                                    <div className="display-1 text-success fw-bold">{currentSlide.correctAnswer}</div>
                                </div>
                            )
                        }

                        {/* SCOREBOARD */}
                        {
                            currentSlide?.type === 'score' && (
                                <div className="d-flex flex-column gap-3 mt-5 align-items-center w-100">
                                    <h1 className="text-warning display-3 fw-bold mb-5">{currentSlide.title || 'Classement'}</h1>
                                    {leaderboard.slice(0, 5).map((team, i) => (
                                        <div key={team.name} className="bg-white text-dark p-3 rounded-4 w-75 d-flex justify-content-between px-5 shadow" style={{ transform: i === 0 ? 'scale(1.1)' : 'scale(1)', border: i === 0 ? '3px solid gold' : 'none' }}>
                                            <div className="fs-2">#{i + 1} <span className="fw-bold ms-3">{team.name}</span></div>
                                            <div className="fs-2 fw-bold text-primary">{team.totalScore}</div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }

                    </motion.div >
                </AnimatePresence >

                {/* MANUAL CONTROL BAR - DEBUG/RESCUE */}
                <div
                    style={{
                        position: 'fixed', bottom: 10, right: 10, zIndex: 9999,
                        background: 'rgba(0,0,0,0.5)', padding: '5px 10px', borderRadius: 10,
                        display: 'flex', gap: 10, opacity: 0.5, transition: 'opacity 0.2s',
                        cursor: 'default'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                    onClick={e => e.stopPropagation()}
                >
                    <button className="btn btn-sm btn-primary" onClick={() => socket.emit('apero-host-open-question')}>Open Quest.</button>
                    <button className="btn btn-sm btn-warning" onClick={() => socket.emit('apero-host-close-question')}>Close/Reveal</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => socket.emit('apero-host-next-slide')}>Next Slide</button>
                </div>
            </div >
        </div >
    );
}

export default AperoHostView;
