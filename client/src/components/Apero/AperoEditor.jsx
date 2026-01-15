import { useState, useEffect } from 'react';
import './AperoStyles.css';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

// Thèmes prédéfinis
const THEMES = {
    'dark': { background: '#1a1a2e', text: '#ffffff', accent: '#00d4ff' },
    'gradient-purple': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#ffffff' },
    'gradient-blue': { background: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)', text: '#ffffff' },
    'gradient-green': { background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', text: '#ffffff' },
    'gradient-orange': { background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)', text: '#ffffff' },
    'gradient-pink': { background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)', text: '#ffffff' },
    'neon': { background: '#0f0f23', text: '#00ff88', accent: '#ff00ff' },
    'retro': { background: '#2d1b69', text: '#ff71ce', accent: '#01cdfe' },
    'gold': { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', text: '#ffd700' }
};

function AperoEditor({ quizId, onBack }) {
    const [quiz, setQuiz] = useState(null);
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(100);

    useEffect(() => {
        if (quizId) {
            loadQuiz(quizId);
        } else {
            // Nouveau quiz
            createNewQuiz();
        }
    }, [quizId]);

    const loadQuiz = async (id) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/quizzes/${id}`);
            const data = await res.json();
            setQuiz(data);
        } catch (error) {
            console.error('Error loading quiz:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const createNewQuiz = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/quizzes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: 'Nouveau Quiz' })
            });
            const data = await res.json();
            setQuiz(data);
        } catch (error) {
            console.error('Error creating quiz:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveQuiz = async () => {
        if (!quiz) return;
        setIsSaving(true);
        try {
            await fetch(`${API_URL}/quizzes/${quiz.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quiz)
            });
        } catch (error) {
            console.error('Error saving quiz:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateSlide = (updates) => {
        if (!quiz) return;
        const newSlides = [...quiz.slides];
        newSlides[selectedSlideIndex] = { ...newSlides[selectedSlideIndex], ...updates };
        setQuiz({ ...quiz, slides: newSlides });
    };

    const addSlide = async (type) => {
        let newSlide;
        switch (type) {
            case 'title':
                newSlide = {
                    type: 'title',
                    title: 'Nouveau Titre',
                    subtitle: '',
                    theme: 'gradient-purple',
                    background: { type: 'gradient', value: THEMES['gradient-purple'].background }
                };
                break;
            case 'qcm':
                newSlide = {
                    type: 'question',
                    questionType: 'qcm',
                    questionText: 'Nouvelle question',
                    options: [
                        { label: 'A', text: '' },
                        { label: 'B', text: '' },
                        { label: 'C', text: '' },
                        { label: 'D', text: '' }
                    ],
                    correctAnswer: 'A',
                    timer: 20,
                    theme: 'dark',
                    background: { type: 'color', value: '#1a1a2e' }
                };
                break;
            case 'estimation':
                newSlide = {
                    type: 'question',
                    questionType: 'estimation',
                    questionText: 'Question estimation',
                    correctAnswer: '0',
                    hint: 'Entrez un nombre',
                    timer: 30,
                    theme: 'dark',
                    background: { type: 'color', value: '#1a1a2e' }
                };
                break;
            case 'text':
                newSlide = {
                    type: 'question',
                    questionType: 'text',
                    questionText: 'Question texte libre',
                    correctAnswer: '',
                    hint: 'Entrez votre réponse',
                    timer: 30,
                    theme: 'dark',
                    background: { type: 'color', value: '#1a1a2e' }
                };
                break;
            case 'score':
                newSlide = {
                    type: 'score',
                    title: '🏆 Classement',
                    theme: 'gold',
                    background: { type: 'gradient', value: THEMES['gold'].background }
                };
                break;
            default:
                return;
        }

        const newSlides = [...quiz.slides, { ...newSlide, id: 'slide_' + Date.now() }];
        setQuiz({ ...quiz, slides: newSlides });
        setSelectedSlideIndex(newSlides.length - 1);
    };

    const deleteSlide = () => {
        if (!quiz || quiz.slides.length <= 1) return;
        const newSlides = quiz.slides.filter((_, i) => i !== selectedSlideIndex);
        setQuiz({ ...quiz, slides: newSlides });
        setSelectedSlideIndex(Math.max(0, selectedSlideIndex - 1));
    };

    const moveSlide = (direction) => {
        if (!quiz) return;
        const newIndex = selectedSlideIndex + direction;
        if (newIndex < 0 || newIndex >= quiz.slides.length) return;

        const newSlides = [...quiz.slides];
        [newSlides[selectedSlideIndex], newSlides[newIndex]] = [newSlides[newIndex], newSlides[selectedSlideIndex]];
        setQuiz({ ...quiz, slides: newSlides });
        setSelectedSlideIndex(newIndex);
    };

    const currentSlide = quiz?.slides?.[selectedSlideIndex];

    if (isLoading) {
        return (
            <div className="apero-editor d-flex justify-content-center align-items-center">
                <div className="spinner-border text-info" role="status"></div>
            </div>
        );
    }

    return (
        <div className="apero-editor">
            {/* Toolbar */}
            <div className="apero-editor-toolbar">
                <div className="d-flex align-items-center gap-3">
                    <button className="btn btn-outline-light btn-sm" onClick={onBack}>
                        ← Retour
                    </button>
                    <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        style={{ width: '300px' }}
                        value={quiz?.title || ''}
                        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                        placeholder="Titre du quiz"
                    />
                </div>
                <div className="apero-editor-toolbar-actions">
                    <button className="btn btn-outline-info btn-sm" onClick={() => setZoom(z => Math.max(50, z - 25))}>
                        −
                    </button>
                    <span className="text-muted">{zoom}%</span>
                    <button className="btn btn-outline-info btn-sm" onClick={() => setZoom(z => Math.min(100, z + 25))}>
                        +
                    </button>
                    <button className="btn btn-success" onClick={saveQuiz} disabled={isSaving}>
                        {isSaving ? '...' : '💾 Sauvegarder'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="apero-editor-main">
                {/* Slides Panel */}
                <div className="apero-slides-panel">
                    <div className="apero-slides-header">
                        Slides ({quiz?.slides?.length || 0})
                    </div>
                    <div className="apero-slides-list">
                        {quiz?.slides?.map((slide, index) => (
                            <div
                                key={slide.id || index}
                                className={`apero-slide-thumb ${index === selectedSlideIndex ? 'active' : ''}`}
                                onClick={() => setSelectedSlideIndex(index)}
                            >
                                <div className="apero-slide-thumb-number">{index + 1}</div>
                                <div className="apero-slide-thumb-type">
                                    {slide.type === 'title' && '📋 Titre'}
                                    {slide.type === 'question' && `❓ ${slide.questionType?.toUpperCase()}`}
                                    {slide.type === 'score' && '🏆 Score'}
                                </div>
                                <div className="apero-slide-thumb-title">
                                    {slide.title || slide.questionText?.substring(0, 20) || 'Sans titre'}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="apero-slides-add">
                        <select
                            className="form-select bg-dark text-white"
                            value=""
                            onChange={(e) => e.target.value && addSlide(e.target.value)}
                        >
                            <option value="">+ Ajouter un slide</option>
                            <option value="title">📋 Titre / Interlude</option>
                            <option value="qcm">❓ Question QCM</option>
                            <option value="estimation">🔢 Estimation</option>
                            <option value="text">✏️ Texte libre</option>
                            <option value="score">🏆 Classement</option>
                        </select>
                    </div>
                </div>

                {/* Canvas */}
                <div className="apero-canvas-container">
                    <div className="apero-canvas-toolbar">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => moveSlide(-1)} disabled={selectedSlideIndex === 0}>
                            ⬆️
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => moveSlide(1)} disabled={selectedSlideIndex >= (quiz?.slides?.length || 1) - 1}>
                            ⬇️
                        </button>
                        <button className="btn btn-sm btn-outline-danger" onClick={deleteSlide} disabled={quiz?.slides?.length <= 1}>
                            🗑️ Supprimer
                        </button>
                    </div>
                    <div className="apero-canvas-wrapper">
                        <div
                            className={`apero-canvas zoom-${zoom}`}
                            style={{
                                background: currentSlide?.background?.value || '#1a1a2e',
                                color: THEMES[currentSlide?.theme]?.text || '#fff'
                            }}
                        >
                            <SlidePreview slide={currentSlide} />
                        </div>
                    </div>
                </div>

                {/* Properties Panel */}
                <div className="apero-properties-panel">
                    <div className="apero-properties-header">
                        Propriétés
                    </div>
                    <div className="apero-properties-content">
                        {currentSlide && (
                            <SlideProperties
                                slide={currentSlide}
                                onUpdate={updateSlide}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Composant pour l'aperçu du slide
function SlidePreview({ slide }) {
    if (!slide) return null;

    if (slide.type === 'title') {
        return (
            <div className="slide-preview type-title">
                <div className="slide-title">{slide.title || 'Titre'}</div>
                <div className="slide-subtitle">{slide.subtitle}</div>
            </div>
        );
    }

    if (slide.type === 'score') {
        return (
            <div className="slide-preview type-score">
                <div className="slide-title">{slide.title || '🏆 Classement'}</div>
                <div style={{ marginTop: '20px', color: '#888' }}>
                    [Classement des équipes]
                </div>
            </div>
        );
    }

    if (slide.type === 'question') {
        return (
            <div className="slide-preview type-question">
                <div className="question-header">
                    Question • {slide.timer || 20}s
                </div>
                <div className="question-text">
                    {slide.questionText || 'Votre question ici...'}
                </div>

                {slide.questionType === 'qcm' && (
                    <div className="question-options">
                        {slide.options?.map((opt, i) => (
                            <div
                                key={i}
                                className={`option ${opt.label === slide.correctAnswer ? 'correct' : ''}`}
                            >
                                <span className="option-letter">{opt.label}</span>
                                <span>{opt.text || '...'}</span>
                            </div>
                        ))}
                    </div>
                )}

                {slide.questionType === 'estimation' && (
                    <div style={{ marginTop: '30px', textAlign: 'center' }}>
                        <div style={{ color: '#888', marginBottom: '10px' }}>{slide.hint || 'Entrez un nombre'}</div>
                        <div style={{ fontSize: '2rem', color: '#00d4ff' }}>[ ___ ]</div>
                        <div style={{ marginTop: '20px', color: '#00ff88' }}>Réponse: {slide.correctAnswer}</div>
                    </div>
                )}

                {slide.questionType === 'text' && (
                    <div style={{ marginTop: '30px', textAlign: 'center' }}>
                        <div style={{ color: '#888', marginBottom: '10px' }}>{slide.hint || 'Entrez votre réponse'}</div>
                        <div style={{ fontSize: '1.5rem', color: '#00d4ff' }}>[ ________ ]</div>
                        <div style={{ marginTop: '20px', color: '#00ff88' }}>Réponse: {slide.correctAnswer}</div>
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// Composant pour les propriétés du slide
function SlideProperties({ slide, onUpdate }) {
    if (slide.type === 'title') {
        return (
            <>
                <div className="apero-property-group">
                    <h4>📝 Contenu</h4>
                    <div className="apero-property-row">
                        <label>Titre</label>
                        <input
                            type="text"
                            value={slide.title || ''}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                        />
                    </div>
                    <div className="apero-property-row">
                        <label>Sous-titre</label>
                        <input
                            type="text"
                            value={slide.subtitle || ''}
                            onChange={(e) => onUpdate({ subtitle: e.target.value })}
                        />
                    </div>
                </div>
                <ThemeSelector slide={slide} onUpdate={onUpdate} />
            </>
        );
    }

    if (slide.type === 'score') {
        return (
            <>
                <div className="apero-property-group">
                    <h4>🏆 Classement</h4>
                    <div className="apero-property-row">
                        <label>Titre</label>
                        <input
                            type="text"
                            value={slide.title || ''}
                            onChange={(e) => onUpdate({ title: e.target.value })}
                        />
                    </div>
                </div>
                <ThemeSelector slide={slide} onUpdate={onUpdate} />
            </>
        );
    }

    if (slide.type === 'question') {
        return (
            <>
                <div className="apero-property-group">
                    <h4>❓ Question</h4>
                    <div className="apero-property-row">
                        <label>Texte de la question</label>
                        <textarea
                            value={slide.questionText || ''}
                            onChange={(e) => onUpdate({ questionText: e.target.value })}
                        />
                    </div>
                    <div className="apero-property-row">
                        <label>Timer (secondes)</label>
                        <input
                            type="number"
                            min="5"
                            max="120"
                            value={slide.timer || 20}
                            onChange={(e) => onUpdate({ timer: parseInt(e.target.value) })}
                        />
                    </div>
                </div>

                {slide.questionType === 'qcm' && (
                    <div className="apero-property-group">
                        <h4>📋 Options</h4>
                        <div className="apero-options-grid">
                            {slide.options?.map((opt, i) => (
                                <div key={i} className="apero-option-item">
                                    <span className={`apero-option-label ${opt.label === slide.correctAnswer ? 'correct' : ''}`}>
                                        {opt.label}
                                    </span>
                                    <input
                                        type="text"
                                        value={opt.text || ''}
                                        onChange={(e) => {
                                            const newOptions = [...slide.options];
                                            newOptions[i] = { ...newOptions[i], text: e.target.value };
                                            onUpdate({ options: newOptions });
                                        }}
                                        placeholder={`Option ${opt.label}`}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="apero-property-row mt-3">
                            <label>Bonne réponse</label>
                            <div className="apero-correct-selector">
                                {['A', 'B', 'C', 'D'].map(letter => (
                                    <button
                                        key={letter}
                                        type="button"
                                        className={`apero-correct-btn ${slide.correctAnswer === letter ? 'selected' : ''}`}
                                        onClick={() => onUpdate({ correctAnswer: letter })}
                                    >
                                        {letter}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {(slide.questionType === 'estimation' || slide.questionType === 'text' || slide.questionType === 'date') && (
                    <div className="apero-property-group">
                        <h4>✅ Réponse</h4>
                        <div className="apero-property-row">
                            <label>Bonne réponse</label>
                            <input
                                type="text"
                                value={slide.correctAnswer || ''}
                                onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
                            />
                        </div>
                        <div className="apero-property-row">
                            <label>Indice (affiché aux joueurs)</label>
                            <input
                                type="text"
                                value={slide.hint || ''}
                                onChange={(e) => onUpdate({ hint: e.target.value })}
                                placeholder="Ex: Entrez un nombre"
                            />
                        </div>
                    </div>
                )}

                <ThemeSelector slide={slide} onUpdate={onUpdate} />
            </>
        );
    }

    return null;
}

// Sélecteur de thème
function ThemeSelector({ slide, onUpdate }) {
    return (
        <div className="apero-property-group">
            <h4>🎨 Thème</h4>
            <div className="apero-theme-grid">
                {Object.entries(THEMES).map(([key, theme]) => (
                    <button
                        key={key}
                        className={`apero-theme-btn ${slide.theme === key ? 'selected' : ''}`}
                        style={{ background: theme.background }}
                        onClick={() => onUpdate({
                            theme: key,
                            background: { type: theme.background.includes('gradient') ? 'gradient' : 'color', value: theme.background }
                        })}
                        title={key}
                    />
                ))}
            </div>
        </div>
    );
}

export default AperoEditor;
