import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { socket } from './socket';

// Pages
import HomePage from './pages/HomePage';
import JoinPage from './pages/JoinPage';

// Quiz
import QuizSelectPage from './pages/quiz/QuizSelectPage';
import HostView from './components/Host/HostView';
import PlayerView from './components/Player/PlayerView';

// Geo
import GeoSelectPage from './pages/geo/GeoSelectPage';
import GeoHostView from './components/Geo/GeoHostView';
import GeoPlayerView from './components/Geo/GeoPlayerView';
import GeoRemoteView from './components/Geo/GeoRemoteView';

// Draw
import DrawSelectPage from './pages/draw/DrawSelectPage';
import DrawHostView from './components/Draw/DrawHostView';
import DrawPlayerView from './components/Draw/DrawPlayerView';

// Apéro
import AperoSelectPage from './pages/apero/AperoSelectPage';
import AperoHostView from './components/Apero/AperoHostView';
import AperoPlayerView from './components/Apero/AperoPlayerView';
import AperoAdmin from './components/Apero/AperoAdmin';

// Admin
import AdminView from './components/Admin/AdminView';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

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

  return (
    <BrowserRouter>
      <div className="app">
        {/* {!isConnected && (
          <div style={{ backgroundColor: 'red', color: 'white', textAlign: 'center', padding: '5px' }}>
            DÉCONNECTÉ DU SERVEUR
          </div>
        )} */}

        <Routes>
          {/* Home */}
          <Route path="/" element={<HomePage />} />

          {/* Join - Universal join page */}
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:roomCode" element={<JoinPage />} />

          {/* Neural Quiz */}
          <Route path="/quiz" element={<QuizSelectPage />} />
          <Route path="/quiz/host" element={<HostView />} />
          <Route path="/quiz/play" element={<PlayerView />} />
          <Route path="/quiz/play/:roomCode" element={<PlayerView />} />

          {/* GeoTrackr */}
          <Route path="/geo" element={<GeoSelectPage />} />
          <Route path="/geo/host" element={<GeoHostView />} />
          <Route path="/geo/play" element={<GeoPlayerView />} />
          <Route path="/geo/play/:roomCode" element={<GeoPlayerView />} />
          <Route path="/geo/remote" element={<GeoRemoteView />} />
          <Route path="/geo/remote/:roomCode" element={<GeoRemoteView />} />

          {/* Draw Up */}
          <Route path="/draw" element={<DrawSelectPage />} />
          <Route path="/draw/host" element={<DrawHostView />} />
          <Route path="/draw/play" element={<DrawPlayerView />} />
          <Route path="/draw/play/:roomCode" element={<DrawPlayerView />} />

          {/* Apéro Quiz */}
          <Route path="/apero" element={<AperoSelectPage />} />
          <Route path="/apero/host" element={<AperoHostView />} />
          <Route path="/apero/play" element={<AperoPlayerView />} />
          <Route path="/apero/play/:roomCode" element={<AperoPlayerView />} />
          <Route path="/apero/admin" element={<AperoAdmin />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminView />} />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
