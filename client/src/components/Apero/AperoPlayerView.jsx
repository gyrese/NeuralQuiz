import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './AperoStyles.css';

const SOCKET_URL = `${window.location.protocol}//${window.location.hostname}:3001/apero`;

function AperoPlayerView({ initialRoomCode }) {
    const [socket, setSocket] = useState(null);
    const [gameState, setGameState] = useState('JOIN'); // JOIN, WAITING, QUESTION, ANSWERED, REVEAL, ENDED
    const [roomCode, setRoomCode] = useState(initialRoomCode || '');
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

    // Connect socket
    useEffect(() => {
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('[APERO PLAYER] Connected');
        });

        newSocket.on('team:joined', ({ roomCode: code, teamName: name, gameState: state }) => {
            setIsJoined(true);
            setRoomCode(code);
            setTeamName(name);
            setGameState('WAITING');
            setError('');
        });

        newSocket.on('game:started', () => {
            setGameState('WAITING');
        });

        newSocket.on('slide:changed', () => {
            setGameState('WAITING');
            setSelectedAnswer(null);
            setInputValue('');
            setIsCorrect(null);
        });

        newSocket.on('question:opened', ({ questionNumber: qNum, questionType: qType, timer: qTimer }) => {
            setQuestionNumber(qNum);
            setQuestionType(qType);
            setTimer(qTimer);
            setGameState('QUESTION');
            setSelectedAnswer(null);
            setInputValue('');
        });

        newSocket.on('answer:confirmed', ({ answer }) => {
            setSelectedAnswer(answer);
            setGameState('ANSWERED');
        });

        newSocket.on('question:closed', ({ correctAnswer, results }) => {
            setGameState('REVEAL');

            // Find our team in results
            const ourResult = results.find(r => r.teamName === teamName);
            if (ourResult) {
                setIsCorrect(ourResult.correct);
                setPoints(ourResult.points);
                setTotalScore(ourResult.totalScore);
                setRank(results.findIndex(r => r.teamName === teamName) + 1);
            }
        });

        newSocket.on('game:ended', () => {
            setGameState('ENDED');
        });

        newSocket.on('game:restarted', () => {
            setGameState('WAITING');
            setTotalScore(0);
            setSelectedAnswer(null);
        });

        newSocket.on('room:closed', () => {
            setGameState('JOIN');
            setIsJoined(false);
            setError('Le salon a été fermé par l\'hôte');
        });

        newSocket.on('error', ({ message }) => {
            setError(message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Timer countdown
    useEffect(() => {
        if (gameState !== 'QUESTION' || timer <= 0) return;

        const interval = setInterval(() => {
            setTimer(t => Math.max(0, t - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [gameState, timer]);

    const handleJoin = (e) => {
        e.preventDefault();
        if (!roomCode.trim() || !teamName.trim()) {
            setError('Veuillez remplir tous les champs');
            return;
        }
        socket?.emit('team:join', { roomCode: roomCode.toUpperCase(), teamName: teamName.trim() });
    };

    const handleAnswer = (answer) => {
        if (gameState !== 'QUESTION' || selectedAnswer) return;
        socket?.emit('team:answer', { answer });
    };

    const handleSubmitInput = () => {
        if (!inputValue.trim()) return;
        socket?.emit('team:answer', { answer: inputValue.trim() });
    };

    // === RENDER ===

    // Join screen
    if (!isJoined) {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>🍻 Apéro Quiz</h2>
                </div>
                <div className="apero-player-content">
                    <form onSubmit={handleJoin} style={{ width: '100%', maxWidth: '300px' }}>
                        <div className="mb-3">
                            <input
                                type="text"
                                className="form-control form-control-lg bg-dark text-white border-secondary text-center"
                                placeholder="Code du salon"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                style={{ fontSize: '1.5rem', letterSpacing: '0.2em' }}
                            />
                        </div>
                        <div className="mb-4">
                            <input
                                type="text"
                                className="form-control form-control-lg bg-dark text-white border-secondary text-center"
                                placeholder="Nom de votre équipe"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                maxLength={20}
                            />
                        </div>
                        {error && (
                            <div className="alert alert-danger text-center">{error}</div>
                        )}
                        <button type="submit" className="btn btn-warning btn-lg w-100">
                            Rejoindre
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Waiting screen
    if (gameState === 'WAITING') {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>🍻 {teamName}</h2>
                    <div className="text-muted">Score: {totalScore} pts</div>
                </div>
                <div className="apero-player-content">
                    <div className="apero-player-waiting">
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⏳</div>
                        <h3>En attente...</h3>
                        <p>Regardez l'écran principal</p>
                    </div>
                </div>
            </div>
        );
    }

    // Question active - QCM
    if (gameState === 'QUESTION' && questionType === 'qcm') {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>Question {questionNumber}</h2>
                    <div className={`apero-timer ${timer <= 5 ? 'warning' : ''}`}>{timer}s</div>
                </div>
                <div className="apero-player-content">
                    <div className="apero-answer-grid">
                        {['A', 'B', 'C', 'D'].map(letter => (
                            <button
                                key={letter}
                                className={`apero-answer-btn ${letter.toLowerCase()} ${selectedAnswer === letter ? 'selected' : ''}`}
                                onClick={() => handleAnswer(letter)}
                                disabled={!!selectedAnswer}
                            >
                                {letter}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Question active - Estimation/Text/Date
    if (gameState === 'QUESTION' && (questionType === 'estimation' || questionType === 'text' || questionType === 'date')) {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>Question {questionNumber}</h2>
                    <div className={`apero-timer ${timer <= 5 ? 'warning' : ''}`}>{timer}s</div>
                </div>
                <div className="apero-player-content">
                    <div className="apero-estimation-input">
                        <input
                            type={questionType === 'estimation' ? 'number' : 'text'}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={questionType === 'estimation' ? 'Votre nombre' : 'Votre réponse'}
                            autoFocus
                        />
                        <button onClick={handleSubmitInput} disabled={!inputValue.trim()}>
                            Valider
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Answer confirmed
    if (gameState === 'ANSWERED') {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>Question {questionNumber}</h2>
                </div>
                <div className="apero-player-content">
                    <div className="apero-answer-confirmed">
                        <div className="checkmark">✅</div>
                        <h3>Réponse enregistrée !</h3>
                        <p className="text-muted mt-3">
                            Votre réponse: <strong>{selectedAnswer || inputValue}</strong>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Reveal
    if (gameState === 'REVEAL') {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>Question {questionNumber}</h2>
                </div>
                <div className="apero-player-content">
                    <div className="text-center">
                        <div style={{ fontSize: '5rem', marginBottom: '20px' }}>
                            {isCorrect ? '🎉' : '😅'}
                        </div>
                        <h3 style={{ color: isCorrect ? '#00ff88' : '#ff6b6b' }}>
                            {isCorrect ? 'Bonne réponse !' : 'Mauvaise réponse'}
                        </h3>
                        <div className="mt-4" style={{ fontSize: '2rem', color: '#ffd700' }}>
                            +{points} pts
                        </div>
                        <div className="mt-2" style={{ fontSize: '1.2rem', color: '#888' }}>
                            Total: {totalScore} pts • Rang: #{rank}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Game ended
    if (gameState === 'ENDED') {
        return (
            <div className="apero-player">
                <div className="apero-player-header">
                    <h2>🏆 Fin du Quiz !</h2>
                </div>
                <div className="apero-player-content">
                    <div className="text-center">
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎊</div>
                        <h3>{teamName}</h3>
                        <div className="mt-3" style={{ fontSize: '3rem', color: '#ffd700' }}>
                            {totalScore} pts
                        </div>
                        <div className="mt-2" style={{ fontSize: '1.5rem', color: '#00d4ff' }}>
                            Position finale: #{rank}
                        </div>
                        <p className="text-muted mt-4">
                            Merci d'avoir joué !
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}

export default AperoPlayerView;
