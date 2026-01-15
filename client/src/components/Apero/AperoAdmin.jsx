import { useState, useEffect } from 'react';
import AperoEditor from './AperoEditor';
import './AperoStyles.css';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

function AperoAdmin() {
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [showEditor, setShowEditor] = useState(false);

    useEffect(() => {
        loadQuizzes();
    }, []);

    const loadQuizzes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/quizzes`);
            const data = await res.json();
            setQuizzes(data);
        } catch (error) {
            console.error('Error loading quizzes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createQuiz = () => {
        setEditingQuizId(null);
        setShowEditor(true);
    };

    const editQuiz = (quizId) => {
        setEditingQuizId(quizId);
        setShowEditor(true);
    };

    const duplicateQuiz = async (quizId) => {
        try {
            await fetch(`${API_URL}/quizzes/${quizId}/duplicate`, { method: 'POST' });
            loadQuizzes();
        } catch (error) {
            console.error('Error duplicating quiz:', error);
        }
    };

    const deleteQuiz = async (quizId, title) => {
        if (!window.confirm(`Supprimer le quiz "${title}" ?`)) return;
        try {
            await fetch(`${API_URL}/quizzes/${quizId}`, { method: 'DELETE' });
            loadQuizzes();
        } catch (error) {
            console.error('Error deleting quiz:', error);
        }
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingQuizId(null);
        loadQuizzes();
    };

    // Si on est dans l'éditeur
    if (showEditor) {
        return <AperoEditor quizId={editingQuizId} onBack={closeEditor} />;
    }

    return (
        <div className="apero-admin p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-warning mb-0">🍻 Apéro Quiz - Gestionnaire</h2>
                <button className="btn btn-success" onClick={createQuiz}>
                    + Nouveau Quiz
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-warning" role="status"></div>
                </div>
            ) : quizzes.length === 0 ? (
                <div className="text-center py-5 text-muted">
                    <h4>Aucun quiz créé</h4>
                    <p>Créez votre premier quiz pour commencer !</p>
                    <button className="btn btn-warning" onClick={createQuiz}>
                        Créer un Quiz
                    </button>
                </div>
            ) : (
                <div className="row g-4">
                    {quizzes.map(quiz => (
                        <div key={quiz.id} className="col-md-4">
                            <div className="card bg-dark border-secondary h-100">
                                <div className="card-body">
                                    <h5 className="card-title text-white">{quiz.title}</h5>
                                    <p className="card-text text-muted">
                                        {quiz.slideCount} slides • {quiz.questionCount} questions
                                    </p>
                                    <p className="card-text">
                                        <small className="text-muted">
                                            Modifié: {new Date(quiz.updatedAt).toLocaleDateString('fr-FR')}
                                        </small>
                                    </p>
                                </div>
                                <div className="card-footer border-secondary d-flex gap-2">
                                    <button
                                        className="btn btn-sm btn-primary flex-fill"
                                        onClick={() => editQuiz(quiz.id)}
                                    >
                                        ✏️ Éditer
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-info"
                                        onClick={() => duplicateQuiz(quiz.id)}
                                        title="Dupliquer"
                                    >
                                        📋
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-danger"
                                        onClick={() => deleteQuiz(quiz.id, quiz.title)}
                                        title="Supprimer"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info section */}
            <div className="mt-5 p-4 bg-dark rounded border border-secondary">
                <h5 className="text-info">📖 Comment utiliser l'Apéro Quiz</h5>
                <ol className="text-muted mb-0">
                    <li>Créez un quiz avec vos questions (QCM, Estimation, Texte libre)</li>
                    <li>Depuis la page d'accueil, lancez "Apéro Quiz" et sélectionnez votre quiz</li>
                    <li>Les équipes scannent le QR code et entrent leur nom d'équipe</li>
                    <li>Naviguez dans les slides et activez les questions pour que les équipes puissent répondre</li>
                    <li>Révélez les réponses et affichez le classement entre les séries</li>
                </ol>
            </div>
        </div>
    );
}

export default AperoAdmin;
