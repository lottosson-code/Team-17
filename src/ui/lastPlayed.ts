/**
 * Remembers the last level the player started, for the main menu's Continue button.
 * This is separate from map progress: progress is the furthest level unlocked,
 * while this is simply the most recent level the player entered.
 */
import type { LevelSelection } from '../../map/types.js';
import { toGameplaySelection } from './levelSelection';

/** localStorage key for the level the player started most recently. */
export const LAST_PLAYED_STORAGE_KEY = 'team17_math_rpg_last_played_v1';

// Backup copy kept in memory, used when the browser has no localStorage (e.g. in unit tests).
let memoryFallback: string | null = null;

/** Returns the browser's localStorage, or null if the browser blocks it. */
function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Saves the level the player just started (called each time a level opens).
 * Stores the map's IDs for that level, which is all Continue needs to reopen it.
 */
export function saveLastPlayed(selection: LevelSelection): void {
  const json = JSON.stringify(selection);
  memoryFallback = json;
  try {
    // Write to the browser's storage, so the level is still known after the browser is closed.
    getStorage()?.setItem(LAST_PLAYED_STORAGE_KEY, json);
  } catch {
    // Storage is full or blocked; the in-memory copy still works until the page is closed.
  }
}

/**
 * Returns the level the player started last time, or null if there is none.
 * Null means a first-time player (or after New Game), so the menu hides Continue.
 */
export function loadLastPlayed(): LevelSelection | null {
  try {
    // Read the browser's storage; if it is unavailable, use the in-memory copy.
    const raw = getStorage()?.getItem(LAST_PLAYED_STORAGE_KEY) ?? memoryFallback;
    if (!raw) return null;
    const saved = JSON.parse(raw) as LevelSelection;
    // Reuse the map's own check; it throws if the saved data is damaged.
    toGameplaySelection(saved);
    // The saved level is valid: Continue will open it.
    return saved;
  } catch {
    // Damaged or unreadable data counts as "no saved level".
    return null;
  }
}

/** Forgets the saved level, both in storage and in memory (called by New Game). */
export function clearLastPlayed(): void {
  memoryFallback = null;
  try {
    getStorage()?.removeItem(LAST_PLAYED_STORAGE_KEY);
  } catch {
    // Storage is blocked, so there is nothing stored to remove.
  }
}
