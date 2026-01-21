import { useState, useEffect, useRef, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer, Circle, Star, Line, RegularPolygon, Group } from 'react-konva';
import useImage from 'use-image';
import './GSlides.css';

const API_URL = `${window.location.protocol}//${window.location.hostname}:3001/api/apero`;

// --- ICONS ---
const Icon = ({ name, size = 18 }) => {
    const paths = {
        undo: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
        redo: "M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z",
        select: "M7 2l12 11.2-5.8.5 3.3 7.3-2.2.9-3.2-7.4-4.4 4.6z",
        text: "M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z",
        image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
        shape: "M3 3h18v18H3V3zm2 2v14h14V5H5z",
        bold: "M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7c2.09 0 3.85-1.52 3.85-3.5 0-1.8-.75-3.23-2.25-3.71zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z",
        italic: "M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z",
        underline: "M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z",
        delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
        upload: "M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"
    };
    return <svg viewBox="0 0 24 24" width={size} height={size} fill="#444746"><path d={paths[name] || ""} /></svg>;
};

// --- URL Image for Konva ---
const URLImage = ({ url, ...props }) => {
    const [image] = useImage(url, 'anonymous');
    return <KonvaImage image={image} {...props} />;
};

// --- Mini Preview (for Thumbnails) ---
const SlideThumbnail = ({ slide, isActive, onClick, index, onDragStart, onDrop }) => {
    const thumbW = 180;
    const thumbH = 101; // 16:9
    const W = 1280;
    const H = 720;
    const scale = thumbW / W;

    return (
        <div
            className={`gs-thumb ${isActive ? 'active' : ''}`}
            onClick={onClick}
            draggable
            onDragStart={onDragStart}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
        >
            <span className="gs-thumb-num">{index + 1}</span>
            <div className="gs-thumb-canvas" style={{ width: thumbW, height: thumbH, background: '#fff', position: 'relative', overflow: 'hidden' }}>

                {/* QCM PREVIEW */}
                {slide.slideType === 'qcm' && (
                    <div style={{
                        width: W, height: H,
                        transform: `scale(${scale})`, transformOrigin: 'top left',
                        background: slide.background?.type === 'color' ? slide.background.value : '#333',
                        backgroundImage: slide.background?.type === 'image' ? `url("${slide.background.value}")` : 'none',
                        backgroundSize: 'cover',
                        display: 'flex', flexDirection: 'column', padding: 20
                    }}>
                        {/* Question */}
                        <div style={{ background: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 12, marginBottom: 20, textAlign: 'center', color: '#fff' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold' }}>{slide.question || 'Question'}</div>
                        </div>
                        {/* Media */}
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
                            {slide.qcmMedia && <img src={slide.qcmMedia} style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />}
                        </div>
                        {/* Answers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: '35%' }}>
                            {['#e21b3c', '#1368ce', '#d89e00', '#26890c'].map((c, i) => (
                                <div key={i} style={{ background: c, borderRadius: 8 }}></div>
                            ))}
                        </div>
                    </div>
                )}

                {/* GENERIC PREVIEW FOR NEW TYPES */}
                {['truefalse', 'open', 'slider', 'pin', 'puzzle'].includes(slide.slideType) && (
                    <div style={{
                        width: W, height: H,
                        transform: `scale(${scale})`, transformOrigin: 'top left',
                        background: slide.background?.type === 'color' ? slide.background.value : '#333',
                        backgroundImage: slide.background?.type === 'image' ? `url("${slide.background.value}")` : 'none',
                        backgroundSize: 'cover',
                        display: 'flex', flexDirection: 'column', padding: 20
                    }}>
                        <div style={{ background: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 12, marginBottom: 20, textAlign: 'center', color: '#fff' }}>
                            <div style={{ fontSize: 32, fontWeight: 'bold' }}>{slide.question || 'Question'}</div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
                            {slide.qcmMedia && <img src={slide.qcmMedia} style={{ maxHeight: '100%', maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />}
                            {slide.slideType === 'pin' && !slide.qcmMedia && <div style={{ fontSize: 200 }}>📍</div>}
                        </div>

                        {/* Type Indicator */}
                        <div style={{ height: '35%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 60, fontWeight: 'bold' }}>
                            {slide.slideType === 'truefalse' && <span>👍 / 👎</span>}
                            {slide.slideType === 'open' && <span>⌨️ ABCD...</span>}
                            {slide.slideType === 'slider' && <span>🎚️ 0 — 100</span>}
                            {slide.slideType === 'pin' && <span>📍 X: {Math.round(slide.pinX || 0)}% Y: {Math.round(slide.pinY || 0)}%</span>}
                            {slide.slideType === 'puzzle' && <span>🔢 1 2 3 4</span>}
                        </div>
                    </div>
                )}

                {/* TITRE PREVIEW */}
                {slide.slideType === 'titre' && (
                    <div style={{
                        width: W, height: H,
                        transform: `scale(${scale})`, transformOrigin: 'top left',
                        background: '#000',
                        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {slide.background?.value && (
                            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${slide.background.value}")`, backgroundSize: 'cover', opacity: slide.bgOpacity ?? 0.7 }} />
                        )}
                        <div style={{ zIndex: 10, textAlign: 'center', color: '#fff' }}>
                            {slide.titleLogo ? (
                                <img src={slide.titleLogo} style={{ maxHeight: 300, maxWidth: '80%' }} />
                            ) : (
                                <h1 style={{ fontSize: 80, margin: 0 }}>{slide.titleText || 'TITRE'}</h1>
                            )}
                            <h2 style={{ fontSize: 40, marginTop: 20, fontWeight: 300 }}>{slide.subtitle || 'Sous-titre'}</h2>
                        </div>
                    </div>
                )}

                {/* LIBRE (CANVAS) PREVIEW */}
                {(!slide.slideType || slide.slideType === 'libre') && (
                    <Stage width={thumbW} height={thumbH} scaleX={scale} scaleY={scale} listening={false}>
                        <Layer>
                            <Rect x={0} y={0} width={1280} height={720} fill={slide.background?.type === 'color' ? slide.background.value : '#fff'} />
                            {slide.background?.type === 'image' && <URLImage url={slide.background.value} x={0} y={0} width={1280} height={720} />}
                            {slide.elements?.map(el => {
                                if (el.type === 'text') return <Text key={el.id} x={el.x} y={el.y} text={el.text} fontSize={el.fontSize || 32} fill={el.fill || '#000'} />;
                                if (el.type === 'shape') {
                                    if (el.shapeType === 'circle') return <Circle key={el.id} x={el.x + el.width / 2} y={el.y + el.height / 2} radius={Math.min(el.width, el.height) / 2} fill={el.fill} opacity={el.opacity} />;
                                    // Simplification for others: Rect
                                    return <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill || '#4285f4'} cornerRadius={el.cornerRadius} opacity={el.opacity} />;
                                }
                                if (el.type === 'image') return <URLImage key={el.id} url={el.url} x={el.x} y={el.y} width={el.width} height={el.height} opacity={el.opacity} />;
                                return null;
                            })}
                        </Layer>
                    </Stage>
                )}
            </div>
        </div>
    );
};

export default function AperoEditor({ quizId, onBack }) {
    const [quiz, setQuiz] = useState({ title: '', slides: [] });
    const [slideIdx, setSlideIdx] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [zoom, setZoom] = useState(60);
    const [menuOpen, setMenuOpen] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const [guides, setGuides] = useState([]);
    const transformerRef = useRef(null);

    // --- SNAPPING LOGIC ---
    const getLineGuideStops = (skipShape) => {
        const W = 1280; const H = 720;
        return {
            vertical: [0, W / 2, W],
            horizontal: [0, H / 2, H],
        };
    };

    const getObjectSnappingEdges = (node) => {
        const box = node.getClientRect({ relativeTo: node.getLayer() });
        const absPos = node.absolutePosition();
        // Since we are inside a scaled stage, we need to work with node coordinates
        // But getClientRect handles transforms.

        // Let's use simpler logic based on attrs
        const w = node.width() * node.scaleX();
        const h = node.height() * node.scaleY();
        const x = node.x();
        const y = node.y();

        // We assume x,y is top-left for Rect/Image/Text.
        // For shapes registered as Circle/Star, we adjust if needed.
        // But in my code, I render Circle via Rect wrapper sometimes? No.
        // Let's rely on getClientRect relative to Layer which corresponds to 1280x720 space
        return {
            vertical: [
                { guide: Math.round(box.x), offset: Math.round(node.x() - box.x), snap: 'start' },
                { guide: Math.round(box.x + box.width / 2), offset: Math.round(node.x() - box.x - box.width / 2), snap: 'center' },
                { guide: Math.round(box.x + box.width), offset: Math.round(node.x() - box.x - box.width), snap: 'end' },
            ],
            horizontal: [
                { guide: Math.round(box.y), offset: Math.round(node.y() - box.y), snap: 'start' },
                { guide: Math.round(box.y + box.height / 2), offset: Math.round(node.y() - box.y - box.height / 2), snap: 'center' },
                { guide: Math.round(box.y + box.height), offset: Math.round(node.y() - box.y - box.height), snap: 'end' },
            ],
        };
    };

    const handleDragMove = (e) => {
        const layer = e.target.getLayer();
        const guidesStops = getLineGuideStops(e.target);
        const itemBounds = getObjectSnappingEdges(e.target);
        const GUIDELINE_OFFSET = 10;
        let newGuides = [];

        // Vertical Snapping
        let minV = Number.MAX_VALUE;
        let guideV = null;
        let snapOffsetV = 0;

        guidesStops.vertical.forEach((guide) => {
            itemBounds.vertical.forEach((bound) => {
                const diff = Math.abs(guide - bound.guide);
                if (diff < GUIDELINE_OFFSET) {
                    if (diff < minV) {
                        minV = diff;
                        guideV = guide;
                        snapOffsetV = bound.offset;
                    }
                }
            });
        });

        if (guideV !== null) {
            e.target.x(guideV + snapOffsetV);
            newGuides.push({ orientation: 'V', lineGuide: guideV });
        }

        // Horizontal Snapping
        let minH = Number.MAX_VALUE;
        let guideH = null;
        let snapOffsetH = 0;

        guidesStops.horizontal.forEach((guide) => {
            itemBounds.horizontal.forEach((bound) => {
                const diff = Math.abs(guide - bound.guide);
                if (diff < GUIDELINE_OFFSET) {
                    if (diff < minH) {
                        minH = diff;
                        guideH = guide;
                        snapOffsetH = bound.offset;
                    }
                }
            });
        });

        if (guideH !== null) {
            e.target.y(guideH + snapOffsetH);
            newGuides.push({ orientation: 'H', lineGuide: guideH });
        }

        setGuides(newGuides);
    };
    const stageRef = useRef(null);
    const fileInputRef = useRef(null);
    const [editingId, setEditingId] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const textareaRef = useRef(null);
    const [clipboard, setClipboard] = useState(null); // For copy/paste
    const [previewMode, setPreviewMode] = useState(false); // For preview

    const W = 1280, H = 720;
    const currentSlide = quiz.slides?.[slideIdx];
    const selectedEl = currentSlide?.elements?.find(e => e.id === selectedId);

    // Load Quiz
    useEffect(() => {
        if (quizId) loadQuiz(quizId);
        else {
            const init = { title: 'Sans titre', slides: [{ id: 's1', elements: [], background: { type: 'color', value: '#FFFFFF' } }] };
            setQuiz(init); pushHistory(init); setIsLoading(false);
        }
    }, [quizId]);

    // Keyboard
    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
            if (e.ctrlKey && e.key === 'c' && selectedId) { e.preventDefault(); copyElement(); }
            if (e.ctrlKey && e.key === 'v' && clipboard) { e.preventDefault(); pasteElement(); }
            if (e.ctrlKey && e.key === 'd' && selectedId) { e.preventDefault(); duplicateElement(); }
            if (e.key === 'Delete' && selectedId) deleteElement(selectedId);
            if (e.key === 'F5') { e.preventDefault(); setPreviewMode(true); }
            if (e.key === 'Escape' && previewMode) setPreviewMode(false);
            // Z-Index shortcuts
            if (e.ctrlKey && e.key === 'ArrowUp' && selectedId) { e.preventDefault(); bringForward(); }
            if (e.ctrlKey && e.key === 'ArrowDown' && selectedId) { e.preventDefault(); sendBackward(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [historyStep, selectedId, quiz, clipboard, previewMode]);

    // Paste Images
    useEffect(() => {
        const onPaste = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            const items = e.clipboardData?.items;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => addImageElement(ev.target.result);
                    reader.readAsDataURL(file);
                }
            }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [quiz, slideIdx]);

    // Transformer Sync
    useEffect(() => {
        if (selectedId && transformerRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) {
                transformerRef.current.nodes([node]);
                transformerRef.current.getLayer()?.batchDraw();
            } else {
                transformerRef.current.nodes([]);
            }
        } else if (transformerRef.current) {
            transformerRef.current.nodes([]);
        }
    }, [selectedId, currentSlide?.elements]);

    // --- History ---
    const pushHistory = (newQuiz) => {
        const str = JSON.stringify(newQuiz);
        const h = history.slice(0, historyStep + 1);
        h.push(str);
        setHistory(h); setHistoryStep(h.length - 1); setQuiz(newQuiz);
    };
    const undo = () => { if (historyStep > 0) { setQuiz(JSON.parse(history[historyStep - 1])); setHistoryStep(historyStep - 1); } };
    const redo = () => { if (historyStep < history.length - 1) { setQuiz(JSON.parse(history[historyStep + 1])); setHistoryStep(historyStep + 1); } };

    // --- API ---
    const loadQuiz = async (id) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/quizzes/${id}`);
            const data = await res.json();
            data.slides = (data.slides || []).map(s => ({ ...s, elements: s.elements || [] }));
            setQuiz(data); pushHistory(data);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const saveQuiz = async (silent = false) => {
        setIsSaving(true);
        try {
            const method = quiz.id ? 'PUT' : 'POST';
            const url = quiz.id ? `${API_URL}/quizzes/${quiz.id}` : `${API_URL}/quizzes`;
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quiz) });
            if (!res.ok) throw new Error('Save failed');
            if (method === 'POST') setQuiz(await res.json());
            if (!silent) alert('✅ Sauvegardé !');
        } catch (e) { if (!silent) alert(e.message); } finally { setIsSaving(false); }
    };

    // Auto-save every 30s
    useEffect(() => {
        const timer = setInterval(() => {
            if (quiz.id && !isSaving) {
                saveQuiz(true);
            }
        }, 30000);
        return () => clearInterval(timer);
    }, [quiz, isSaving]);

    // --- Slide & Element ---
    const updateSlide = (updates) => {
        const newSlides = [...quiz.slides];
        newSlides[slideIdx] = { ...newSlides[slideIdx], ...updates };
        pushHistory({ ...quiz, slides: newSlides });
    };

    const addElement = (type, extra = {}) => {
        const id = 'el_' + Date.now();
        const isShape = ['rect', 'circle', 'triangle', 'star'].includes(type);
        const el = {
            id,
            type: isShape ? 'shape' : type,
            shapeType: isShape ? type : undefined,
            x: 150 + Math.random() * 200,
            y: 150 + Math.random() * 100,
            width: type === 'text' ? 400 : 150,
            height: type === 'text' ? 60 : 150,
            text: type === 'text' ? 'Texte' : undefined,
            fontSize: 36,
            fill: isShape ? '#4285f4' : '#000000',
            opacity: 1,
            ...extra
        };
        updateSlide({ elements: [...(currentSlide.elements || []), el] });
        setSelectedId(id);
    };

    const moveLayer = (fromIdx, toIdx) => {
        if (!currentSlide?.elements) return;
        const els = [...currentSlide.elements];
        const [moved] = els.splice(fromIdx, 1);
        els.splice(toIdx, 0, moved);
        updateSlide({ elements: els });
    };

    const addImageElement = async (dataUrlOrFile) => {
        try {
            let imageUrl = dataUrlOrFile;

            // If it's a data URL (base64), convert to file and upload
            if (typeof dataUrlOrFile === 'string' && dataUrlOrFile.startsWith('data:')) {
                // Convert base64 to blob
                const res = await fetch(dataUrlOrFile);
                const blob = await res.blob();
                const formData = new FormData();
                formData.append('image', blob, 'image.png');

                // Upload to server
                const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                if (uploadRes.ok) {
                    const data = await uploadRes.json();
                    imageUrl = data.url;
                }
            }

            // Get image dimensions
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > 600) { h = h * (600 / w); w = 600; }
                addElement('image', { url: imageUrl, width: w, height: h });
            };
            img.src = imageUrl;
        } catch (error) {
            console.error('Image upload failed:', error);
            // Fallback to base64 if upload fails
            const img = new Image();
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > 600) { h = h * (600 / w); w = 600; }
                addElement('image', { url: dataUrlOrFile, width: w, height: h });
            };
            img.src = dataUrlOrFile;
        }
    };

    const updateEl = (id, updates) => {
        const els = currentSlide.elements.map(e => e.id === id ? { ...e, ...updates } : e);
        setQuiz({ ...quiz, slides: quiz.slides.map((s, i) => i === slideIdx ? { ...s, elements: els } : s) });
    };

    const updateElWithHistory = (id, updates) => {
        const els = currentSlide.elements.map(e => e.id === id ? { ...e, ...updates } : e);
        pushHistory({ ...quiz, slides: quiz.slides.map((s, i) => i === slideIdx ? { ...s, elements: els } : s) });
    };

    const deleteElement = (id) => { updateSlide({ elements: currentSlide.elements.filter(e => e.id !== id) }); setSelectedId(null); };

    // Copy/Paste/Duplicate
    const copyElement = () => {
        if (!selectedEl) return;
        setClipboard({ ...selectedEl });
    };

    const pasteElement = () => {
        if (!clipboard) return;
        const newEl = { ...clipboard, id: 'el_' + Date.now(), x: clipboard.x + 30, y: clipboard.y + 30 };
        updateSlide({ elements: [...currentSlide.elements, newEl] });
        setSelectedId(newEl.id);
    };

    const duplicateElement = () => {
        if (!selectedEl) return;
        const newEl = { ...selectedEl, id: 'el_' + Date.now(), x: selectedEl.x + 30, y: selectedEl.y + 30 };
        updateSlide({ elements: [...currentSlide.elements, newEl] });
        setSelectedId(newEl.id);
    };

    // Z-Index
    const bringForward = () => {
        if (!selectedId) return;
        const els = [...currentSlide.elements];
        const idx = els.findIndex(e => e.id === selectedId);
        if (idx < els.length - 1) {
            [els[idx], els[idx + 1]] = [els[idx + 1], els[idx]];
            updateSlide({ elements: els });
        }
    };

    const sendBackward = () => {
        if (!selectedId) return;
        const els = [...currentSlide.elements];
        const idx = els.findIndex(e => e.id === selectedId);
        if (idx > 0) {
            [els[idx], els[idx - 1]] = [els[idx - 1], els[idx]];
            updateSlide({ elements: els });
        }
    };

    const bringToFront = () => {
        if (!selectedId) return;
        const els = currentSlide.elements.filter(e => e.id !== selectedId);
        els.push(selectedEl);
        updateSlide({ elements: els });
    };

    const sendToBack = () => {
        if (!selectedId) return;
        const els = currentSlide.elements.filter(e => e.id !== selectedId);
        els.unshift(selectedEl);
        updateSlide({ elements: els });
    };

    const addSlide = () => {
        const ns = { id: 's_' + Date.now(), elements: [], background: { type: 'color', value: '#FFFFFF' } };
        pushHistory({ ...quiz, slides: [...quiz.slides, ns] });
        setSlideIdx(quiz.slides.length);
    };

    const deleteSlide = () => {
        if (quiz.slides.length <= 1) return;
        pushHistory({ ...quiz, slides: quiz.slides.filter((_, i) => i !== slideIdx) });
        setSlideIdx(Math.max(0, slideIdx - 1));
    };

    const moveSlide = (from, to) => {
        if (from === to) return;
        const arr = [...quiz.slides];
        const [removed] = arr.splice(from, 1);
        arr.splice(to, 0, removed);
        pushHistory({ ...quiz, slides: arr });
        setSlideIdx(to);
    };

    // --- File Input for Images ---
    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => addImageElement(ev.target.result);
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // --- Canvas Drop ---
    const handleCanvasDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file?.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => addImageElement(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    if (isLoading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666' }}>Chargement...</div>;

    const scaledW = W * (zoom / 100);
    const scaledH = H * (zoom / 100);

    // --- PREVIEW MODE ---
    if (previewMode) {
        const previewW = window.innerWidth - 360;
        const scale = Math.min(previewW / W, window.innerHeight / H);

        return (
            <div className="gs-preview" onClick={() => setPreviewMode(false)} onKeyDown={(e) => {
                if (e.key === 'ArrowRight' && slideIdx < quiz.slides.length - 1) setSlideIdx(slideIdx + 1);
                if (e.key === 'ArrowLeft' && slideIdx > 0) setSlideIdx(slideIdx - 1);
                if (e.key === 'Escape') setPreviewMode(false);
            }} tabIndex={0} style={{
                position: 'fixed', inset: 0, zIndex: 99999, background: '#1e1e1e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40
            }}>
                {/* PRESENTER SCREEN */}
                <div style={{ position: 'relative', width: W * scale, height: H * scale, boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}>
                    <Stage width={W * scale} height={H * scale} scaleX={scale} scaleY={scale}>
                        <Layer>
                            <Rect x={0} y={0} width={W} height={H} fill={currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#fff'} />
                            {currentSlide?.background?.type === 'image' && <URLImage url={currentSlide.background.value} x={0} y={0} width={W} height={H} />}
                            {currentSlide?.elements?.map(el => {
                                if (el.type === 'text') return <Text key={el.id} x={el.x} y={el.y} text={el.text} fontSize={el.fontSize || 36} fontStyle={el.fontStyle} fontFamily={el.fontFamily} fill={el.fill || '#000'} />;
                                if (el.type === 'shape') return <Rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} cornerRadius={el.cornerRadius} />;
                                if (el.type === 'image') return <URLImage key={el.id} url={el.url} x={el.x} y={el.y} width={el.width} height={el.height} opacity={el.opacity} />;
                                return null;
                            })}
                        </Layer>
                    </Stage>
                    {/* Overlay for Interactive Slides (HTML) */}
                    {['qcm', 'open', 'slider', 'truefalse', 'puzzle', 'pin'].includes(currentSlide?.slideType) && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                            <div style={{ background: 'rgba(0,0,0,0.6)', padding: 20, borderRadius: 10, color: '#fff', fontSize: 24 }}>
                                Interface interactive (voir panneau participant)
                            </div>
                        </div>
                    )}
                </div>

                {/* PARTICIPANT MOBILE PREVIEW */}
                <div onClick={(e) => e.stopPropagation()} style={{ width: 320, height: 640, flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h3 style={{ color: '#9aa0a6', fontSize: 12, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 }}>Vue Participant</h3>
                    {/* PHONE FRAME */}
                    <div className="mobile-preview" style={{ width: 300, height: 600, background: '#111', borderRadius: 40, border: '8px solid #222', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        {/* Top Bar */}
                        <div style={{ height: 25, background: '#000', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                            <div style={{ width: 120, height: 18, background: '#222', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}></div>
                        </div>
                        {/* Screen Content */}
                        <div style={{ flex: 1, background: '#130f40', position: 'relative', display: 'flex', flexDirection: 'column', padding: 20, overflowY: 'auto' }}>
                            {/* HEADER */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, color: '#fff' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#a0a0a0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                                    <span style={{ fontWeight: 'bold', fontSize: 14 }}>Moi</span>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>0 pts</div>
                            </div>
                            {/* SLIDE CONTENT */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                {/* QCM */}
                                {(!currentSlide?.slideType || currentSlide.slideType === 'qcm') && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 10, height: 300 }}>
                                        <div style={{ background: '#e21b3c', borderRadius: 8, boxShadow: '0 4px 0 #9f132a' }}></div>
                                        <div style={{ background: '#1368ce', borderRadius: 8, boxShadow: '0 4px 0 #0d468a' }}></div>
                                        <div style={{ background: '#d89e00', borderRadius: 8, boxShadow: '0 4px 0 #966e00' }}></div>
                                        <div style={{ background: '#26890c', borderRadius: 8, boxShadow: '0 4px 0 #1a5d08' }}></div>
                                    </div>
                                )}
                                {/* TRUE/FALSE */}
                                {currentSlide?.slideType === 'truefalse' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 15, height: 300 }}>
                                        <div style={{ flex: 1, background: '#1368ce', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 24, boxShadow: '0 4px 0 #0d468a' }}>Vrai</div>
                                        <div style={{ flex: 1, background: '#e21b3c', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: 24, boxShadow: '0 4px 0 #9f132a' }}>Faux</div>
                                    </div>
                                )}
                                {/* OPEN */}
                                {currentSlide?.slideType === 'open' && (
                                    <div style={{ background: '#fff', borderRadius: 8, padding: 15, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                                        <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Votre réponse :</div>
                                        <div style={{ height: 40, border: '2px solid #ccc', borderRadius: 4, marginBottom: 15, background: '#f9f9f9' }}></div>
                                        <div style={{ height: 40, background: '#333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', textTransform: 'uppercase' }}>Envoyer</div>
                                    </div>
                                )}
                                {/* SLIDER */}
                                {currentSlide?.slideType === 'slider' && (
                                    <div style={{ background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                                        <div style={{ textAlign: 'center', fontSize: 32, fontWeight: 'bold', color: '#1a73e8', marginBottom: 20 }}>
                                            {Math.round((currentSlide.sliderMin || 0) + ((currentSlide.sliderMax || 100) - (currentSlide.sliderMin || 0)) / 2)}
                                            <span style={{ fontSize: 16, color: '#666', marginLeft: 4 }}>{currentSlide.sliderUnit}</span>
                                        </div>
                                        <div style={{ height: 6, background: '#ddd', borderRadius: 3, position: 'relative', marginBottom: 20 }}>
                                            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 24, height: 24, background: '#1a73e8', borderRadius: '50%', border: '3px solid #fff', boxShadow: '0 2px 5px rgba(0,0,0,0.3)' }}></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: 12, fontWeight: 'bold' }}>
                                            <span>{currentSlide.sliderMin || 0}</span>
                                            <span>{currentSlide.sliderMax || 100}</span>
                                        </div>
                                        <div style={{ height: 40, background: '#333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', marginTop: 25, textTransform: 'uppercase' }}>Valider</div>
                                    </div>
                                )}
                                {/* PIN */}
                                {currentSlide?.slideType === 'pin' && (
                                    <div style={{ flex: 1, position: 'relative', background: '#333', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 400 }}>
                                        {currentSlide.qcmMedia ? (
                                            <img src={currentSlide.qcmMedia} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', fontSize: 12 }}>Image requise</div>
                                        )}
                                        <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '6px 12px', borderRadius: 20, fontSize: 12, whiteSpace: 'nowrap' }}>👆 Touchez l'image</div>
                                        <div style={{ position: 'absolute', top: 10, right: 10, background: '#1a73e8', color: '#fff', padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>Valider</div>
                                    </div>
                                )}
                                {/* PUZZLE */}
                                {currentSlide?.slideType === 'puzzle' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {(currentSlide.puzzleItems || []).map((item, i) => (
                                            <div key={i} style={{ background: '#fff', padding: 12, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                                                <div style={{ color: '#ccc', fontSize: 20 }}>≡</div>
                                                <div style={{ flex: 1, fontSize: 14, fontWeight: '500' }}>{item.text || `Item ${i + 1}`}</div>
                                            </div>
                                        ))}
                                        <div style={{ textAlign: 'center', color: '#rgba(255,255,255,0.5)', fontSize: 12, marginTop: 10 }}>Glissez pour ordonner</div>
                                        <div style={{ height: 40, background: '#333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', marginTop: 10, textTransform: 'uppercase' }}>Valider</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Home Button */}
                        <div style={{ height: 40, background: '#000', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <div style={{ width: 100, height: 4, background: '#333', borderRadius: 2 }}></div>
                        </div>
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: 8 }}>
                    Slide {slideIdx + 1} / {quiz.slides.length} • ← → pour naviguer • Clic ou Échap pour quitter
                </div>
            </div>
        );
    }

    return (
        <div className="gs-editor">
            {/* Hidden file input */}
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

            {/* HEADER */}
            <header className="gs-header">
                <div className="gs-header-left">
                    <div className="gs-logo" onClick={onBack} title="Retour">
                        <svg viewBox="0 0 24 24" width="32" height="32"><rect x="2" y="2" width="20" height="20" rx="4" fill="#FBBC04" /><path d="M6 7h12v2H6zm0 4h12v2H6zm0 4h8v2H6z" fill="#fff" /></svg>
                    </div>
                    <div className="gs-title-area">
                        <input className="gs-title-input" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} placeholder="Sans titre" />
                        <div className="gs-menu-bar">
                            {['Fichier', 'Édition', 'Insertion', 'Diapositive'].map(m => (
                                <div key={m} className={`gs-menu-item ${menuOpen === m ? 'open' : ''}`} onClick={() => setMenuOpen(menuOpen === m ? null : m)}>
                                    {m}
                                    {menuOpen === m && (
                                        <div className="gs-dropdown">
                                            {m === 'Fichier' && <><div className="gs-dd-item" onClick={onBack}>Retour</div><div className="gs-dd-item" onClick={saveQuiz}>Sauvegarder</div></>}
                                            {m === 'Édition' && <><div className="gs-dd-item" onClick={undo}>Annuler</div><div className="gs-dd-item" onClick={redo}>Rétablir</div><div className="gs-dd-item" onClick={() => selectedId && deleteElement(selectedId)}>Supprimer</div></>}
                                            {m === 'Insertion' && <><div className="gs-dd-item" onClick={() => addElement('text')}>Zone de texte</div><div className="gs-dd-item" onClick={() => fileInputRef.current?.click()}>Image...</div><div className="gs-dd-item" onClick={() => addElement('shape')}>Rectangle</div></>}
                                            {m === 'Diapositive' && <><div className="gs-dd-item" onClick={addSlide}>Nouvelle</div><div className="gs-dd-item" onClick={deleteSlide}>Supprimer</div></>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button className="gs-save-btn" onClick={() => saveQuiz(false)} disabled={isSaving}>{isSaving ? '...' : '💾 Sauvegarder'}</button>
            </header>

            {/* TOOLBAR */}
            <div className="gs-toolbar">
                <button onClick={undo} title="Annuler"><Icon name="undo" /></button>
                <button onClick={redo} title="Rétablir"><Icon name="redo" /></button>
                <span className="gs-sep" />
                <button onClick={() => setZoom(Math.max(25, zoom - 10))}>-</button>
                <span className="gs-zoom">{zoom}%</span>
                <button onClick={() => setZoom(Math.min(150, zoom + 10))}>+</button>
                <span className="gs-sep" />
                <button onClick={() => setSelectedId(null)} title="Sélection" className={!selectedId ? 'active' : ''}><Icon name="select" /></button>
                <button onClick={() => addElement('text')} title="Texte"><Icon name="text" /></button>
                <button onClick={() => fileInputRef.current?.click()} title="Image"><Icon name="upload" /></button>

                {/* SHAPES DROPDOWN */}
                <select onChange={(e) => { if (e.target.value) { addElement(e.target.value); e.target.value = ''; } }} style={{ height: 36, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer' }} defaultValue="">
                    <option value="" disabled>▼ Formes</option>
                    <option value="rect">▢ Rectangle</option>
                    <option value="circle">○ Cercle</option>
                    <option value="triangle">△ Triangle</option>
                    <option value="star">☆ Étoile</option>
                </select>
                <span className="gs-sep" />

                {/* TEXT CONTROLS */}
                {selectedEl?.type === 'text' && <>
                    <select value={selectedEl.fontFamily || 'Arial'} onChange={(e) => updateElWithHistory(selectedId, { fontFamily: e.target.value })} style={{ height: 32, borderRadius: 4, border: '1px solid #dadce0', padding: '0 8px' }}>
                        <option>Arial</option>
                        <option>Georgia</option>
                        <option>Times New Roman</option>
                        <option>Courier New</option>
                        <option>Verdana</option>
                        <option>Comic Sans MS</option>
                    </select>
                    <input type="number" value={selectedEl.fontSize || 36} onChange={(e) => updateElWithHistory(selectedId, { fontSize: parseInt(e.target.value) || 36 })} style={{ width: 50 }} min={8} max={200} />
                    <button onClick={() => updateElWithHistory(selectedId, { fontStyle: selectedEl.fontStyle === 'bold' ? 'normal' : 'bold' })} title="Gras" className={selectedEl.fontStyle === 'bold' ? 'active' : ''}><Icon name="bold" /></button>
                    <button onClick={() => updateElWithHistory(selectedId, { fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italique" className={selectedEl.fontStyle === 'italic' ? 'active' : ''}><Icon name="italic" /></button>
                    <button onClick={() => updateElWithHistory(selectedId, { textDecoration: selectedEl.textDecoration === 'underline' ? 'none' : 'underline' })} title="Souligné" className={selectedEl.textDecoration === 'underline' ? 'active' : ''}><Icon name="underline" /></button>
                    <input type="color" value={selectedEl.fill || '#000'} onChange={(e) => updateElWithHistory(selectedId, { fill: e.target.value })} title="Couleur du texte" />
                </>}

                {/* SHAPE CONTROLS */}
                {selectedEl?.type === 'shape' && <>
                    <input type="color" value={selectedEl.fill || '#4285f4'} onChange={(e) => updateElWithHistory(selectedId, { fill: e.target.value })} title="Remplissage" />
                    <input type="number" value={selectedEl.cornerRadius || 0} onChange={(e) => updateElWithHistory(selectedId, { cornerRadius: parseInt(e.target.value) || 0 })} style={{ width: 50 }} min={0} max={100} title="Coins arrondis" />
                </>}

                {/* IMAGE CONTROLS */}
                {selectedEl?.type === 'image' && <>
                    <input type="number" value={Math.round(selectedEl.opacity * 100) || 100} onChange={(e) => updateElWithHistory(selectedId, { opacity: (parseInt(e.target.value) || 100) / 100 })} style={{ width: 50 }} min={0} max={100} title="Opacité %" />
                </>}

                {selectedId && <button onClick={() => deleteElement(selectedId)} title="Supprimer"><Icon name="delete" /></button>}

                {/* Z-INDEX */}
                {selectedId && <>
                    <span className="gs-sep" />
                    <button onClick={bringToFront} title="Premier plan">⬆️</button>
                    <button onClick={bringForward} title="Avancer">↑</button>
                    <button onClick={sendBackward} title="Reculer">↓</button>
                    <button onClick={sendToBack} title="Arrière plan">⬇️</button>
                </>}

                <span className="gs-sep" />

                {/* BACKGROUND */}
                <input type="color" value={currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#ffffff'} onChange={(e) => updateSlide({ background: { type: 'color', value: e.target.value } })} title="Fond de diapositive" />

                {/* PREVIEW */}
                <button
                    onClick={() => setPreviewMode(true)}
                    title="Lancer le mode présentation (F5)"
                    style={{
                        marginLeft: 'auto',
                        marginRight: 5, // Avoid shadow clipping
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: '#fff',
                        padding: '6px 20px 6px 16px', // Adjusted padding
                        borderRadius: 30,
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '12px',
                        letterSpacing: '1px',
                        boxShadow: '0 4px 15px rgba(118, 75, 162, 0.4)', // Matching glow
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        textTransform: 'uppercase',
                        outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(118, 75, 162, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(118, 75, 162, 0.4)';
                    }}
                >
                    <div style={{
                        width: 24, height: 24,
                        background: 'rgba(255,255,255,0.2)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'inset 0 0 5px rgba(255,255,255,0.2)'
                    }}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="#fff" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" /></svg>
                    </div>
                    Aperçu
                </button>
            </div>

            {/* BODY */}
            <div className="gs-body">
                {/* FILMSTRIP */}
                <aside className="gs-filmstrip">
                    {quiz.slides.map((slide, idx) => (
                        <SlideThumbnail
                            key={slide.id || idx}
                            slide={slide}
                            index={idx}
                            isActive={idx === slideIdx}
                            onClick={() => { setSlideIdx(idx); setSelectedId(null); }}
                            onDragStart={(e) => e.dataTransfer.setData('idx', idx)}
                            onDrop={(e) => { e.preventDefault(); moveSlide(parseInt(e.dataTransfer.getData('idx')), idx); }}
                        />
                    ))}
                    <button className="gs-add-slide" onClick={addSlide}>+ Diapositive</button>
                </aside>

                {/* CANVAS */}
                <main className="gs-canvas-area" onDrop={handleCanvasDrop} onDragOver={(e) => e.preventDefault()}>
                    <div className="gs-canvas-wrapper" style={{ width: scaledW, height: scaledH, overflow: 'hidden' }}>

                        {/* QCM SLIDE */}
                        {currentSlide?.slideType === 'qcm' ? (
                            <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#667',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                backgroundRepeat: 'no-repeat',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: `${20 * zoom / 100}px`
                            }}>
                                {/* Question */}
                                <div
                                    style={{
                                        flex: '0 0 auto',
                                        background: 'rgba(0,0,0,0.7)',
                                        borderRadius: 12 * zoom / 100,
                                        padding: `${15 * zoom / 100}px ${30 * zoom / 100}px`,
                                        marginBottom: 10 * zoom / 100,
                                        textAlign: 'center',
                                        zIndex: 10
                                    }}
                                >
                                    <div style={{
                                        fontSize: 28 * zoom / 100,
                                        fontWeight: 'bold',
                                        color: '#fff'
                                    }}>
                                        {currentSlide.question || 'Cliquez pour modifier la question'}
                                    </div>
                                </div>

                                {/* MEDIA AREA (Middle) */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 10 * zoom / 100,
                                    position: 'relative',
                                    minHeight: 0,
                                    overflow: 'hidden'
                                }}>
                                    {currentSlide.qcmMedia ? (
                                        <img
                                            src={currentSlide.qcmMedia}
                                            alt="Media"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain',
                                                borderRadius: 8 * zoom / 100,
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            border: `2px dashed rgba(255,255,255,0.3)`,
                                            borderRadius: 8 * zoom / 100,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'rgba(255,255,255,0.5)',
                                            fontSize: 14 * zoom / 100
                                        }}>
                                            Média (Image/Vidéo)
                                        </div>
                                    )}
                                </div>

                                {/* Answers Grid (Bottom - Compact) */}
                                <div style={{
                                    flex: '0 0 auto',
                                    height: '35%', // Take only bottom 35%
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: 10 * zoom / 100
                                }}>
                                    {(currentSlide.answers || []).map((ans, i) => {
                                        const colors = [
                                            'linear-gradient(135deg, #e21b3c, #c0392b)', // Rouge
                                            'linear-gradient(135deg, #1368ce, #2980b9)', // Bleu
                                            'linear-gradient(135deg, #d89e00, #f39c12)', // Jaune
                                            'linear-gradient(135deg, #26890c, #27ae60)'  // Vert
                                        ];
                                        const symbols = ['▲', '◆', '●', '■'];
                                        return (
                                            <div
                                                key={ans.id}
                                                style={{
                                                    background: colors[i],
                                                    borderRadius: 6 * zoom / 100,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 10 * zoom / 100,
                                                    padding: `${8 * zoom / 100}px`,
                                                    cursor: 'pointer',
                                                    border: ans.correct ? `3px solid #fff` : 'none',
                                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                                }}
                                            >
                                                <span style={{ fontSize: 20 * zoom / 100, color: '#fff' }}>{symbols[i]}</span>
                                                <span style={{
                                                    fontSize: 18 * zoom / 100,
                                                    fontWeight: 'bold',
                                                    color: '#fff',
                                                    textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '80%'
                                                }}>
                                                    {ans.text}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'truefalse' ? (
                            /* TRUE/FALSE SLIDE */
                            <div style={{
                                width: '100%', height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#667',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                display: 'flex', flexDirection: 'column', padding: `${20 * zoom / 100}px`
                            }}>
                                {/* Question & Media (Same as QCM) */}
                                <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.7)', borderRadius: 12 * zoom / 100, padding: `${15 * zoom / 100}px`, marginBottom: 10 * zoom / 100, textAlign: 'center', zIndex: 10 }}>
                                    <div style={{ fontSize: 28 * zoom / 100, fontWeight: 'bold', color: '#fff' }}>{currentSlide.question || 'Vrai ou Faux ?'}</div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 * zoom / 100, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                                    {currentSlide.qcmMedia && <img src={currentSlide.qcmMedia} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 * zoom / 100 }} />}
                                </div>
                                {/* TF Buttons */}
                                <div style={{ flex: '0 0 auto', height: '35%', display: 'flex', gap: 10 * zoom / 100 }}>
                                    {(currentSlide.answers || []).map((ans) => (
                                        <div key={ans.id} style={{
                                            flex: 1, background: ans.color, borderRadius: 6 * zoom / 100,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                                            border: ans.correct ? `4px solid #fff` : 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                        }}>
                                            <span style={{ fontSize: 40 * zoom / 100 }}>{ans.id === 'true' ? '👍' : '👎'}</span>
                                            <span style={{ fontSize: 30 * zoom / 100, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' }}>{ans.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'open' ? (
                            /* OPEN ANSWER SLIDE */
                            <div style={{
                                width: '100%', height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#667',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                display: 'flex', flexDirection: 'column', padding: `${20 * zoom / 100}px`
                            }}>
                                <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.7)', borderRadius: 12 * zoom / 100, padding: `${15 * zoom / 100}px`, marginBottom: 10 * zoom / 100, textAlign: 'center', zIndex: 10 }}>
                                    <div style={{ fontSize: 28 * zoom / 100, fontWeight: 'bold', color: '#fff' }}>{currentSlide.question || 'Question ?'}</div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 * zoom / 100, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                                    {currentSlide.qcmMedia && <img src={currentSlide.qcmMedia} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 * zoom / 100 }} />}
                                </div>
                                <div style={{ flex: '0 0 auto', padding: 20 * zoom / 100, background: 'rgba(255,255,255,0.9)', borderRadius: 8 * zoom / 100, textAlign: 'center' }}>
                                    <div style={{ fontSize: 24 * zoom / 100, color: '#333', fontStyle: 'italic' }}>Tapez votre réponse...</div>
                                    <div style={{ marginTop: 10, fontSize: 14 * zoom / 100, color: '#666' }}>
                                        Accepté : {(currentSlide.acceptedAnswers || []).join(', ')}
                                    </div>
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'slider' ? (
                            /* SLIDER SLIDE (RULER DESIGN) */
                            <div style={{
                                width: '100%', height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#667',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                display: 'flex', flexDirection: 'column', padding: `${20 * zoom / 100}px`
                            }}>
                                {/* Question - White Box */}
                                <div style={{ flex: '0 0 auto', background: '#fff', borderRadius: 12 * zoom / 100, padding: `${15 * zoom / 100}px`, marginBottom: 10 * zoom / 100, textAlign: 'center', zIndex: 10, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                                    <div style={{ fontSize: 28 * zoom / 100, fontWeight: 'bold', color: '#333' }}>{currentSlide.question || 'Combien ?'}</div>
                                </div>
                                {/* Media Center */}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 * zoom / 100, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
                                    {currentSlide.qcmMedia && <img src={currentSlide.qcmMedia} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 * zoom / 100 }} />}
                                </div>
                                {/* Slider Ruler Style */}
                                <div style={{
                                    flex: '0 0 auto',
                                    background: '#fff', borderRadius: 16 * zoom / 100, padding: `${20 * zoom / 100}px ${40 * zoom / 100}px`,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)', width: '90%', margin: '0 auto'
                                }}>
                                    {/* Ruler Container */}
                                    <div style={{ position: 'relative', width: '100%', height: 60 * zoom / 100, display: 'flex', alignItems: 'flex-end', marginBottom: 10 * zoom / 100 }}>
                                        {/* Cursor (Blue Line + Bubble) */}
                                        <div style={{
                                            position: 'absolute',
                                            left: `${((currentSlide.sliderCorrect - (currentSlide.sliderMin || 0)) / ((currentSlide.sliderMax || 100) - (currentSlide.sliderMin || 0))) * 100}%`,
                                            bottom: 0, top: -20 * zoom / 100,
                                            width: 4 * zoom / 100, background: '#1a73e8',
                                            transform: 'translateX(-50%)',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                                            zIndex: 2
                                        }}>
                                            {/* Value Bubble */}
                                            <div style={{
                                                background: '#1a73e8', color: '#fff', fontWeight: 'bold',
                                                padding: `${5 * zoom / 100}px ${10 * zoom / 100}px`,
                                                borderRadius: 6 * zoom / 100, marginBottom: 5 * zoom / 100,
                                                fontSize: 20 * zoom / 100, whiteSpace: 'nowrap',
                                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                                            }}>
                                                {currentSlide.sliderCorrect} {currentSlide.sliderUnit}
                                            </div>
                                        </div>

                                        {/* Graduations */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', height: 30 * zoom / 100, alignItems: 'flex-end' }}>
                                            {[...Array(21)].map((_, i) => (
                                                <div key={i} style={{
                                                    width: i % 5 === 0 ? 3 * zoom / 100 : 2 * zoom / 100,
                                                    height: i % 5 === 0 ? 30 * zoom / 100 : 15 * zoom / 100,
                                                    background: '#ccc'
                                                }} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Min/Max Labels */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', paddingTop: 5 * zoom / 100, borderTop: '2px solid #eee', color: '#666', fontWeight: 'bold', fontSize: 18 * zoom / 100 }}>
                                        <span>{currentSlide.sliderMin ?? 0}</span>
                                        <span>{currentSlide.sliderMax ?? 100} {currentSlide.sliderUnit}</span>
                                    </div>
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'puzzle' ? (
                            /* PUZZLE SLIDE */
                            <div style={{
                                width: '100%', height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#667',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                display: 'flex', flexDirection: 'column', padding: `${20 * zoom / 100}px`
                            }}>
                                <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.7)', borderRadius: 12 * zoom / 100, padding: `${15 * zoom / 100}px`, marginBottom: 10 * zoom / 100, textAlign: 'center', zIndex: 10 }}>
                                    <div style={{ fontSize: 28 * zoom / 100, fontWeight: 'bold', color: '#fff' }}>{currentSlide.question || 'Mettez dans l\'ordre'}</div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', gap: 20 * zoom / 100, minHeight: 0, overflow: 'hidden' }}>
                                    {/* Media Left (Optional) */}
                                    {currentSlide.qcmMedia && (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img src={currentSlide.qcmMedia} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 * zoom / 100 }} />
                                        </div>
                                    )}
                                    {/* Puzzle List */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 * zoom / 100, justifyContent: 'center' }}>
                                        {(currentSlide.puzzleItems || []).map((item, idx) => (
                                            <div key={item.id} style={{
                                                background: '#fff', padding: 15 * zoom / 100, borderRadius: 8 * zoom / 100,
                                                display: 'flex', alignItems: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                                fontWeight: 'bold', fontSize: 18 * zoom / 100
                                            }}>
                                                <span style={{ width: 30 * zoom / 100, height: 30 * zoom / 100, background: '#333', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>{idx + 1}</span>
                                                {item.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'pin' ? (
                            /* PIN SLIDE */
                            <div style={{
                                width: '100%', height: '100%',
                                backgroundColor: currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#333',
                                backgroundImage: currentSlide?.background?.type === 'image' ? `url("${currentSlide.background.value}")` : 'none',
                                backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                                display: 'flex', flexDirection: 'column', padding: `${20 * zoom / 100}px`, position: 'relative'
                            }}>
                                <div style={{ flex: '0 0 auto', background: 'rgba(0,0,0,0.7)', borderRadius: 12 * zoom / 100, padding: `${15 * zoom / 100}px`, marginBottom: 10 * zoom / 100, textAlign: 'center', zIndex: 10 }}>
                                    <div style={{ fontSize: 28 * zoom / 100, fontWeight: 'bold', color: '#fff' }}>{currentSlide.question || 'Où se trouve... ?'}</div>
                                </div>
                                <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, overflow: 'hidden' }}>
                                    {currentSlide.qcmMedia ? (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const x = ((e.clientX - rect.left) / rect.width) * 100;
                                                const y = ((e.clientY - rect.top) / rect.height) * 100;
                                                updateSlide({ pinX: x, pinY: y });
                                            }}
                                            style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', cursor: 'crosshair' }}
                                        >
                                            <img src={currentSlide.qcmMedia} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 * zoom / 100 }} />
                                            {/* Pin Marker */}
                                            {currentSlide.pinX !== undefined && (
                                                <div style={{
                                                    position: 'absolute',
                                                    left: `${currentSlide.pinX}%`, top: `${currentSlide.pinY}%`,
                                                    width: 30 * zoom / 100, height: 30 * zoom / 100,
                                                    background: 'rgba(226, 27, 60, 0.8)',
                                                    border: '2px solid #fff',
                                                    borderRadius: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                                                }}>
                                                    <div style={{ position: 'absolute', inset: -currentSlide.pinRadius * (zoom / 100), border: '2px dashed rgba(255,255,255,0.5)', borderRadius: '50%' }} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ color: '#fff', fontSize: 20 }}>Ajoutez une image pour placer le point</div>
                                    )}
                                </div>
                            </div>
                        ) : currentSlide?.slideType === 'titre' ? (
                            /* TITRE SLIDE */
                            <div style={{
                                width: '100%',
                                height: '100%',
                                background: '#000',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}>
                                {/* Background Image with Opacity */}
                                {currentSlide.background?.value && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundImage: `url("${currentSlide.background.value}")`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        opacity: currentSlide.bgOpacity ?? 0.7,
                                        zIndex: 0
                                    }} />
                                )}

                                {/* Content */}
                                <div style={{ zIndex: 10, textAlign: 'center', width: '80%' }}>
                                    {currentSlide.titleLogo ? (
                                        <img
                                            src={currentSlide.titleLogo}
                                            style={{ maxWidth: '100%', maxHeight: 400 * zoom / 100, objectFit: 'contain' }}
                                            alt="Titre"
                                        />
                                    ) : (
                                        <h1 style={{
                                            fontSize: 80 * zoom / 100,
                                            color: '#fff',
                                            textTransform: 'uppercase',
                                            fontWeight: 900,
                                            textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                            margin: 0,
                                            lineHeight: 1
                                        }}>
                                            {currentSlide.titleText || 'TITRE DU QUIZ'}
                                        </h1>
                                    )}

                                    <h2 style={{
                                        fontSize: 40 * zoom / 100,
                                        color: '#fff',
                                        marginTop: 20 * zoom / 100,
                                        fontWeight: 300,
                                        textShadow: '0 2px 5px rgba(0,0,0,0.5)',
                                        fontFamily: 'serif',
                                        fontStyle: 'italic'
                                    }}>
                                        {currentSlide.subtitle || 'Sous-titre ou thème'}
                                    </h2>
                                </div>
                            </div>
                        ) : (
                            /* LIBRE (CANVAS) SLIDE */
                            <>
                                <Stage ref={stageRef} width={scaledW} height={scaledH} scaleX={zoom / 100} scaleY={zoom / 100}
                                    onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}>
                                    <Layer>
                                        {/* Background */}
                                        <Rect x={0} y={0} width={W} height={H} fill={currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#fff'} />
                                        {currentSlide?.background?.type === 'image' && <URLImage url={currentSlide.background.value} x={0} y={0} width={W} height={H} />}

                                        {/* Elements */}
                                        {currentSlide?.elements?.map(el => {
                                            const isSelected = selectedId === el.id;

                                            const handleTransformEnd = (e) => {
                                                const node = e.target;
                                                const scaleX = node.scaleX();
                                                const scaleY = node.scaleY();

                                                // Reset scale and update width/height
                                                node.scaleX(1);
                                                node.scaleY(1);

                                                updateElWithHistory(el.id, {
                                                    x: node.x(),
                                                    y: node.y(),
                                                    width: Math.max(20, node.width() * scaleX),
                                                    height: Math.max(20, node.height() * scaleY),
                                                    rotation: node.rotation()
                                                });
                                            };

                                            const baseProps = {
                                                id: el.id,
                                                key: el.id,
                                                x: el.x,
                                                y: el.y,
                                                width: el.width,
                                                height: el.height,
                                                rotation: el.rotation || 0,
                                                draggable: true,
                                                onDragMove: handleDragMove,
                                                onMouseDown: (e) => {
                                                    e.cancelBubble = true;
                                                    setSelectedId(el.id);
                                                },
                                                onTouchStart: (e) => {
                                                    e.cancelBubble = true;
                                                    setSelectedId(el.id);
                                                },
                                                onClick: (e) => { e.cancelBubble = true; },
                                                onTap: (e) => { e.cancelBubble = true; },
                                                onDragEnd: (e) => {
                                                    setGuides([]);
                                                    updateElWithHistory(el.id, { x: e.target.x(), y: e.target.y() });
                                                },
                                                onTransformEnd: handleTransformEnd
                                            };

                                            // TEXT
                                            if (el.type === 'text') {
                                                return (
                                                    <Group
                                                        {...baseProps}
                                                        onDblClick={() => { setEditingId(el.id); setEditingValue(el.text || ''); }}
                                                    >
                                                        {/* Hit Box (Transparent but clickable) */}
                                                        <Rect width={el.width} height={el.height} fill="rgba(0,0,0,0)" />

                                                        <Text
                                                            x={0} y={0}
                                                            width={el.width}
                                                            height={el.height}
                                                            text={el.text}
                                                            fontSize={el.fontSize || 36}
                                                            fontStyle={el.fontStyle}
                                                            fontFamily={el.fontFamily}
                                                            fill={el.fill || '#000'}
                                                            textDecoration={el.textDecoration}
                                                            align="center"
                                                            verticalAlign="middle"
                                                        />
                                                    </Group>
                                                );
                                            }

                                            // SHAPES - Using Rect as base for all to enable proper transform
                                            if (el.type === 'shape') {
                                                const shapeType = el.shapeType || 'rect';
                                                const w = el.width || 100;
                                                const h = el.height || 100;
                                                const fill = el.fill || '#4285f4';

                                                // Rectangle
                                                if (shapeType === 'rect') {
                                                    return <Rect {...baseProps} fill={fill} cornerRadius={el.cornerRadius || 0} opacity={el.opacity || 1} />;
                                                }

                                                // Circle - draw ellipse inside rect bounds
                                                if (shapeType === 'circle') {
                                                    return <Rect {...baseProps}
                                                        fill={fill}
                                                        cornerRadius={Math.min(w, h) / 2}
                                                        opacity={el.opacity || 1}
                                                    />;
                                                }

                                                // Triangle & Star - use scaleX/scaleY approach
                                                if (shapeType === 'triangle') {
                                                    return <RegularPolygon {...baseProps}
                                                        x={el.x + w / 2}
                                                        y={el.y + h / 2}
                                                        sides={3}
                                                        radius={Math.min(w, h) / 2}
                                                        fill={fill}
                                                        opacity={el.opacity || 1}
                                                        offsetX={0}
                                                        offsetY={0}
                                                    />;
                                                }

                                                if (shapeType === 'star') {
                                                    return <Star {...baseProps}
                                                        x={el.x + w / 2}
                                                        y={el.y + h / 2}
                                                        numPoints={5}
                                                        innerRadius={Math.min(w, h) / 4}
                                                        outerRadius={Math.min(w, h) / 2}
                                                        fill={el.fill || '#FBBC04'}
                                                        opacity={el.opacity || 1}
                                                    />;
                                                }
                                            }

                                            // IMAGE
                                            if (el.type === 'image') {
                                                return <URLImage {...baseProps} url={el.url} opacity={el.opacity || 1} />;
                                            }

                                            return null;
                                        })}

                                        {/* Snap Guides */}
                                        {guides.map((lg, i) => {
                                            if (lg.orientation === 'V') {
                                                return <Line key={`guide-v-${i}`} points={[lg.lineGuide, 0, lg.lineGuide, H]} stroke="rgb(255, 0, 255)" strokeWidth={1} dash={[4, 6]} />;
                                            } else if (lg.orientation === 'H') {
                                                return <Line key={`guide-h-${i}`} points={[0, lg.lineGuide, W, lg.lineGuide]} stroke="rgb(255, 0, 255)" strokeWidth={1} dash={[4, 6]} />;
                                            }
                                            return null;
                                        })}

                                        <Transformer
                                            ref={transformerRef}
                                            rotateEnabled={true}
                                            keepRatio={false}
                                            borderStroke="#1a73e8"
                                            borderStrokeWidth={2}
                                            anchorFill="#ffffff"
                                            anchorStroke="#1a73e8"
                                            anchorSize={10}
                                            anchorCornerRadius={2}
                                            rotateAnchorOffset={30}
                                            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
                                            boundBoxFunc={(_, n) => ({ ...n, width: Math.max(20, n.width), height: Math.max(20, n.height) })}
                                        />
                                    </Layer>
                                </Stage>

                                {/* In-Place Text Editor Overlay */}
                                {editingId && (() => {
                                    const el = currentSlide?.elements?.find(e => e.id === editingId);
                                    if (!el) return null;
                                    const scale = zoom / 100;
                                    return (
                                        <textarea
                                            ref={textareaRef}
                                            autoFocus
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            onBlur={() => { updateElWithHistory(editingId, { text: editingValue }); setEditingId(null); }}
                                            onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); updateElWithHistory(editingId, { text: editingValue }); setEditingId(null); } }}
                                            style={{
                                                position: 'absolute',
                                                left: el.x * scale,
                                                top: el.y * scale,
                                                width: Math.max(200, (el.width || 300) * scale),
                                                minHeight: 60 * scale,
                                                fontSize: (el.fontSize || 36) * scale,
                                                fontWeight: el.fontStyle === 'bold' ? 'bold' : 'normal',
                                                color: el.fill || '#000',
                                                background: 'rgba(255,255,255,0.95)',
                                                border: '2px solid #1a73e8',
                                                borderRadius: 4,
                                                padding: '8px',
                                                outline: 'none',
                                                resize: 'both',
                                                zIndex: 9999,
                                                fontFamily: 'inherit'
                                            }}
                                        />
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </main>

                {/* RIGHT PANEL - PROPERTIES */}
                <aside className="gs-properties">
                    {selectedEl ? (
                        <>
                            <h3>Propriétés : {selectedEl.type === 'shape' ? selectedEl.shapeType || 'Forme' : selectedEl.type === 'text' ? 'Texte' : 'Image'}</h3>

                            {/* ACTIONS RAPIDES */}
                            <div className="gs-prop-group" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button onClick={() => duplicateElement(selectedId)} title="Dupliquer (Ctrl+D)" style={{ flex: 1, padding: 8 }}><Icon name="copy" /> Dupliquer</button>
                                <button onClick={() => deleteElement(selectedId)} title="Supprimer (Suppr)" style={{ flex: 1, padding: 8, color: '#d93025' }}><Icon name="trash" /> Supprimer</button>
                            </div>
                            <div className="gs-prop-group" style={{ display: 'flex', gap: 4 }}>
                                <button onClick={bringToFront} title="Premier plan" style={{ flex: 1 }}>↥</button>
                                <button onClick={bringForward} title="Avancer" style={{ flex: 1 }}>↑</button>
                                <button onClick={sendBackward} title="Reculer" style={{ flex: 1 }}>↓</button>
                                <button onClick={sendToBack} title="Arrière plan" style={{ flex: 1 }}>↧</button>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '16px 0' }} />

                            {/* POSITION & TAILLE */}
                            <div className="gs-prop-group">
                                <label>Position & Taille</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>X: <input type="number" value={Math.round(selectedEl.x)} onChange={(e) => updateElWithHistory(selectedId, { x: parseInt(e.target.value) })} style={{ width: 60 }} /></div>
                                    <div>Y: <input type="number" value={Math.round(selectedEl.y)} onChange={(e) => updateElWithHistory(selectedId, { y: parseInt(e.target.value) })} style={{ width: 60 }} /></div>
                                    <div>W: <input type="number" value={Math.round(selectedEl.width)} onChange={(e) => updateElWithHistory(selectedId, { width: parseInt(e.target.value) })} style={{ width: 60 }} /></div>
                                    <div>H: <input type="number" value={Math.round(selectedEl.height)} onChange={(e) => updateElWithHistory(selectedId, { height: parseInt(e.target.value) })} style={{ width: 60 }} /></div>
                                    <div>Rot: <input type="number" value={Math.round(selectedEl.rotation || 0)} onChange={(e) => updateElWithHistory(selectedId, { rotation: parseInt(e.target.value) })} style={{ width: 60 }} />°</div>
                                    <div>Opac: <input type="number" value={Math.round((selectedEl.opacity || 1) * 100)} onChange={(e) => updateElWithHistory(selectedId, { opacity: parseInt(e.target.value) / 100 })} style={{ width: 60 }} max={100} min={0} />%</div>
                                </div>
                            </div>

                            {/* STYLE SPECIFIQUE */}
                            {(selectedEl.type === 'text') && (
                                <div className="gs-prop-group">
                                    <label>Texte</label>
                                    <textarea value={selectedEl.text} onChange={(e) => updateElWithHistory(selectedId, { text: e.target.value })} style={{ width: '100%', minHeight: 60, marginBottom: 8 }} />
                                    <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                                        <input type="number" value={selectedEl.fontSize || 20} onChange={(e) => updateElWithHistory(selectedId, { fontSize: parseInt(e.target.value) })} style={{ width: 50 }} /> px
                                        <input type="color" value={selectedEl.fill || '#000'} onChange={(e) => updateElWithHistory(selectedId, { fill: e.target.value })} />
                                    </div>
                                    <select value={selectedEl.fontFamily || 'Arial'} onChange={(e) => updateElWithHistory(selectedId, { fontFamily: e.target.value })} style={{ width: '100%', marginBottom: 8 }}>
                                        <option>Arial</option><option>Verdana</option><option>Times New Roman</option><option>Courier New</option><option>Georgia</option><option>Comic Sans MS</option>
                                    </select>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button onClick={() => updateElWithHistory(selectedId, { fontStyle: selectedEl.fontStyle === 'bold' ? 'normal' : 'bold' })} style={{ fontWeight: 'bold', flex: 1 }}>B</button>
                                        <button onClick={() => updateElWithHistory(selectedId, { fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic' })} style={{ fontStyle: 'italic', flex: 1 }}>I</button>
                                        <button onClick={() => updateElWithHistory(selectedId, { textDecoration: selectedEl.textDecoration === 'underline' ? 'none' : 'underline' })} style={{ textDecoration: 'underline', flex: 1 }}>U</button>
                                    </div>
                                </div>
                            )}

                            {(selectedEl.type === 'shape') && (
                                <div className="gs-prop-group">
                                    <label>Apparence</label>
                                    <div style={{ marginBottom: 8 }}>
                                        Couleur: <input type="color" value={selectedEl.fill || '#4285f4'} onChange={(e) => updateElWithHistory(selectedId, { fill: e.target.value })} />
                                    </div>
                                    {selectedEl.shapeType === 'rect' && (
                                        <div>
                                            Arrondi: <input type="range" min="0" max="100" value={selectedEl.cornerRadius || 0} onChange={(e) => updateElWithHistory(selectedId, { cornerRadius: parseInt(e.target.value) })} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <h3>Propriétés du Slide</h3>

                            {/* SLIDE TYPE */}
                            <div className="gs-prop-group">
                                <label>Type de slide</label>
                                <select
                                    value={currentSlide?.slideType || 'libre'}
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        const baseUpdates = { slideType: newType, question: currentSlide?.question || 'Question ?' };

                                        if (newType === 'qcm') {
                                            updateSlide({
                                                ...baseUpdates,
                                                answers: [
                                                    { id: 'a', text: 'Réponse A', correct: true },
                                                    { id: 'b', text: 'Réponse B', correct: false },
                                                    { id: 'c', text: 'Réponse C', correct: false },
                                                    { id: 'd', text: 'Réponse D', correct: false }
                                                ]
                                            });
                                        } else if (newType === 'truefalse') {
                                            updateSlide({
                                                ...baseUpdates,
                                                answers: [
                                                    { id: 'true', text: 'Vrai', correct: true, color: '#1368ce' }, // Bleu
                                                    { id: 'false', text: 'Faux', correct: false, color: '#e21b3c' } // Rouge
                                                ]
                                            });
                                        } else if (newType === 'open') {
                                            updateSlide({
                                                ...baseUpdates,
                                                acceptedAnswers: ['Réponse']
                                            });
                                        } else if (newType === 'slider') {
                                            updateSlide({
                                                ...baseUpdates,
                                                sliderMin: 0,
                                                sliderMax: 100,
                                                sliderStep: 1,
                                                sliderUnit: '',
                                                sliderCorrect: 50,
                                                sliderTolerance: 5
                                            });
                                        } else if (newType === 'pin') {
                                            updateSlide({
                                                ...baseUpdates,
                                                pinX: 50,
                                                pinY: 50,
                                                pinRadius: 5
                                            });
                                        } else if (newType === 'puzzle') {
                                            updateSlide({
                                                ...baseUpdates,
                                                // Ordered list. Game will shuffle.
                                                puzzleItems: [
                                                    { id: '1', text: 'Étape 1' },
                                                    { id: '2', text: 'Étape 2' },
                                                    { id: '3', text: 'Étape 3' },
                                                    { id: '4', text: 'Étape 4' }
                                                ]
                                            });
                                        } else if (newType === 'titre') {
                                            updateSlide({
                                                slideType: 'titre',
                                                titleText: currentSlide?.titleText || '',
                                                titleLogo: currentSlide?.titleLogo || '',
                                                subtitle: currentSlide?.subtitle || 'Sous-titre',
                                                bgOpacity: currentSlide?.bgOpacity ?? 0.7
                                            });
                                        } else {
                                            updateSlide({ slideType: 'libre' });
                                        }
                                    }}
                                >
                                    <option value="libre">📝 Libre (Canvas)</option>
                                    <option value="titre">🎬 Titre</option>
                                    <option value="qcm">❓ QCM (4 Choix)</option>
                                    <option value="truefalse">🔵🔴 Vrai ou Faux</option>
                                    <option value="open">⌨️ Réponse Libre</option>
                                    <option value="slider">🎚️ Curseur (Estimez)</option>
                                    <option value="pin">📍 Point sur carte/image</option>
                                    <option value="puzzle">🔢 Puzzle (Ordre)</option>
                                </select>
                            </div>

                            {/* BACKGROUND */}
                            <div className="gs-prop-group">
                                <label>Arrière-plan</label>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <input
                                        type="color"
                                        value={currentSlide?.background?.type === 'color' ? currentSlide.background.value : '#ffffff'}
                                        onChange={(e) => updateSlide({ background: { type: 'color', value: e.target.value } })}
                                        style={{ width: 40, height: 40 }}
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = 'image/*';
                                            input.onchange = async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = async (ev) => {
                                                    // Upload to server
                                                    try {
                                                        const res = await fetch(ev.target.result);
                                                        const blob = await res.blob();
                                                        const formData = new FormData();
                                                        formData.append('image', blob, 'bg.png');
                                                        const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                                                        if (uploadRes.ok) {
                                                            const data = await uploadRes.json();
                                                            updateSlide({ background: { type: 'image', value: data.url } });
                                                        }
                                                    } catch (err) {
                                                        updateSlide({ background: { type: 'image', value: ev.target.result } });
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            };
                                            input.click();
                                        }}
                                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #dadce0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                                    >
                                        📷 Image
                                    </button>
                                </div>
                                {currentSlide?.background?.type === 'image' && (
                                    <button
                                        onClick={() => updateSlide({ background: { type: 'color', value: '#ffffff' } })}
                                        style={{ marginTop: 8, width: '100%', padding: 8, background: '#fee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                        ✕ Supprimer l'image
                                    </button>
                                )}
                            </div>

                            {/* TITRE PROPERTIES */}
                            {currentSlide?.slideType === 'titre' && (
                                <div className="gs-prop-group">
                                    <label>Logo du titre (Optionnel)</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                                        <button
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.onchange = async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = async (ev) => {
                                                        try {
                                                            const res = await fetch(ev.target.result);
                                                            const blob = await res.blob();
                                                            const formData = new FormData();
                                                            formData.append('image', blob, 'logo.png');
                                                            const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                                                            if (uploadRes.ok) {
                                                                const data = await uploadRes.json();
                                                                updateSlide({ titleLogo: data.url });
                                                            }
                                                        } catch (err) {
                                                            updateSlide({ titleLogo: ev.target.result });
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                };
                                                input.click();
                                            }}
                                            style={{ flex: 1, padding: '8px', border: '1px solid #dadce0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                                        >
                                            📷 Upload Logo
                                        </button>
                                        {currentSlide.titleLogo && (
                                            <button
                                                onClick={() => updateSlide({ titleLogo: null })}
                                                style={{ padding: '8px', background: '#fee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                                title="Supprimer logo"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {!currentSlide.titleLogo && (
                                        <>
                                            <label>Titre Principal</label>
                                            <input
                                                type="text"
                                                value={currentSlide.titleText || ''}
                                                onChange={(e) => updateSlide({ titleText: e.target.value })}
                                                placeholder="TITRE DU QUIZ"
                                                style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #dadce0', marginBottom: 12 }}
                                            />
                                        </>
                                    )}

                                    <label>Sous-titre</label>
                                    <input
                                        type="text"
                                        value={currentSlide.subtitle || ''}
                                        onChange={(e) => updateSlide({ subtitle: e.target.value })}
                                        placeholder="Sous-titre"
                                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #dadce0', marginBottom: 12 }}
                                    />

                                    <label>Opacité du fond ({(currentSlide.bgOpacity ?? 0.7) * 100}%)</label>
                                    <input
                                        type="range"
                                        min="0" max="1" step="0.1"
                                        value={currentSlide.bgOpacity ?? 0.7}
                                        onChange={(e) => updateSlide({ bgOpacity: parseFloat(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}
                            {/* INTERACTIVE SLIDE PROPERTIES (Shared Question & Media) */}
                            {['qcm', 'truefalse', 'open', 'slider', 'pin', 'puzzle'].includes(currentSlide?.slideType) && (
                                <div className="gs-prop-group">
                                    <label>Question</label>
                                    <textarea
                                        value={currentSlide.question || ''}
                                        onChange={(e) => updateSlide({ question: e.target.value })}
                                        style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 4, border: '1px solid #dadce0', resize: 'vertical' }}
                                    />

                                    <label style={{ marginTop: 12 }}>Média (Image)</label>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                                        <button
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'file';
                                                input.accept = 'image/*';
                                                input.onchange = async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = async (ev) => {
                                                        try {
                                                            const res = await fetch(ev.target.result);
                                                            const blob = await res.blob();
                                                            const formData = new FormData();
                                                            formData.append('image', blob, 'qcm.png');
                                                            const uploadRes = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
                                                            if (uploadRes.ok) {
                                                                const data = await uploadRes.json();
                                                                updateSlide({ qcmMedia: data.url });
                                                            }
                                                        } catch (err) {
                                                            updateSlide({ qcmMedia: ev.target.result });
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                };
                                                input.click();
                                            }}
                                            style={{ flex: 1, padding: '8px', border: '1px solid #dadce0', borderRadius: 4, background: '#fff', cursor: 'pointer' }}
                                        >
                                            📷 Média
                                        </button>
                                        {currentSlide.qcmMedia && (
                                            <button
                                                onClick={() => updateSlide({ qcmMedia: null })}
                                                style={{ padding: '8px', background: '#fee', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                                title="Supprimer média"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* SPECIFIC: QCM */}
                                    {currentSlide.slideType === 'qcm' && (
                                        <>
                                            <label>Réponses</label>
                                            {currentSlide.answers?.map((ans, i) => (
                                                <div key={ans.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                                    <input type="radio" name="correct" checked={ans.correct} onChange={() => { const newAns = currentSlide.answers.map(a => ({ ...a, correct: a.id === ans.id })); updateSlide({ answers: newAns }); }} title="Bonne réponse" />
                                                    <input type="text" value={ans.text} onChange={(e) => { const newAns = currentSlide.answers.map(a => a.id === ans.id ? { ...a, text: e.target.value } : a); updateSlide({ answers: newAns }); }} style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #dadce0' }} />
                                                </div>
                                            ))}
                                            <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>○ = Sélectionner la bonne réponse</p>
                                        </>
                                    )}

                                    {/* SPECIFIC: TRUE/FALSE */}
                                    {currentSlide.slideType === 'truefalse' && (
                                        <>
                                            <label>Bonne réponse</label>
                                            <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                                                {currentSlide.answers?.map((ans) => (
                                                    <label key={ans.id} style={{ flex: 1, padding: 10, borderRadius: 4, border: ans.correct ? '2px solid #1a73e8' : '1px solid #dadce0', background: ans.correct ? '#e8f0fe' : '#fff', cursor: 'pointer', textAlign: 'center' }}>
                                                        <input type="radio" name="tf_correct" checked={ans.correct} onChange={() => { const newAns = currentSlide.answers.map(a => ({ ...a, correct: a.id === ans.id })); updateSlide({ answers: newAns }); }} style={{ display: 'none' }} />
                                                        <div style={{ fontWeight: 'bold', color: ans.color }}>{ans.text}</div>
                                                    </label>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* SPECIFIC: OPEN */}
                                    {currentSlide.slideType === 'open' && (
                                        <>
                                            <label>Réponses acceptées (séparées par des virgules)</label>
                                            <textarea
                                                value={(currentSlide.acceptedAnswers || []).join(', ')}
                                                onChange={(e) => updateSlide({ acceptedAnswers: e.target.value.split(',').map(s => s.trim()).filter(s => s) })}
                                                placeholder="Ex: Paris, La ville lumière"
                                                style={{ width: '100%', minHeight: 60, padding: 8, borderRadius: 4, border: '1px solid #dadce0' }}
                                            />
                                        </>
                                    )}

                                    {/* SPECIFIC: SLIDER */}
                                    {currentSlide.slideType === 'slider' && (
                                        <>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                                <div><label>Min</label><input type="number" value={currentSlide.sliderMin} onChange={(e) => updateSlide({ sliderMin: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                                <div><label>Max</label><input type="number" value={currentSlide.sliderMax} onChange={(e) => updateSlide({ sliderMax: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                                <div><label>Unité</label><input type="text" value={currentSlide.sliderUnit} onChange={(e) => updateSlide({ sliderUnit: e.target.value })} style={{ width: '100%', padding: 4 }} placeholder="ex: km, €" /></div>
                                                <div><label>Pas</label><input type="number" value={currentSlide.sliderStep} onChange={(e) => updateSlide({ sliderStep: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                            </div>
                                            <label style={{ marginTop: 12 }}>Valeur Correcte</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <input type="number" value={currentSlide.sliderCorrect} onChange={(e) => updateSlide({ sliderCorrect: parseFloat(e.target.value) })} style={{ flex: 1, padding: 8 }} />
                                                <div style={{ display: 'flex', alignItems: 'center' }}>+/- <input type="number" value={currentSlide.sliderTolerance} onChange={(e) => updateSlide({ sliderTolerance: parseFloat(e.target.value) })} style={{ width: 50, padding: 8, marginLeft: 4 }} title="Tolérance" /></div>
                                            </div>
                                        </>
                                    )}

                                    {/* SPECIFIC: PIN */}
                                    {currentSlide.slideType === 'pin' && (
                                        <>
                                            <div style={{ padding: 10, background: '#e8f0fe', borderRadius: 4, marginTop: 8, fontSize: 13, color: '#1a73e8' }}>
                                                ℹ️ Pour définir la réponse, cliquez directement sur l'image dans l'éditeur.
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                                <div><label>X (%)</label><input type="number" value={Math.round(currentSlide.pinX || 0)} onChange={(e) => updateSlide({ pinX: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                                <div><label>Y (%)</label><input type="number" value={Math.round(currentSlide.pinY || 0)} onChange={(e) => updateSlide({ pinY: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                                <div><label>Rayon</label><input type="number" value={currentSlide.pinRadius || 5} onChange={(e) => updateSlide({ pinRadius: parseFloat(e.target.value) })} style={{ width: '100%', padding: 4 }} /></div>
                                            </div>
                                        </>
                                    )}

                                    {/* SPECIFIC: PUZZLE */}
                                    {currentSlide.slideType === 'puzzle' && (
                                        <>
                                            <label>Ordre Correct (1 = Haut)</label>
                                            {(currentSlide.puzzleItems || []).map((item, idx) => (
                                                <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                                                    <span style={{ width: 20, fontWeight: 'bold' }}>{idx + 1}</span>
                                                    <input type="text" value={item.text} onChange={(e) => { const newItems = [...currentSlide.puzzleItems]; newItems[idx] = { ...item, text: e.target.value }; updateSlide({ puzzleItems: newItems }); }} style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #dadce0' }} />
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}

                        </>
                    )}

                    {/* LAYERS PANEL */}
                    <div className="gs-layers-panel" style={{ marginTop: 20, borderTop: '1px solid #dadce0', paddingTop: 10 }}>
                        <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: '#5f6368', padding: '0 16px', margin: '0 0 8px 0' }}>Calques</h3>
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {currentSlide?.elements && [...currentSlide.elements].map((el, index) => ({ el, index })).reverse().map(({ el, index: originalIndex }) => (
                                <div
                                    key={el.id}
                                    draggable
                                    onDragStart={(e) => { e.dataTransfer.setData('layerIdx', originalIndex); }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const fromIdx = parseInt(e.dataTransfer.getData('layerIdx'));
                                        if (!isNaN(fromIdx) && fromIdx !== originalIndex) moveLayer(fromIdx, originalIndex);
                                    }}
                                    onDragOver={(e) => e.preventDefault()}
                                    onClick={() => setSelectedId(el.id)}
                                    style={{
                                        padding: '8px 16px',
                                        background: selectedId === el.id ? '#e8f0fe' : 'transparent',
                                        borderLeft: selectedId === el.id ? '3px solid #1a73e8' : '3px solid transparent',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        borderBottom: '1px solid #f1f3f4',
                                        fontSize: 13
                                    }}
                                >
                                    <span style={{ color: '#5f6368', width: 20, textAlign: 'center', fontSize: 16 }}>
                                        {el.type === 'text' ? 'T' : el.type === 'image' ? '🖼' : el.shapeType === 'circle' ? '○' : el.shapeType === 'triangle' ? '△' : el.shapeType === 'star' ? '☆' : '□'}
                                    </span>
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, color: '#333' }}>
                                        {el.type === 'text' ? (el.text || 'Texte') : el.type === 'shape' ? (el.shapeType === 'rect' ? 'Rectangle' : el.shapeType === 'circle' ? 'Cercle' : 'Forme') : 'Image'}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }}
                                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 18, padding: 0, display: 'flex', alignItems: 'center' }}
                                        title="Supprimer"
                                        onMouseEnter={(e) => e.target.style.color = '#d93025'}
                                        onMouseLeave={(e) => e.target.style.color = '#ccc'}
                                    >×</button>
                                </div>
                            ))}
                            {(!currentSlide?.elements || currentSlide.elements.length === 0) && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
                                    Aucun élément sur ce slide
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div >
        </div >
    );
}
