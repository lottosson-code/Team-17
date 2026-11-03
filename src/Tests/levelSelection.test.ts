import { describe, expect, test } from 'vitest';
import { toGameplaySelection } from '../ui/levelSelection';
import type { LevelSelection } from '../../map/types';

function selected(room: number, node: number): LevelSelection {
  const roomId = 'classroom-' + String(room).padStart(2, '0');
  return { roomId, levelId: roomId + '-level-' + String(node).padStart(2, '0'), levelNumber: node, selectionCount: 1 };
}

describe('UI selection to gameplay adapter', () => {
  test('keeps the classroom and main-level number', () => {
    expect(toGameplaySelection(selected(2, 4))).toEqual({ moduleId: 2, levelId: 4, activity: 'level', selectionId: 'classroom-02-level-04' });
  });
  test('dispatches branch nodes as minigames, independently in each classroom', () => {
    expect(toGameplaySelection(selected(1, 6))).toEqual({ moduleId: 1, levelId: 1, activity: 'minigame', selectionId: 'classroom-01-level-06' });
    expect(toGameplaySelection(selected(3, 8))).toEqual({ moduleId: 3, levelId: 3, activity: 'minigame', selectionId: 'classroom-03-level-08' });
  });
  test('rejects unsupported rooms and out-of-range or inconsistent node IDs', () => {
    for (const selection of [selected(4, 1), selected(1, 0), selected(1, 9), { ...selected(1, 2), levelId: 'classroom-02-level-02' }]) {
      expect(() => toGameplaySelection(selection)).toThrow();
    }
  });
});
