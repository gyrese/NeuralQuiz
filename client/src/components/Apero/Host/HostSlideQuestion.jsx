import { motion, AnimatePresence } from 'framer-motion';
import './HostSlideQuestion.css';

// Kahoot-like colors & shapes
const OPTION_THEMES = {
    0: { color: '#e21b3c', shape: '▲' }, // Red
    1: { color: '#1368ce', shape: '◆' }, // Blue
    2: { color: '#d89e00', shape: '●' }, // Yellow
    3: { color: '#26890c', shape: '■' }  // Green
};

// --- DATA NORMALIZATION (Handle schema mismatch between Server Defaults and Editor) ---
// The Editor uses 'slideType', 'question', 'answers', 'sliderMin' etc.
// The Server template uses 'questionType', 'questionText', 'options', 'min' etc.
// We normalize everything here to avoid issues.

const HostSlideQuestion = ({ slide, state, timer, totalTimer, answeredCount, isReveal, stats }) => {

    const type = slide.slideType || slide.questionType;
    const isQCM = type === 'qcm';
    const isEstimation = type === 'slider' || type === 'estimation';

    const questionText = slide.question || slide.questionText || 'Question ?';

    // Normalizing Options (QCM)
    // Editor: [{ id: 'a', text: '...' }, ...]
    // Server: [{ label: 'A', text: '...' }, ...]
    const rawOptions = slide.answers || slide.options || [];
    const options = rawOptions.map((opt, i) => ({
        label: opt.id ? opt.id.toUpperCase() : (opt.label || ['A', 'B', 'C', 'D'][i]),
        text: opt.text || '',
        isCorrect: opt.correct || opt.isCorrect || false
    }));

    const correctLabel = options.find(o => o.isCorrect)?.label || slide.correctAnswer; // For QCM revealing

    // Normalizing Estimation
    const minVal = slide.sliderMin ?? slide.min ?? 0;
    const maxVal = slide.sliderMax ?? slide.max ?? 100;
    const correctVal = parseFloat(slide.sliderCorrect ?? slide.correctAnswer ?? 0);

    // Calculate percentage position for cursor
    const range = maxVal - minVal || 1; // avoid div by zero
    const rawPercent = ((correctVal - minVal) / range) * 100;
    const cursorPercent = Math.min(Math.max(rawPercent, 0), 100);

    // Image Handling
    const mediaUrl = slide.qcmMedia || slide.elements?.find(el => el.type === 'image')?.url;

    return (
        <div className="host-slide-question">
            {/* --- HEADER: QUESTION --- */}
            <div className="question-header">
                <motion.div
                    initial={{ y: -50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="question-text-box"
                >
                    {questionText}
                </motion.div>
            </div>

            {/* --- MAIN CONTENT: MEDIA + TIMER --- */}
            <div className="question-content">
                <div className="media-container">
                    {/* Placeholder or Slide Image */}
                    {mediaUrl ? (
                        <img
                            src={mediaUrl}
                            alt="Question Media"
                            className="question-image"
                        />
                    ) : (
                        <div className="media-placeholder">
                            <span className="placeholder-icon">📷</span>
                        </div>
                    )}

                    {/* TIMER & COUNTER */}
                    {state === 'active' && (
                        <>
                            <div className="timer-circle">
                                <svg viewBox="0 0 100 100">
                                    <circle cx="50" cy="50" r="45" className="timer-bg" />
                                    <circle
                                        cx="50" cy="50" r="45"
                                        className="timer-progress"
                                        strokeDasharray="283"
                                        strokeDashoffset={283 - (283 * (timer / (totalTimer || 20)))}
                                        style={{ stroke: timer <= 5 ? '#ff0000' : '#fff' }}
                                    />
                                </svg>
                                <span className="timer-number">{timer}</span>
                            </div>

                            <div className="answer-counter">
                                <span className="counter-val">{answeredCount}</span>
                                <span className="counter-label">Réponses</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* --- FOOTER: QCM OPTIONS --- */}
            {isQCM && (
                <div className="options-grid">
                    {options.map((opt, idx) => {
                        const theme = OPTION_THEMES[idx % 4];
                        const isCorrect = opt.label === correctLabel || opt.isCorrect;
                        // Determine if we should count this option (stats might use label 'A' or id 'a')
                        // We standardize on stats keys being uppercase or matching label
                        const statKey = opt.label;
                        const statCount = stats ? (stats[statKey] || stats[statKey.toLowerCase()] || 0) : 0;

                        // Reveal State Visuals
                        const opacity = isReveal && !isCorrect ? 0.3 : 1;
                        const scale = isReveal && isCorrect ? 1.05 : 1;

                        return (
                            <motion.div
                                key={idx}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: opacity, scale }}
                                transition={{ delay: idx * 0.1 }}
                                className="option-card"
                                style={{ backgroundColor: theme.color }}
                            >
                                <div className="option-shape">{theme.shape}</div>
                                <div className="option-text">{opt.text}</div>

                                {isReveal && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        className="option-stat"
                                    >
                                        {isCorrect && <span className="check-mark">✓</span>}
                                        {!isCorrect && <span className="cross-mark">✗</span>}
                                        <span className="stat-number">{statCount}</span>
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* --- FOOTER: ESTIMATION SLIDER --- */}
            {isEstimation && (
                <div className="estimation-footer">
                    <div className="slider-container">
                        {/* Track / Scale */}
                        <div className="slider-track">
                            {/* Graduation marks roughly every 10% */}
                            {[...Array(11)].map((_, i) => (
                                <div
                                    key={i}
                                    className="slider-tick"
                                    style={{ left: `${i * 10}%`, height: i % 5 === 0 ? '20px' : '10px' }}
                                />
                            ))}
                        </div>

                        {/* Labels Min/Max */}
                        <div className="slider-label label-min">{minVal}</div>
                        <div className="slider-label label-max">{maxVal}</div>

                        {/* Cursor - animated on Reveal */}
                        {isReveal && (
                            <motion.div
                                className="slider-cursor"
                                initial={{ left: '0%' }}
                                animate={{
                                    left: [
                                        '0%',
                                        `${cursorPercent - 5}%`, // overshoot left
                                        `${cursorPercent + 3}%`, // overshoot right
                                        `${cursorPercent}%`      // settle
                                    ]
                                }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            >
                                <div className="cursor-pin"></div>
                                <div className="cursor-bubble">{correctVal}</div>
                            </motion.div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HostSlideQuestion;
