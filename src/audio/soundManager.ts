import { settingsStore, GameSettings } from '../state/settingsStore';

export type SfxType = 'hover' | 'click' | 'start' | 'modalOpen' | 'modalClose';

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  private isMusicPlaying = false;
  private musicIntervalId: ReturnType<typeof setInterval> | null = null;
  private activeMusicOscillators: OscillatorNode[] = [];

  private currentSettings: GameSettings;

  constructor() {
    this.currentSettings = settingsStore.getSettings();
    this.initAudioContext();
    this.setupUnlockListeners();

    settingsStore.subscribe((settings) => {
      this.currentSettings = settings;
      this.updateVolumes();
    });
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public static resetInstance(): void {
    if (SoundManager.instance) {
      SoundManager.instance.stopMenuMusic();
      SoundManager.instance = null;
    }
  }

  private initAudioContext(): void {
    try {
      const AudioCtxClass =
        (typeof window !== 'undefined' &&
          (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) ||
        (typeof globalThis !== 'undefined' &&
          (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext);

      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.sfxGainNode = this.ctx.createGain();
        this.musicGainNode = this.ctx.createGain();

        this.sfxGainNode.connect(this.ctx.destination);
        this.musicGainNode.connect(this.ctx.destination);

        this.updateVolumes();
      }
    } catch {
      this.ctx = null;
    }
  }

  private setupUnlockListeners(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  public unlockAudio(): void {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isUnlocked = true;
  }

  private updateVolumes(): void {
    if (!this.ctx) return;
    const { musicVolume, sfxVolume, muted } = this.currentSettings;

    const effectiveSfx = muted ? 0 : (sfxVolume / 100) * 0.25;
    const effectiveMusic = muted ? 0 : (musicVolume / 100) * 0.15;

    const now = this.ctx.currentTime;
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.cancelScheduledValues(now);
      this.sfxGainNode.gain.setValueAtTime(effectiveSfx, now);
    }
    if (this.musicGainNode) {
      this.musicGainNode.gain.cancelScheduledValues(now);
      this.musicGainNode.gain.setValueAtTime(effectiveMusic, now);
    }
  }

  /**
   * Plays a procedural sound effect using Web Audio API synthesis.
   */
  public playSfx(type: SfxType): void {
    if (!this.ctx || !this.sfxGainNode) return;
    this.unlockAudio();

    if (this.currentSettings.muted || this.currentSettings.sfxVolume <= 0) {
      return;
    }

    try {
      const now = this.ctx.currentTime;

      switch (type) {
        case 'hover':
          this.synthesizeHover(now);
          break;
        case 'click':
          this.synthesizeClick(now);
          break;
        case 'start':
          this.synthesizeStart(now);
          break;
        case 'modalOpen':
          this.synthesizePitchSlide(now, 320, 560, 0.09);
          break;
        case 'modalClose':
          this.synthesizePitchSlide(now, 560, 320, 0.09);
          break;
      }
    } catch {
      // Safe guard against audio context state issues
    }
  }

  /**
   * Helper to synthesize a single timed oscillator tone through a dedicated gain envelope.
   *
   * @param options Sound configuration:
   *  - type: Waveform ('sine', 'triangle', 'square', 'sawtooth')
   *  - startFreq: Frequency at the start of the note in Hertz
   *  - endFreq: Optional frequency to smoothly glide to by the end of the duration
   *  - startTime: AudioContext timestamp when this tone begins playing
   *  - duration: Length of the tone in seconds
   *  - peakGain: Volume peak reached at startTime (0.0 to 1.0)
   *  - endGain: Volume reached at the end of the duration (defaults to 0.001 to prevent audio popping)
   */
  private playSfxTone(options: {
    type: OscillatorType;
    startFreq: number;
    endFreq?: number;
    startTime: number;
    duration: number;
    peakGain: number;
    endGain?: number;
  }): void {
    if (!this.ctx || !this.sfxGainNode) {
      return;
    }

    const type = options.type;
    const startFreq = options.startFreq;
    const endFreq = options.endFreq;
    const startTime = options.startTime;
    const duration = options.duration;
    const peakGain = options.peakGain;
    // In Web Audio API, exponential ramps cannot target 0 (it throws an error or breaks the curve).
    // 0.001 represents near-silence (-60dB) and creates a clean, pop-free fade out.
    let endGain = 0.001;
    if (options.endGain !== undefined) {
      endGain = options.endGain;
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (endFreq !== undefined) {
      // Smooth pitch bend / frequency slide
      osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    }

    // Set peak volume at start, then ramp down smoothly according to duration
    gain.gain.setValueAtTime(peakGain, startTime);
    gain.gain.exponentialRampToValueAtTime(endGain, startTime + duration);

    // Wire: Oscillator -> Tone Gain Envelope -> Master SFX Gain -> Destination
    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(startTime);
    // Add 5ms buffer so the exponential decay finishes before cutting off the oscillator
    osc.stop(startTime + duration + 0.005);
  }

  private synthesizeHover(now: number): void {
    this.playSfxTone({
      type: 'sine',
      startFreq: 880,
      startTime: now,
      duration: 0.04,
      peakGain: 0.35,
      endGain: 0.001,
    });
  }

  private synthesizeClick(now: number): void {
    // Two-tone chime (523Hz -> 784Hz)
    this.playSfxTone({
      type: 'triangle',
      startFreq: 523.25,
      startTime: now,
      duration: 0.04,
      peakGain: 0.4,
      endGain: 0.01,
    });
    this.playSfxTone({
      type: 'sine',
      startFreq: 783.99,
      startTime: now + 0.04,
      duration: 0.05,
      peakGain: 0.5,
      endGain: 0.001,
    });
  }

  private synthesizeStart(now: number): void {
    // Ascending 3-note heroic RPG arpeggio (C5 -> E5 -> G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      // The final resolved chord note (idx === 2) uses a richer triangle wave and rings out longer (0.22s)
      let waveType: OscillatorType = 'sine';
      let noteDuration = 0.12;
      if (idx === 2) {
        waveType = 'triangle';
        noteDuration = 0.22;
      }

      this.playSfxTone({
        type: waveType,
        startFreq: freq,
        startTime: now + idx * 0.11,
        duration: noteDuration,
        peakGain: 0.45,
        endGain: 0.001,
      });
    });
  }

  private synthesizePitchSlide(now: number, fromFreq: number, toFreq: number, duration: number): void {
    this.playSfxTone({
      type: 'sine',
      startFreq: fromFreq,
      endFreq: toFreq,
      startTime: now,
      duration,
      peakGain: 0.3,
      endGain: 0.001,
    });
  }

  /**
   * Starts looping calm procedural fantasy-math arpeggio background music.
   */
  public startMenuMusic(): void {
    if (this.isMusicPlaying || !this.ctx || !this.musicGainNode) return;
    this.unlockAudio();
    this.isMusicPlaying = true;

    // Harmonic pentatonic arpeggio sequence: C4, E4, G4, B4, C5, G4, E4, D4
    const scale = [261.63, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63, 293.66];
    let noteIndex = 0;
    const noteInterval = 320; // ms

    const playNextNote = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.musicGainNode) return;
      try {
        const now = this.ctx.currentTime;
        const freq = scale[noteIndex % scale.length];
        noteIndex++;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Soft attack and gentle decay
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(this.musicGainNode);

        osc.start(now);
        osc.stop(now + 0.4);

        this.activeMusicOscillators.push(osc);
        osc.onended = () => {
          const idx = this.activeMusicOscillators.indexOf(osc);
          if (idx !== -1) {
            this.activeMusicOscillators.splice(idx, 1);
          }
        };
      } catch {
        // Safe guard against audio context closure
      }
    };

    playNextNote();
    this.musicIntervalId = setInterval(playNextNote, noteInterval);
  }

  /**
   * Stops background music cleanly.
   */
  public stopMenuMusic(): void {
    this.isMusicPlaying = false;
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }

    for (const osc of this.activeMusicOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.activeMusicOscillators = [];
  }
}

export const soundManager = SoundManager.getInstance();
