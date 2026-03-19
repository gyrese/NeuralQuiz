import { motion } from 'framer-motion';

const HostSlideLeaderboard = ({ leaderboard }) => {
    // Sort just in case, though backend usually handles it
    const top5 = leaderboard.slice(0, 5);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px',
            color: 'white'
        }}>
            <motion.h1
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                style={{
                    fontSize: '4rem',
                    fontWeight: 'bold',
                    marginBottom: '40px',
                    textTransform: 'uppercase',
                    letterSpacing: '5px'
                }}
            >
                🏆 Classement
            </motion.h1>

            <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {top5.map((team, index) => (
                    <motion.div
                        key={team.teamName || team.name} // Handle both props
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.1 }}
                        style={{
                            background: index === 0 ? 'linear-gradient(90deg, #ffd700, #ffb347)' : 'rgba(255,255,255,0.9)',
                            color: '#333',
                            padding: '20px 40px',
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '2rem',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                            transform: index === 0 ? 'scale(1.05)' : 'scale(1)',
                            border: index === 0 ? '4px solid #fff' : 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <span style={{
                                width: '50px',
                                textAlign: 'center',
                                color: index === 0 ? '#fff' : '#666',
                                textShadow: index === 0 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {index + 1}
                            </span>
                            {team.avatar && team.avatar.startsWith('http') ? (
                                <img src={team.avatar} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover', marginRight: 10 }} />
                            ) : (
                                <span style={{ fontSize: '1.5rem', marginRight: 10 }}>{team.avatar}</span>
                            )}
                            <span>{team.teamName || team.name}</span>
                        </div>
                        <div>
                            {team.totalScore} <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>pts</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default HostSlideLeaderboard;
