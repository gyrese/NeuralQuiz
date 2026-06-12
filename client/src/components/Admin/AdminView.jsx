import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuizEditor from './QuizEditor';
import DrawAdmin from './DrawAdmin';
import GeoAdmin from './GeoAdmin';
import ColorAdmin from './ColorAdmin';
import Login from './Login';

const isHttps = window.location.protocol === 'https:';
const serverPort = isHttps ? 3443 : 3005;
const API_URL = import.meta.env.VITE_SERVER_URL 
    ? `${import.meta.env.VITE_SERVER_URL}/api`
    : (!import.meta.env.DEV ? '/api' : `${window.location.protocol}//${window.location.hostname}:${serverPort}/api`);

function AdminView() {
    const navigate = useNavigate();
    const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
    const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes', 'geo', 'draw', 'color'

    // Quiz State
    const [quizzes, setQuizzes] = useState([]);
    const [editingQuiz, setEditingQuiz] = useState(null); // null = list, 'new' = create, object = edit

    useEffect(() => {
        if (token && activeTab === 'quizzes') {
            fetchQuizzes();
        }
    }, [activeTab, token]);

    useEffect(() => {
        const handleLogoutEvent = () => {
            setToken('');
        };
        window.addEventListener('admin-logout', handleLogoutEvent);
        return () => window.removeEventListener('admin-logout', handleLogoutEvent);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        setToken('');
    };

    const fetchQuizzes = async () => {
        try {
            const response = await fetch(`${API_URL}/quizzes`);
            const data = await response.json();
            // Si la requête a échoué car non autorisé (géré par l'intercepteur), fetch renverra une erreur ou de fausses données
            if (response.ok) {
                setQuizzes(data);
            }
        } catch (error) {
            console.error("Erreur chargement quiz:", error);
        }
    };

    const handleDeleteQuiz = async (id) => {
        if (window.confirm("Supprimer ce quiz ?")) {
            try {
                const response = await fetch(`${API_URL}/quizzes/${id}`, { method: 'DELETE' });
                if (response.ok) {
                    fetchQuizzes();
                }
            } catch (error) {
                console.error("Erreur suppression:", error);
            }
        }
    };

    // Si l'utilisateur n'est pas connecté, afficher le formulaire de connexion
    if (!token) {
        return <Login onLoginSuccess={(t) => setToken(t)} />;
    }

    // Render Logic
    const renderContent = () => {
        if (activeTab === 'draw') {
            return <DrawAdmin />;
        }

        if (activeTab === 'geo') {
            return <GeoAdmin />;
        }

        if (activeTab === 'color') {
            return <ColorAdmin />;
        }

        // Quizzes Tab
        if (editingQuiz) {
            return (
                <QuizEditor
                    quiz={editingQuiz === 'new' ? null : editingQuiz}
                    onSave={() => { setEditingQuiz(null); fetchQuizzes(); }}
                    onCancel={() => setEditingQuiz(null)}
                />
            );
        }

        return (
            <div className="row g-4">
                <div className="col-12 text-end">
                    <button className="btn btn-primary" onClick={() => setEditingQuiz('new')}>+ NOUVEAU QUIZ</button>
                </div>
                {quizzes.length === 0 && (
                    <div className="text-center text-muted">Aucun quiz disponible.</div>
                )}
                {quizzes.map(quiz => (
                    <div key={quiz.id} className="col-12">
                        <div className="card shadow-sm bg-transparent border-secondary">
                            <div className="card-body d-flex justify-content-between align-items-center">
                                <div>
                                    <h3 className="card-title text-primary mb-1">{quiz.title}</h3>
                                    <p className="text-info mb-1">{quiz.questions.length} questions</p>
                                    <p className="card-text text-muted small mb-0">{quiz.description}</p>
                                </div>
                                <div>
                                    <button className="btn btn-sm btn-outline-light me-2" onClick={() => setEditingQuiz(quiz)}>ÉDITER</button>
                                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteQuiz(quiz.id)}>SUPPRIMER</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="container mt-4 text-light">
            {/* Header / Navigation */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary" onClick={() => navigate('/')}>&lt; RETOUR</button>
                    <button className="btn btn-outline-danger" onClick={handleLogout}>DECONNEXION</button>
                </div>
                <div className="btn-group">
                    <button
                        className="btn"
                        onClick={() => { setActiveTab('quizzes'); setEditingQuiz(null); }}
                        style={activeTab === 'quizzes'
                            ? { background: '#00ff41', color: '#000', borderColor: '#00ff41' }
                            : { background: 'transparent', color: '#00ff41', borderColor: '#00ff41' }}
                    >
                        🧠 NEURAL QUIZ
                    </button>
                    <button
                        className="btn"
                        onClick={() => setActiveTab('geo')}
                        style={activeTab === 'geo'
                            ? { background: '#00dbde', color: '#000', borderColor: '#00dbde' }
                            : { background: 'transparent', color: '#00dbde', borderColor: '#00dbde' }}
                    >
                        🌍 GEO TRACKR
                    </button>
                    <button
                        className="btn"
                        onClick={() => setActiveTab('draw')}
                        style={activeTab === 'draw'
                            ? { background: '#ff6b9d', color: '#000', borderColor: '#ff6b9d' }
                            : { background: 'transparent', color: '#ff6b9d', borderColor: '#ff6b9d' }}
                    >
                        ✏️ DRAW UP
                    </button>
                    <button
                        className="btn"
                        onClick={() => setActiveTab('color')}
                        style={activeTab === 'color'
                            ? { background: '#ffc107', color: '#000', borderColor: '#ffc107' }
                            : { background: 'transparent', color: '#ffc107', borderColor: '#ffc107' }}
                    >
                        🌈 COULEUR MOI
                    </button>
                </div>
                <div style={{ width: 100 }}></div> {/* Spacer for alignment */}
            </div>

            {/* Content Area */}
            <div className="admin-content-area animate__animated animate__fadeIn">
                {renderContent()}
            </div>
        </div>
    );
}

export default AdminView;

