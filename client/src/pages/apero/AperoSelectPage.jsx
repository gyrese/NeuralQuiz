import { Link } from 'react-router-dom';

function AperoSelectPage() {
    return (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
            <Link to="/" className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }}>
                ← RETOUR
            </Link>
            <h1 className="display-2 mb-5 fw-bold" style={{ color: '#ffd700', fontFamily: 'var(--font-display)', letterSpacing: '5px', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
                🍻 APÉRO_QUIZ
            </h1>
            <p className="text-muted mb-5">Quiz de bar interactif - Les équipes répondent sur leur téléphone</p>
            <div className="d-grid gap-4 col-md-4 mx-auto">
                <Link to="/apero/host" className="btn btn-lg py-3" style={{ background: 'linear-gradient(135deg, #f5af19, #f12711)', border: 'none', color: 'white', boxShadow: '0 0 20px rgba(245, 175, 25, 0.4)' }}>
                    LANCER UN QUIZ (ÉCRAN BAR)
                </Link>
                <Link to="/apero/play" className="btn btn-outline-light btn-lg py-3" style={{ borderColor: '#ffd700', color: '#ffd700', boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
                    REJOINDRE (ÉQUIPE)
                </Link>
                <Link to="/apero/admin" className="btn btn-outline-secondary btn-lg py-3 mt-3">
                    📝 Gérer les Quiz
                </Link>
            </div>
        </div>
    );
}

export default AperoSelectPage;
