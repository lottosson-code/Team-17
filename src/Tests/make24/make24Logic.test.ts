/**
 * Unit tests for the Make 24 game logic (src/minigames/make24/src/logic.ts).
 * Pure functions only: no DOM needed. Random puzzle generation uses a seeded
 * random number generator so every run is identical.
 */
import { describe, expect, it } from 'vitest';
import {
  Fraction,
  applyOp,
  atom,
  findSolution,
  generatePuzzle,
  isSolvable,
  joinTerms,
  puzzleKey,
} from '../../minigames/make24/src/logic';
import type { Difficulty, Solution } from '../../minigames/make24/src/logic';

/** Small seeded random number generator (mulberry32) so tests are repeatable. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replays a solution step by step: every step must use two values that are
 * currently available, compute its result correctly, and the last value left
 * must equal the target.
 */
function isValidSolution(numbers: number[], solution: Solution, target = 24): boolean {
  let pool = numbers.map((n) => new Fraction(n));
  for (const step of solution.steps) {
    const leftIndex = pool.findIndex((v) => v.equals(step.left));
    if (leftIndex === -1) return false;
    pool = pool.filter((_, i) => i !== leftIndex);
    const rightIndex = pool.findIndex((v) => v.equals(step.right));
    if (rightIndex === -1) return false;
    pool = pool.filter((_, i) => i !== rightIndex);
    const result = applyOp(step.left, step.op, step.right);
    if (!result || !result.equals(step.result)) return false;
    pool.push(result);
  }
  return pool.length === 1 && pool[0].equals(target);
}

describe('Fraction', () => {
  it('reduces to lowest terms', () => {
    const f = new Fraction(6, 8);
    expect(f.num).toBe(3);
    expect(f.den).toBe(4);
  });

  it('keeps the sign on the numerator', () => {
    const f = new Fraction(3, -6);
    expect(f.num).toBe(-1);
    expect(f.den).toBe(2);
  });

  it('turns negative zero into plain zero', () => {
    const f = new Fraction(0, -5);
    expect(Object.is(f.num, 0)).toBe(true);
    expect(f.toString()).toBe('0');
  });

  it('rejects a zero denominator', () => {
    expect(() => new Fraction(1, 0)).toThrow(RangeError);
  });

  it('rejects non-integer parts', () => {
    expect(() => new Fraction(1.5, 2)).toThrow(TypeError);
  });

  it('adds, subtracts, multiplies and divides exactly', () => {
    const half = new Fraction(1, 2);
    const third = new Fraction(1, 3);
    expect(half.add(third).toString()).toBe('5/6');
    expect(half.sub(third).toString()).toBe('1/6');
    expect(half.mul(third).toString()).toBe('1/6');
    expect(half.div(third).toString()).toBe('3/2');
  });

  it('prints whole numbers, fractions and negatives', () => {
    expect(new Fraction(24).toString()).toBe('24');
    expect(new Fraction(8, 3).toString()).toBe('8/3');
    expect(new Fraction(-5).toString()).toBe('−5'); // real minus sign
  });

  it('compares with fractions and plain numbers', () => {
    expect(new Fraction(48, 2).equals(24)).toBe(true);
    expect(new Fraction(2, 4).equals(new Fraction(1, 2))).toBe(true);
    expect(new Fraction(1, 3).equals(new Fraction(1, 2))).toBe(false);
  });
});

describe('applyOp', () => {
  const six = new Fraction(6);
  const two = new Fraction(2);

  it('applies each of the four operations', () => {
    expect(applyOp(six, '+', two)!.equals(8)).toBe(true);
    expect(applyOp(six, '-', two)!.equals(4)).toBe(true);
    expect(applyOp(six, '*', two)!.equals(12)).toBe(true);
    expect(applyOp(six, '/', two)!.equals(3)).toBe(true);
  });

  it('returns null when dividing by zero', () => {
    expect(applyOp(six, '/', new Fraction(0))).toBeNull();
  });

  it('allows zero divided by a number', () => {
    expect(applyOp(new Fraction(0), '/', six)!.equals(0)).toBe(true);
  });

  it('has no rounding error on the classic 3 3 8 8 puzzle', () => {
    // 8 ÷ (3 − 8 ÷ 3) = 24 exactly; floating point gives 23.999999999999996.
    const eight = new Fraction(8);
    const three = new Fraction(3);
    const inner = applyOp(three, '-', applyOp(eight, '/', three)!)!;
    expect(applyOp(eight, '/', inner)!.equals(24)).toBe(true);
  });
});

describe('expression text', () => {
  const n = (value: number) => atom(new Fraction(value));

  it('adds parentheses only where they change the meaning', () => {
    const sum = joinTerms(n(1), '+', n(2), new Fraction(3));
    expect(joinTerms(sum, '*', n(4), new Fraction(12)).text).toBe('(1 + 2) × 4');
    expect(joinTerms(n(4), '*', sum, new Fraction(12)).text).toBe('4 × (1 + 2)');
    expect(joinTerms(sum, '+', n(4), new Fraction(7)).text).toBe('1 + 2 + 4');
  });

  it('keeps parentheses on the right side of − and ÷', () => {
    const diff = joinTerms(n(5), '-', n(3), new Fraction(2));
    expect(joinTerms(n(9), '-', diff, new Fraction(7)).text).toBe('9 − (5 − 3)');
    const quotient = joinTerms(n(8), '/', n(4), new Fraction(2));
    expect(joinTerms(n(16), '/', quotient, new Fraction(8)).text).toBe('16 ÷ (8 ÷ 4)');
  });

  it('wraps negative numbers in parentheses', () => {
    const negative = atom(new Fraction(-2));
    expect(joinTerms(n(5), '*', negative, new Fraction(-10)).text).toBe('5 × (−2)');
  });
});

describe('findSolution', () => {
  it('solves a puzzle with a valid, checkable answer', () => {
    const solution = findSolution([4, 7, 8, 9]);
    expect(solution).not.toBeNull();
    expect(isValidSolution([4, 7, 8, 9], solution!)).toBe(true);
  });

  it('solves puzzles that need fractions', () => {
    const solution = findSolution([3, 3, 8, 8]);
    expect(solution!.expression).toBe('8 ÷ (3 − 8 ÷ 3)');
    expect(isValidSolution([3, 3, 8, 8], solution!)).toBe(true);
  });

  it('returns null when there is no solution', () => {
    expect(findSolution([1, 1, 1, 1])).toBeNull();
    expect(findSolution([1, 1, 1, 2])).toBeNull();
  });

  it('can be limited to whole-number steps', () => {
    // 3 3 8 8 can only be solved by going through 8/3.
    expect(findSolution([3, 3, 8, 8], 24, { wholeNumbersOnly: true })).toBeNull();
    const solution = findSolution([4, 7, 8, 9], 24, { wholeNumbersOnly: true });
    expect(solution!.steps.every((s) => s.result.isInteger() && !s.result.isNegative())).toBe(true);
  });

  it('prefers whole-number steps when they exist', () => {
    const solution = findSolution([1, 2, 3, 4]);
    expect(solution!.steps.every((s) => s.result.isInteger())).toBe(true);
  });

  it('supports other targets', () => {
    const solution = findSolution([1, 2, 3, 4], 10);
    expect(isValidSolution([1, 2, 3, 4], solution!, 10)).toBe(true);
  });

  it('works mid-game with fewer cards and fractions', () => {
    expect(findSolution([new Fraction(8, 3), 3, 8])).not.toBeNull();
    expect(findSolution([24])!.steps).toHaveLength(0);
    expect(findSolution([23])).toBeNull();
  });

  it('agrees with the known count of solvable hands for 1–13', () => {
    // A standard deck gives 1820 different hands; 1362 of them can make 24.
    let solvable = 0;
    let total = 0;
    for (let a = 1; a <= 13; a++)
      for (let b = a; b <= 13; b++)
        for (let c = b; c <= 13; c++)
          for (let d = c; d <= 13; d++) {
            total++;
            if (isSolvable([a, b, c, d])) solvable++;
          }
    expect(total).toBe(1820);
    expect(solvable).toBe(1362);
  });
});

describe('puzzleKey', () => {
  it('ignores the order of the numbers', () => {
    expect(puzzleKey([8, 3, 8, 3])).toBe('3,3,8,8');
    expect(puzzleKey([3, 8, 3, 8])).toBe(puzzleKey([8, 8, 3, 3]));
  });

  it('sorts numerically, not alphabetically', () => {
    expect(puzzleKey([10, 2, 13, 1])).toBe('1,2,10,13');
  });
});

describe('generatePuzzle', () => {
  const ranges: [Difficulty, number][] = [['easy', 9], ['normal', 10], ['hard', 13]];

  for (const [difficulty, maxNumber] of ranges) {
    it(`makes solvable ${difficulty} puzzles with numbers 1–${maxNumber}`, () => {
      const rng = seededRandom(42);
      for (let i = 0; i < 200; i++) {
        const puzzle = generatePuzzle(difficulty, { rng });
        expect(puzzle).toHaveLength(4);
        expect(puzzle.every((n) => Number.isInteger(n) && n >= 1 && n <= maxNumber)).toBe(true);
        expect(isSolvable(puzzle)).toBe(true);
      }
    });
  }

  it('only gives easy puzzles that never need fractions or negatives', () => {
    const rng = seededRandom(7);
    for (let i = 0; i < 200; i++) {
      const puzzle = generatePuzzle('easy', { rng });
      expect(isSolvable(puzzle, 24, { wholeNumbersOnly: true })).toBe(true);
    }
  });

  it('is repeatable with the same seed', () => {
    const first = generatePuzzle('hard', { rng: seededRandom(123) });
    const second = generatePuzzle('hard', { rng: seededRandom(123) });
    expect(first).toEqual(second);
  });

  it('skips puzzles listed in avoid', () => {
    const avoided = generatePuzzle('normal', { rng: seededRandom(99) });
    const next = generatePuzzle('normal', { rng: seededRandom(99), avoid: [puzzleKey(avoided)] });
    expect(puzzleKey(next)).not.toBe(puzzleKey(avoided));
  });

  // The next two tests make the generator try (and solve) 2000 unsolvable hands,
  // which takes a few seconds, so they get a longer time limit than Vitest's 5 s default.
  it('falls back to 1 2 3 4 if it keeps rolling unsolvable hands', { timeout: 20_000 }, () => {
    // A generator stuck on 0 always rolls 1 1 1 1, which can never make 24.
    expect(generatePuzzle('normal', { rng: () => 0 })).toEqual([1, 2, 3, 4]);
  });

  it('throws when an unusual target cannot be reached', { timeout: 20_000 }, () => {
    // 1 1 1 1 can make at most 4, so a target of 5 is impossible.
    expect(() => generatePuzzle('normal', { rng: () => 0, target: 5 })).toThrow();
  });
});
