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

  public setMusicVolume(val: number): GameSettings {
    this.settings.musicVolume = this.clampVolume(val);
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public setSfxVolume(val: number): GameSettings {
    this.settings.sfxVolume = this.clampVolume(val);
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public toggleMute(): GameSettings {
    this.settings.muted = !this.settings.muted;
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public setDifficulty(difficulty: GameDifficulty): GameSettings {
    this.settings.difficulty = difficulty;
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public resetSettings(): GameSettings {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.notify();
    return this.getSettings();
  }

  public subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private clampVolume(val: number): number {
    if (Number.isNaN(val)) return 0;
    return Math.max(0, Math.min(100, Math.round(val)));
  }

  private notify(): void {
    const current = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch {
        // Prevent subscriber errors from bubbling
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
        const validDifficulties: GameDifficulty[] = ['Easy', 'Normal', 'Hard'];
        return {
          musicVolume: typeof parsed.musicVolume === 'number' ? this.clampVolume(parsed.musicVolume) : DEFAULT_SETTINGS.musicVolume,
          sfxVolume: typeof parsed.sfxVolume === 'number' ? this.clampVolume(parsed.sfxVolume) : DEFAULT_SETTINGS.sfxVolume,
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
          difficulty: validDifficulties.includes(parsed.difficulty) ? parsed.difficulty : DEFAULT_SETTINGS.difficulty,
        };
      }
    } catch {
      // Fallback on defaults if parse error or restricted storage
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      const json = JSON.stringify(this.settings);
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(SETTINGS_STORAGE_KEY, json);
      } else {
        this.memoryFallback = json;
      }
    } catch {
      this.memoryFallback = JSON.stringify(this.settings);
    }
  }
}

export const settingsStore = SettingsStore.getInstance();
