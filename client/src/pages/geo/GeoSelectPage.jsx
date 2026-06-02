import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function GeoSelectPage() {
    const navigate = useNavigate();

    useEffect(() => {
        document.body.classList.add('pop-culture-theme');
        return () => {
            document.body.classList.remove('pop-culture-theme');
        };
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-pattern text-on-background font-body-md relative select-none overflow-hidden">
            {/* Pop dots layer */}
            <div className="pop-dots"></div>

            {/* Fun floating decoration stickers */}
            <div className="absolute top-12 left-10 bg-secondary text-white font-headline-sm px-4 py-2 border-[3px] border-on-background -rotate-12 floating select-none" style={{ '--rot': '-12deg' }}>GEO</div>
            <div className="absolute bottom-16 right-12 bg-primary-container text-on-primary-container font-headline-sm px-4 py-2 border-[3px] border-on-background rotate-6 floating select-none" style={{ '--rot': '6deg', 'animationDelay': '1s' }}>READY?</div>

            <main className="w-full max-w-[480px] relative z-10 text-center">
                <div className="mb-8">
                    <img src="/logo-geotrackr.png" alt="GeoTrackr" className="w-36 h-36 object-contain mb-4 mx-auto drop-shadow-lg" />
                    <h1 className="text-5xl font-black font-headline-xl text-on-background tracking-tighter uppercase italic -rotate-1 mb-2">
                        GeoTrackr
                    </h1>
                    <p className="text-sm font-semibold font-body-md text-secondary uppercase tracking-wider">Explorez le monde et testez votre sens de l'orientation</p>
                </div>

                <div className="bg-white border-[3px] border-on-background rounded-xl p-6 relative overflow-hidden neo-shadow-lg flex flex-col gap-4">
                    <button 
                        onClick={() => navigate('/geo/host')}
                        className="w-full bg-primary-container text-on-primary-container py-4 border-[3px] border-on-background rounded-lg font-black text-sm font-headline-md uppercase tracking-wide hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(22,26,51,1)] shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] transition-all flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                        <span className="material-symbols-outlined text-[20px]">groups</span>
                        Créer une partie (Hôte)
                    </button>

                    <button 
                        onClick={() => navigate('/geo/play')}
                        className="w-full bg-surface-container text-on-surface py-4 border-[3px] border-on-background rounded-lg font-black text-sm font-headline-md uppercase tracking-wide hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(22,26,51,1)] shadow-[4px_4px_0px_0px_rgba(22,26,51,1)] transition-all flex items-center justify-center gap-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                        <span className="material-symbols-outlined text-[20px]">person</span>
                        Rejoindre une partie
                    </button>
                </div>

                <div className="mt-8">
                    <button 
                        onClick={() => navigate('/')}
                        className="text-xs font-black font-label-lg text-secondary uppercase tracking-widest hover:text-primary transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Retour au menu principal
                    </button>
                </div>
            </main>
        </div>
    );
}

export default GeoSelectPage;
