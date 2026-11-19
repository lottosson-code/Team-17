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

interface NodeTemplate {
  label: string;
  x: number;
  y: number;
  /** Same-module levelIds unlocked upon completing this node. */
  sameModuleUnlocks: number[];
  /** Whether completing this node unlocks Level 1 of the next module (if moduleId < 3). */
  unlocksNextModule?: boolean;
  prerequisiteDescription: (moduleId: number) => string;
}

const NODE_TEMPLATES: Record<number, NodeTemplate> = {
  1: {
    label: 'Level 1',
    x: 220,
    y: 380,
    sameModuleUnlocks: [2],
    prerequisiteDescription: (moduleId) => {
      if (moduleId === 1) {
        return 'Unlocked by default';
      }
      return `Complete Module ${moduleId - 1} — Level 5 first`;
    },
  },
  2: {
    label: 'Level 2',
    x: 500,
    y: 240,
    sameModuleUnlocks: [3],
    prerequisiteDescription: () => 'Complete Level 1 first',
  },
  3: {
    label: 'Level 3',
    x: 500,
    y: 520,
    sameModuleUnlocks: [4, 6],
    prerequisiteDescription: () => 'Complete Level 2 first',
  },
  4: {
    label: 'Level 4',
    x: 790,
    y: 380,
    sameModuleUnlocks: [5],
    prerequisiteDescription: () => 'Complete Level 3 first',
  },
  5: {
    label: 'Level 5 (Boss)',
    x: 1060,
    y: 380,
    sameModuleUnlocks: [],
    unlocksNextModule: true,
    prerequisiteDescription: () => 'Complete Level 4 first',
  },
  6: {
    label: 'Minigame 1',
    x: 320,
    y: 560,
    sameModuleUnlocks: [7],
    prerequisiteDescription: () => 'Complete Level 3 first',
  },
  7: {
    label: 'Minigame 2',
    x: 640,
    y: 570,
    sameModuleUnlocks: [8],
    prerequisiteDescription: () => 'Complete Minigame 1 first',
  },
  8: {
    label: 'Minigame 3',
    x: 960,
    y: 600,
    sameModuleUnlocks: [],
    prerequisiteDescription: () => 'Complete Minigame 2 first',
  },
};

export function getLevelNodeDefinition(moduleId: number, levelId: number): LevelNodeDefinition {
  const template = NODE_TEMPLATES[levelId];
  if (!template) {
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

  // Find which levels within the same module are unlocked upon completing this node.
  const unlocks: LevelTarget[] = template.sameModuleUnlocks.map((targetLevelId) => {
    return {
      moduleId: moduleId,
      levelId: targetLevelId,
    };
  });

  // If completing this level unlocks the next module (e.g. boss levels in module 1 or 2),
  // add Level 1 of the next module to the unlocked targets list.
  if (template.unlocksNextModule && moduleId < 3) {
    unlocks.push({ moduleId: moduleId + 1, levelId: 1 });
  }

  return {
    moduleId,
    levelId,
    label: template.label,
    x: template.x,
    y: template.y,
    unlocks,
    prerequisiteDescription: template.prerequisiteDescription(moduleId),
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
      // Keys are stored in the format "moduleId-levelId" (e.g. "1-3").
      const parts = key.split('-');
      const m = parseInt(parts[0], 10);
      const l = parseInt(parts[1], 10);

      const isValidNumbers = !Number.isNaN(m) && !Number.isNaN(l);
      const matchesModuleFilter = moduleId === undefined || m === moduleId;

      if (isValidNumbers && matchesModuleFilter) {
        result.push({ moduleId: m, levelId: l });
      }
    }
    return result;
  }

  public getLockedLevels(moduleId?: number): Array<{ moduleId: number; levelId: number }> {
    const result: Array<{ moduleId: number; levelId: number }> = [];
    let targetModules = [1, 2, 3];
    if (moduleId !== undefined) {
      targetModules = [moduleId];
    }

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
