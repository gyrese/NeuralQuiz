import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import './AperoStyles.css';

const SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:3001/apero`;
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
    const [socket, setSocket] = useState(null);
    const [gameState, setGameState] = useState('SELECT_QUIZ'); // SELECT_QUIZ, LOBBY, PLAYING
    const [quizzes, setQuizzes] = useState([]);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [roomCode, setRoomCode] = useState('');
    const [teams, setTeams] = useState([]);
    const [currentSlide, setCurrentSlide] = useState(null);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const [questionState, setQuestionState] = useState('idle'); // idle, active, reveal
    const [timer, setTimer] = useState(0);
    const [answeredCount, setAnsweredCount] = useState(0);
    const [answerStats, setAnswerStats] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);

    // Load quizzes on mount
    useEffect(() => {
        loadQuizzes();
    }, []);

    const loadQuizzes = async () => {
        try {
            const res = await fetch(`${API_URL}/quizzes`);
            const data = await res.json();
            setQuizzes(data);
        } catch (error) {
            console.error('Error loading quizzes:', error);
        }
    };

    // Socket connection
    useEffect(() => {
        if (gameState === 'SELECT_QUIZ') return;

        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('[APERO HOST] Connected');
            if (selectedQuiz && !roomCode) {
                newSocket.emit('host:create', { quizId: selectedQuiz.id });
            }
        });

        newSocket.on('room:created', ({ roomCode: code, quiz }) => {
            console.log('[APERO HOST] Room created:', code);
            setRoomCode(code);
            setGameState('LOBBY');
        });

        newSocket.on('teams:updated', ({ teams: updatedTeams }) => {
            setTeams(updatedTeams);
        });

        newSocket.on('game:started', ({ slide }) => {
            setGameState('PLAYING');
            setCurrentSlide(slide);
            setCurrentSlideIndex(0);
        });

        newSocket.on('slide:changed', ({ slideIndex, slide }) => {
            setCurrentSlide(slide);
            setCurrentSlideIndex(slideIndex);
            setQuestionState('idle');
            setAnsweredCount(0);
            setAnswerStats(null);
        });

        newSocket.on('question:opened', ({ questionNumber, questionType, timer: questionTimer }) => {
            setQuestionState('active');
            setTimer(questionTimer);
            setAnsweredCount(0);
        });

        newSocket.on('answers:updated', ({ answeredCount: count, totalTeams, allAnswered }) => {
            setAnsweredCount(count);
        });

        newSocket.on('question:closed', ({ correctAnswer, results, answerStats: stats }) => {
            setQuestionState('reveal');
            setAnswerStats(stats);
            setLeaderboard(results);
        });

        newSocket.on('game:ended', ({ leaderboard: finalLeaderboard }) => {
            setLeaderboard(finalLeaderboard);
            setQuestionState('gameOver');
        });

        newSocket.on('error', ({ message }) => {
            console.error('[APERO HOST] Error:', message);
            alert(message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [gameState, selectedQuiz]);

    // Timer countdown
    useEffect(() => {
        if (questionState !== 'active' || timer <= 0) return;

        const interval = setInterval(() => {
            setTimer(t => {
                if (t <= 1) {
                    // Auto-close question when timer reaches 0
                    socket?.emit('host:closeQuestion');
                    return 0;
                }
                return t - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [questionState, timer, socket]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (gameState !== 'PLAYING') return;

            switch (e.key) {
                case 'ArrowRight':
                case ' ':
                    handleNext();
                    break;
                case 'ArrowLeft':
                    handlePrev();
                    break;
                case 'Enter':
                    if (questionState === 'idle' && currentSlide?.type === 'question') {
                        handleOpenQuestion();
                    } else if (questionState === 'active') {
                        handleCloseQuestion();
                    }
                    break;
                case 'Escape':
                    setShowControls(c => !c);
                    break;
                case 'f':
                case 'F':
                    toggleFullscreen();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, questionState, currentSlide, socket]);

    const selectQuiz = async (quizId) => {
        try {
            const res = await fetch(`${API_URL}/quizzes/${quizId}`);
            const quiz = await res.json();
            setSelectedQuiz(quiz);
            setGameState('CONNECTING');
        } catch (error) {
            console.error('Error loading quiz:', error);
        }
    };

    const startGame = () => {
        socket?.emit('host:start');
    };

    const handleNext = () => {
        if (questionState === 'active') {
            socket?.emit('host:closeQuestion');
        } else {
            socket?.emit('host:nextSlide');
        }
    };

    const handlePrev = () => {
        socket?.emit('host:prevSlide');
    };

    const handleOpenQuestion = () => {
        socket?.emit('host:openQuestion');
    };

    const handleCloseQuestion = () => {
        socket?.emit('host:closeQuestion');
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const getJoinUrl = () => {
        return `${window.location.origin}/apero/play/${roomCode}`;
    };

    // === RENDER ===

    // Quiz Selection
    if (gameState === 'SELECT_QUIZ') {
        return (
            <div className="apero-host" style={{ padding: '40px' }}>
                <button className="btn btn-outline-light mb-4" onClick={() => navigate('/apero')}>
                    ← Retour
                </button>
                <h2 className="text-warning mb-4">🍻 Sélectionnez un Quiz</h2>

                {quizzes.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                        <p>Aucun quiz disponible</p>
                        <p>Créez un quiz dans l'Admin d'abord !</p>
                    </div>
                ) : (
                    <div className="row g-4">
                        {quizzes.map(quiz => (
                            <div key={quiz.id} className="col-md-4">
                                <div
                                    className="card bg-dark border-secondary h-100"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => selectQuiz(quiz.id)}
                                >
                                    <div className="card-body text-center">
                                        <h4 className="text-white">{quiz.title}</h4>
                                        <p className="text-muted">
                                            {quiz.slideCount} slides • {quiz.questionCount} questions
                                        </p>
                                        <button className="btn btn-warning">
                                            Lancer ce Quiz
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Lobby
    if (gameState === 'LOBBY' || gameState === 'CONNECTING') {
        return (
            <div className="apero-host d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
                <h1 className="text-warning mb-2">🍻 {selectedQuiz?.title}</h1>
                <p className="text-muted mb-4">En attente des équipes...</p>

                {roomCode && (
                    <>
                        <div className="mb-4 p-4 bg-white rounded" style={{ display: 'inline-block' }}>
                            <QRCodeSVG value={getJoinUrl()} size={200} />
                        </div>
                        <div className="text-center mb-4">
                            <h2 className="text-info mb-2">Code: <span className="text-white">{roomCode}</span></h2>
                            <p className="text-muted">{getJoinUrl()}</p>
                        </div>
                    </>
                )}

                <div className="mb-4">
                    <h4 className="text-white">Équipes connectées: {teams.length}</h4>
                    <div className="d-flex flex-wrap gap-2 justify-content-center mt-3">
                        {teams.map(team => (
                            <span key={team.name} className="badge bg-info fs-6 px-3 py-2">
                                {team.name}
                            </span>
                        ))}
                    </div>
                </div>

                <button
                    className="btn btn-success btn-lg px-5"
                    onClick={startGame}
                    disabled={teams.length === 0}
                >
                    🚀 Lancer le Quiz !
                </button>
            </div>
        );
    }

    // Playing - Main presentation view
    return (
        <div
            className="apero-host-fullscreen"
            style={{
                background: currentSlide?.background?.value || THEMES[currentSlide?.theme]?.background || '#1a1a2e',
                color: THEMES[currentSlide?.theme]?.text || '#fff'
            }}
        >
            {/* Slide Content */}
            <div className="slide-preview" style={{ height: '100vh' }}>
                {currentSlide?.type === 'title' && (
                    <>
                        <div className="slide-title" style={{ fontSize: '5rem' }}>
                            {currentSlide.title}
                        </div>
                        <div className="slide-subtitle" style={{ fontSize: '2rem' }}>
                            {currentSlide.subtitle}
                        </div>
                    </>
                )}

                {currentSlide?.type === 'question' && (
                    <>
                        <div className="question-header" style={{ fontSize: '1.5rem' }}>
                            Question {currentSlideIndex + 1}
                        </div>
                        <div className="question-text" style={{ fontSize: '3rem', maxWidth: '80%' }}>
                            {currentSlide.questionText}
                        </div>

                        {currentSlide.questionType === 'qcm' && (
                            <div className="question-options" style={{ maxWidth: '80%', marginTop: '40px' }}>
                                {currentSlide.options?.map((opt, i) => (
                                    <div
                                        key={i}
                                        className={`option ${questionState === 'reveal' && opt.label === currentSlide.correctAnswer ? 'correct' : ''}`}
                                        style={{
                                            fontSize: '1.5rem',
                                            opacity: questionState === 'reveal' && opt.label !== currentSlide.correctAnswer ? 0.5 : 1
                                        }}
                                    >
                                        <span className="option-letter">{opt.label}</span>
                                        <span>{opt.text}</span>
                                        {questionState === 'reveal' && answerStats && (
                                            <span className="ms-auto badge bg-secondary">
                                                {answerStats[opt.label] || 0} réponses
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {(currentSlide.questionType === 'estimation' || currentSlide.questionType === 'text') && questionState === 'reveal' && (
                            <div style={{ marginTop: '40px', textAlign: 'center' }}>
                                <div style={{ fontSize: '2rem', color: '#00ff88' }}>
                                    Réponse: {currentSlide.correctAnswer}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {currentSlide?.type === 'score' && (
                    <>
                        <div className="slide-title" style={{ fontSize: '4rem', marginBottom: '40px' }}>
                            {currentSlide.title || '🏆 Classement'}
                        </div>
                        <div className="apero-leaderboard" style={{ maxWidth: '600px' }}>
                            {leaderboard.slice(0, 10).map((team, i) => (
                                <div key={team.name || team.teamName} className={`apero-leaderboard-item rank-${i + 1}`}>
                                    <div className="apero-leaderboard-rank">
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </div>
                                    <div className="apero-leaderboard-name">{team.name || team.teamName}</div>
                                    <div className="apero-leaderboard-score">{team.totalScore} pts</div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Timer (during active question) */}
            {questionState === 'active' && (
                <div style={{
                    position: 'fixed',
                    top: '30px',
                    right: '30px',
                    fontSize: '4rem',
                    fontWeight: 'bold',
                    color: timer <= 5 ? '#ff6b6b' : '#ffd700',
                    textShadow: '0 0 20px rgba(0,0,0,0.5)'
                }}>
                    {timer}s
                </div>
            )}

            {/* Answer count */}
            {questionState === 'active' && (
                <div style={{
                    position: 'fixed',
                    top: '30px',
                    left: '30px',
                    fontSize: '1.5rem',
                    color: '#00d4ff'
                }}>
                    📝 {answeredCount}/{teams.length} réponses
                </div>
            )}

            {/* Controls */}
            {showControls && (
                <div className="apero-host-controls">
                    <button className="btn btn-outline-light" onClick={handlePrev}>
                        ⬅️ Précédent
                    </button>

                    {currentSlide?.type === 'question' && questionState === 'idle' && (
                        <button className="btn btn-success" onClick={handleOpenQuestion}>
                            ▶️ Ouvrir Question
                        </button>
                    )}

                    {questionState === 'active' && (
                        <button className="btn btn-warning" onClick={handleCloseQuestion}>
                            ⏹️ Révéler Réponse
                        </button>
                    )}

                    <button className="btn btn-outline-light" onClick={handleNext}>
                        Suivant ➡️
                    </button>

                    <button className="btn btn-outline-info ms-3" onClick={toggleFullscreen}>
                        {isFullscreen ? '⬜' : '⬛'} Fullscreen
                    </button>
                </div>
            )}

            {/* Keyboard hints */}
            <div style={{
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '0.8rem',
                color: '#666',
                textAlign: 'center'
            }}>
                ← → Navigation • Entrée: Ouvrir/Révéler • Échap: Cacher contrôles • F: Fullscreen
            </div>
        </div>
    );
}

export default AperoHostView;
