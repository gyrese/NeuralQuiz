import { useState, useEffect } from 'react';
import { socket } from './socket';
import HostView from './components/Host/HostView';
import PlayerView from './components/Player/PlayerView';
import AdminView from './components/Admin/AdminView';
import GeoHostView from './components/Geo/GeoHostView';
import GeoPlayerView from './components/Geo/GeoPlayerView';
import GeoRemoteView from './components/Geo/GeoRemoteView';
import DrawHostView from './components/Draw/DrawHostView';
import DrawPlayerView from './components/Draw/DrawPlayerView';
import AperoHostView from './components/Apero/AperoHostView';
import AperoPlayerView from './components/Apero/AperoPlayerView';
import AperoAdmin from './components/Apero/AperoAdmin';


function App() {
  const [view, setView] = useState('HOME'); // HOME, GAME_SELECT, HOST, PLAYER, ADMIN, GEO_HOST, GEO_PLAYER, GEO_REMOTE, DRAW_HOST, DRAW_PLAYER, APERO_HOST, APERO_PLAYER, APERO_ADMIN
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [initialRoomCode, setInitialRoomCode] = useState(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Auto-redirect if ?code=XXXX is in URL (from QR Code scan)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('code');
    const mode = params.get('mode');
    const game = params.get('game');

    if (roomCode) {
      setInitialRoomCode(roomCode.toUpperCase());
      // Check which game type
      if (game === 'draw') {
        setView('DRAW_PLAYER');
      } else if (game === 'apero') {
        setView('APERO_PLAYER');
      } else if (mode === 'remote') {
        setView('GEO_REMOTE');
      } else {
        setView('GEO_PLAYER');
      }
      // Clean URL without reloading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  return (
    <div className="app">
      {!isConnected && (
        <div style={{ backgroundColor: 'red', color: 'white', textAlign: 'center', padding: '5px' }}>
          DÉCONNECTÉ DU SERVEUR
        </div>
      )}

      {/* HOME - Choix du mode */}
      {view === 'HOME' && (
        <div className="container text-center" style={{ marginTop: '5vh' }}>
          <h1 className="display-1 mb-3 fw-bold text-primary glitch-text" data-text="GAME_HUB" style={{ fontSize: '4rem' }}>
            GAME_HUB
          </h1>
          <p className="text-muted mb-5">Choisissez votre expérience de jeu</p>

          <div className="row justify-content-center g-4">
            {/* Quiz Card */}
            <div className="col-md-4">
              <div className="card game-card p-4 h-100" style={{ cursor: 'pointer' }} onClick={() => setView('QUIZ_SELECT')}>
                <div className="game-card-icon mb-3">🧠</div>
                <h3 className="text-primary mb-3">NEURAL_QUIZ</h3>
                <p className="text-muted mb-4">Test de QI interactif avec statistiques et classement en temps réel</p>
                <div className="game-features">
                  <span className="badge bg-dark me-2">Quiz</span>
                  <span className="badge bg-dark me-2">Multijoueur</span>
                  <span className="badge bg-dark">Score QI</span>
                </div>
              </div>
            </div>

            {/* GeoGuessr Card */}
            <div className="col-md-4">
              <div className="card game-card p-4 h-100" style={{ cursor: 'pointer' }} onClick={() => setView('GEO_SELECT')}>
                <div className="game-card-icon mb-3">🌍</div>
                <h3 className="text-info mb-3" style={{ fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>GEO_TRACKR</h3>
                <p className="text-muted mb-4">Explorez le monde en Street View et devinez votre position</p>
                <div className="game-features">
                  <span className="badge bg-dark me-2">Géographie</span>
                  <span className="badge bg-dark me-2">Street View</span>
                  <span className="badge bg-dark">Multijoueur</span>
                </div>
              </div>
            </div>

            {/* Draw Up Card (NEW) */}
            <div className="col-md-4">
              <div className="card game-card p-4 h-100" style={{ cursor: 'pointer', borderColor: 'rgba(255, 107, 107, 0.3)' }} onClick={() => setView('DRAW_SELECT')}>
                <div className="game-card-icon mb-3">🎨</div>
                <h3 className="mb-3" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>DRAW_UP</h3>
                <p className="text-muted mb-4">Dessine et fais deviner ! Clone de Pictionary en temps réel</p>
                <div className="game-features">
                  <span className="badge bg-dark me-2">Dessin</span>
                  <span className="badge bg-dark me-2">Temps Réel</span>
                  <span className="badge bg-dark">Multijoueur</span>
                </div>
              </div>
            </div>

            {/* Apéro Quiz Card (NEW) */}
            <div className="col-md-4">
              <div className="card game-card p-4 h-100" style={{ cursor: 'pointer', borderColor: 'rgba(255, 215, 0, 0.3)' }} onClick={() => setView('APERO_SELECT')}>
                <div className="game-card-icon mb-3">🍻</div>
                <h3 className="mb-3" style={{ color: '#ffd700', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>APÉRO_QUIZ</h3>
                <p className="text-muted mb-4">Quiz de bar interactif - Les équipes répondent sur leur téléphone</p>
                <div className="game-features">
                  <span className="badge bg-dark me-2">Quiz</span>
                  <span className="badge bg-dark me-2">Par Équipe</span>
                  <span className="badge bg-dark">Bar</span>
                </div>
              </div>
            </div>
          </div>

          <button className="btn btn-link text-muted mt-5" style={{ textDecoration: 'none', fontSize: '0.9rem' }} onClick={() => setView('ADMIN')}>
            // ACCÈS ADMINISTRATEUR
          </button>
        </div>
      )}

      {/* Quiz Selection */}
      {view === 'QUIZ_SELECT' && (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
          <button className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }} onClick={() => setView('HOME')}>
            ← RETOUR
          </button>
          <h1 className="display-2 mb-5 fw-bold text-primary glitch-text" data-text="NEURAL_QUIZ" style={{ fontSize: '4rem' }}>
            🧠 NEURAL_QUIZ
          </h1>
          <div className="d-grid gap-4 col-md-4 mx-auto">
            <button className="btn btn-primary btn-lg py-3" onClick={() => setView('HOST')}>
              INITIER LE PROTOCOLE (HÔTE)
            </button>
            <button className="btn btn-outline-light btn-lg py-3" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', boxShadow: '0 0 10px rgba(189, 0, 255, 0.3)' }} onClick={() => setView('PLAYER')}>
              REJOINDRE LA MATRICE
            </button>
          </div>
        </div>
      )}

      {/* Geo Selection */}
      {view === 'GEO_SELECT' && (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
          <button className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }} onClick={() => setView('HOME')}>
            ← RETOUR
          </button>
          <h1 className="display-2 mb-5 fw-bold text-info" style={{ fontFamily: 'var(--font-display)', letterSpacing: '5px', textShadow: '0 0 20px rgba(0, 219, 222, 0.5)' }}>
            🌍 GEO_TRACKR
          </h1>
          <div className="d-grid gap-4 col-md-4 mx-auto">
            <button className="btn btn-lg py-3" style={{ backgroundColor: 'transparent', border: '2px solid var(--neon-blue)', color: 'var(--neon-blue)', boxShadow: '0 0 10px rgba(0, 219, 222, 0.3)' }} onClick={() => setView('GEO_HOST')}>
              CRÉER UNE PARTIE (HÔTE)
            </button>
            <button className="btn btn-outline-light btn-lg py-3" style={{ borderColor: 'var(--neon-purple)', color: 'var(--neon-purple)', boxShadow: '0 0 10px rgba(189, 0, 255, 0.3)' }} onClick={() => setView('GEO_PLAYER')}>
              REJOINDRE UNE PARTIE
            </button>
          </div>
        </div>
      )}

      {/* Draw Up Selection (NEW) */}
      {view === 'DRAW_SELECT' && (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
          <button className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }} onClick={() => setView('HOME')}>
            ← RETOUR
          </button>
          <h1 className="display-2 mb-5 fw-bold" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontFamily: 'var(--font-display)', letterSpacing: '5px' }}>
            🎨 DRAW_UP
          </h1>
          <div className="d-grid gap-4 col-md-4 mx-auto">
            <button className="btn btn-lg py-3" style={{ background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)', border: 'none', color: 'white', boxShadow: '0 0 20px rgba(255, 107, 107, 0.4)' }} onClick={() => setView('DRAW_HOST')}>
              CRÉER UNE PARTIE (HÔTE)
            </button>
            <button className="btn btn-outline-light btn-lg py-3" style={{ borderColor: '#4ECDC4', color: '#4ECDC4', boxShadow: '0 0 10px rgba(78, 205, 196, 0.3)' }} onClick={() => setView('DRAW_PLAYER')}>
              REJOINDRE UNE PARTIE
            </button>
          </div>
        </div>
      )}

      {/* Apéro Quiz Selection (NEW) */}
      {view === 'APERO_SELECT' && (
        <div className="container text-center" style={{ marginTop: '15vh' }}>
          <button className="btn btn-outline-secondary position-absolute" style={{ top: '20px', left: '20px' }} onClick={() => setView('HOME')}>
            ← RETOUR
          </button>
          <h1 className="display-2 mb-5 fw-bold" style={{ color: '#ffd700', fontFamily: 'var(--font-display)', letterSpacing: '5px', textShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }}>
            🍻 APÉRO_QUIZ
          </h1>
          <p className="text-muted mb-5">Quiz de bar interactif - Les équipes répondent sur leur téléphone</p>
          <div className="d-grid gap-4 col-md-4 mx-auto">
            <button className="btn btn-lg py-3" style={{ background: 'linear-gradient(135deg, #f5af19, #f12711)', border: 'none', color: 'white', boxShadow: '0 0 20px rgba(245, 175, 25, 0.4)' }} onClick={() => setView('APERO_HOST')}>
              LANCER UN QUIZ (ÉCRAN BAR)
            </button>
            <button className="btn btn-outline-light btn-lg py-3" style={{ borderColor: '#ffd700', color: '#ffd700', boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }} onClick={() => setView('APERO_PLAYER')}>
              REJOINDRE (ÉQUIPE)
            </button>
            <button className="btn btn-outline-secondary btn-lg py-3 mt-3" onClick={() => setView('APERO_ADMIN')}>
              📝 Gérer les Quiz
            </button>
          </div>
        </div>
      )}

      {/* Views */}
      {view === 'HOST' && <HostView onBack={() => setView('QUIZ_SELECT')} />}
      {view === 'PLAYER' && <PlayerView onBack={() => setView('QUIZ_SELECT')} />}
      {view === 'ADMIN' && <AdminView onBack={() => setView('HOME')} />}
      {view === 'GEO_HOST' && <GeoHostView onBack={() => setView('GEO_SELECT')} />}
      {view === 'GEO_PLAYER' && <GeoPlayerView onBack={() => setView('GEO_SELECT')} initialRoomCode={initialRoomCode} />}
      {view === 'GEO_REMOTE' && <GeoRemoteView onBack={() => setView('GEO_SELECT')} initialRoomCode={initialRoomCode} />}
      {view === 'DRAW_HOST' && <DrawHostView onBack={() => setView('DRAW_SELECT')} />}
      {view === 'DRAW_PLAYER' && <DrawPlayerView onBack={() => setView('DRAW_SELECT')} initialRoomCode={initialRoomCode} />}
      {view === 'APERO_HOST' && <AperoHostView onBack={() => setView('APERO_SELECT')} />}
      {view === 'APERO_PLAYER' && <AperoPlayerView onBack={() => setView('APERO_SELECT')} initialRoomCode={initialRoomCode} />}
      {view === 'APERO_ADMIN' && <AperoAdmin onBack={() => setView('APERO_SELECT')} />}
    </div>
  );
}

export default App;

