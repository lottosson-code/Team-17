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
      if (typeof window !== 'undefined') {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtxClass) {
          this.ctx = new AudioCtxClass();
          this.sfxGainNode = this.ctx.createGain();
          this.musicGainNode = this.ctx.createGain();

          this.sfxGainNode.connect(this.ctx.destination);
          this.musicGainNode.connect(this.ctx.destination);

          this.updateVolumes();
        }
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

  private synthesizeHover(now: number): void {
    if (!this.ctx || !this.sfxGainNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  private synthesizeClick(now: number): void {
    if (!this.ctx || !this.sfxGainNode) return;
    // Two-tone chime (523Hz -> 784Hz)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(this.sfxGainNode);
    osc1.start(now);
    osc1.stop(now + 0.045);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.04);
    gain2.gain.setValueAtTime(0.5, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc2.connect(gain2);
    gain2.connect(this.sfxGainNode);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.095);
  }

  private synthesizeStart(now: number): void {
    if (!this.ctx || !this.sfxGainNode) return;
    // Ascending 3-note heroic RPG arpeggio (C5 -> E5 -> G5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGainNode) return;
      const noteTime = now + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.45, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + (idx === 2 ? 0.22 : 0.12));

      osc.connect(gain);
      gain.connect(this.sfxGainNode);

      osc.start(noteTime);
      osc.stop(noteTime + 0.24);
    });
  }

  private synthesizePitchSlide(now: number, fromFreq: number, toFreq: number, duration: number): void {
    if (!this.ctx || !this.sfxGainNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromFreq, now);
    osc.frequency.exponentialRampToValueAtTime(toFreq, now + duration);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.start(now);
    osc.stop(now + duration + 0.01);
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
