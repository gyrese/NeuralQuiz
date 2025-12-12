import { useState, useEffect } from 'react';
import QuizEditor from './QuizEditor';

function AdminView({ onBack }) {
    const [quizzes, setQuizzes] = useState([]);
    const [editingQuiz, setEditingQuiz] = useState(null); // null = list, 'new' = create, object = edit

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const response = await fetch(`${window.location.protocol}//${window.location.hostname}:3001/api/quizzes`);
            const data = await response.json();
            setQuizzes(data);
        } catch (error) {
            console.error("Erreur chargement quiz:", error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Supprimer ce quiz ?")) {
            try {
                await fetch(`${window.location.protocol}//${window.location.hostname}:3001/api/quizzes/${id}`, { method: 'DELETE' });
                fetchQuizzes();
            } catch (error) {
                console.error("Erreur suppression:", error);
            }
        }
    };

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
        <div className="container mt-5 text-light">
            <div className="d-flex justify-content-between align-items-center mb-5">
                <button className="btn btn-outline-secondary" onClick={onBack}>&lt; RETOUR</button>
                <h1 className="glitch-text text-primary" data-text="ADMINISTRATION">ADMINISTRATION</h1>
                <button className="btn btn-primary" onClick={() => setEditingQuiz('new')}>+ NOUVEAU QUIZ</button>
            </div>

            <div className="row g-4">
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
                                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(quiz.id)}>SUPPRIMER</button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default AdminView;
