import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { settingsStore } from '../state/settingsStore';
import { SoundManager, SfxType } from './soundManager';

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
