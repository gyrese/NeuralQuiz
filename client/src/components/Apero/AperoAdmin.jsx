import { useState, useEffect, useRef } from 'react';
import AperoEditor from './AperoEditor';
import { convertPdfToQuiz } from '../../utils/pdfImporter';
import { motion, AnimatePresence } from 'framer-motion';
import './AperoStyles.css';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

function AperoAdmin() {
    const [quizzes, setQuizzes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [editingQuizId, setEditingQuizId] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const fileInputRef = useRef(null);

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

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            alert('Veuillez sélectionner un fichier PDF');
            return;
        }

        try {
            setIsImporting(true);
            const newQuiz = await convertPdfToQuiz(file); // This might take time

            // Upload
            const res = await fetch(`${API_URL}/quizzes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newQuiz)
            });

            if (!res.ok) throw new Error('Erreur sauvegarde serveur');

            await loadQuizzes();
            alert('✅ Quiz importé avec succès !');
        } catch (error) {
            alert(`Erreur d'import : ${error.message}`);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const editQuiz = (quizId) => {
        setEditingQuizId(quizId);
        setShowEditor(true);
    };

    const duplicateQuiz = async (e, quizId) => {
        e.stopPropagation();
        if (!window.confirm('Dupliquer ce quiz ?')) return;
        try {
            await fetch(`${API_URL}/quizzes/${quizId}/duplicate`, { method: 'POST' });
            loadQuizzes();
        } catch (error) { console.error(error); }
    };

    const deleteQuiz = async (e, quizId, title) => {
        e.stopPropagation();
        if (!window.confirm(`Supprimer définitivement "${title}" ?`)) return;
        try {
            await fetch(`${API_URL}/quizzes/${quizId}`, { method: 'DELETE' });
            loadQuizzes();
        } catch (error) { console.error(error); }
    };

    const closeEditor = () => {
        setShowEditor(false);
        setEditingQuizId(null);
        loadQuizzes();
    };

    // Helper to get thumbnail
    const getQuizThumbnail = (quiz) => {
        const firstBg = quiz.slides?.[0]?.background;
        if (firstBg?.type === 'image') return `url("${firstBg.value}")`;
        if (firstBg?.type === 'gradient') return firstBg.value;
        return 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'; // default dark
    };

    if (showEditor) {
        return <AperoEditor quizId={editingQuizId} onBack={closeEditor} />;
    }

    return (
        <div className="apero-admin container-fluid p-4" style={{ minHeight: '100vh', backgroundColor: '#121212' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h1 className="fw-bold text-white mb-0">🍻 Apéro Quiz <span className="text-warning">Studio</span></h1>
                    <p className="text-muted mb-0">Créez et gérez vos animations interactives</p>
                </div>
                <div className="d-flex gap-3">
                    <input
                        type="file"
                        accept="application/pdf"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <button
                        className={`btn btn-outline-info rounded-pill px-4 ${isImporting ? 'disabled' : ''}`}
                        onClick={handleImportClick}
                    >
                        {isImporting ? <span className="spinner-border spinner-border-sm me-2" /> : '📥'} Importer PDF
                    </button>
                    <button className="btn btn-warning rounded-pill px-4 fw-bold" onClick={createQuiz}>
                        + Créer Nouveau
                    </button>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="text-center py-5 text-secondary">Chargement...</div>
            ) : (
                <div className="row g-4">
                    {/* Create New Card */}
                    <div className="col-12 col-md-6 col-lg-4 col-xl-3">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="card h-100 bg-transparent border-2 border-secondary border-dashed d-flex align-items-center justify-content-center"
                            style={{ minHeight: '300px', cursor: 'pointer', borderStyle: 'dashed' }}
                            onClick={createQuiz}
                        >
                            <div className="text-center text-secondary">
                                <div className="display-4 mb-2">+</div>
                                <div className="fw-bold">Nouveau Quiz</div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Quiz List */}
                    {quizzes.map(quiz => (
                        <div key={quiz.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                            <motion.div
                                whileHover={{ y: -5, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                                className="card h-100 bg-dark border-0 overflow-hidden shadow"
                                style={{ cursor: 'pointer' }}
                                onClick={() => editQuiz(quiz.id)}
                            >
                                {/* Thumbnail */}
                                <div style={{
                                    height: '160px',
                                    background: getQuizThumbnail(quiz),
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    position: 'relative'
                                }}>
                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)' }} />
                                    <div className="position-absolute bottom-0 start-0 p-3 w-100">
                                        <h5 className="text-white fw-bold mb-0 text-truncate">{quiz.title}</h5>
                                    </div>
                                    <span className="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-75">
                                        {quiz.slides?.length || 0} slides
                                    </span>
                                </div>

                                {/* Body */}
                                <div className="card-body">
                                    <div className="d-flex justify-content-between text-muted small mb-3">
                                        <span>🕒 {new Date(quiz.updatedAt).toLocaleDateString()}</span>
                                        <span>{quiz.questionCount} questions</span>
                                    </div>

                                    <div className="d-grid gap-2">
                                        <button className="btn btn-primary btn-sm rounded-pill fw-bold">
                                            ✏️ Éditer
                                        </button>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="card-footer bg-dark border-top border-secondary py-2 d-flex justify-content-between">
                                    <button
                                        className="btn btn-sm text-info hover-scale"
                                        onClick={(e) => duplicateQuiz(e, quiz.id)}
                                        title="Dupliquer"
                                    >
                                        📄 Dupliquer
                                    </button>
                                    <button
                                        className="btn btn-sm text-danger hover-scale"
                                        onClick={(e) => deleteQuiz(e, quiz.id, quiz.title)}
                                        title="Supprimer"
                                    >
                                        🗑️ Supprimer
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AperoAdmin;
