import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsStore, SETTINGS_STORAGE_KEY } from './settingsStore';

class MockStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
}

describe('settingsStore', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    if (typeof window !== 'undefined') {
      (window as unknown as { localStorage: Storage }).localStorage = mockStorage;
    }
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    SettingsStore.resetInstance();
  });

  it('verifies default settings: musicVolume: 70, sfxVolume: 80, muted: false, difficulty: Normal', () => {
    const store = SettingsStore.getInstance();
    const settings = store.getSettings();

    expect(settings.musicVolume).toBe(70);
    expect(settings.sfxVolume).toBe(80);
    expect(settings.muted).toBe(false);
    expect(settings.difficulty).toBe('Normal');
  });

  it('clamps setMusicVolume and setSfxVolume between 0 and 100', () => {
    const store = SettingsStore.getInstance();

    store.setMusicVolume(150);
    expect(store.getSettings().musicVolume).toBe(100);

    store.setMusicVolume(-25);
    expect(store.getSettings().musicVolume).toBe(0);

    store.setMusicVolume(45);
    expect(store.getSettings().musicVolume).toBe(45);

    store.setSfxVolume(200);
    expect(store.getSettings().sfxVolume).toBe(100);

    store.setSfxVolume(-10);
    expect(store.getSettings().sfxVolume).toBe(0);

    store.setSfxVolume(65);
    expect(store.getSettings().sfxVolume).toBe(65);
  });

  it('toggles muted state and returns updated settings', () => {
    const store = SettingsStore.getInstance();
    expect(store.getSettings().muted).toBe(false);

    const toggled = store.toggleMute();
    expect(toggled.muted).toBe(true);
    expect(store.getSettings().muted).toBe(true);

    const toggledBack = store.toggleMute();
    expect(toggledBack.muted).toBe(false);
    expect(store.getSettings().muted).toBe(false);
  });

  it('sets difficulty to Easy, Normal, or Hard', () => {
    const store = SettingsStore.getInstance();

    store.setDifficulty('Hard');
    expect(store.getSettings().difficulty).toBe('Hard');

    store.setDifficulty('Easy');
    expect(store.getSettings().difficulty).toBe('Easy');

    store.setDifficulty('Normal');
    expect(store.getSettings().difficulty).toBe('Normal');
  });

  it('resets settings to default values', () => {
    const store = SettingsStore.getInstance();
    store.setMusicVolume(10);
    store.setSfxVolume(15);
    store.toggleMute();
    store.setDifficulty('Hard');

    const reset = store.resetSettings();
    expect(reset.musicVolume).toBe(70);
    expect(reset.sfxVolume).toBe(80);
    expect(reset.muted).toBe(false);
    expect(reset.difficulty).toBe('Normal');
  });

  it('notifies subscribers upon settings changes and unsubscribes cleanly', () => {
    const store = SettingsStore.getInstance();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setMusicVolume(85);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ musicVolume: 85 }));

    unsubscribe();
    store.setMusicVolume(90);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists settings to localStorage under team17_math_rpg_settings_v1', () => {
    const store = SettingsStore.getInstance();
    store.setMusicVolume(33);
    store.setDifficulty('Hard');

    const raw = mockStorage.getItem(SETTINGS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.musicVolume).toBe(33);
    expect(parsed.difficulty).toBe('Hard');

    // Re-initialize from storage
    SettingsStore.resetInstance();
    const restoredStore = SettingsStore.getInstance();
    expect(restoredStore.getSettings().musicVolume).toBe(33);
    expect(restoredStore.getSettings().difficulty).toBe('Hard');
  });

  it('gracefully handles corrupted data in localStorage and falls back to defaults', () => {
    mockStorage.setItem(SETTINGS_STORAGE_KEY, '{ broken json');
    SettingsStore.resetInstance();
    const store = SettingsStore.getInstance();

    expect(store.getSettings().musicVolume).toBe(70);
    expect(store.getSettings().difficulty).toBe('Normal');
  });
});
