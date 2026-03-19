import { motion } from 'framer-motion';
import { useEffect } from 'react';
import confetti from 'canvas-confetti';

const HostSlidePodium = ({ leaderboard }) => {
    useEffect(() => {
        // Fireworks
        const duration = 15 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);

        return () => clearInterval(interval);
    }, []);

    const top3 = leaderboard.slice(0, 3);
    // [2nd, 1st, 3rd] for visual arrangement
    const displayOrder = [];
    if (top3[1]) displayOrder.push({ ...top3[1], rank: 2 });
    if (top3[0]) displayOrder.push({ ...top3[0], rank: 1 });
    if (top3[2]) displayOrder.push({ ...top3[2], rank: 3 });

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: '50px',
            color: 'white'
        }}>
            <h1 style={{
                position: 'absolute',
                top: '50px',
                fontSize: '4rem',
                fontWeight: 'bold',
                textShadow: '0 0 20px rgba(255,215,0,0.8)'
            }}>
                PODIUM
            </h1>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                {displayOrder.map((team) => (
                    <motion.div
                        key={team.teamName}
                        initial={{ height: 0 }}
                        animate={{ height: team.rank === 1 ? '500px' : team.rank === 2 ? '350px' : '200px' }}
                        transition={{ delay: team.rank === 1 ? 2 : team.rank === 2 ? 1 : 1.5, type: 'spring' }}
                        style={{
                            width: '200px',
                            background: team.rank === 1 ? 'linear-gradient(to top, #ffd700, #fffacD)' : team.rank === 2 ? 'linear-gradient(to top, #c0c0c0, #f5f5f5)' : 'linear-gradient(to top, #cd7f32, #ffdab9)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            paddingBottom: '20px',
                            borderTopLeftRadius: '20px',
                            borderTopRightRadius: '20px',
                            color: '#333',
                            position: 'relative'
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '-80px',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '2rem',
                            textAlign: 'center',
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}>
                            <div style={{ fontSize: '3rem', display: 'flex', justifyContent: 'center' }}>
                                {team.avatar && team.avatar.startsWith('http') ? (
                                    <img src={team.avatar} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #fff', objectFit: 'cover' }} />
                                ) : (
                                    team.avatar
                                )}
                            </div>
                            {team.teamName}
                        </div>
                        <div style={{ fontSize: '4rem', fontWeight: 'bold', opacity: 0.5 }}>
                            {team.rank}
                        </div>
                        <div style={{ fontWeight: 'bold', fontSize: '1.5rem' }}>
                            {team.totalScore} pts
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default HostSlidePodium;
