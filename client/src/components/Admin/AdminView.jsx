import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuizEditor from './QuizEditor';
import DrawAdmin from './DrawAdmin';
import GeoAdmin from './GeoAdmin';
import AperoAdmin from '../Apero/AperoAdmin';
import Login from './Login';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api`;

function AdminView() {
    const navigate = useNavigate();
    const [token, setToken] = useState(localStorage.getItem('admin_token') || '');
    const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes', 'geo', 'draw', 'apero'

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

        if (activeTab === 'apero') {
            return <AperoAdmin />;
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
                        className={`btn ${activeTab === 'quizzes' ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => { setActiveTab('quizzes'); setEditingQuiz(null); }}
                    >
                        🧠 NEURAL QUIZ
                    </button>
                    <button
                        className={`btn ${activeTab === 'geo' ? 'btn-success' : 'btn-outline-success'}`}
                        onClick={() => setActiveTab('geo')}
                    >
                        🌍 GEO TRACKR
                    </button>
                    <button
                        className={`btn ${activeTab === 'draw' ? 'btn-info' : 'btn-outline-info'}`}
                        onClick={() => setActiveTab('draw')}
                    >
                        🎨 DRAW UP
                    </button>
                    <button
                        className={`btn ${activeTab === 'apero' ? 'btn-warning' : 'btn-outline-warning'}`}
                        onClick={() => setActiveTab('apero')}
                    >
                        🍻 APÉRO QUIZ
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

