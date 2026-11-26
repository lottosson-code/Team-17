import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { settingsStore } from '../../state/settingsStore';
import { SoundManager, SfxType, audibleStart } from '../soundManager';

class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  currentTime = 10;
  destination = new MockAudioNode();
  resume = vi.fn().mockImplementation(async () => {
    this.state = 'running';
  });
  createGain = vi.fn().mockImplementation(() => new MockGainNode());
  createOscillator = vi.fn().mockImplementation(() => new MockOscillatorNode());
}

describe('SoundManager', () => {
  let mockCtx: MockAudioContext;
  let originalAudioContext: unknown;

  beforeEach(() => {
    settingsStore.resetToDefaults();
    mockCtx = new MockAudioContext();
    originalAudioContext = (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = class {
      constructor() {
        return mockCtx;
      }
    };
    if (typeof window !== 'undefined') {
      (window as unknown as { AudioContext?: unknown }).AudioContext = (
        globalThis as unknown as { AudioContext?: unknown }
      ).AudioContext;
    }
    SoundManager.resetInstance();
  });

  afterEach(() => {
    SoundManager.resetInstance();
    (globalThis as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext;
  });

  it('creates and manages a singleton instance', () => {
    const sm1 = SoundManager.getInstance();
    const sm2 = SoundManager.getInstance();
    expect(sm1).toBe(sm2);

    SoundManager.resetInstance();
    const sm3 = SoundManager.getInstance();
    expect(sm3).not.toBe(sm1);
  });

  it('initializes audio nodes and connects gains to destination', () => {
    SoundManager.getInstance();

    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);
  });

  it('unlocks suspended audio context upon interaction', () => {
    const sm = SoundManager.getInstance();
    expect(mockCtx.state).toBe('suspended');

    sm.unlockAudio();
    expect(mockCtx.resume).toHaveBeenCalledTimes(1);
  });

  it('updates gain values reactively when settingsStore changes volume', () => {
    SoundManager.getInstance();

    settingsStore.setMusicVolume(50);
    settingsStore.setSfxVolume(60);

    // Verify volumes updated
    expect(settingsStore.musicVolume).toBe(50);
    expect(settingsStore.sfxVolume).toBe(60);
  });

  it('sets gain to 0 when muted', () => {
    SoundManager.getInstance();
    settingsStore.setMuted(true);

    expect(settingsStore.muted).toBe(true);
  });

  it.each([
    'hover',
    'click',
    'start',
    'modalOpen',
    'modalClose',
  ] as SfxType[])('plays sfx type "%s" without throwing errors', (sfxType) => {
    const sm = SoundManager.getInstance();
    expect(() => sm.playSfx(sfxType)).not.toThrow();
  });

  it('does not synthesize sfx when muted or sfxVolume is 0', () => {
    const sm = SoundManager.getInstance();
    settingsStore.setMuted(true);

    mockCtx.createOscillator.mockClear();
    sm.playSfx('click');

    expect(mockCtx.createOscillator).not.toHaveBeenCalled();

    settingsStore.setMuted(false);
    settingsStore.setSfxVolume(0);

    sm.playSfx('click');
    expect(mockCtx.createOscillator).not.toHaveBeenCalled();
  });

  it('plays an 8-bit voice blip: a short square wave at the given pitch', () => {
    const sm = SoundManager.getInstance();
    const before = mockCtx.createOscillator.mock.calls.length;
    sm.playVoiceBlip(220);

    const osc = mockCtx.createOscillator.mock.results[before].value as MockOscillatorNode;
    expect(osc.type).toBe('square');
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(220, expect.any(Number));
    // Held at full level before fading, rather than decaying from the start.
    const gain = mockCtx.createGain.mock.results.at(-1)!.value as MockGainNode;
    const held = gain.gain.setValueAtTime.mock.calls.map((call: unknown[]) => call[0] as number);
    expect(Math.max(...held)).toBeGreaterThan(0.1);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledTimes(1);
  });

  it('does not play voice blips when muted or at zero volume', () => {
    const sm = SoundManager.getInstance();
    const before = mockCtx.createOscillator.mock.calls.length;
    settingsStore.setMuted(true);
    sm.playVoiceBlip(220);
    settingsStore.setMuted(false);
    settingsStore.setSfxVolume(0);
    sm.playVoiceBlip(220);
    expect(mockCtx.createOscillator.mock.calls.length).toBe(before);
  });

  it('starts background music and is idempotent on repeat calls', () => {
    vi.useFakeTimers();
    const sm = SoundManager.getInstance();

    sm.startMenuMusic();
    const initialCalls = mockCtx.createOscillator.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    // Repeated call should not schedule duplicate timers
    sm.startMenuMusic();
    expect(mockCtx.createOscillator.mock.calls.length).toBe(initialCalls);

    // Advance timer to trigger next note in arpeggio
    vi.advanceTimersByTime(350);
    expect(mockCtx.createOscillator.mock.calls.length).toBeGreaterThan(initialCalls);

    sm.stopMenuMusic();
    vi.useRealTimers();
  });

  it('stops background music cleanly and cancels oscillators', () => {
    const sm = SoundManager.getInstance();
    sm.startMenuMusic();
    sm.stopMenuMusic();

    expect(() => sm.stopMenuMusic()).not.toThrow();
  });
});

describe('SoundManager files', () => {
  class FakeAudio {
    static made: FakeAudio[] = [];
    loop = false;
    preload = '';
    volume = 1;
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();
    load = vi.fn();
    removeAttribute = vi.fn();
    constructor(public src: string) {
      FakeAudio.made.push(this);
    }
  }

  const g = globalThis as unknown as Record<string, unknown>;
  let saved: Record<string, unknown>;
  let ctx: MockAudioContext & { decodeAudioData: ReturnType<typeof vi.fn>; createBufferSource: ReturnType<typeof vi.fn> };
  let sources: { start: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>; buffer: unknown }[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    saved = { Audio: g.Audio, AudioContext: g.AudioContext, fetch: g.fetch };
    settingsStore.resetToDefaults();
    FakeAudio.made = [];
    sources = [];
    ctx = Object.assign(new MockAudioContext(), {
      decodeAudioData: vi.fn(async () => ({ duration: 0.3 })),
      createBufferSource: vi.fn(() => {
        const source = { start: vi.fn(), connect: vi.fn(), buffer: null as unknown };
        sources.push(source);
        return source;
      }),
    });
    g.AudioContext = class {
      constructor() {
        return ctx;
      }
    };
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).AudioContext = g.AudioContext;
    g.Audio = FakeAudio;
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }));
    g.fetch = fetchMock;
    SoundManager.resetInstance();
  });

  afterEach(() => {
    SoundManager.resetInstance();
    Object.assign(g, saved);
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).AudioContext = saved.AudioContext;
  });

  it('plays a music file on a loop at the music volume', () => {
    settingsStore.setMusicVolume(80);
    const sm = SoundManager.getInstance();
    sm.playMusicTrack('theme.mp3');

    const track = FakeAudio.made[0];
    expect(track.src).toBe('theme.mp3');
    expect(track.loop).toBe(true); // Starts over if the level outlasts it
    expect(track.play).toHaveBeenCalledTimes(1);
    expect(track.volume).toBeCloseTo(0.8 * 0.5);
  });

  it('lowers the music file while ducked, and a new track starts at full volume', () => {
    settingsStore.setMusicVolume(80);
    const sm = SoundManager.getInstance();
    sm.playMusicTrack('theme.mp3');
    sm.duckMusicTrack(0.4);
    expect(FakeAudio.made[0].volume).toBeCloseTo(0.8 * 0.5 * 0.4);
    sm.duckMusicTrack(1);
    expect(FakeAudio.made[0].volume).toBeCloseTo(0.8 * 0.5);

    sm.duckMusicTrack(0.4);
    sm.playMusicTrack('theme.mp3'); // e.g. the level restarted mid-speech
    expect(FakeAudio.made[1].volume).toBeCloseTo(0.8 * 0.5);
  });

  it('pauses and resumes the music file, and restarts it from the beginning when played again', () => {
    const sm = SoundManager.getInstance();
    sm.playMusicTrack('theme.mp3');
    const first = FakeAudio.made[0];

    sm.pauseMusicTrack();
    expect(first.pause).toHaveBeenCalledTimes(1);
    sm.resumeMusicTrack();
    expect(first.play).toHaveBeenCalledTimes(2);

    sm.playMusicTrack('theme.mp3'); // e.g. the level restarted
    expect(first.pause).toHaveBeenCalledTimes(2);
    expect(FakeAudio.made).toHaveLength(2);
    expect(FakeAudio.made[1].play).toHaveBeenCalledTimes(1);
  });

  it('follows volume and mute changes while the music file plays, and stops cleanly', () => {
    const sm = SoundManager.getInstance();
    sm.playMusicTrack('theme.mp3');
    const track = FakeAudio.made[0];

    settingsStore.setMuted(true);
    expect(track.volume).toBe(0);
    settingsStore.setMuted(false);
    settingsStore.setMusicVolume(40);
    expect(track.volume).toBeCloseTo(0.4 * 0.5);

    sm.stopMusicTrack();
    expect(track.pause).toHaveBeenCalled();
    expect(() => sm.stopMusicTrack()).not.toThrow();
    sm.resumeMusicTrack(); // Nothing to resume after stopping
    expect(track.play).toHaveBeenCalledTimes(1);
  });

  it('plays a sound effect file, fetching and decoding it only once', async () => {
    const sm = SoundManager.getInstance();
    sm.playSound('hit.mp3');
    sm.playSound('hit.mp3');
    await vi.waitFor(() => expect(sources).toHaveLength(2));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources.every((s) => s.start.mock.calls.length === 1)).toBe(true);
  });

  it('does not play sound effect files when muted or at zero volume', async () => {
    const sm = SoundManager.getInstance();
    settingsStore.setMuted(true);
    sm.playSound('hit.mp3');
    settingsStore.setMuted(false);
    settingsStore.setSfxVolume(0);
    sm.playSound('hit.mp3');
    await Promise.resolve();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sources).toHaveLength(0);
  });

  it('plays a sound effect louder or quieter than recorded when given a volume', async () => {
    const sm = SoundManager.getInstance();
    const gains = () => ctx.createGain.mock.results.map((r) => (r.value as MockGainNode).gain.value);
    const before = gains().length;
    sm.playSound('hit.mp3');
    sm.playSound('hit.mp3', 0.5);
    await vi.waitFor(() => expect(sources).toHaveLength(2));

    const [normal, quiet] = gains().slice(before);
    expect(quiet).toBeCloseTo(normal * 0.5);
  });

  it('starts a sound effect after the silence at the start of its file', async () => {
    // 10 ms of silence at 1000 samples per second, then the sound.
    const samples = new Float32Array(100);
    samples.fill(0.5, 10);
    ctx.decodeAudioData.mockImplementation(async () => ({
      duration: 0.1, sampleRate: 1000, numberOfChannels: 1, getChannelData: () => samples,
    }));
    const sm = SoundManager.getInstance();
    sm.playSound('click.wav');
    await vi.waitFor(() => expect(sources).toHaveLength(1));

    expect(sources[0].start).toHaveBeenCalledWith(0, expect.closeTo(0.009, 6));
  });

  it('retries a sound effect file that failed to load', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
    const sm = SoundManager.getInstance();
    sm.playSound('hit.mp3');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sources).toHaveLength(0);

    sm.playSound('hit.mp3');
    await vi.waitFor(() => expect(sources).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('audibleStart', () => {
  it('finds where the sound begins, keeping 1 ms before it', () => {
    const samples = new Float32Array(1000);
    samples[250] = -0.8; // First loud sample at 250 ms (1000 samples per second)
    samples[600] = 0.4;
    expect(audibleStart(samples, 1000)).toBeCloseTo(0.249);
  });

  it('ignores noise below 2% of the peak', () => {
    const samples = new Float32Array(1000).fill(0.005);
    samples[400] = 1;
    expect(audibleStart(samples, 1000)).toBeCloseTo(0.399);
  });

  it('starts at 0 for sounds that begin right away, and for silent or empty ones', () => {
    expect(audibleStart(new Float32Array([0.9, 0.1, 0]), 44100)).toBe(0);
    expect(audibleStart(new Float32Array(50), 44100)).toBe(0);
    expect(audibleStart(new Float32Array(0), 44100)).toBe(0);
  });
});
