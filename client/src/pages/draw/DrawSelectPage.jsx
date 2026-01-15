import { Link } from 'react-router-dom';

function DrawSelectPage() {
    return (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
            <Link to="/" className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }}>
                ← RETOUR
            </Link>
            <h1 className="display-2 mb-5 fw-bold" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)', letterSpacing: '5px' }}>
                🎨 DRAW_UP
            </h1>
            <div className="d-grid gap-4 col-md-4 mx-auto">
                <Link to="/draw/host" className="btn btn-lg py-3" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', border: 'none', color: 'white', boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)' }}>
                    CRÉER UNE PARTIE (HÔTE)
                </Link>
                <Link to="/draw/play" className="btn btn-outline-light btn-lg py-3" style={{ borderColor: '#4ECDC4', color: '#4ECDC4', boxShadow: '0 0 10px rgba(78, 205, 196, 0.3)' }}>
                    REJOINDRE UNE PARTIE
                </Link>
            </div>
        </div>
    );
}

export default DrawSelectPage;
