import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';

const GAMES = [
    {
        id: 'quiz',
        route: '/quiz',
        name: 'NEURAL_QUIZ',
        description: 'Test de QI interactif avec statistiques et classement en temps réel',
        tags: ['Quiz', 'Multijoueur', 'Score QI'],
        color: '#00ff41',
        colorRgb: '0, 255, 65',
        icon: (
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M24 4C17 4 11 9 10 16C7 17 5 20 5 23C5 27 8 30 12 30L12 36C12 38 14 40 16 40L32 40C34 40 36 38 36 36L36 30C40 30 43 27 43 23C43 20 41 17 38 16C37 9 31 4 24 4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M17 30L17 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M24 30L24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M31 30L31 26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M15 20C15 20 17 22 20 20C23 18 25 22 28 20C31 18 33 20 33 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="18" cy="14" r="1.5" fill="currentColor"/>
                <circle cx="30" cy="14" r="1.5" fill="currentColor"/>
            </svg>
        ),
    },
    {
        id: 'geo',
        route: '/geo',
        name: 'GEO_TRACKR',
        description: 'Explorez le monde en Street View et devinez votre position',
        tags: ['Géographie', 'Street View', 'Multijoueur'],
        color: '#00dbde',
        colorRgb: '0, 219, 222',
        icon: (
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2"/>
                <ellipse cx="24" cy="24" rx="8" ry="18" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 24L42 24" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 16L40 16" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2"/>
                <path d="M8 32L40 32" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2"/>
                <circle cx="24" cy="12" r="3" fill="currentColor"/>
                <path d="M24 9L24 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        ),
    },
    {
        id: 'draw',
        route: '/draw',
        name: 'DRAW_UP',
        description: 'Dessine et fais deviner ! Clone de Pictionary en temps réel',
        tags: ['Dessin', 'Temps Réel', 'Multijoueur'],
        color: '#ff6b9d',
        colorRgb: '255, 107, 157',
        icon: (
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M34 6L42 14L18 38L8 40L10 30L34 6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M28 12L36 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M10 30L18 38" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="14" cy="38" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
                <path d="M18 42C20 43 23 43 24 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        ),
    },
    {
        id: 'apero',
        href: 'https://ltnhout.ltn.re',
        name: 'APÉRO_QUIZ',
        description: 'Quiz de bar interactif — Les équipes répondent sur leur téléphone',
        tags: ['Quiz', 'Par Équipe', 'Bar'],
        color: '#ffd700',
        colorRgb: '255, 215, 0',
        icon: (
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M14 8L18 38L30 38L34 8L14 8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M14 8C14 8 10 14 10 20C10 26 14 28 14 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M18 38L30 38L30 42L18 42L18 38Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M14 42L34 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M20 20C20 20 22 23 24 20C26 17 28 20 28 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M18 14L30 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 2"/>
            </svg>
        ),
    },
    {
        id: 'color',
        route: '/color',
        name: 'COULEUR_MOI',
        description: 'Clone de Toon Tone : devinez la couleur exacte de personnages célèbres',
        tags: ['Couleurs', 'Mémoire', 'Multijoueur'],
        color: '#ffc107',
        colorRgb: '255, 193, 7',
        icon: (
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 36C6 34 4 28 4 22C4 12 12 4 24 4C36 4 44 12 44 22C44 28 42 34 36 36L30 38C28 39 26 41 26 43C26 44 25 45 24 45C23 45 22 44 22 43C22 41 20 39 18 38L12 36Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <circle cx="14" cy="16" r="3" fill="currentColor"/>
                <circle cx="20" cy="11" r="3" fill="currentColor"/>
                <circle cx="28" cy="11" r="3" fill="currentColor"/>
                <circle cx="34" cy="16" r="3" fill="currentColor"/>
                <circle cx="37" cy="24" r="3" fill="currentColor"/>
                <path d="M22 28C22 28 23 25 24 25C25 25 26 28 26 28 L28 32 L20 32 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor"/>
            </svg>
        ),
    },
];

function GameCard({ game, index }) {
    const Wrapper = game.href
        ? ({ children, ...props }) => <a href={game.href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
        : ({ children, ...props }) => <Link to={game.route} {...props}>{children}</Link>;

    return (
        <Wrapper
            className="group relative block focus:outline-none"
            aria-label={`Jouer à ${game.name}`}
            style={{ '--card-color': game.color, '--card-rgb': game.colorRgb }}
        >
            {/* Outer glow on hover */}
            <div
                className="absolute -inset-px rounded-lg opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300"
                style={{ background: `linear-gradient(135deg, ${game.color}40, transparent 60%)`, boxShadow: `0 0 20px ${game.color}30` }}
            />

            {/* Card */}
            <div
                className="relative flex flex-col h-full rounded-lg border bg-[#0a0a0f] p-6 cursor-pointer transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-focus-visible:ring-2"
                style={{
                    borderColor: `${game.color}30`,
                    '--tw-ring-color': game.color,
                    transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                {/* Scanline overlay */}
                <div className="pointer-events-none absolute inset-0 rounded-lg opacity-[0.03] overflow-hidden" aria-hidden="true"
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)' }} />

                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden rounded-tr-lg">
                    <div className="absolute top-0 right-0 w-full h-[2px] transition-all duration-300 group-hover:opacity-100 opacity-40"
                        style={{ background: game.color }} />
                    <div className="absolute top-0 right-0 h-full w-[2px] transition-all duration-300 group-hover:opacity-100 opacity-40"
                        style={{ background: game.color }} />
                </div>
                <div className="absolute bottom-0 left-0 w-12 h-12 overflow-hidden rounded-bl-lg">
                    <div className="absolute bottom-0 left-0 w-full h-[2px] transition-all duration-300 group-hover:opacity-100 opacity-40"
                        style={{ background: game.color }} />
                    <div className="absolute bottom-0 left-0 h-full w-[2px] transition-all duration-300 group-hover:opacity-100 opacity-40"
                        style={{ background: game.color }} />
                </div>

                {/* Icon */}
                <div
                    className="mb-5 w-14 h-14 flex items-center justify-center rounded-md transition-all duration-300 group-hover:scale-110"
                    style={{
                        color: game.color,
                        background: `${game.color}12`,
                        boxShadow: `0 0 0 1px ${game.color}20`,
                        filter: 'drop-shadow(0 0 8px currentColor)',
                    }}
                >
                    <span style={{ color: game.color, width: 32, height: 32, display: 'flex', filter: `drop-shadow(0 0 6px ${game.color})` }}>
                        {game.icon}
                    </span>
                </div>

                {/* Game name */}
                <h2
                    className="font-bold mb-3 tracking-widest text-sm uppercase transition-all duration-300"
                    style={{
                        fontFamily: "'Orbitron', monospace",
                        color: game.color,
                        textShadow: `0 0 12px ${game.color}80`,
                    }}
                >
                    {game.name}
                </h2>

                {/* Description */}
                <p className="text-[#8892a4] text-sm leading-relaxed mb-5 flex-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {game.description}
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-auto">
                    {game.tags.map(tag => (
                        <span
                            key={tag}
                            className="text-xs px-2.5 py-1 rounded tracking-wider uppercase"
                            style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                color: `${game.color}cc`,
                                background: `${game.color}10`,
                                border: `1px solid ${game.color}25`,
                                fontSize: '10px',
                            }}
                        >
                            {tag}
                        </span>
                    ))}
                </div>

                {/* Play arrow — appears on hover */}
                <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke={game.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            </div>
        </Wrapper>
    );
}

function HomePage() {
    const titleRef = useRef(null);

    useEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) return;

        let frame;
        let triggered = false;
        const triggerGlitch = () => {
            if (triggered) return;
            triggered = true;
            el.classList.add('glitch-active');
            setTimeout(() => { el.classList.remove('glitch-active'); triggered = false; }, 600);
        };

        const interval = setInterval(triggerGlitch, 4000);
        return () => { clearInterval(interval); cancelAnimationFrame(frame); };
    }, []);

    return (
        <>
            <style>{`
                @keyframes scanline {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100vh); }
                }
                @keyframes flicker {
                    0%, 95%, 100% { opacity: 1; }
                    96% { opacity: 0.85; }
                    97% { opacity: 1; }
                    98% { opacity: 0.9; }
                }
                @keyframes glitch-1 {
                    0% { clip-path: inset(0 0 95% 0); transform: translate(-3px, 0); }
                    20% { clip-path: inset(30% 0 50% 0); transform: translate(3px, 0); }
                    40% { clip-path: inset(60% 0 20% 0); transform: translate(-2px, 0); }
                    60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, 0); }
                    80% { clip-path: inset(10% 0 75% 0); transform: translate(-1px, 0); }
                    100% { clip-path: inset(95% 0 0 0); transform: translate(0, 0); }
                }
                @keyframes glitch-2 {
                    0% { clip-path: inset(80% 0 5% 0); transform: translate(3px, 0); }
                    25% { clip-path: inset(10% 0 75% 0); transform: translate(-3px, 0); }
                    50% { clip-path: inset(50% 0 30% 0); transform: translate(2px, 0); }
                    75% { clip-path: inset(25% 0 60% 0); transform: translate(-1px, 0); }
                    100% { clip-path: inset(5% 0 80% 0); transform: translate(0, 0); }
                }
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(0.8); }
                }
                @keyframes grid-scroll {
                    0% { background-position: 0 0; }
                    100% { background-position: 40px 40px; }
                }
                .hub-title {
                    font-family: 'Orbitron', monospace;
                    font-weight: 900;
                    font-size: clamp(2.5rem, 8vw, 5rem);
                    letter-spacing: 0.1em;
                    color: #00ff41;
                    text-shadow: 0 0 20px rgba(0,255,65,0.7), 0 0 60px rgba(0,255,65,0.3), 0 0 100px rgba(0,255,65,0.1);
                    animation: flicker 8s infinite;
                    position: relative;
                    display: inline-block;
                }
                .hub-title::before,
                .hub-title::after {
                    content: attr(data-text);
                    position: absolute;
                    inset: 0;
                    font-family: inherit;
                    font-weight: inherit;
                    font-size: inherit;
                    letter-spacing: inherit;
                    opacity: 0;
                }
                .hub-title.glitch-active::before {
                    color: #bd00ff;
                    opacity: 0.8;
                    animation: glitch-1 0.6s steps(1) forwards;
                }
                .hub-title.glitch-active::after {
                    color: #00dbde;
                    opacity: 0.8;
                    animation: glitch-2 0.6s steps(1) forwards;
                }
                .bg-grid {
                    background-image:
                        linear-gradient(rgba(0,255,65,0.04) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(0,255,65,0.04) 1px, transparent 1px);
                    background-size: 40px 40px;
                    animation: grid-scroll 8s linear infinite;
                }
                @media (prefers-reduced-motion: reduce) {
                    .hub-title { animation: none; }
                    .bg-grid { animation: none; }
                }
            `}</style>

            <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden" style={{ background: '#050505' }}>

                {/* Animated grid background */}
                <div className="bg-grid absolute inset-0 pointer-events-none" aria-hidden="true" />

                {/* Radial vignette */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                    style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 10%, rgba(0,255,65,0.07) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                    style={{ background: 'radial-gradient(ellipse 60% 40% at 80% 80%, rgba(189,0,255,0.05) 0%, transparent 60%)' }} />

                {/* Content */}
                <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center">

                    {/* Header */}
                    <header className="text-center mb-16">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="h-px flex-1 max-w-24" style={{ background: 'linear-gradient(to right, transparent, #00ff4160)' }} />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#00ff4180', fontSize: '11px', letterSpacing: '0.25em' }}>// GAME PLATFORM v2.0</span>
                            <div className="h-px flex-1 max-w-24" style={{ background: 'linear-gradient(to left, transparent, #00ff4160)' }} />
                        </div>

                        <h1
                            ref={titleRef}
                            className="hub-title"
                            data-text="GAME_HUB"
                        >
                            GAME_HUB
                        </h1>

                        <p className="mt-4 text-[#4a5568] text-sm tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            Choisissez votre expérience de jeu
                        </p>

                        {/* Status indicators */}
                        <div className="flex items-center justify-center gap-6 mt-6">
                            {[
                                { label: '5 JEUX', color: '#00ff41' },
                                { label: 'MULTIJOUEUR', color: '#00dbde' },
                                { label: 'TEMPS RÉEL', color: '#bd00ff' },
                            ].map(({ label, color }) => (
                                <div key={label} className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse-dot 2s ease-in-out infinite' }} />
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: `${color}90`, fontSize: '10px', letterSpacing: '0.2em' }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    </header>

                    {/* Game grid */}
                    <div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full"
                        role="list"
                        aria-label="Sélection de jeux"
                    >
                        {GAMES.map((game, i) => (
                            <div key={game.id} role="listitem">
                                <GameCard game={game} index={i} />
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <footer className="mt-16 flex flex-col items-center gap-3">
                        <div className="h-px w-48" style={{ background: 'linear-gradient(to right, transparent, #ffffff10, transparent)' }} />
                        <Link
                            to="/admin"
                            className="group flex items-center gap-2 transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#4a5568] rounded px-2 py-1"
                            style={{ color: '#2d3748', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.15em', textDecoration: 'none' }}
                            aria-label="Accès administrateur"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="group-hover:opacity-60 transition-opacity">
                                <rect x="1" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                                <path d="M3.5 5V3.5a2.5 2.5 0 0 1 5 0V5" stroke="currentColor" strokeWidth="1.2"/>
                            </svg>
                            <span className="group-hover:text-[#4a5568] transition-colors">// ACCÈS ADMINISTRATEUR</span>
                        </Link>
                    </footer>
                </main>
            </div>
        </>
    );
}

export default HomePage;
