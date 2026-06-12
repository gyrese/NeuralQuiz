import { useNavigate } from 'react-router-dom';
import '../../components/Color/ColorStyles.css';

const BLOBS = [
    { top:'8%',  left:'6%',  size:80,  bg:'#FF5263', rot:'-18deg', delay:'0s' },
    { top:'15%', right:'8%', size:56,  bg:'#00C2B3', rot:'12deg',  delay:'0.4s' },
    { top:'70%', left:'4%',  size:64,  bg:'#C084FC', rot:'22deg',  delay:'0.8s' },
    { top:'72%', right:'5%', size:72,  bg:'#FFD93D', rot:'-10deg', delay:'1.2s' },
    { top:'40%', left:'2%',  size:40,  bg:'#4ADE80', rot:'35deg',  delay:'0.3s' },
    { top:'45%', right:'3%', size:44,  bg:'#FF9A3C', rot:'-25deg', delay:'0.9s' },
];

function ColorSelectPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden select-none"
             style={{ background: '#FFFBEB' }}>

            {/* Halftone dots */}
            <div className="toon-dots" />

            {/* Decorative blobs */}
            {BLOBS.map((b, i) => (
                <div key={i}
                     className="absolute rounded-full border-[3px] border-[#1A1A2E] float-up"
                     style={{
                         top: b.top, left: b.left, right: b.right,
                         width: b.size, height: b.size,
                         background: b.bg,
                         transform: `rotate(${b.rot})`,
                         animationDelay: b.delay,
                         boxShadow: '3px 3px 0px #1A1A2E',
                         zIndex: 1,
                     }}
                />
            ))}

            {/* Stars decoration */}
            <span className="absolute top-[22%] left-[14%] text-3xl star-spin" style={{ animationDuration:'5s', zIndex:2 }}>✦</span>
            <span className="absolute top-[30%] right-[13%] text-2xl star-spin" style={{ animationDuration:'7s', animationDirection:'reverse', zIndex:2 }}>★</span>
            <span className="absolute bottom-[20%] left-[18%] text-xl star-spin" style={{ animationDuration:'6s', zIndex:2 }}>✦</span>

            {/* Main content */}
            <main className="w-full max-w-[460px] relative z-10 flex flex-col items-center gap-6">

                {/* Logo */}
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-28 h-28 rounded-[24px] mb-4 toon-bounce"
                         style={{ background:'#FFD93D', border:'4px solid #1A1A2E', boxShadow:'5px 5px 0px #1A1A2E' }}>
                        <span style={{ fontSize: 56 }}>🎨</span>
                    </div>

                    <h1 className="text-[4.5rem] font-black leading-none tracking-tight mb-2"
                        style={{
                            fontFamily: "'Fredoka One', 'Nunito', sans-serif",
                            color: '#1A1A2E',
                            textShadow: '4px 4px 0px #FF5263',
                            transform: 'rotate(-2deg)',
                            display: 'inline-block',
                        }}>
                        CouleurMoi
                    </h1>

                    <div className="flex items-center justify-center gap-2 mt-3">
                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 font-extrabold text-xs uppercase tracking-widest text-white rounded-full"
                              style={{ background:'#00C2B3', border:'2px solid #1A1A2E', boxShadow:'2px 2px 0px #1A1A2E' }}>
                            🌈 Devine la couleur exacte !
                        </span>
                    </div>
                </div>

                {/* Action card */}
                <div className="w-full rounded-2xl p-6 flex flex-col gap-4"
                     style={{ background:'#FFFFFF', border:'3px solid #1A1A2E', boxShadow:'7px 7px 0px #1A1A2E' }}>

                    <button onClick={() => navigate('/color/host')}
                            className="toon-btn w-full py-5 text-lg"
                            style={{ background:'#FF5263', color:'#fff' }}>
                        <span style={{ fontSize:22 }}>🎮</span>
                        Créer une partie
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-[2px]" style={{ background:'#E5E7EB' }} />
                        <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">ou</span>
                        <div className="flex-1 h-[2px]" style={{ background:'#E5E7EB' }} />
                    </div>

                    <button onClick={() => navigate('/color/play')}
                            className="toon-btn w-full py-5 text-lg"
                            style={{ background:'#1A1A2E', color:'#fff' }}>
                        <span style={{ fontSize:22 }}>👾</span>
                        Rejoindre une partie
                    </button>
                </div>

                {/* Petit label fun */}
                <div className="flex gap-3 flex-wrap justify-center">
                    {['Toon', 'Multijoueur', 'Temps réel'].map(tag => (
                        <span key={tag}
                              className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full"
                              style={{ background:'#F3F4F6', border:'2px solid #1A1A2E', color:'#1A1A2E', boxShadow:'1px 1px 0px #1A1A2E' }}>
                            {tag}
                        </span>
                    ))}
                </div>

                <button onClick={() => navigate('/')}
                        className="text-xs font-extrabold text-gray-400 hover:text-gray-600 uppercase tracking-widest flex items-center gap-1 transition-colors">
                    ← Retour au menu
                </button>
            </main>
        </div>
    );
}

export default ColorSelectPage;
