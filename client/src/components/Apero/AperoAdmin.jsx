import { useState, useEffect, useRef } from 'react';
import AperoEditor from './AperoEditor';
import { convertPdfToQuiz } from '../../utils/pdfImporter';
import { motion, AnimatePresence } from 'framer-motion';
import './AperoStyles.css';
import './AperoAdmin.css'; // New CSS file for grid layout

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
            const newQuiz = await convertPdfToQuiz(file);
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

    if (showEditor) {
        return <AperoEditor quizId={editingQuizId} onBack={closeEditor} />;
    }

    return (
        <div className="apero-admin container-fluid p-4" style={{ minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h1 className="fw-bold text-white mb-0">🍻 Apéro Quiz <span className="text-warning">Studio</span></h1>
                    <p className="text-secondary fs-5 mb-0" style={{ opacity: 0.8 }}>Parcourir vos quiz</p>
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
                <div className="quiz-grid-masonry">
                    {/* Quiz Cards */}
                    {quizzes.map((quiz, index) => {
                        const isLarge = index % 5 === 0; // Every 5th is large
                        const isTall = index % 4 === 1 || index % 4 === 3; // Pattern for tall cards

                        return (
                            <motion.div
                                key={quiz.id}
                                whileHover={{ y: -8, boxShadow: '0 25px 50px rgba(0,0,0,0.8)' }}
                                className={`quiz-grid-card ${isLarge ? 'quiz-card-large' : ''} ${isTall ? 'quiz-card-tall' : ''}`}
                                onClick={() => editQuiz(quiz.id)}
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
                                        {/* Render miniature content SCALED to fit container using viewBox-like approach */}
                                        <div style={{
                                            width: '960px', height: '540px',
                                            transform: `scale(${isLarge ? 0.8 : 0.6})`, // Grossissement pour bien remplir
                                            transformOrigin: 'center center',
                                            position: 'absolute',
                                            left: '50%', top: '50%',
                                            marginLeft: '-480px', marginTop: '-270px',
                                            display: quiz.slides?.[0]?.background?.type === 'image' ? 'none' : 'block' // Hide DOM elements if image bg (cleaner)
                                        }}>
                                            {/* Render miniature */}
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

                                {/* Hover Actions */}
                                <div className="quiz-card-actions">
                                    <button className="quiz-action-btn" onClick={() => editQuiz(quiz.id)} title="Éditer">✏️</button>
                                    <button className="quiz-action-btn" onClick={(e) => duplicateQuiz(e, quiz.id)} title="Dupliquer">📄</button>
                                    <button className="quiz-action-btn quiz-action-delete" onClick={(e) => deleteQuiz(e, quiz.id, quiz.title)} title="Supprimer">🗑️</button>
                                </div>
                            </motion.div>
                        );
                    })}

                    {/* Create New Card */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="quiz-grid-card quiz-card-new"
                        onClick={createQuiz}
                    >
                        <div className="quiz-card-new-content">
                            <div className="quiz-new-icon">+</div>
                            <div className="quiz-new-text">Créer un Quiz</div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

export default AperoAdmin;
