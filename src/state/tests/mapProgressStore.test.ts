import { describe, it, expect, beforeEach } from 'vitest';
import {
  MapProgressStore,
  MAP_PROGRESS_STORAGE_KEY,
  MODULE_THEMES,
} from '../mapProgressStore';

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

describe('mapProgressStore', () => {
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
    MapProgressStore.resetInstance();
  });

  it('exposes defined working themes for Modules 1, 2, and 3', () => {
    expect(MODULE_THEMES[1].themeKey).toBe('grassland');
    expect(MODULE_THEMES[2].themeKey).toBe('cave');
    expect(MODULE_THEMES[3].themeKey).toBe('lava');
  });

  it('initial state: only Module 1 Level 1 is unlocked by default', () => {
    const store = MapProgressStore.getInstance();

    expect(store.isLevelUnlocked(1, 1)).toBe(true);
    expect(store.isLevelLocked(1, 1)).toBe(false);

    // Other levels start locked
    expect(store.isLevelUnlocked(1, 2)).toBe(false);
    expect(store.isLevelUnlocked(1, 3)).toBe(false);
    expect(store.isLevelUnlocked(1, 4)).toBe(false);
    expect(store.isLevelUnlocked(1, 5)).toBe(false);

    // Module 1 is unlocked; Modules 2 & 3 are locked
    expect(store.isModuleUnlocked(1)).toBe(true);
    expect(store.isModuleUnlocked(2)).toBe(false);
    expect(store.isModuleUnlocked(3)).toBe(false);

    expect(store.getModuleProgress(1)).toEqual({ completedCount: 0, totalCount: 5 });
    expect(store.getTotalProgress()).toEqual({ completedCount: 0, totalCount: 15 });
  });

  it('completing Level 1 unlocks Level 2 (and keeps Level 3 locked)', () => {
    const store = MapProgressStore.getInstance();

    store.completeLevel(1, 1);

    expect(store.isLevelCompleted(1, 1)).toBe(true);
    expect(store.isLevelUnlocked(1, 2)).toBe(true);
    expect(store.isLevelUnlocked(1, 3)).toBe(false);
    expect(store.isLevelUnlocked(1, 4)).toBe(false);
  });

  it('completing Level 2 unlocks Level 3', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);
    store.completeLevel(1, 2);

    expect(store.isLevelUnlocked(1, 3)).toBe(true);
    expect(store.isLevelUnlocked(1, 4)).toBe(false);
  });

  it('completing Level 3 unlocks Level 4 and minigame 1', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);
    store.completeLevel(1, 2);
    store.completeLevel(1, 3);

    expect(store.isLevelUnlocked(1, 4)).toBe(true);
    expect(store.isLevelUnlocked(1, 6)).toBe(true);
  });

  it('completing Level 4 unlocks Boss Level 5', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);
    store.completeLevel(1, 2);
    store.completeLevel(1, 3);
    store.completeLevel(1, 4);

    expect(store.isLevelUnlocked(1, 5)).toBe(true);
  });

  it('completing Module 1 Boss Level 5 unlocks Module 2 Level 1', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);
    store.completeLevel(1, 2);
    store.completeLevel(1, 4);
    store.completeLevel(1, 5);

    expect(store.isModuleUnlocked(2)).toBe(true);
    expect(store.isLevelUnlocked(2, 1)).toBe(true);
    expect(store.isModuleUnlocked(3)).toBe(false);
  });

  it('attemptSelectLevel returns correct status and message for locked vs unlocked levels', () => {
    const store = MapProgressStore.getInstance();

    const unlockedAttempt = store.attemptSelectLevel(1, 1);
    expect(unlockedAttempt.playable).toBe(true);
    expect(unlockedAttempt.status).toBe('unlocked');
    expect(unlockedAttempt.targetScene).toBe('Combat');
    expect(unlockedAttempt.sceneData).toEqual({ moduleId: 1, levelId: 1 });

    const lockedAttempt = store.attemptSelectLevel(1, 2);
    expect(lockedAttempt.playable).toBe(false);
    expect(lockedAttempt.status).toBe('locked');
    expect(lockedAttempt.targetScene).toBeNull();
    expect(lockedAttempt.message).toContain('Complete Level 1 first');
  });

  it('resets progress back to initial state on resetProgress()', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);
    store.completeLevel(1, 2);
    store.completeLevel(1, 4);
    store.completeLevel(1, 5);

    expect(store.getModuleProgress(1).completedCount).toBe(4);

    store.resetProgress();
    expect(store.getModuleProgress(1).completedCount).toBe(0);
    expect(store.isLevelUnlocked(1, 1)).toBe(true);
    expect(store.isLevelUnlocked(1, 2)).toBe(false);
    expect(store.isModuleUnlocked(2)).toBe(false);
  });

  it('persists progress to localStorage under MAP_PROGRESS_STORAGE_KEY', () => {
    const store = MapProgressStore.getInstance();
    store.completeLevel(1, 1);

    const stored = mockStorage.getItem(MAP_PROGRESS_STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.completedLevels).toContain('1-1');
    expect(parsed.unlockedLevels).toContain('1-2');
    expect(parsed.unlockedLevels).not.toContain('1-3');

    // Reload from storage
    MapProgressStore.resetInstance();
    const reloaded = MapProgressStore.getInstance();
    expect(reloaded.isLevelCompleted(1, 1)).toBe(true);
    expect(reloaded.isLevelUnlocked(1, 2)).toBe(true);
  });
});
