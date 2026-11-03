import type { LevelSelection } from '../../map/types.js';

export interface GameplaySelection {
  moduleId: number;
  levelId: number;
  activity: 'level' | 'minigame';
  selectionId: string;
}

/** Adapt the UI's stable IDs to the existing gameplay scene contract. */
export function toGameplaySelection(selection: LevelSelection): GameplaySelection {
  const room = /^classroom-0([1-3])$/.exec(selection.roomId);
  const node = selection.levelNumber;
  const expectedId = selection.roomId + '-level-' + String(node).padStart(2, '0');
  if (!room || !Number.isInteger(node) || node < 1 || node > 8 || selection.levelId !== expectedId) {
    throw new RangeError('Unsupported classroom or level selection');
  }
  return {
    moduleId: Number(room[1]),
    levelId: node > 5 ? node - 5 : node,
    activity: node > 5 ? 'minigame' : 'level',
    selectionId: selection.levelId,
  };
}
