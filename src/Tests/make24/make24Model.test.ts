/**
 * Unit tests for the Make 24 game state and rules (src/minigames/make24/src/Make24Model.ts).
 * The model has no page code, so these run without jsdom: just create a model,
 * make moves, and check the state. Puzzles are fixed so every run is identical.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Make24Model, DEFAULT_COIN_REWARD } from '../../minigames/make24/src/Make24Model';
import type { MoveOutcome, ModelSettings } from '../../minigames/make24/src/Make24Model';
import type { Op } from '../../minigames/make24/src/logic';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A model with a fixed starting puzzle. */
function modelWith(numbers: number[], settings: Partial<ModelSettings> = {}): Make24Model {
  const model = new Make24Model({ target: 24, difficulty: 'normal', coins: 0, ...settings });
  model.startPuzzle(numbers);
  return model;
}

/** The id of the card in a slot (fails the test if the slot is empty). */
function idInSlot(model: Make24Model, slot: number): number {
  const card = model.cardInSlot(slot);
  if (card === undefined) throw new Error(`No card in slot ${slot}`);
  return card.id;
}

/** Combine two slots the way a player would: card, operation, card. */
function combine(model: Make24Model, leftSlot: number, op: Op, rightSlot: number): MoveOutcome | null {
  if (model.selectedId !== idInSlot(model, leftSlot)) model.pickCard(idInSlot(model, leftSlot));
  model.pickOperation(op);
  return model.pickCard(idInSlot(model, rightSlot));
}

/** Card values left to right, e.g. ['3', '8/3', '8']. */
function values(model: Make24Model): string[] {
  return model.cards.map((card) => card.term.value.toString());
}

/** Solves 6 6 6 6 as 6 + 6 + 6 + 6 and returns the final outcome. */
function solveSixes(model: Make24Model): MoveOutcome | null {
  combine(model, 0, '+', 1);
  combine(model, 1, '+', 2);
  return combine(model, 2, '+', 3);
}

describe('starting a puzzle', () => {
  it('deals one card per number into slots 0–3, with nothing selected', () => {
    const model = modelWith([4, 7, 8, 9]);
    expect(values(model)).toEqual(['4', '7', '8', '9']);
    expect(model.cards.map((card) => card.slot)).toEqual([0, 1, 2, 3]);
    expect(model.selectedId).toBeNull();
    expect(model.canUndo).toBe(false);
    expect(model.canPickOperation).toBe(false);
  });

  it('rejects invalid numbers and keeps the current puzzle', () => {
    const model = modelWith([4, 7, 8, 9]);
    expect(() => model.startPuzzle([1, 2, 3])).toThrow(RangeError);
    expect(() => model.startPuzzle([1, 2, 3, -4])).toThrow(RangeError);
    expect(values(model)).toEqual(['4', '7', '8', '9']);
  });

  it('warns when a fixed puzzle has no solution', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      modelWith([1, 1, 1, 1]);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('never deals the same random hand twice in a row', () => {
    const model = new Make24Model({ target: 24, difficulty: 'easy', coins: 0 });
    let previous = '';
    for (let i = 0; i < 50; i++) {
      model.startPuzzle();
      const hand = [...model.numbers].sort((a, b) => a - b).join(',');
      expect(hand).not.toBe(previous);
      previous = hand;
    }
  });
});

describe('picking cards and operations', () => {
  it('selects a card, and un-selects it on a second tap', () => {
    const model = modelWith([4, 7, 8, 9]);
    const first = idInSlot(model, 0);
    expect(model.pickCard(first)).toEqual({ kind: 'selection-changed' });
    expect(model.selectedId).toBe(first);
    expect(model.canPickOperation).toBe(true);

    model.pickCard(first);
    expect(model.selectedId).toBeNull();
  });

  it('switches the selection when another card is tapped before an operation', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.pickCard(idInSlot(model, 0));
    model.pickCard(idInSlot(model, 2));
    expect(model.selectedId).toBe(idInSlot(model, 2));
  });

  it('ignores a card id that is not on the table', () => {
    const model = modelWith([4, 7, 8, 9]);
    expect(model.pickCard(999)).toBeNull();
  });

  it('asks for a card before an operation', () => {
    const model = modelWith([4, 7, 8, 9]);
    expect(model.pickOperation('+')).toEqual({ kind: 'no-card-selected' });
    expect(model.pendingOp).toBeNull();
  });

  it('chooses an operation, and un-chooses it on a second tap', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.pickCard(idInSlot(model, 0));
    model.pickOperation('*');
    expect(model.pendingOp).toBe('*');
    model.pickOperation('*');
    expect(model.pendingOp).toBeNull();
  });

  it('ignores an operation when only one card is left', () => {
    const model = modelWith([1, 2, 3, 4]);
    combine(model, 0, '+', 1);
    combine(model, 1, '+', 2);
    combine(model, 2, '+', 3); // 10 is the only card left, so this is a wrong total
    model.pickCard(idInSlot(model, 3)); // select the last card, like pressing "4" on the keyboard
    expect(model.pickOperation('+')).toBeNull();
    expect(model.pendingOp).toBeNull();
  });
});

describe('combining cards', () => {
  it('merges into the second card’s slot, keeps it selected and logs the step', () => {
    const model = modelWith([9, 4, 7, 8]);
    expect(combine(model, 0, '-', 2)).toEqual({ kind: 'combined' });
    expect(model.cards.map((card) => [card.slot, card.term.value.toString()])).toEqual([[1, '4'], [2, '2'], [3, '8']]);
    expect(model.selectedId).toBe(idInSlot(model, 2));
    expect(model.freshId).toBe(idInSlot(model, 2));
    expect(model.steps).toHaveLength(1);
    expect(model.canUndo).toBe(true);
  });

  it('keeps fractions exact', () => {
    const model = modelWith([3, 3, 8, 8]);
    combine(model, 2, '/', 1);
    expect(values(model)).toEqual(['3', '8/3', '8']);
  });

  it('refuses to divide by zero and changes nothing but the operation', () => {
    const model = modelWith([3, 3, 1, 2]);
    combine(model, 0, '-', 1); // 3 − 3 = 0
    const before = values(model);
    expect(combine(model, 2, '/', 1)).toEqual({ kind: 'divide-by-zero' });
    expect(values(model)).toEqual(before);
    expect(model.pendingOp).toBeNull();
    expect(model.selectedId).toBe(idInSlot(model, 2));
  });

  it('reports a wrong final total without counting it as solved', () => {
    const model = modelWith([1, 2, 3, 4]);
    combine(model, 0, '+', 1);
    combine(model, 1, '+', 2);
    const outcome = combine(model, 2, '+', 3);
    expect(outcome !== null && outcome.kind).toBe('wrong-total');
    expect(model.solved).toBe(false);
    expect(model.coins).toBe(0);
  });
});

describe('solving', () => {
  it('returns the result, adds coins and counts the solve', () => {
    const model = modelWith([6, 6, 6, 6], { coins: 5 });
    vi.advanceTimersByTime(4_000);
    const outcome = solveSixes(model);

    expect(outcome === null ? null : outcome.kind).toBe('solved');
    if (outcome === null || outcome.kind !== 'solved') return;
    expect(outcome.result.expression).toBe('6 + 6 + 6 + 6');
    expect(outcome.result.timeMs).toBe(4_000);
    expect(outcome.result.coinsEarned).toBe(DEFAULT_COIN_REWARD.normal);
    expect(outcome.result.totalCoins).toBe(15);
    expect(model.coins).toBe(15);
    expect(model.solvedCount).toBe(1);
    expect(model.streak).toBe(1);
  });

  it('solves puzzles that need fractions', () => {
    const model = modelWith([3, 3, 8, 8]);
    combine(model, 2, '/', 1);
    combine(model, 0, '-', 1);
    const outcome = combine(model, 3, '/', 1);
    expect(outcome !== null && outcome.kind === 'solved' && outcome.result.expression).toBe('8 ÷ (3 − 8 ÷ 3)');
  });

  it('ignores moves and undo after the puzzle is solved', () => {
    const model = modelWith([6, 6, 6, 6]);
    solveSixes(model);
    expect(model.pickCard(idInSlot(model, 3))).toBeNull();
    expect(model.pickOperation('+')).toBeNull();
    expect(model.undo()).toBe(false);
    expect(model.reset()).toBe(false);
  });

  it('stops the clock when solved', () => {
    const model = modelWith([6, 6, 6, 6]);
    vi.advanceTimersByTime(2_000);
    expect(model.elapsedMs()).toBe(2_000);
    solveSixes(model);
    vi.advanceTimersByTime(10_000);
    expect(model.elapsedMs()).toBe(2_000);
  });
});

describe('coin rewards', () => {
  function coinsFor(settings: Partial<ModelSettings>): number {
    const model = modelWith([6, 6, 6, 6], settings);
    solveSixes(model);
    return model.coins;
  }

  it('uses the default reward for each difficulty', () => {
    expect(coinsFor({ difficulty: 'easy' })).toBe(5);
    expect(coinsFor({ difficulty: 'normal' })).toBe(10);
    expect(coinsFor({ difficulty: 'hard' })).toBe(15);
  });

  it('accepts a fixed reward, rounding down and never below zero', () => {
    expect(coinsFor({ coinReward: 3 })).toBe(3);
    expect(coinsFor({ coinReward: 2.9 })).toBe(2);
    expect(coinsFor({ coinReward: -5 })).toBe(0);
  });

  it('passes the solve details to a reward function', () => {
    const coinReward = vi.fn(() => 7);
    expect(coinsFor({ coinReward, difficulty: 'hard' })).toBe(7);
    expect(coinReward).toHaveBeenCalledWith({ difficulty: 'hard', timeMs: 0, streak: 1 });
  });

  it('keeps setCoins whole and non-negative', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.setCoins(30.7);
    expect(model.coins).toBe(30);
    model.setCoins(-4);
    expect(model.coins).toBe(0);
  });
});

describe('undo and reset', () => {
  it('undo goes back one move; reset goes back to the start', () => {
    const model = modelWith([1, 2, 3, 4]);
    combine(model, 0, '+', 1);
    combine(model, 1, '+', 2);

    expect(model.undo()).toBe(true);
    expect(values(model)).toEqual(['3', '3', '4']);
    expect(model.selectedId).toBeNull();

    combine(model, 1, '*', 3);
    expect(model.reset()).toBe(true);
    expect(values(model)).toEqual(['1', '2', '3', '4']);
    expect(model.canUndo).toBe(false);
  });

  it('returns false when there is nothing to undo', () => {
    const model = modelWith([1, 2, 3, 4]);
    expect(model.undo()).toBe(false);
    expect(model.reset()).toBe(false);
  });
});

describe('leaving a puzzle and changing difficulty', () => {
  it('leaving an unsolved puzzle ends the streak and returns an answer', () => {
    const model = modelWith([6, 6, 6, 6]);
    solveSixes(model);
    model.startPuzzle([4, 7, 8, 9]);

    const skipped = model.leavePuzzle();
    expect(model.streak).toBe(0);
    expect(skipped === null ? null : skipped.numbers).toEqual([4, 7, 8, 9]);
    expect(skipped !== null && skipped.answer !== null).toBe(true);
  });

  it('leaving a solved puzzle keeps the streak', () => {
    const model = modelWith([6, 6, 6, 6]);
    solveSixes(model);
    expect(model.leavePuzzle()).toBeNull();
    expect(model.streak).toBe(1);
  });

  it('reports whether the difficulty changed, and rejects unknown ones', () => {
    const model = modelWith([4, 7, 8, 9]);
    expect(model.setDifficulty('normal')).toBe(false);
    expect(model.setDifficulty('hard')).toBe(true);
    expect(model.difficulty).toBe('hard');
    expect(() => model.setDifficulty('expert' as never)).toThrow(RangeError);
  });
});

describe('pausing the clock', () => {
  it('does not count time while paused', () => {
    const model = modelWith([4, 7, 8, 9]);
    vi.advanceTimersByTime(2_000);
    model.pauseClock();
    vi.advanceTimersByTime(30_000);
    expect(model.elapsedMs()).toBe(2_000);

    model.resumeClock();
    vi.advanceTimersByTime(1_000);
    expect(model.elapsedMs()).toBe(3_000);
  });

  it('ignores a second pause or a resume without a pause', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.resumeClock(); // nothing to resume
    model.pauseClock();
    vi.advanceTimersByTime(5_000);
    model.pauseClock(); // already paused: must not move the pause point
    model.resumeClock();
    expect(model.elapsedMs()).toBe(0);
  });

  it('starts a puzzle dealt while paused at 0:00', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.pauseClock();
    vi.advanceTimersByTime(5_000);
    model.startPuzzle([6, 6, 6, 6]);
    vi.advanceTimersByTime(5_000);
    expect(model.elapsedMs()).toBe(0);
    model.resumeClock();
    vi.advanceTimersByTime(1_000);
    expect(model.elapsedMs()).toBe(1_000);
  });
});

describe('hints', () => {
  /** Plays the move the hint suggests, the way a player would. */
  function followHint(model: Make24Model): MoveOutcome | null {
    const hint = model.useHint();
    if (hint === null) throw new Error('Expected a hint');
    model.pickCard(hint.leftId);
    model.pickOperation(hint.op);
    return model.pickCard(hint.rightId);
  }

  /** The value on a card, as text. */
  function valueOf(model: Make24Model, id: number): string | undefined {
    const card = model.cardById(id);
    if (card === undefined) return undefined;
    return card.term.value.toString();
  }

  it('solves the puzzle if you follow the hint every time', () => {
    const puzzles = [[4, 7, 8, 9], [3, 3, 8, 8], [6, 6, 6, 6], [1, 5, 5, 5], [1, 3, 4, 6]];
    for (const numbers of puzzles) {
      const model = modelWith(numbers);
      let outcome = followHint(model);
      while (outcome !== null && outcome.kind === 'combined') {
        outcome = followHint(model);
      }
      expect(outcome).not.toBeNull();
      expect(outcome!.kind).toBe('solved');
    }
  });

  it('points at two different cards when they have the same value', () => {
    const model = modelWith([6, 6, 6, 6]);
    const hint = model.useHint();
    expect(hint).not.toBeNull();
    expect(hint!.leftId).not.toBe(hint!.rightId);
  });

  it('works from the middle of a puzzle, including fractions', () => {
    const model = modelWith([3, 3, 8, 8]);
    combine(model, 2, '/', 1); // 8 ÷ 3 lands in slot 1
    expect(values(model)).toEqual(['3', '8/3', '8']);

    const hint = model.useHint();
    expect(hint).not.toBeNull();
    // From 3, 8/3, 8 the only way to 24 is 8 ÷ (3 − 8/3), so the next step is 3 − 8/3.
    expect(valueOf(model, hint!.leftId)).toBe('3');
    expect(hint!.op).toBe('-');
    expect(valueOf(model, hint!.rightId)).toBe('8/3');
  });

  it('gives no hint when the cards left cannot make 24', () => {
    const model = modelWith([6, 6, 6, 6]);
    combine(model, 0, '*', 1);
    combine(model, 1, '*', 2); // 216 and 6 left: no way to 24
    expect(model.useHint()).toBeNull();
    expect(model.hint).toBeNull();
    expect(model.hintsUsed).toBe(0);
  });

  it('gives no hint once the puzzle is solved', () => {
    const model = modelWith([6, 6, 6, 6]);
    solveSixes(model);
    expect(model.useHint()).toBeNull();
  });

  it('clears the selected card and operation so the hinted move starts fresh', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.pickCard(idInSlot(model, 0));
    model.pickOperation('+');
    model.useHint();
    expect(model.selectedId).toBeNull();
    expect(model.pendingOp).toBeNull();
  });

  it('halves the coins (rounded down) when a hint was used', () => {
    const normal = modelWith([6, 6, 6, 6]);
    normal.useHint();
    const normalOutcome = solveSixes(normal);
    if (normalOutcome === null || normalOutcome.kind !== 'solved') {
      throw new Error('Expected a solve');
    }
    expect(normalOutcome.result.coinsEarned).toBe(5); // 10 halved
    expect(normalOutcome.result.hintsUsed).toBe(1);

    const easy = modelWith([6, 6, 6, 6], { difficulty: 'easy' });
    easy.useHint();
    easy.useHint(); // more hints don't cost more
    const easyOutcome = solveSixes(easy);
    if (easyOutcome === null || easyOutcome.kind !== 'solved') {
      throw new Error('Expected a solve');
    }
    expect(easyOutcome.result.coinsEarned).toBe(2); // 5 halved, rounded down
    expect(easyOutcome.result.hintsUsed).toBe(2);
  });

  it('removes the hint after a move, undo or reset, but keeps counting hints used', () => {
    // 6 + 6 keeps 6 6 6 6 solvable, so a hint is always available here.
    const model = modelWith([6, 6, 6, 6]);
    expect(model.useHint()).not.toBeNull();
    combine(model, 0, '+', 1);
    expect(model.hint).toBeNull();

    expect(model.useHint()).not.toBeNull();
    model.undo();
    expect(model.hint).toBeNull();

    combine(model, 0, '+', 1);
    expect(model.useHint()).not.toBeNull();
    model.reset();
    expect(model.hint).toBeNull();
    // Undo and Reset don't give the coins back.
    expect(model.hintsUsed).toBe(3);
  });

  it('starts each new puzzle with no hint and no hints used', () => {
    const model = modelWith([4, 7, 8, 9]);
    model.useHint();
    model.startPuzzle([6, 6, 6, 6]);
    expect(model.hint).toBeNull();
    expect(model.hintsUsed).toBe(0);
  });
});
