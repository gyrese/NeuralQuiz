import { useState, useEffect } from 'react';
import { Rnd } from 'react-rnd';
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

const generateId = () => 'el_' + Math.random().toString(36).substr(2, 9);

function AperoEditor({ quizId, onBack }) {
    const [quiz, setQuiz] = useState(null);
    const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
    const [selectedElementId, setSelectedElementId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(60); // Zoom par défaut plus petit pour voir tout le canvas HD

    useEffect(() => {
        if (quizId) loadQuiz(quizId);
        else createNewQuiz();
    }, [quizId]);

    // Keyboard shortcuts handled globally for delete
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Delete' && selectedElementId) {
                deleteElement(selectedElementId);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedElementId, quiz, selectedSlideIndex]);

    const loadQuiz = async (id) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/quizzes/${id}`);
            const data = await res.json();
            // Ensure elements array exists
            data.slides = data.slides.map(s => ({ ...s, elements: s.elements || [] }));
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

    // --- Element Management ---

    const addElement = (type, initialProps = {}) => {
        const currentElements = quiz.slides[selectedSlideIndex].elements || [];
        const newEl = {
            id: Date.now().toString(),
            type,
            x: 100,
            y: 100,
            width: type === 'text' ? 300 : 200,
            height: type === 'text' ? 100 : 200,
            rotation: 0,
            content: type === 'text' ? 'Nouveau texte' : '',
            url: initialProps.url || '',
            style: {
                zIndex: (currentElements.length + 1) * 10,
                fontSize: 24,
                backgroundColor: type === 'shape' ? '#3498db' : 'transparent',
                borderRadius: type === 'shape' ? 0 : 0,
                color: '#ffffff',
                textAlign: 'center',
                ...initialProps.style
            },
            ...initialProps
        };

        updateSlide({ elements: [...currentElements, newEl] });
        setSelectedElementId(newEl.id);
    };

    // --- Paste & Drop Handlers ---

    useEffect(() => {
        const handlePaste = (e) => {
            // Ignore inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const ratio = img.width / img.height;
                            const baseWidth = 300;
                            addElement('image', {
                                url: event.target.result,
                                width: baseWidth,
                                height: baseWidth / ratio,
                                content: 'Image collée'
                            });
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(blob);
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [quiz, selectedSlideIndex]); // Re-bind when quiz state changes to access latest closure

    const handleCanvasDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        const ratio = img.width / img.height;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left - 150;
                        const y = e.clientY - rect.top - 100;
                        addElement('image', {
                            url: event.target.result,
                            width: 300,
                            height: 300 / ratio,
                            x: x,
                            y: y
                        });
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const updateElement = (id, updates) => {
        const currentElements = quiz.slides[selectedSlideIndex].elements || [];
        const newElements = currentElements.map(el => el.id === id ? { ...el, ...updates } : el);
        updateSlide({ elements: newElements });
    };

    const updateElementStyle = (id, styleUpdates) => {
        const currentElements = quiz.slides[selectedSlideIndex].elements || [];
        const newElements = currentElements.map(el => el.id === id ? { ...el, style: { ...el.style, ...styleUpdates } } : el);
        updateSlide({ elements: newElements });
    };

    const deleteElement = (id) => {
        const currentElements = quiz.slides[selectedSlideIndex].elements || [];
        const newElements = currentElements.filter(el => el.id !== id);
        updateSlide({ elements: newElements });
        setSelectedElementId(null);
    };

    const changeZIndex = (id, direction) => {
        const currentElements = quiz.slides[selectedSlideIndex].elements || [];
        const newElements = currentElements.map(el => {
            if (el.id === id) {
                const currentZ = el.style?.zIndex || 10;
                return { ...el, style: { ...el.style, zIndex: currentZ + direction } };
            }
            return el;
        });
        updateSlide({ elements: newElements });
    };

    // --- Slide Management ---

    const addSlide = async (type) => {
        let newSlide = {
            id: 'slide_' + Date.now(),
            type: 'question',
            questionType: type === 'qcm' || type === 'estimation' || type === 'text' ? type : 'qcm',
            title: 'Nouveau Slide',
            subtitle: '',
            theme: 'dark',
            background: { type: 'color', value: '#1a1a2e' },
            elements: [], // Initialize empty elements array
            ...getInitialProps(type)
        };

        const newSlides = [...quiz.slides, newSlide];
        setQuiz({ ...quiz, slides: newSlides });
        setSelectedSlideIndex(newSlides.length - 1);
        setSelectedElementId(null);
    };

    const getInitialProps = (type) => {
        switch (type) {
            case 'title': return { type: 'title', title: 'Grand Titre', subtitle: 'Sous-titre' };
            case 'score': return { type: 'score', title: 'Classement' };
            case 'qcm': return {
                questionText: 'Votre question ?',
                options: [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }],
                correctAnswer: 'A', timer: 20
            };
            default: return { questionText: 'Question ?', correctAnswer: '', timer: 30 };
        }
    };

    const deleteSlide = () => {
        if (!quiz || quiz.slides.length <= 1) return;
        const newSlides = quiz.slides.filter((_, i) => i !== selectedSlideIndex);
        setQuiz({ ...quiz, slides: newSlides });
        setSelectedSlideIndex(Math.max(0, selectedSlideIndex - 1));
        setSelectedElementId(null);
    };

    const currentSlide = quiz?.slides?.[selectedSlideIndex];
    const selectedElement = currentSlide?.elements?.find(el => el.id === selectedElementId);

    if (isLoading) return <div className="text-white p-5">Chargement...</div>;

    return (
        <div className="apero-editor">
            {/* Toolbar */}
            <div className="apero-editor-toolbar">
                <div className="d-flex align-items-center gap-3">
                    <button className="btn btn-outline-light btn-sm" onClick={onBack}>← Retour</button>
                    <input
                        type="text"
                        className="form-control bg-dark text-white border-secondary"
                        style={{ width: '200px' }}
                        value={quiz?.title || ''}
                        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                        placeholder="Titre du quiz"
                    />
                    <div className="vr bg-secondary mx-2"></div>
                    <div className="btn-group">
                        <button className="btn btn-outline-info btn-sm" onClick={() => addElement('text')}>➕ Texte</button>
                        <button className="btn btn-outline-warning btn-sm" onClick={() => addElement('image')}>➕ Image</button>
                        <button className="btn btn-outline-success btn-sm" onClick={() => addElement('shape')}>➕ Forme</button>
                    </div>
                </div>
                <div className="apero-editor-toolbar-actions">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setZoom(z => Math.max(30, z - 10))}>-</button>
                    <span className="text-muted mx-2">{zoom}%</span>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setZoom(z => Math.min(100, z + 10))}>+</button>
                    <button className="btn btn-success ms-3" onClick={saveQuiz} disabled={isSaving}>
                        {isSaving ? '...' : '💾 Sauvegarder'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="apero-editor-main">
                {/* Slides List */}
                <div className="apero-slides-panel">
                    <div className="apero-slides-list">
                        {quiz?.slides?.map((slide, index) => (
                            <div
                                key={slide.id || index}
                                className={`apero-slide-thumb ${index === selectedSlideIndex ? 'active' : ''}`}
                                onClick={() => { setSelectedSlideIndex(index); setSelectedElementId(null); }}
                            >
                                <div className="apero-slide-thumb-number">{index + 1}</div>
                                <div className="apero-slide-thumb-title">
                                    {slide.title || slide.questionText || 'Slide ' + (index + 1)}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-2">
                        <button className="btn btn-outline-light w-100 btn-sm" onClick={() => addSlide('qcm')}>+ Slide</button>
                    </div>
                </div>

                {/* Canvas Area */}
                <div className="apero-canvas-container" onClick={() => setSelectedElementId(null)}>
                    <div className="apero-canvas-wrapper" style={{ padding: '40px' }}>

                        {/* THE CANVAS - BASE 1280x720 */}
                        <div
                            className="apero-canvas-hd"
                            onDrop={handleCanvasDrop}
                            onDragOver={handleDragOver}
                            style={{
                                width: '1280px',
                                height: '720px',
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top left',
                                position: 'relative',
                                backgroundColor: currentSlide?.background?.type === 'image' ? '#000' : (currentSlide?.background?.value || '#1a1a2e'),
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                overflow: 'hidden',
                                boxShadow: '0 0 50px rgba(0,0,0,0.5)'
                            }}
                            onClick={(e) => e.stopPropagation()} // Prevent deselection when clicking canvas bg
                        >
                            {/* Overlay Layer */}
                            {currentSlide?.background?.type === 'image' && (
                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 0 }} />
                            )}

                            {/* Elements Layer (Z-Index 10+) */}
                            {currentSlide?.elements?.map(el => (
                                <Rnd
                                    key={el.id}
                                    size={{ width: el.width, height: el.height }}
                                    position={{ x: el.x, y: el.y }}
                                    onDragStop={(e, d) => updateElement(el.id, { x: d.x, y: d.y })}
                                    onResizeStop={(e, direction, ref, delta, position) => {
                                        updateElement(el.id, {
                                            width: parseInt(ref.style.width),
                                            height: parseInt(ref.style.height),
                                            ...position
                                        });
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedElementId(el.id);
                                    }}
                                    scale={zoom / 100}
                                    bounds="parent"
                                    style={{
                                        position: 'absolute',
                                        zIndex: el.style?.zIndex || 10,
                                        border: selectedElementId === el.id ? '2px solid #00d4ff' : '1px dashed rgba(255,255,255,0.1)',
                                        cursor: 'move'
                                    }}
                                >
                                    <div style={{
                                        width: '100%', height: '100%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        ...el.style,
                                        pointerEvents: 'none' // Let Rnd handle events
                                    }}>
                                        {el.type === 'text' && el.content}
                                        {el.type === 'shape' && el.content}
                                        {el.type === 'image' && (
                                            el.url ? <img src={el.url} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: el.style.borderRadius }} /> : <span className="text-white-50">Image (vide)</span>
                                        )}
                                    </div>
                                </Rnd>
                            ))}

                            {/* Standard Content Layer (Fallback / Fixed QCM) - Z-Index 5 */}
                            <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', padding: '40px' }}>
                                <SlidePreview slide={currentSlide} />
                            </div>

                        </div>
                    </div>
                </div>

                {/* Properties Panel & Layers */}
                <div className="apero-properties-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                    {/* LAYERS EXPLORER (Haut à Droite, hauteur fixe si possible ou flex) */}
                    <div style={{ flex: '0 0 40%', borderBottom: '1px solid #444', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div className="apero-properties-header">
                            📚 Calques ({currentSlide?.elements?.length || 0})
                        </div>
                        <div className="p-2">
                            {/* Liste inversée pour avoir le Premier Plan en HAUT de liste */}
                            {[...(currentSlide?.elements || [])]
                                .sort((a, b) => (b.style?.zIndex || 0) - (a.style?.zIndex || 0))
                                .map((el) => (
                                    <div
                                        key={el.id}
                                        className={`d-flex align-items-center justify-content-between p-2 mb-1 rounded ${selectedElementId === el.id ? 'bg-primary text-white' : 'bg-dark text-white-50'}`}
                                        style={{ cursor: 'pointer', border: '1px solid #333' }}
                                        onClick={() => setSelectedElementId(el.id)}
                                    >
                                        <div className="d-flex align-items-center gap-2 overflow-hidden">
                                            <span>
                                                {el.type === 'text' && 'T'}
                                                {el.type === 'image' && '🖼️'}
                                                {el.type === 'shape' && '🟦'}
                                            </span>
                                            <span className="small text-truncate" style={{ maxWidth: '100px' }}>
                                                {el.type === 'text' ? (el.content || 'Texte') : (el.type === 'image' ? 'Image' : 'Forme')}
                                            </span>
                                        </div>
                                        <div className="btn-group btn-group-sm">
                                            <button
                                                className="btn btn-outline-light py-0 px-1"
                                                title="Monter (Premier plan)"
                                                onClick={(e) => { e.stopPropagation(); changeZIndex(el.id, 1); }}
                                            >⬆️</button>
                                            <button
                                                className="btn btn-outline-light py-0 px-1"
                                                title="Descendre (Arrière plan)"
                                                onClick={(e) => { e.stopPropagation(); changeZIndex(el.id, -1); }}
                                            >⬇️</button>
                                        </div>
                                    </div>
                                ))}
                            {(!currentSlide?.elements || currentSlide.elements.length === 0) && (
                                <div className="text-muted small text-center mt-3">Aucun élément</div>
                            )}
                        </div>
                    </div>

                    {/* PROPERTIES (Bas à Droite) */}
                    <div style={{ flex: '1', overflowY: 'auto', borderTop: '1px solid #444' }}>
                        {selectedElement ? (
                            <ElementProperties
                                element={selectedElement}
                                onUpdate={(updates) => updateElement(selectedElement.id, updates)}
                                onStyleUpdate={(style) => updateElementStyle(selectedElement.id, style)}
                                onDelete={() => deleteElement(selectedElement.id)}
                            />
                        ) : (
                            currentSlide && (
                                <SlideProperties
                                    slide={currentSlide}
                                    onUpdate={updateSlide}
                                />
                            )
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

// Composant Properties pour un Élément sélectionné
function ElementProperties({ element, onUpdate, onStyleUpdate, onDelete }) {
    return (
        <div>
            <div className="apero-properties-header d-flex justify-content-between align-items-center">
                <span>Propriétés Élément</span>
                <button className="btn btn-sm btn-danger" onClick={onDelete}>🗑️</button>
            </div>
            <div className="apero-properties-content">
                <div className="apero-property-group">
                    <label>Position</label>
                    <div className="d-flex gap-2">
                        <input type="number" className="form-control form-control-sm" value={Math.round(element.x)} onChange={(e) => onUpdate({ x: parseInt(e.target.value) })} />
                        <input type="number" className="form-control form-control-sm" value={Math.round(element.y)} onChange={(e) => onUpdate({ y: parseInt(e.target.value) })} />
                    </div>
                </div>

                {element.type === 'text' && (
                    <div className="apero-property-group">
                        <label>Contenu Texte</label>
                        <textarea className="form-control" rows={3} value={element.content} onChange={(e) => onUpdate({ content: e.target.value })} />

                        <label className="mt-2">Taille Police</label>
                        <input type="text" className="form-control" value={element.style.fontSize} onChange={(e) => onStyleUpdate({ fontSize: e.target.value })} />

                        <label className="mt-2">Couleur</label>
                        <input type="color" className="form-control form-control-color w-100" value={element.style.color} onChange={(e) => onStyleUpdate({ color: e.target.value })} />

                        <label className="mt-2">Fond</label>
                        <input type="color" className="form-control form-control-color w-100" value={element.style.backgroundColor} onChange={(e) => onStyleUpdate({ backgroundColor: e.target.value })} />
                    </div>
                )}

                {element.type === 'image' && (
                    <div className="apero-property-group">
                        <label>URL Image</label>
                        <input type="text" className="form-control" value={element.url || ''} onChange={(e) => onUpdate({ url: e.target.value })} placeholder="https://..." />

                        <label className="mt-2">Arrondi (Border Radius)</label>
                        <input type="text" className="form-control" value={element.style.borderRadius || '0px'} onChange={(e) => onStyleUpdate({ borderRadius: e.target.value })} />
                    </div>
                )}

                <div className="apero-property-group mt-3">
                    <label>Profondeur (Z-Index)</label>
                    <input type="number" className="form-control" value={element.style.zIndex} onChange={(e) => onStyleUpdate({ zIndex: parseInt(e.target.value) })} />
                </div>
            </div>
        </div>
    );
}

// Composant pour l'aperçu du slide (Contenu Fixe QCM/Titre)
function SlidePreview({ slide }) {
    if (!slide) return null;

    // Affiche seulement le titre/question en mode preview "ghost"
    // Le vrai contenu est editable via les éléments maintenant, mais on garde ça pour la compatibilité
    // On rend ça semi-transparent pour montrer que c'est le "layout fixe"

    const containerStyle = { opacity: 0.8 };

    if (slide.type === 'title') {
        return (
            <div className="slide-preview type-title" style={containerStyle}>
                <div className="slide-title">{slide.title}</div>
                <div className="slide-subtitle">{slide.subtitle}</div>
            </div>
        );
    }

    if (slide.type === 'question') {
        return (
            <div className="slide-preview type-question" style={containerStyle}>
                <div className="question-header">Question</div>
                <div className="question-text">{slide.questionText}</div>
                {slide.questionType === 'qcm' && (
                    <div className="question-options">
                        {slide.options?.map((opt, i) => (
                            <div key={i} className={`option ${opt.label === slide.correctAnswer ? 'correct' : ''}`}>
                                <span className="option-letter">{opt.label}</span>
                                <span>{opt.text}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return null;
}

// Composant PROPS Globales (Background, Question Core...)
function SlideProperties({ slide, onUpdate }) {
    return (
        <div>
            <div className="apero-properties-header">Propriétés Slide</div>
            <div className="apero-properties-content">
                <div className="apero-property-group">
                    <label>Type Slide</label>
                    <select className="form-select" value={slide.type} disabled>
                        <option value="title">Titre</option>
                        <option value="question">Question</option>
                        <option value="score">Score</option>
                    </select>
                </div>

                <div className="apero-property-group">
                    <label>Background URL</label>
                    <input
                        type="text"
                        className="form-control"
                        value={slide.background?.value || ''}
                        onChange={(e) => onUpdate({ background: { type: 'image', value: e.target.value } })}
                        placeholder="Image de fond..."
                    />
                </div>

                {slide.type === 'question' && (
                    <div className="apero-property-group">
                        <label>Question</label>
                        <textarea className="form-control" value={slide.questionText} onChange={(e) => onUpdate({ questionText: e.target.value })} />

                        <label className="mt-2">Temps (s)</label>
                        <input type="number" className="form-control" value={slide.timer} onChange={(e) => onUpdate({ timer: parseInt(e.target.value) })} />

                        {slide.questionType === 'qcm' && (
                            <div className="mt-3">
                                <label>Réponses QCM</label>
                                {slide.options.map((opt, i) => (
                                    <div key={i} className="d-flex gap-2 mb-1">
                                        <span className="badge bg-secondary pt-2">{opt.label}</span>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            value={opt.text}
                                            onChange={(e) => {
                                                const newOpts = [...slide.options];
                                                newOpts[i] = { ...opt, text: e.target.value };
                                                onUpdate({ options: newOpts });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="alert alert-info mt-3 p-2 small">
                    💡 Cliquez sur les boutons <b>+ Texte / Image</b> en haut pour ajouter des éléments libres.
                </div>
            </div>
        </div>
    );
}

export default AperoEditor;
