// Web Audio API Synthesizer pour les effets sonores
let audioCtx = null;

function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

export const playCountdownSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // La4
        
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
};

export const playTickSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
};

export const playSuccessSound = () => {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        
        const playNote = (freq, time, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        };
        
        playNote(523.25, now, 0.15); // Do5
        playNote(783.99, now + 0.1, 0.3); // Sol5
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
};

export const playFailSound = () => {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.4);
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
};

export const playWinnerSound = () => {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;
        
        const playNote = (freq, time, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            
            gain.gain.setValueAtTime(0.12, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
            
            osc.start(time);
            osc.stop(time + duration);
        };
        
        playNote(523.25, now, 0.2);       // Do5
        playNote(659.25, now + 0.12, 0.2); // Mi5
        playNote(783.99, now + 0.24, 0.2); // Sol5
        playNote(1046.50, now + 0.36, 0.6);// Do6
    } catch (e) {
        console.warn('Web Audio error:', e);
    }
};
