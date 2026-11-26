import { settingsStore, GameSettings } from '../state/settingsStore';

export type SfxType = 'hover' | 'click' | 'start' | 'modalOpen' | 'modalClose';

/** Music files play at this fraction of the music volume setting, so sound effects stay audible over them. */
const MUSIC_TRACK_LEVEL = 0.5;
/** Sound effect files are boosted against the SFX gain, which is set low for the synthesized sounds. */
const SOUND_FILE_LEVEL = 3;
/** Voice blips hold this level (about as loud as the sound effect files), then cut off quickly. */
const VOICE_BLIP_GAIN = 0.3;
const VOICE_BLIP_SECONDS = 0.07;
/** A sound effect starts where its level first reaches this fraction of its peak (skipping silence). */
const SOUND_START_THRESHOLD = 0.02;

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;
  private isUnlocked = false;

  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;

  private isMusicPlaying = false;
  private musicIntervalId: ReturnType<typeof setInterval> | null = null;
  private activeMusicOscillators: OscillatorNode[] = [];
  /** A music file (e.g. a level's theme), as opposed to the synthesized menu music. */
  private musicTrack: HTMLAudioElement | null = null;
  /** The music file's volume is multiplied by this, e.g. lowered while a character talks. */
  private musicDuck = 1;
  /** Decoded sound effect files by URL, so each is fetched once. */
  private soundBuffers = new Map<string, Promise<AudioBuffer | null>>();
  /** Where each decoded sound effect really starts, in seconds, worked out on its first play. */
  private soundStarts = new WeakMap<AudioBuffer, number>();

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
      SoundManager.instance.stopMusicTrack();
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
    this.updateMusicTrackVolume();
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
   * One syllable of an 8-bit voice, like the talking blips in Undertale: a short square-wave note
   * that dips slightly in pitch. Call it as speech types out, with a different `frequency` each
   * time so it sounds like talking. Follows the sound effects volume and mute settings.
   */
  public playVoiceBlip(frequency: number): void {
    if (!this.ctx || !this.sfxGainNode) return;
    if (this.currentSettings.muted || this.currentSettings.sfxVolume <= 0) return;
    this.unlockAudio();
    try {
      const now = this.ctx.currentTime;
      const end = now + VOICE_BLIP_SECONDS;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(frequency, now);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.94, end);
      // A held note rather than a decaying ping, so each syllable is clearly heard: a 4 ms rise
      // (no click), hold, then a quick fade over the last 30%.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(VOICE_BLIP_GAIN, now + 0.004);
      gain.gain.setValueAtTime(VOICE_BLIP_GAIN, now + VOICE_BLIP_SECONDS * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain);
      gain.connect(this.sfxGainNode);
      osc.start(now);
      osc.stop(end + 0.01);
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

  /**
   * Plays a music file from the start, looping, so it begins again if it ends before the level does.
   * Stops the menu music and any other track. Follows the music volume and mute settings.
   */
  public playMusicTrack(url: string): void {
    this.stopMenuMusic();
    this.stopMusicTrack();
    if (typeof Audio === 'undefined') return;
    this.musicDuck = 1;
    const track = new Audio(url);
    track.loop = true;
    track.preload = 'auto';
    this.musicTrack = track;
    this.updateMusicTrackVolume();
    this.resumeMusicTrack();
  }

  /** Pauses the music file where it is; resumeMusicTrack carries on from there. */
  public pauseMusicTrack(): void {
    try {
      this.musicTrack?.pause();
    } catch {
      // Not supported here (e.g. tests)
    }
  }

  public resumeMusicTrack(): void {
    if (!this.musicTrack) return;
    try {
      // play() returns a promise that rejects if the browser blocks audio; the next resume retries.
      void this.musicTrack.play()?.catch(() => {});
    } catch {
      // Not supported here (e.g. tests)
    }
  }

  /** Stops the music file and lets it be freed. */
  public stopMusicTrack(): void {
    const track = this.musicTrack;
    if (!track) return;
    this.musicTrack = null;
    try {
      track.pause();
      track.removeAttribute('src');
      track.load();
    } catch {
      // Not supported here (e.g. tests)
    }
  }

  /** Starts loading a sound effect file, so its first play has no delay. */
  public preloadSound(url: string): void {
    void this.loadSound(url);
  }

  /**
   * Plays a sound effect file (e.g. 'assets/audio/sfx/enemy-attack.mp3') at the sound effects volume,
   * times `volume` (1 = as recorded). Starts at the first audible sample, so silence at the start of
   * the file (or MP3 encoder padding) doesn't delay it.
   */
  public playSound(url: string, volume = 1): void {
    if (!this.ctx || !this.sfxGainNode) return;
    if (this.currentSettings.muted || this.currentSettings.sfxVolume <= 0) return;
    this.unlockAudio();
    void this.loadSound(url).then((buffer) => {
      if (!buffer || !this.ctx || !this.sfxGainNode) return;
      try {
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        gain.gain.value = SOUND_FILE_LEVEL * volume;
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(this.sfxGainNode);
        source.start(0, this.soundStart(buffer));
      } catch {
        // Safe guard against audio context state issues
      }
    });
  }

  private loadSound(url: string): Promise<AudioBuffer | null> {
    const cached = this.soundBuffers.get(url);
    if (cached) return cached;
    const loading = (async () => {
      try {
        if (!this.ctx || typeof fetch === 'undefined') return null;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        return await this.ctx.decodeAudioData(await response.arrayBuffer());
      } catch {
        this.soundBuffers.delete(url); // Let a later play try again
        return null;
      }
    })();
    this.soundBuffers.set(url, loading);
    return loading;
  }

  /** Seconds of near-silence at the start of a sound, from its first channel (cached per sound). */
  private soundStart(buffer: AudioBuffer): number {
    const known = this.soundStarts.get(buffer);
    if (known !== undefined) return known;
    let start = 0;
    if (typeof buffer.getChannelData === 'function' && buffer.numberOfChannels > 0) {
      start = audibleStart(buffer.getChannelData(0), buffer.sampleRate);
    }
    this.soundStarts.set(buffer, start);
    return start;
  }

  private updateMusicTrackVolume(): void {
    if (!this.musicTrack) return;
    const { musicVolume, muted } = this.currentSettings;
    this.musicTrack.volume = muted ? 0 : (musicVolume / 100) * MUSIC_TRACK_LEVEL * this.musicDuck;
  }

  /**
   * Lowers the music file to `level` of its normal volume (e.g. 0.4 while someone talks), or
   * brings it back with 1. A new track always starts at its normal volume.
   */
  public duckMusicTrack(level: number): void {
    this.musicDuck = Math.min(1, Math.max(0, level));
    this.updateMusicTrackVolume();
  }
}

/**
 * Seconds before the first sample that reaches SOUND_START_THRESHOLD of the peak, less 1 ms so the
 * attack isn't clipped. 0 for silent or empty audio.
 */
export function audibleStart(samples: ArrayLike<number>, sampleRate: number): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak === 0 || sampleRate <= 0) return 0;
  const threshold = peak * SOUND_START_THRESHOLD;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) return Math.max(0, i / sampleRate - 0.001);
  }
  return 0;
}

export const soundManager = SoundManager.getInstance();
