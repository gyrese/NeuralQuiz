import { Link } from 'react-router-dom';

function HomePage() {
    return (
        <div className="container text-center" style={{ marginTop: '5vh' }}>
            <h1 className="display-1 mb-3 fw-bold text-primary glitch-text" data-text="GAME_HUB" style={{ fontSize: '4rem' }}>
                GAME_HUB
            </h1>
            <p className="text-muted mb-5">Choisissez votre expérience de jeu</p>

            <div className="row justify-content-center g-4">
                {/* Quiz Card */}
                <div className="col-md-3">
                    <Link to="/quiz" className="text-decoration-none">
                        <div className="card game-card p-4 h-100" style={{ cursor: 'pointer' }}>
                            <div className="game-card-icon mb-3">🧠</div>
                            <h3 className="text-primary mb-3">NEURAL_QUIZ</h3>
                            <p className="text-muted mb-4">Test de QI interactif avec statistiques et classement en temps réel</p>
                            <div className="game-features">
                                <span className="badge bg-dark me-2">Quiz</span>
                                <span className="badge bg-dark me-2">Multijoueur</span>
                                <span className="badge bg-dark">Score QI</span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* GeoGuessr Card */}
                <div className="col-md-3">
                    <Link to="/geo" className="text-decoration-none">
                        <div className="card game-card p-4 h-100" style={{ cursor: 'pointer' }}>
                            <div className="game-card-icon mb-3">🌍</div>
                            <h3 className="text-info mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>GEO_TRACKR</h3>
                            <p className="text-muted mb-4">Explorez le monde en Street View et devinez votre position</p>
                            <div className="game-features">
                                <span className="badge bg-dark me-2">Géographie</span>
                                <span className="badge bg-dark me-2">Street View</span>
                                <span className="badge bg-dark">Multijoueur</span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Draw Up Card */}
                <div className="col-md-3">
                    <Link to="/draw" className="text-decoration-none">
                        <div className="card game-card p-4 h-100" style={{ cursor: 'pointer', borderColor: 'rgba(255, 107, 107, 0.3)' }}>
                            <div className="game-card-icon mb-3">🎨</div>
                            <h3 className="mb-3" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>DRAW_UP</h3>
                            <p className="text-muted mb-4">Dessine et fais deviner ! Clone de Pictionary en temps réel</p>
                            <div className="game-features">
                                <span className="badge bg-dark me-2">Dessin</span>
                                <span className="badge bg-dark me-2">Temps Réel</span>
                                <span className="badge bg-dark">Multijoueur</span>
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Apéro Quiz Card */}
                <div className="col-md-3">
                    <Link to="/apero" className="text-decoration-none">
                        <div className="card game-card p-4 h-100" style={{ cursor: 'pointer', borderColor: 'rgba(255, 215, 0, 0.3)' }}>
                            <div className="game-card-icon mb-3">🍻</div>
                            <h3 className="mb-3" style={{ color: '#ffd700', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>APÉRO_QUIZ</h3>
                            <p className="text-muted mb-4">Quiz de bar interactif - Les équipes répondent sur leur téléphone</p>
                            <div className="game-features">
                                <span className="badge bg-dark me-2">Quiz</span>
                                <span className="badge bg-dark me-2">Par Équipe</span>
                                <span className="badge bg-dark">Bar</span>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            <Link to="/admin" className="btn btn-link text-muted mt-5" style={{ textDecoration: 'none', fontSize: '0.9rem' }}>
                // ACCÈS ADMINISTRATEUR
            </Link>
        </div>
    );
}

export default HomePage;
