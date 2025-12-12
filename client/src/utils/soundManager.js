
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {
            // Optional file paths if user adds them later
            start: '/sounds/start.mp3',
            tick: '/sounds/tick.mp3',
            end: '/sounds/end.mp3',
            win: '/sounds/win.mp3',
            pop: '/sounds/pop.mp3'
        };
    }

    play(type) {
        // Try to unlock audio context on first user interaction
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        // Try playing file first (if exists), else synth
        const audio = new Audio(this.sounds[type]);
        audio.volume = 0.5;
        audio.play().catch(() => {
            // File not found or error -> Fallback to Synth
            this.playSynth(type);
        });
    }

    playTick() {
        this.play('tick');
    }

    playSynth(type) {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        switch (type) {
            case 'start': // Gong / Chime
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, t);
                osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
                gain.gain.setValueAtTime(0.5, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 1);
                osc.start(t);
                osc.stop(t + 1);
                break;

            case 'tick': // Woodblock
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'pop': // High Pop
                osc.type = 'sine';
                osc.frequency.setValueAtTime(1200, t);
                osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
                osc.start(t);
                osc.stop(t + 0.1);
                break;

            case 'end': // Buzzer
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200, t);
                osc.frequency.linearRampToValueAtTime(100, t + 0.5);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.linearRampToValueAtTime(0.01, t + 0.5);
                osc.start(t);
                osc.stop(t + 0.5);
                break;

            case 'win': // Victory Arpeggio
                this.playNote(523.25, t, 0.1); // C5
                this.playNote(659.25, t + 0.1, 0.1); // E5
                this.playNote(783.99, t + 0.2, 0.2); // G5
                this.playNote(1046.50, t + 0.4, 0.4); // C6
                return; // Special case, osc already handled
        }
    }

    playNote(freq, time, duration) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.start(time);
        osc.stop(time + duration);
    }
}

export const soundManager = new SoundManager();
