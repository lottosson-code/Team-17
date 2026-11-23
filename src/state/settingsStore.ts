/**
 * Global Settings State Store.
 *
 * Manages player settings across the game, including music volume, sound effects volume,
 * audio muting, and game difficulty. Implements an observable pattern via `subscribe()`,
 * allowing UI controls and audio managers to reactively update without polling.
 *
 * Persistence Strategy:
 * - Persists settings to browser `localStorage` under `SETTINGS_STORAGE_KEY`.
 * - Employs a defensive in-memory fallback (`memoryFallback`) if `localStorage` is unavailable,
 *   restricted by browser sandbox permissions, or throws QuotaExceededError.
 */

export type GameDifficulty = 'Easy' | 'Normal' | 'Hard';

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  difficulty: GameDifficulty;
}

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  musicVolume: 70,
  sfxVolume: 80,
  muted: false,
  difficulty: 'Normal',
};

export const SETTINGS_STORAGE_KEY = 'team17_math_rpg_settings_v1';

export const VALID_DIFFICULTIES: readonly GameDifficulty[] = ['Easy', 'Normal', 'Hard'];

export class SettingsStore {
  private static instance: SettingsStore | null = null;
  private settings: GameSettings;
  private listeners: Set<(settings: GameSettings) => void> = new Set();
  private memoryFallback: string | null = null;

  constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): SettingsStore {
    if (!SettingsStore.instance) {
      SettingsStore.instance = new SettingsStore();
    }
    return SettingsStore.instance;
  }

  public static resetInstance(): void {
    SettingsStore.instance = null;
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  /**
   * Persists current settings, notifies subscribers, and returns a fresh snapshot.
   */
  private commit(): GameSettings {
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public setMusicVolume(val: number): GameSettings {
    this.settings.musicVolume = this.clampVolume(val);
    return this.commit();
  }

  public setSfxVolume(val: number): GameSettings {
    this.settings.sfxVolume = this.clampVolume(val);
    return this.commit();
  }

  public toggleMute(): GameSettings {
    this.settings.muted = !this.settings.muted;
    return this.commit();
  }

  public setMuted(muted: boolean): GameSettings {
    this.settings.muted = Boolean(muted);
    return this.commit();
  }

  public setDifficulty(difficulty: GameDifficulty): GameSettings {
    this.settings.difficulty = difficulty;
    return this.commit();
  }

  public resetSettings(): GameSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    return this.commit();
  }

  public resetToDefaults(): GameSettings {
    return this.resetSettings();
  }

  public get musicVolume(): number {
    return this.settings.musicVolume;
  }

  public get sfxVolume(): number {
    return this.settings.sfxVolume;
  }

  public get muted(): boolean {
    return this.settings.muted;
  }

  public get difficulty(): GameDifficulty {
    return this.settings.difficulty;
  }

  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Ensures a volume value is an integer between 0 and 100 inclusive.
   */
  private clampVolume(val: number): number {
    if (Number.isNaN(val)) {
      return 0;
    }
    // Round to nearest whole integer, then bound strictly between 0 and 100.
    const rounded = Math.round(val);
    if (rounded < 0) {
      return 0;
    }
    if (rounded > 100) {
      return 100;
    }
    return rounded;
  }

  private notify(): void {
    const current = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch {
        // Defensive: Prevent subscriber errors from bubbling
      }
    }
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
        return (globalThis as unknown as { localStorage: Storage }).localStorage;
      }
    } catch {
      return null;
    }
    return null;
  }

  private loadSettings(): GameSettings {
    try {
      const storage = this.getStorage();
      let rawData: string | null = null;
      if (storage) {
        rawData = storage.getItem(SETTINGS_STORAGE_KEY);
      } else {
        rawData = this.memoryFallback;
      }

      if (rawData) {
        const parsed = JSON.parse(rawData);

        // Validate each setting individually so corrupted, missing, or out-of-date keys fallback safely.
        let musicVolume = DEFAULT_SETTINGS.musicVolume;
        if (typeof parsed.musicVolume === 'number') {
          musicVolume = this.clampVolume(parsed.musicVolume);
        }

        let sfxVolume = DEFAULT_SETTINGS.sfxVolume;
        if (typeof parsed.sfxVolume === 'number') {
          sfxVolume = this.clampVolume(parsed.sfxVolume);
        }

        let muted = DEFAULT_SETTINGS.muted;
        if (typeof parsed.muted === 'boolean') {
          muted = parsed.muted;
        }

        let difficulty = DEFAULT_SETTINGS.difficulty;
        if (VALID_DIFFICULTIES.includes(parsed.difficulty)) {
          difficulty = parsed.difficulty;
        }

        return {
          musicVolume,
          sfxVolume,
          muted,
          difficulty,
        };
      }
    } catch {
      // Fallback on defaults if parse error or restricted storage
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    const json = JSON.stringify(this.settings);
    try {
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(SETTINGS_STORAGE_KEY, json);
      } else {
        this.memoryFallback = json;
      }
    } catch {
      this.memoryFallback = json;
    }
  }
}

export const settingsStore = SettingsStore.getInstance();
