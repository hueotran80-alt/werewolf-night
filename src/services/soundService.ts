// ============================================================================
// WEREWOLF: NIGHT OF DECEPTION - Web Audio API Atmospheric Sound Synthesizer
// Generates realistic dark fantasy procedural audio with 0 external asset dependency
// ============================================================================

class SoundService {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  public bgmMuted: boolean = false;
  private bgmOsc: OscillatorNode | null = null;
  private bgmGain: GainNode | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('AudioContext initialization ignored:', e);
    }
  }

  // Play a procedural dark Wolf Howl sound
  public playWolfHowl() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1200, now + 1.2);
      filter.frequency.exponentialRampToValueAtTime(300, now + 3.0);

      // Wolf pitch envelope (rising, howling peak, slow fall)
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.9);
      osc.frequency.exponentialRampToValueAtTime(360, now + 1.8);
      osc.frequency.exponentialRampToValueAtTime(160, now + 3.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.3, now + 2.0);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 3.3);
    } catch (err) {
      // Ignore audio synthesis errors
    }
  }

  // Play Morning Church / Village Bell
  public playMorningBell() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freqs = [330, 660, 990, 1320];

      freqs.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * (1 + idx * 0.01), now);

        const amp = 0.2 / (idx + 1);
        gain.gain.setValueAtTime(amp, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 2.6);
      });
    } catch (err) {
      // Ignore
    }
  }

  // Play Courtroom Gavel Strike for Voting
  public playGavelStrike() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (err) {
      // Ignore
    }
  }

  // Play Card Flip Sound
  public playCardFlip() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (err) {
      // Ignore
    }
  }

  // Play Victory Fanfare
  public playVictory() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C E G C E
      const now = this.ctx.currentTime;

      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.001, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.12 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 1.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 1.3);
      });
    } catch (err) {
      // Ignore
    }
  }

  // Play Death Toll / Elimination Sound
  public playDeathToll() {
    try {
      if (this.isMuted) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 1.5);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.9);
    } catch (err) {
      // Ignore
    }
  }

  // Ambient Dark Fantasy Drone / Wind BGM
  public startAmbientBgm() {
    try {
      if (this.bgmMuted || this.isMuted || this.bgmOsc) return;
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.bgmOsc = this.ctx.createOscillator();
      this.bgmGain = this.ctx.createGain();

      this.bgmOsc.type = 'sine';
      this.bgmOsc.frequency.setValueAtTime(55, now); // Low A

      this.bgmGain.gain.setValueAtTime(0.001, now);
      this.bgmGain.gain.exponentialRampToValueAtTime(0.04, now + 3);

      this.bgmOsc.connect(this.bgmGain);
      this.bgmGain.connect(this.ctx.destination);

      this.bgmOsc.start(now);
    } catch (err) {
      // Ignore
    }
  }

  public stopAmbientBgm() {
    if (this.bgmOsc) {
      try {
        this.bgmOsc.stop();
        this.bgmOsc.disconnect();
      } catch (e) {}
      this.bgmOsc = null;
      this.bgmGain = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAmbientBgm();
    }
    return this.isMuted;
  }
}

export const soundManager = new SoundService();
