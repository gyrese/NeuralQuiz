import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../../socket';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './AperoStyles.css';
import './AperoHost.css';

// Sub-components
import HostQuizSelector from './Host/HostQuizSelector';
import HostLobby from './Host/HostLobby';
import HostSlideTitle from './Host/HostSlideTitle';
import HostSlideQuestion from './Host/HostSlideQuestion';
import HostSlideLeaderboard from './Host/HostSlideLeaderboard';
import HostSlidePodium from './Host/HostSlidePodium';

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
    const [questionState, setQuestionState] = useState('idle'); // idle, active, reveal, gameOver
    const [timer, setTimer] = useState(0);
    const [answeredCount, setAnsweredCount] = useState(0);
    const [answerStats, setAnswerStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);

    // Logic for Answered Count specific slide
    const [visibleOptionsCount, setVisibleOptionsCount] = useState(0);

    const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

    // ================== INITIALIZATION ==================
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

    // ================== SOCKET EVENTS ==================
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
                setQuestionState('idle'); // Reset to idle
                setAnsweredCount(0);
                setAnswerStats(null);
                setTimer(slide.timer || 20); // Reset timer display
                setVisibleOptionsCount(0);
            },
            'apero-question-opened': ({ timer: questionTimer }) => {
                setQuestionState('active');
                setTimer(questionTimer);
                setAnsweredCount(0);
                setVisibleOptionsCount(10); // Show all options
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
            'apero-error': ({ message }) => {
                if (message === 'Impossible de restaurer la session') {
                    console.warn('[HOST] Session restore failed. Clearing session and resetting.');
                    sessionStorage.removeItem('apero_host_session');
                    setGameState('SELECT_QUIZ');
                    setRoomCode('');
                    alert('La session a expiré (serveur redémarré). Veuillez relancer le quiz.');
                } else {
                    alert('Erreur: ' + message);
                }
            }
        };
        Object.entries(events).forEach(([event, handler]) => socket.on(event, handler));

        // Reconnection Logic (Critical for Server Restarts)
        const handleConnect = () => {
            console.log('[HOST] Socket connected. Checking for session to restore...');
            const savedSession = sessionStorage.getItem('apero_host_session');
            if (savedSession) {
                try {
                    const { roomCode: savedCode } = JSON.parse(savedSession);
                    if (savedCode) {
                        console.log('[HOST] Restoring session for room:', savedCode);
                        socket.emit('apero-host-reconnect', { roomCode: savedCode });
                    }
                } catch (e) {
                    console.error('Invalid session data during reconnect');
                }
            }
        };
        socket.on('connect', handleConnect);

        return () => {
            Object.entries(events).forEach(([event, handler]) => socket.off(event, handler));
            socket.off('connect', handleConnect);
        };
    }, []);

    // Timer Interval
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

    // Keyboard & Generic Click Controls
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                case 'Enter':
                    if (gameState === 'PLAYING') handleSmartAdvance();
                    break;
                case 'ArrowLeft':
                    if (gameState === 'PLAYING') socket.emit('apero-host-prev-slide');
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, questionState, currentSlide]);

    // ================== LOGIC ==================
    const loadQuizzes = async () => {
        try {
            const res = await fetch(`${API_URL}/quizzes`);
            if (res.ok) setQuizzes(await res.json());
        } catch (e) {
            console.error('Failed to load quizzes', e);
        }
    };

    const selectQuiz = async (quizId) => {
        if (!socket.connected) return alert('Socket déconnecté');
        const res = await fetch(`${API_URL}/quizzes/${quizId}`);
        const quiz = await res.json();
        setSelectedQuiz(quiz);
        socket.emit('apero-host-create', { quizId: quiz.id });
    };

    const startGame = () => socket.emit('apero-host-start');

    const handleSmartAdvance = () => {
        // 1. If active -> Close/Reveal
        if (questionState === 'active') {
            socket.emit('apero-host-close-question');
        }
        // 2. If idle question -> Open
        else if (questionState === 'idle' && currentSlide?.type === 'question') {
            socket.emit('apero-host-open-question');
        }
        // 3. Otherwise -> Next Slide
        else {
            socket.emit('apero-host-next-slide');
        }
    };

    // ================== RENDERERS ==================

    if (gameState === 'SELECT_QUIZ') {
        return <HostQuizSelector quizzes={quizzes} onSelect={selectQuiz} onBack={() => navigate('/')} />;
    }

    if (gameState === 'LOBBY') {
        return <HostLobby roomCode={roomCode} teams={teams} onStart={startGame} quizTitle={selectedQuiz?.title} />;
    }

    if (gameState === 'PLAYING') {
        // Determine Render Component based on Slide Type & State
        let ContentComponent;

        if (questionState === 'gameOver') {
            ContentComponent = <HostSlidePodium leaderboard={leaderboard} />;
        } else if (currentSlide?.type === 'title') {
            ContentComponent = <HostSlideTitle slide={currentSlide} />;
        } else if (currentSlide?.type === 'score') {
            ContentComponent = <HostSlideLeaderboard leaderboard={leaderboard} />;
        } else if (currentSlide?.type === 'question') {
            ContentComponent = (
                <HostSlideQuestion
                    slide={currentSlide}
                    state={questionState}
                    timer={timer}
                    totalTimer={currentSlide.timer}
                    answeredCount={answeredCount}
                    totalPlayers={teams.length}
                    stats={answerStats} // { 'A': 5, 'B': 2 }
                />
            );
        } else {
            // Fallback for simple slides or unknown types
            ContentComponent = (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {/* Just render elements if any */}
                    {currentSlide?.elements?.map((el, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: el.x, top: el.y,
                            width: el.width, height: el.height,
                            ...el.style
                        }}>
                            {el.type === 'image' && <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                            {el.type === 'text' && el.content}
                        </div>
                    ))}
                </div>
            );
        }

        // BACKGROUND LAYER (Global)
        const bgStyle = currentSlide?.background?.type === 'image'
            ? { backgroundImage: `url("${currentSlide.background.value}")` }
            : { background: currentSlide?.background?.value || '#1a1a2e' };

        return (
            <div
                className="host-screen"
                onClick={handleSmartAdvance}
                style={{
                    position: 'fixed', inset: 0, overflow: 'hidden',
                    ...bgStyle,
                    backgroundSize: 'cover', backgroundPosition: 'center'
                }}
            >
                {/* DARK OVERLAY for Readability */}
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 0 }} />

                {/* SCALED CONTENT AREA (1280x720 Base) */}
                {/* We can use a scaler wrapper if we want WYSIWYG precision, but for these premium components we might want responsive full width. 
                    Let's use a responsive container for the premium components and only scale for absolute elements.
                    Actually, for premium feel, we usually want full viewport usage.
                */}
                <div style={{ position: 'relative', zIndex: 10, width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentSlide?.id || 'gameover'}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.5 }}
                            style={{ width: '100%', height: '100%' }}
                        >
                            {ContentComponent}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* DEBUG CONTROLS (Hover bottom right) */}
                <div
                    style={{ position: 'absolute', bottom: 10, right: 10, opacity: 0, zIndex: 9999 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.5}
                >
                    <button onClick={() => socket.emit('apero-host-prev-slide')}>Prev</button>
                    <button onClick={() => socket.emit('apero-host-next-slide')}>Next</button>
                </div>
            </div>
        );
    }

    return <div>Loading...</div>;
}

export default AperoHostView;
