import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { socket } from '../../socket';
import { motion, AnimatePresence } from 'framer-motion';
import './AperoStyles.css';

// Couleurs Kahoot-style
const COLORS = {
    A: '#e21b3c', // Rouge - Triangle
    B: '#1368ce', // Bleu - Losange
    C: '#d89e00', // Jaune - Rond (Gold plus lisible)
    D: '#26890c'  // Vert - Carré
};

const ICONS = {
    A: '🔺',
    B: '🔷',
    C: '⏺️',
    D: '⏹️'
};

function AperoPlayerView() {
    const { roomCode: urlRoomCode } = useParams();
    const [gameState, setGameState] = useState('JOIN');
    const [roomCode, setRoomCode] = useState(urlRoomCode || '');
    const [teamName, setTeamName] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const [error, setError] = useState('');

    // Question state
    const [questionNumber, setQuestionNumber] = useState(0);
    const [questionType, setQuestionType] = useState('qcm');
    const [timer, setTimer] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [isCorrect, setIsCorrect] = useState(null);
    const [points, setPoints] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [rank, setRank] = useState(0);

    // Setup Socket Listeners
    useEffect(() => {
        const events = {
            'apero-team-joined': ({ roomCode: code, teamName: name }) => {
                setIsJoined(true);
                setRoomCode(code);
                setTeamName(name);
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
                // Haptic feedback
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

    // Timer
    useEffect(() => {
        if (gameState !== 'QUESTION' || timer <= 0) return;
        const interval = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
        return () => clearInterval(interval);
    }, [gameState, timer]);

    const handleJoin = (e) => {
        e.preventDefault();
        if (!roomCode.trim() || !teamName.trim()) return setError('Remplissez tout !');
        socket.emit('apero-team-join', { roomCode: roomCode.toUpperCase(), teamName: teamName.trim() });
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

    // --- RENDER ---
    const bgStyle = {
        background: '#121212',
        color: 'white',
        minHeight: '100vh',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
    };

    // JOIN SCREEN
    if (!isJoined) {
        return (
            <div style={bgStyle} className="p-4 d-flex flex-column justify-content-center align-items-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-100" style={{ maxWidth: '400px' }}
                >
                    <h1 className="text-center fw-bold mb-5" style={{ fontSize: '3.5rem', textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>🍻 APÉRO</h1>
                    <form onSubmit={handleJoin} className="d-flex flex-column gap-3">
                        <input
                            type="text"
                            placeholder="CODE SALON (ABC123)"
                            className="form-control form-control-lg bg-dark text-white border-secondary text-center fw-bold fs-2"
                            value={roomCode}
                            onChange={e => setRoomCode(e.target.value.toUpperCase())}
                            maxLength={6}
                        />
                        <input
                            type="text"
                            placeholder="Nom d'équipe"
                            className="form-control form-control-lg bg-dark text-white border-secondary text-center fs-4"
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            maxLength={15}
                        />
                        {error && <div className="alert alert-danger py-2 small text-center">{error}</div>}
                        <button className="btn btn-warning btn-lg fw-bold fs-3 py-3 rounded-pill mt-3 shadow-lg transform-active">
                            REJOINDRE
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    // HEADER (Common)
    const Header = () => (
        <div className="d-flex justify-content-between align-items-center p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="fw-bold fs-5">{teamName}</div>
            <div className="badge bg-dark border border-secondary p-2">{totalScore} pts</div>
        </div>
    );

    // WAITING
    if (gameState === 'WAITING') {
        return (
            <div style={bgStyle}>
                <Header />
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                        <div style={{ fontSize: '5rem' }}>👀</div>
                    </motion.div>
                    <h2 className="mt-4 fw-bold">Regardez l'écran !</h2>
                    <p className="text-muted">La question va s'afficher...</p>
                </div>
            </div>
        );
    }

    // QUESTION (QCM)
    if (gameState === 'QUESTION' && questionType === 'qcm') {
        return (
            <div style={bgStyle}>
                <div className="d-flex justify-content-between p-3 align-items-center">
                    <span className="badge bg-secondary fs-6">Q{questionNumber}</span>
                    <span className={`badge ${timer < 5 ? 'bg-danger animate-pulse' : 'bg-primary'} fs-4 rounded-pill px-4`}>{timer}s</span>
                </div>

                <div className="flex-grow-1 p-3 pb-5">
                    <div className="h-100 d-grid gap-3" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
                        {['A', 'B', 'C', 'D'].map(letter => (
                            <motion.button
                                key={letter}
                                whileTap={{ scale: 0.95 }}
                                className="border-0 rounded-4 shadow-lg text-white d-flex flex-column align-items-center justify-content-center"
                                style={{ background: COLORS[letter], fontSize: '2rem' }}
                                onClick={() => handleAnswer(letter)}
                            >
                                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>{ICONS[letter]}</div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // QUESTION (Input)
    if (gameState === 'QUESTION') {
        return (
            <div style={bgStyle}>
                <Header />
                <div className="flex-grow-1 d-flex flex-column justify-content-center p-4">
                    <div className="text-center mb-5">
                        <span className="badge bg-primary fs-1 mb-4">{timer}s</span>
                        <h3>Entrez votre réponse</h3>
                    </div>
                    <form onSubmit={handleSubmitInput}>
                        <input
                            type={questionType === 'estimation' ? 'number' : 'text'}
                            className="form-control form-control-lg bg-dark text-white border-secondary text-center fs-2 py-4 mb-4"
                            placeholder="Votre réponse..."
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            autoFocus
                        />
                        <button className="btn btn-success w-100 py-4 fs-3 fw-bold rounded-pill shadow-lg">
                            ENVOYER
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ANSWERED
    if (gameState === 'ANSWERED') {
        return (
            <div style={bgStyle}>
                <Header />
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <div className="rounded-circle bg-success d-flex align-items-center justify-content-center mb-4" style={{ width: 100, height: 100 }}>
                            <span style={{ fontSize: '3rem' }}>✅</span>
                        </div>
                    </motion.div>
                    <h2>Réponse envoyée !</h2>
                    <p className="text-muted mt-2">Attendez la fin du chrono...</p>
                </div>
            </div>
        );
    }

    // REVEAL RESULT
    if (gameState === 'REVEAL') {
        const bgResult = isCorrect ? '#26890c' : '#e21b3c';
        return (
            <div style={{ ...bgStyle, background: bgResult }}>
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        className="mb-4"
                    >
                        <div style={{ fontSize: '6rem' }}>{isCorrect ? '🤩' : '😭'}</div>
                    </motion.div>
                    <h1 className="display-3 fw-bold mb-2">{isCorrect ? 'CORRECT !' : 'RATE...'}</h1>

                    <div className="bg-black bg-opacity-25 rounded-4 p-4 mt-4 w-100">
                        <div className="fs-5 text-white-50">Score total</div>
                        <div className="display-4 fw-bold">{totalScore}</div>
                        <div className="fs-5 text-white-50 mt-2">Classement: #{rank}</div>
                    </div>
                </div>
            </div>
        );
    }

    // ENDED
    if (gameState === 'ENDED') {
        return (
            <div style={bgStyle}>
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center text-center p-4">
                    <h1 className="fw-bold text-warning mb-5">FIN DU QUIZ</h1>
                    <div className="card bg-dark text-white border-secondary w-100 p-4">
                        <h3>{teamName}</h3>
                        <div className="display-2 fw-bold text-primary my-3">{totalScore} pts</div>
                        <div className="fs-4 badge bg-warning text-dark">Position #{rank}</div>
                    </div>
                    <button className="btn btn-outline-light mt-5" onClick={() => window.location.reload()}>Quitter</button>
                </div>
            </div>
        );
    }

    return null;
}

export default AperoPlayerView;
