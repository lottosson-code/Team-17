export interface LevelTarget {
  moduleId: number;
  levelId: number;
}

export interface LevelNodeDefinition {
  moduleId: number;
  levelId: number;
  label: string;
  x: number;
  y: number;
  unlocks: LevelTarget[];
  prerequisiteDescription: string;
}

export interface ModuleTheme {
  moduleId: number;
  workingTitle: string;
  shortLabel: string;
  themeKey: 'grassland' | 'cave' | 'lava';
}

export const MODULE_THEMES: Record<number, ModuleTheme> = {
  1: {
    moduleId: 1,
    workingTitle: 'Module 1: Basic Arithmetic (Grassland Theme)',
    shortLabel: 'Module 1 — Basic Arithmetic',
    themeKey: 'grassland',
  },
  2: {
    moduleId: 2,
    workingTitle: 'Module 2: Geometry & Shapes (Cave / Stone Theme)',
    shortLabel: 'Module 2 — Geometry & Shapes',
    themeKey: 'cave',
  },
  3: {
    moduleId: 3,
    workingTitle: 'Module 3: Algebra & Equations (Lava / Fortress Theme)',
    shortLabel: 'Module 3 — Algebra & Equations',
    themeKey: 'lava',
  },
};

export const MAP_PROGRESS_STORAGE_KEY = 'team17_math_rpg_map_progress_v1';

export function getLevelNodeDefinition(moduleId: number, levelId: number): LevelNodeDefinition {
  if (levelId === 1) {
    return {
      moduleId,
      levelId: 1,
      label: 'Level 1 (Start)',
      x: 220,
      y: 380,
      unlocks: [
        { moduleId, levelId: 2 },
        { moduleId, levelId: 3 },
      ],
      prerequisiteDescription:
        moduleId === 1
          ? 'Unlocked by default'
          : `Complete Module ${moduleId - 1} — Level 5 first`,
    };
  }
  if (levelId === 2) {
    return {
      moduleId,
      levelId: 2,
      label: 'Level 2 (Upper Path)',
      x: 500,
      y: 240,
      unlocks: [{ moduleId, levelId: 4 }],
      prerequisiteDescription: 'Complete Level 1 first',
    };
  }
  if (levelId === 3) {
    return {
      moduleId,
      levelId: 3,
      label: 'Level 3 (Lower Path)',
      x: 500,
      y: 520,
      unlocks: [{ moduleId, levelId: 4 }],
      prerequisiteDescription: 'Complete Level 1 first',
    };
  }
  if (levelId === 4) {
    return {
      moduleId,
      levelId: 4,
      label: 'Level 4 (Convergence)',
      x: 790,
      y: 380,
      unlocks: [{ moduleId, levelId: 5 }],
      prerequisiteDescription: 'Complete Level 2 or Level 3 first',
    };
  }
  if (levelId === 5) {
    return {
      moduleId,
      levelId: 5,
      label: 'Level 5 (Boss)',
      x: 1060,
      y: 380,
      unlocks: moduleId < 3 ? [{ moduleId: moduleId + 1, levelId: 1 }] : [],
      prerequisiteDescription: 'Complete Level 4 first',
    };
  }

  // Minigame branch nodes (nodes 6, 7, 8)
  if (levelId === 6) {
    return {
      moduleId,
      levelId: 6,
      label: 'Minigame 1',
      x: 320,
      y: 560,
      unlocks: [{ moduleId, levelId: 7 }],
      prerequisiteDescription: 'Complete Level 3 first',
    };
  }
  if (levelId === 7) {
    return {
      moduleId,
      levelId: 7,
      label: 'Minigame 2',
      x: 640,
      y: 570,
      unlocks: [{ moduleId, levelId: 8 }],
      prerequisiteDescription: 'Complete Minigame 1 first',
    };
  }
  if (levelId === 8) {
    return {
      moduleId,
      levelId: 8,
      label: 'Minigame 3',
      x: 960,
      y: 600,
      unlocks: [],
      prerequisiteDescription: 'Complete Minigame 2 first',
    };
  }

  return {
    moduleId,
    levelId,
    label: `Level ${levelId}`,
    x: 0,
    y: 0,
    unlocks: [],
    prerequisiteDescription: 'Complete preceding level first',
  };
}

export interface LevelSelectionAttemptResult {
  playable: boolean;
  status: 'unlocked' | 'locked';
  targetScene: 'Combat' | null;
  sceneData: { moduleId: number; levelId: number } | null;
  message: string;
}

export interface MapProgressData {
  unlockedLevels: string[];
  completedLevels: string[];
}

export class MapProgressStore {
  private static instance: MapProgressStore | null = null;
  private unlockedLevels: Set<string> = new Set(['1-1']);
  private completedLevels: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();
  private memoryFallback: string | null = null;

  constructor() {
    this.load();
  }

  public static getInstance(): MapProgressStore {
    if (!MapProgressStore.instance) {
      MapProgressStore.instance = new MapProgressStore();
    }
    return MapProgressStore.instance;
  }

  public static resetInstance(): void {
    MapProgressStore.instance = null;
  }

  private toKey(moduleId: number, levelId: number): string {
    return `${moduleId}-${levelId}`;
  }

  public isLevelUnlocked(moduleId: number, levelId: number): boolean {
    if (moduleId === 1 && levelId === 1) return true;
    return this.unlockedLevels.has(this.toKey(moduleId, levelId));
  }

  public isLevelLocked(moduleId: number, levelId: number): boolean {
    return !this.isLevelUnlocked(moduleId, levelId);
  }

  public isLevelCompleted(moduleId: number, levelId: number): boolean {
    return this.completedLevels.has(this.toKey(moduleId, levelId));
  }

  public isModuleUnlocked(moduleId: number): boolean {
    if (moduleId === 1) return true;
    return this.isLevelUnlocked(moduleId, 1);
  }

  public getUnlockedLevels(moduleId?: number): Array<{ moduleId: number; levelId: number }> {
    const result: Array<{ moduleId: number; levelId: number }> = [];
    for (const key of this.unlockedLevels) {
      const [m, l] = key.split('-').map(Number);
      if (m && l && (moduleId === undefined || m === moduleId)) {
        result.push({ moduleId: m, levelId: l });
      }
    }
    return result;
  }

  public getLockedLevels(moduleId?: number): Array<{ moduleId: number; levelId: number }> {
    const result: Array<{ moduleId: number; levelId: number }> = [];
    const targetModules = moduleId !== undefined ? [moduleId] : [1, 2, 3];

    for (const m of targetModules) {
      for (let l = 1; l <= 5; l++) {
        if (!this.isLevelUnlocked(m, l)) {
          result.push({ moduleId: m, levelId: l });
        }
      }
    }
    return result;
  }

  public getModuleProgress(moduleId: number): { completedCount: number; totalCount: number } {
    let completedCount = 0;
    for (let l = 1; l <= 5; l++) {
      if (this.isLevelCompleted(moduleId, l)) {
        completedCount++;
      }
    }
    return { completedCount, totalCount: 5 };
  }

  public getTotalProgress(): { completedCount: number; totalCount: number } {
    let completedCount = 0;
    for (let m = 1; m <= 3; m++) {
      for (let l = 1; l <= 5; l++) {
        if (this.isLevelCompleted(m, l)) completedCount++;
      }
    }
    return { completedCount, totalCount: 15 };
  }

  public attemptSelectLevel(moduleId: number, levelId: number): LevelSelectionAttemptResult {
    if (this.isLevelUnlocked(moduleId, levelId)) {
      return {
        playable: true,
        status: 'unlocked',
        targetScene: 'Combat',
        sceneData: { moduleId, levelId },
        message: `Starting Module ${moduleId} — Level ${levelId}`,
      };
    }

    const node = getLevelNodeDefinition(moduleId, levelId);
    return {
      playable: false,
      status: 'locked',
      targetScene: null,
      sceneData: null,
      message: `Level Locked — ${node.prerequisiteDescription}`,
    };
  }

  public completeLevel(
    moduleId: number,
    levelId: number
  ): { unlockedLevels: string[]; completedLevels: string[] } {
    const key = this.toKey(moduleId, levelId);
    this.completedLevels.add(key);

    const node = getLevelNodeDefinition(moduleId, levelId);
    for (const target of node.unlocks) {
      this.unlockedLevels.add(this.toKey(target.moduleId, target.levelId));
    }

    // Minigame bridge: completing level 3 unlocks minigame 1 (node 6)
    if (levelId === 3) {
      this.unlockedLevels.add(this.toKey(moduleId, 6));
    }

    this.save();
    this.notify();

    return {
      unlockedLevels: Array.from(this.unlockedLevels),
      completedLevels: Array.from(this.completedLevels),
    };
  }

  public resetProgress(): void {
    this.unlockedLevels = new Set(['1-1']);
    this.completedLevels = new Set();
    this.save();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Safe guard
      }
    }
  }

  private getStorage(): Storage | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
      if (
        typeof globalThis !== 'undefined' &&
        (globalThis as unknown as { localStorage?: Storage }).localStorage
      ) {
        return (globalThis as unknown as { localStorage: Storage }).localStorage;
      }
    } catch {
      return null;
    }
    return null;
  }

  private load(): void {
    try {
      const storage = this.getStorage();
      let raw: string | null = null;
      if (storage) {
        raw = storage.getItem(MAP_PROGRESS_STORAGE_KEY);
      } else {
        raw = this.memoryFallback;
      }

      if (raw) {
        const parsed = JSON.parse(raw) as MapProgressData;
        if (Array.isArray(parsed.unlockedLevels)) {
          this.unlockedLevels = new Set(parsed.unlockedLevels);
        }
        if (Array.isArray(parsed.completedLevels)) {
          this.completedLevels = new Set(parsed.completedLevels);
        }
      }
    } catch {
      // Graceful fallback to initial defaults
    }

    // Module 1 Level 1 is always unlocked
    this.unlockedLevels.add('1-1');
  }

  private save(): void {
    const data: MapProgressData = {
      unlockedLevels: Array.from(this.unlockedLevels),
      completedLevels: Array.from(this.completedLevels),
    };
    const json = JSON.stringify(data);
    try {
      const storage = this.getStorage();
      if (storage) {
        storage.setItem(MAP_PROGRESS_STORAGE_KEY, json);
      } else {
        this.memoryFallback = json;
      }
    } catch {
      this.memoryFallback = json;
    }
  }
}

export const mapProgressStore = MapProgressStore.getInstance();
