import { Link } from 'react-router-dom';

function GeoSelectPage() {
    return (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
            <Link to="/" className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }}>
                ← RETOUR
            </Link>
            <h1 className="display-2 mb-5 fw-bold text-info" style={{ fontFamily: 'var(--font-display)', letterSpacing: '5px', textShadow: '0 0 20px rgba(0, 219, 222, 0.5)' }}>
                🌍 GEO_TRACKR
            </h1>
            <div className="d-grid gap-4 col-md-4 mx-auto">
                <Link to="/geo/host" className="btn btn-lg py-3" style={{ backgroundColor: 'transparent', border: '2px solid var(--neon-blue)', color: 'var(--neon-blue)', boxShadow: '0 0 10px rgba(0, 219, 222, 0.3)' }}>
                    CRÉER UNE PARTIE (HÔTE)
                </Link>
                <Link to="/geo/play" className="btn btn-outline-light btn-lg py-3" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', boxShadow: '0 0 10px rgba(189, 0, 255, 0.3)' }}>
                    REJOINDRE UNE PARTIE
                </Link>
            </div>
        </div>
    );
}

export default GeoSelectPage;
