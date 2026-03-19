import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

const HostLobby = ({ roomCode, teams, onStart, quizTitle, onBack }) => {
    const joinUrl = `${window.location.protocol}//${window.location.host}/apero/play/${roomCode}`;

    return (
        <div style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'url(/assets/images/lobby_bg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
            fontFamily: "'Segoe UI', 'Roboto', 'Helvetica', sans-serif"
        }}>
            {/* Dark Overlay for readability */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(10, 5, 20, 0.85)', backdropFilter: 'blur(3px)' }}></div>

            {/* Geek Grid Overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(255, 0, 0, 0.02), rgba(255, 0, 0, 0.06))',
                backgroundSize: '100% 2px, 3px 100%',
                pointerEvents: 'none',
                opacity: 0.3
            }}></div>

            <div style={{
                position: 'relative',
                zIndex: 10,
                display: 'flex',
                gap: '80px',
                maxWidth: '1400px',
                width: '90%',
                alignItems: 'center',
                padding: '40px'
            }}>

                {/* LEFT: QR CODE CARD */}
                <motion.div
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '40px',
                        borderRadius: '30px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div style={{ background: 'white', padding: '15px', borderRadius: '15px', boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
                        <QRCodeSVG value={joinUrl} size={320} />
                    </div>
                    <div style={{
                        marginTop: '30px',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#4db5ff',
                        textTransform: 'uppercase',
                        letterSpacing: '2px',
                        textAlign: 'center'
                    }}>
                        Scanner pour rejoindre
                    </div>
                </motion.div>

                {/* RIGHT: INFO + PLAYERS */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                    >
                        <h3 style={{ fontSize: '1.8rem', color: '#ff71ce', textTransform: 'uppercase', marginBottom: '0', letterSpacing: '4px' }}>Code de la salle</h3>
                        <h1 style={{
                            fontSize: '9rem',
                            fontWeight: 900,
                            lineHeight: 1,
                            marginBottom: '20px',
                            background: 'linear-gradient(to right, #00c6ff, #0072ff)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            filter: 'drop-shadow(0 0 20px rgba(0,114,255,0.5))',
                            fontFamily: 'monospace'
                        }}>
                            {roomCode}
                        </h1>

                        <h2 style={{ fontSize: '2.5rem', marginBottom: '40px', fontWeight: 300 }}>
                            <span style={{ color: '#ffd700', textShadow: '0 0 10px #ffd700' }}>★</span> {quizTitle || 'Quiz à l\'apéro'}
                        </h2>
                    </motion.div>

                    {/* PLAYERS GRID */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '20px',
                        fontSize: '1.5rem',
                        fontWeight: '600',
                        color: '#fff',
                        borderBottom: '1px solid rgba(255,255,255,0.2)',
                        paddingBottom: '10px'
                    }}>
                        <span>👥 {teams.length} Joueurs prêts</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '15px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        paddingRight: '10px',
                        marginBottom: '30px'
                    }}>
                        {teams.map((team, idx) => (
                            <motion.div
                                key={team.id || idx}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                style={{
                                    background: `linear-gradient(135deg, hsl(${idx * 45}, 80%, 60%), hsl(${idx * 45}, 80%, 40%))`,
                                    padding: '10px 25px',
                                    borderRadius: '50px',
                                    fontWeight: 'bold',
                                    fontSize: '1.2rem',
                                    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    border: '2px solid rgba(255,255,255,0.2)'
                                }}
                            >
                                {team.avatar && team.avatar.startsWith('http') ? (
                                    <img src={team.avatar} alt="Avatar" style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover' }} />
                                ) : (
                                    <span style={{ fontSize: '1.5rem' }}>{team.avatar || '👾'}</span>
                                )}
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                    {team.name}
                                </span>
                            </motion.div>
                        ))}
                        {teams.length === 0 && (
                            <div style={{ fontStyle: 'italic', opacity: 0.5 }}>En attente de connexion...</div>
                        )}
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(56, 239, 125, 0.6)' }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                            console.log('Start Clicked');
                            onStart();
                        }}
                        style={{
                            background: 'linear-gradient(90deg, #11998e, #38ef7d)',
                            color: 'white',
                            border: 'none',
                            padding: '20px 60px',
                            fontSize: '2rem',
                            fontWeight: '900',
                            borderRadius: '100px',
                            cursor: 'pointer',
                            boxShadow: '0 0 30px rgba(56, 239, 125, 0.4)',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            alignSelf: 'flex-start'
                        }}
                    >
                        Lancer la Partie 🚀
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

export default HostLobby;
