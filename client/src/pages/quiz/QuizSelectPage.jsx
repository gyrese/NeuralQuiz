import { Link } from 'react-router-dom';

function QuizSelectPage() {
    return (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
            <Link to="/" className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }}>
                ← RETOUR
            </Link>
            <h1 className="display-2 mb-5 fw-bold text-primary glitch-text" data-text="NEURAL_QUIZ" style={{ fontSize: '4rem' }}>
                🧠 NEURAL_QUIZ
            </h1>
            <div className="d-grid gap-4 col-md-4 mx-auto">
                <Link to="/quiz/host" className="btn btn-primary btn-lg py-3">
                    INITIER LE PROTOCOLE (HÔTE)
                </Link>
                <Link to="/quiz/play" className="btn btn-outline-light btn-lg py-3" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', boxShadow: '0 0 10px rgba(189, 0, 255, 0.3)' }}>
                    REJOINDRE LA MATRICE
                </Link>
            </div>
        </div>
    );
}

export default QuizSelectPage;
