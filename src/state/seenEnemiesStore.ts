/**
 * Which enemies the player has already met, so combat tags an enemy as new only the first
 * time it ever appears, not once per level. Saved in localStorage; if storage is missing or
 * blocked, it is remembered for this session only. "New Game" clears it.
 */

export const SEEN_ENEMIES_STORAGE_KEY = 'team17_math_rpg_seen_enemies_v1';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export class SeenEnemiesStore {
  private seen = new Set<string>();

  constructor(private readonly storage: KeyValueStorage | null = browserStorage()) {
    this.load();
  }

  public hasSeen(id: string): boolean {
    return this.seen.has(id);
  }

  /** Records that the player met `id`. Returns true only the first time. */
  public markSeen(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    this.save();
    return true;
  }

  /** Forgets every enemy, so each one is tagged as new again. */
  public reset(): void {
    this.seen.clear();
    this.save();
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(SEEN_ENEMIES_STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.seen = new Set(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      // An unreadable save counts as nothing seen yet.
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(SEEN_ENEMIES_STORAGE_KEY, JSON.stringify([...this.seen]));
    } catch {
      // Full or blocked storage: `seen` still holds it for this session.
    }
  }
}

function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const seenEnemiesStore = new SeenEnemiesStore();
