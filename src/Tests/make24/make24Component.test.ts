// @vitest-environment jsdom
/**
 * Component tests for the Make 24 minigame UI (src/minigames/make24/src/make24.ts).
 * Each test mounts the game into a fake page (jsdom), clicks buttons the way a
 * student would, and checks what is shown and which callbacks fire.
 * Puzzles are fixed with the `numbers` option and timers are faked, so every
 * run is identical.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountMake24 } from '../../minigames/make24/src/make24';
import type { Make24Controller, Make24Options, Make24Result } from '../../minigames/make24/src/make24';

let container: HTMLElement;
let game: Make24Controller | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  game?.destroy();
  game = undefined;
  container.remove();
  vi.useRealTimers();
});

/* ---- helpers ------------------------------------------------------------ */

function mount(options: Make24Options = {}) {
  game = mountMake24(container, { keyboard: false, ...options });
  return game.element;
}

function find<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = container.querySelector<T>(selector);
  if (!el) throw new Error(`Nothing matches ${selector}`);
  return el;
}

/** The four card positions, left to right. Empty positions are null. */
function slots(): (HTMLButtonElement | null)[] {
  return [...container.querySelectorAll('.cse-make24__cards > *')].map((el) =>
    el instanceof HTMLButtonElement ? el : null);
}

/** Card values as shown on screen, e.g. ['3', null, '8/3', '8']. */
function shownValues(): (string | null)[] {
  return slots().map((card) => {
    if (!card) return null;
    const whole = card.querySelector('.cse-make24__int');
    if (whole) return whole.textContent;
    const sign = card.querySelector('.cse-make24__sign')?.textContent ?? '';
    const [top, bottom] = card.querySelectorAll('.cse-make24__frac > span');
    return `${sign}${top.textContent}/${bottom.textContent}`;
  });
}

function clickCard(slot: number) {
  const card = slots()[slot];
  if (!card) throw new Error(`No card in slot ${slot}`);
  card.click();
}

function clickOp(op: '+' | '-' | '*' | '/') {
  find<HTMLButtonElement>(`[data-op="${op}"]`).click();
}

/** Combine the cards in two slots: first card, operation, second card. */
function combine(leftSlot: number, op: '+' | '-' | '*' | '/', rightSlot: number) {
  // Picking a card while another is selected (with no operation chosen) switches the selection.
  if (!slots()[leftSlot]?.classList.contains('is-selected')) clickCard(leftSlot);
  clickOp(op);
  clickCard(rightSlot);
}

/** Solves 6 6 6 6 as 6 + 6 + 6 + 6. */
function solveSixes() {
  combine(0, '+', 1);
  combine(1, '+', 2);
  combine(2, '+', 3);
}

const feedback = () => find('.cse-make24__feedback').textContent ?? '';
const stat = (name: string) => find(`[data-stat="${name}"]`).textContent;
const overlay = () => find('.cse-make24__overlay');

/* ---- tests -------------------------------------------------------------- */

describe('starting a puzzle', () => {
  it('shows the four numbers it was given', () => {
    mount({ numbers: [4, 7, 8, 9] });
    expect(shownValues()).toEqual(['4', '7', '8', '9']);
  });

  it('starts with no steps, no coins and the operations disabled', () => {
    mount({ numbers: [4, 7, 8, 9] });
    expect(find('.cse-make24__log').textContent).toContain('Pick a number');
    expect(stat('coins')).toBe('0');
    for (const op of container.querySelectorAll<HTMLButtonElement>('[data-op]')) {
      expect(op.disabled).toBe(true);
    }
  });

  it('shows the starting coin balance', () => {
    mount({ numbers: [4, 7, 8, 9], coins: 40 });
    expect(stat('coins')).toBe('40');
  });

  it('makes a random solvable puzzle when no numbers are given', () => {
    mount({ difficulty: 'easy' });
    const values = shownValues();
    expect(values).toHaveLength(4);
    expect(values.every((v) => v !== null && Number(v) >= 1 && Number(v) <= 9)).toBe(true);
  });

  it('rejects puzzles that are not four positive whole numbers', () => {
    const bad = (numbers: number[]) => () => mountMake24(container, { numbers, keyboard: false });
    expect(bad([1, 2, 3])).toThrow(RangeError);
    expect(bad([1, 2, 3, 0])).toThrow(RangeError);
    expect(bad([1, 2, 3, 4.5])).toThrow(RangeError);
  });
});

describe('selecting cards and operations', () => {
  it('selects a card, enables the operations, and deselects on a second tap', () => {
    mount({ numbers: [4, 7, 8, 9] });
    clickCard(0);
    expect(slots()[0]!.classList.contains('is-selected')).toBe(true);
    expect(find<HTMLButtonElement>('[data-op="+"]').disabled).toBe(false);

    clickCard(0);
    expect(slots()[0]!.classList.contains('is-selected')).toBe(false);
    expect(find<HTMLButtonElement>('[data-op="+"]').disabled).toBe(true);
  });

  it('merges two cards into the second card’s spot and logs the step', () => {
    mount({ numbers: [9, 4, 7, 8] });
    combine(0, '-', 2);
    expect(shownValues()).toEqual([null, '4', '2', '8']);
    expect(find('.cse-make24__log').textContent).toContain('9 − 7 = 2');
    // The new card stays selected so the student can keep going.
    expect(slots()[2]!.classList.contains('is-selected')).toBe(true);
  });

  it('shows fractions exactly', () => {
    mount({ numbers: [3, 3, 8, 8] });
    combine(2, '/', 1);
    expect(shownValues()).toEqual(['3', '8/3', null, '8']);
  });

  it('shows negative results', () => {
    mount({ numbers: [2, 5, 6, 8] });
    combine(0, '-', 1);
    expect(shownValues()[1]).toBe('−3');
  });

  it('refuses to divide by zero and keeps the cards as they were', () => {
    mount({ numbers: [3, 3, 1, 2] });
    combine(0, '-', 1); // 3 − 3 = 0
    combine(2, '/', 1); // 1 ÷ 0
    expect(feedback()).toContain("can't divide by zero");
    expect(shownValues()).toEqual([null, '0', '1', '2']);
  });
});

describe('undo and reset', () => {
  it('undo goes back one step', () => {
    mount({ numbers: [1, 2, 3, 4] });
    combine(0, '+', 1);
    combine(1, '+', 2);
    find<HTMLButtonElement>('[data-action="undo"]').click();
    expect(shownValues()).toEqual([null, '3', '3', '4']);
  });

  it('reset goes back to the starting numbers', () => {
    mount({ numbers: [1, 2, 3, 4] });
    combine(0, '+', 1);
    combine(1, '+', 2);
    find<HTMLButtonElement>('[data-action="reset"]').click();
    expect(shownValues()).toEqual(['1', '2', '3', '4']);
    expect(find<HTMLButtonElement>('[data-action="undo"]').disabled).toBe(true);
  });
});

describe('finishing a puzzle', () => {
  it('reports a wrong final answer without paying coins', () => {
    const onSolve = vi.fn();
    mount({ numbers: [1, 2, 3, 4], onSolve });
    combine(0, '+', 1);
    combine(1, '+', 2);
    combine(2, '+', 3); // 1 + 2 + 3 + 4 = 10
    expect(feedback()).toContain('That makes 10, not 24');
    expect(onSolve).not.toHaveBeenCalled();
    expect(stat('coins')).toBe('0');
  });

  it('calls onSolve with the student’s expression and the coins earned', () => {
    const onSolve = vi.fn();
    mount({ numbers: [6, 6, 6, 6], coins: 5, onSolve });
    vi.advanceTimersByTime(5000);
    solveSixes();

    expect(onSolve).toHaveBeenCalledTimes(1);
    const result = onSolve.mock.calls[0][0] as Make24Result;
    expect(result.expression).toBe('6 + 6 + 6 + 6');
    expect(result.numbers).toEqual([6, 6, 6, 6]);
    expect(result.steps).toHaveLength(3);
    expect(result.timeMs).toBe(5000);
    expect(result.coinsEarned).toBe(10); // Normal difficulty
    expect(result.totalCoins).toBe(15);
    expect(stat('coins')).toBe('15');
    expect(stat('solved')).toBe('1');
    expect(stat('streak')).toBe('1');
  });

  it('solves puzzles that need fractions', () => {
    const onSolve = vi.fn();
    mount({ numbers: [3, 3, 8, 8], onSolve });
    combine(2, '/', 1); // 8 ÷ 3 = 8/3
    combine(0, '-', 1); // 3 − 8/3 = 1/3
    combine(3, '/', 1); // 8 ÷ 1/3 = 24
    expect((onSolve.mock.calls[0][0] as Make24Result).expression).toBe('8 ÷ (3 − 8 ÷ 3)');
  });

  it('shows the win screen after a short pause', () => {
    mount({ numbers: [6, 6, 6, 6] });
    solveSixes();
    expect(overlay().hidden).toBe(true);
    vi.advanceTimersByTime(700);
    expect(overlay().hidden).toBe(false);
    expect(find('.cse-make24__result-coins').textContent).toContain('+10 coins');
  });

  it('keeps coins and streak when moving on to the next puzzle', () => {
    mount({ numbers: [6, 6, 6, 6] });
    solveSixes();
    vi.advanceTimersByTime(700);
    find<HTMLButtonElement>('[data-action="next"]').click();
    expect(overlay().hidden).toBe(true);
    expect(shownValues().every((v) => v !== null)).toBe(true);
    expect(stat('coins')).toBe('10');
    expect(stat('streak')).toBe('1');
  });
});

describe('coin rewards', () => {
  function coinsForOneSolve(options: Make24Options) {
    const onSolve = vi.fn();
    mount({ numbers: [6, 6, 6, 6], onSolve, ...options });
    solveSixes();
    return (onSolve.mock.calls[0][0] as Make24Result).coinsEarned;
  }

  it('pays more for harder difficulties by default', () => {
    expect(coinsForOneSolve({ difficulty: 'easy' })).toBe(5);
  });

  it('pays 15 on hard by default', () => {
    expect(coinsForOneSolve({ difficulty: 'hard' })).toBe(15);
  });

  it('accepts a fixed reward', () => {
    expect(coinsForOneSolve({ coinReward: 3 })).toBe(3);
  });

  it('accepts a reward function and passes it the solve details', () => {
    const coinReward = vi.fn(() => 7);
    expect(coinsForOneSolve({ coinReward, difficulty: 'hard' })).toBe(7);
    expect(coinReward).toHaveBeenCalledWith({ difficulty: 'hard', timeMs: 0, streak: 1 });
  });

  it('never pays a negative number of coins', () => {
    expect(coinsForOneSolve({ coinReward: -5 })).toBe(0);
  });

  it('rounds a fractional reward down', () => {
    expect(coinsForOneSolve({ coinReward: 2.9 })).toBe(2);
  });

  it('lets the host game read and set the balance', () => {
    mount({ numbers: [4, 7, 8, 9], coins: 12 });
    expect(game!.getCoins()).toBe(12);
    game!.setCoins(30.7);
    expect(game!.getCoins()).toBe(30);
    expect(stat('coins')).toBe('30');
    game!.setCoins(-4);
    expect(game!.getCoins()).toBe(0);
  });
});

describe('skipping, exiting and cleanup', () => {
  it('New puzzle reports the skip, shows an answer and resets the streak', () => {
    const onSkip = vi.fn();
    mount({ numbers: [6, 6, 6, 6], onSkip });
    solveSixes();
    find<HTMLButtonElement>('[data-action="next"]').click();
    expect(stat('streak')).toBe('1');

    game!.newPuzzle([4, 7, 8, 9]);
    find<HTMLButtonElement>('[data-action="skip"]').click();
    expect(onSkip).toHaveBeenCalledWith([4, 7, 8, 9]);
    expect(stat('streak')).toBe('0');
    expect(feedback()).toContain('Last one:');
    expect([...shownValues()].sort()).not.toEqual(['4', '7', '8', '9']);
  });

  it('hides the Map button when there is no onExit', () => {
    mount({ numbers: [4, 7, 8, 9] });
    expect(find('.cse-make24__exit').hidden).toBe(true);
  });

  it('calls onExit when the Map button is pressed', () => {
    const onExit = vi.fn();
    mount({ numbers: [4, 7, 8, 9], onExit });
    find<HTMLButtonElement>('.cse-make24__exit').click();
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('switching difficulty starts a new puzzle in that range', () => {
    mount({ numbers: [4, 7, 8, 9] });
    find<HTMLButtonElement>('[data-difficulty="hard"]').click();
    expect(find('[data-difficulty="hard"]').getAttribute('aria-pressed')).toBe('true');
    expect(shownValues().every((v) => Number(v) >= 1 && Number(v) <= 13)).toBe(true);
  });

  it('destroy removes the game from the page', () => {
    mount({ numbers: [4, 7, 8, 9] });
    game!.destroy();
    game = undefined;
    expect(container.querySelector('.cse-make24')).toBeNull();
  });
});
