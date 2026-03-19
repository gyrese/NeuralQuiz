import { motion } from 'framer-motion';

const HostQuizSelector = ({ quizzes, onSelect, onBack }) => {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0f', padding: '40px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ color: 'white', fontWeight: 'bold' }}>🍻 Apéro Quiz <span style={{ color: '#fbbf24' }}>Live</span></h1>
                    <p style={{ color: '#9ca3af', fontSize: '1.2rem' }}>Choisissez un quiz à lancer</p>
                </div>
                <button
                    onClick={onBack}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.3)',
                        color: 'white',
                        padding: '10px 20px',
                        borderRadius: '20px',
                        cursor: 'pointer'
                    }}
                >
                    ← Retour
                </button>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '30px'
            }}>
                {quizzes.map(quiz => (
                    <motion.div
                        key={quiz.id}
                        whileHover={{ y: -10, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                        onClick={() => onSelect(quiz.id)}
                        style={{
                            background: '#1f2937',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            transition: 'all 0.3s'
                        }}
                    >
                        {/* Thumbnail */}
                        <div style={{ height: '200px', background: '#374151', position: 'relative' }}>
                            {quiz.slides?.[0]?.background?.type === 'image' ? (
                                <img
                                    src={quiz.slides[0].background.value}
                                    alt=""
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{
                                    width: '100%', height: '100%',
                                    background: quiz.slides?.[0]?.background?.value || '#1a1a2e',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '2rem'
                                }}>
                                    🍻
                                </div>
                            )}
                            <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px 10px', borderRadius: '10px', fontSize: '0.9rem' }}>
                                {quiz.questions?.length || quiz.slides?.length} slides
                            </div>
                        </div>

                        {/* Content */}
                        <div style={{ padding: '20px', color: 'white' }}>
                            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.5rem' }}>{quiz.title}</h3>
                            <button style={{
                                background: '#3b82f6',
                                border: 'none',
                                color: 'white',
                                width: '100%',
                                padding: '10px',
                                borderRadius: '10px',
                                fontWeight: 'bold',
                                marginTop: '10px',
                                cursor: 'pointer'
                            }}>
                                LANCER
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default HostQuizSelector;
