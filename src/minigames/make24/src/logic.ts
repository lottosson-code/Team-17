/**
 * Make 24 game rules, with no page code.
 *
 * - Fraction: exact arithmetic, so 8 ÷ (3 − 8 ÷ 3) is exactly 24 with no rounding errors.
 * - findSolution: a brute-force solver, used to check puzzles and show answers.
 * - generatePuzzle: random puzzles that the solver has confirmed can be solved.
 */

export type Op = '+' | '-' | '*' | '/';
export type Difficulty = 'easy' | 'normal' | 'hard';

export const OPS: readonly Op[] = ['+', '-', '*', '/'];

/** How each operation is shown on screen. */
export const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

/** How a screen reader says each operation. */
export const OP_NAME: Record<Op, string> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
};

export interface DifficultySettings {
  label: string;
  /** Puzzles use numbers from 1 up to this. */
  maxNumber: number;
  /** If true, every puzzle can be solved without fractions or negative numbers. */
  wholeNumbersOnly: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  easy: { label: 'Easy', maxNumber: 9, wholeNumbersOnly: true },
  normal: { label: 'Normal', maxNumber: 10, wholeNumbersOnly: false },
  hard: { label: 'Hard', maxNumber: 13, wholeNumbersOnly: false }, // a full deck of cards
};

/* ------------------------------------------------------------------ */
/* Fractions                                                           */
/* ------------------------------------------------------------------ */

/** Greatest common divisor (Euclid's algorithm). */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

/** A number stored exactly as top / bottom whole numbers, always in lowest terms. */
export class Fraction {
  readonly num: number;
  readonly den: number;

  constructor(num: number, den = 1) {
    if (!Number.isInteger(num) || !Number.isInteger(den)) {
      throw new TypeError('Fraction parts must be integers');
    }
    if (den === 0) {
      throw new RangeError('Denominator cannot be zero');
    }

    // Keep the sign on top: 3 / −6 becomes −3 / 6.
    if (den < 0) {
      num = -num;
      den = -den;
    }

    // Reduce: 6/8 becomes 3/4. gcd is 0 only when num is 0, so fall back to 1.
    const divisor = gcd(Math.abs(num), den) || 1;
    this.num = num / divisor + 0; // "+ 0" turns −0 into plain 0
    this.den = den / divisor;
  }

  add(other: Fraction): Fraction {
    return new Fraction(this.num * other.den + other.num * this.den, this.den * other.den);
  }

  sub(other: Fraction): Fraction {
    return new Fraction(this.num * other.den - other.num * this.den, this.den * other.den);
  }

  mul(other: Fraction): Fraction {
    return new Fraction(this.num * other.num, this.den * other.den);
  }

  div(other: Fraction): Fraction {
    return new Fraction(this.num * other.den, this.den * other.num);
  }

  isZero(): boolean {
    return this.num === 0;
  }

  isInteger(): boolean {
    return this.den === 1;
  }

  isNegative(): boolean {
    return this.num < 0;
  }

  equals(other: Fraction | number): boolean {
    let fraction: Fraction;
    if (typeof other === 'number') fraction = new Fraction(other);
    else fraction = other;
    return this.num === fraction.num && this.den === fraction.den;
  }

  /** Plain text with a real minus sign: "24", "8/3", "−5". */
  toString(): string {
    let sign = '';
    if (this.num < 0) sign = '−';
    const top = Math.abs(this.num);

    if (this.den === 1) return `${sign}${top}`;
    return `${sign}${top}/${this.den}`;
  }
}

/** Does one operation. Returns null for division by zero. */
export function applyOp(a: Fraction, op: Op, b: Fraction): Fraction | null {
  switch (op) {
    case '+':
      return a.add(b);
    case '-':
      return a.sub(b);
    case '*':
      return a.mul(b);
    case '/':
      if (b.isZero()) return null;
      return a.div(b);
  }
}

/* ------------------------------------------------------------------ */
/* Expressions: a value plus readable text with only needed parentheses */
/* ------------------------------------------------------------------ */

/**
 * Precedence: how tightly a piece of an expression holds together.
 * A piece gets parentheses when it's put inside an operation that binds tighter.
 */
const PRECEDENCE_NEGATIVE = 0; // −2 always needs parentheses inside an expression
const PRECEDENCE_ADD = 1; // + and −
const PRECEDENCE_MULTIPLY = 2; // × and ÷ (a fraction like 8/3 counts as a division)
const PRECEDENCE_NUMBER = 3; // a plain number never needs parentheses

const PREC: Record<Op, number> = {
  '+': PRECEDENCE_ADD,
  '-': PRECEDENCE_ADD,
  '*': PRECEDENCE_MULTIPLY,
  '/': PRECEDENCE_MULTIPLY,
};

export interface Term {
  value: Fraction;
  text: string;
  /** Precedence of the outermost operation in `text` (see PRECEDENCE_* above). */
  prec: number;
}

/** Turns a single number into a Term. */
export function atom(value: Fraction): Term {
  const text = value.toString();
  if (value.isNegative()) return { value, text, prec: PRECEDENCE_NEGATIVE };
  if (value.isInteger()) return { value, text, prec: PRECEDENCE_NUMBER };
  return { value, text, prec: PRECEDENCE_MULTIPLY };
}

/** Combines two Terms, e.g. "1 + 2" and "4" with × become "(1 + 2) × 4". */
export function joinTerms(left: Term, op: Op, right: Term, value: Fraction): Term {
  const opPrecedence = PREC[op];

  // The left side needs parentheses only if it binds weaker: (1 + 2) × 4.
  let leftText = left.text;
  if (left.prec < opPrecedence) leftText = `(${left.text})`;

  // The right side also needs them at equal strength after − or ÷,
  // because 9 − (5 − 3) is not the same as 9 − 5 − 3.
  const orderMatters = op === '-' || op === '/';
  let rightText = right.text;
  if (right.prec < opPrecedence || (right.prec === opPrecedence && orderMatters)) {
    rightText = `(${right.text})`;
  }

  return { value, text: `${leftText} ${OP_SYMBOL[op]} ${rightText}`, prec: opPrecedence };
}

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

/** One move: left op right = result. */
export interface Step {
  left: Fraction;
  op: Op;
  right: Fraction;
  result: Fraction;
}

export interface Solution {
  expression: string;
  steps: Step[];
}

/** "9 − 7 = 2" */
export function stepText(step: Step): string {
  return `${step.left} ${OP_SYMBOL[step.op]} ${step.right} = ${step.result}`;
}

/**
 * Which results the search may pass through:
 * 'whole' = whole numbers only, 'nonNegative' = no negatives, 'any' = anything.
 */
type SearchMode = 'whole' | 'nonNegative' | 'any';

export interface SolveOptions {
  /** Only accept answers that never go through fractions or negative numbers. */
  wholeNumbersOnly?: boolean;
}

/**
 * Recursive search: pick any two values, try every way to combine them,
 * replace the pair with the result, and repeat until one value is left.
 */
function search(terms: Term[], steps: Step[], target: Fraction, mode: SearchMode): Solution | null {
  if (terms.length === 1) {
    const last = terms[0];
    if (last.value.equals(target)) return { expression: last.text, steps };
    return null;
  }

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const a = terms[i];
      const b = terms[j];
      const rest = terms.filter((_, k) => k !== i && k !== j);

      // + and × give the same answer either way round, so they're tried once.
      // Friendlier operations come first, so simpler answers are found first.
      const moves: [Term, Op, Term][] = [
        [a, '+', b],
        [a, '*', b],
        [a, '-', b],
        [b, '-', a],
        [a, '/', b],
        [b, '/', a],
      ];

      for (const [left, op, right] of moves) {
        const value = applyOp(left.value, op, right.value);
        if (value === null) continue; // divide by zero
        if (mode !== 'any' && value.isNegative()) continue;
        if (mode === 'whole' && !value.isInteger()) continue;

        const joined = joinTerms(left, op, right, value);
        const step = { left: left.value, op, right: right.value, result: value };
        const found = search([...rest, joined], [...steps, step], target, mode);
        if (found !== null) return found;
      }
    }
  }
  return null;
}

/**
 * Finds a way to make the target, or returns null if there is none.
 * Prefers the friendliest kind of answer: whole numbers only, then no negatives,
 * then anything. Works on any number of values, including fractions mid-game.
 */
export function findSolution(
  values: readonly (Fraction | number)[],
  target = 24,
  options: SolveOptions = {},
): Solution | null {
  const targetFraction = new Fraction(target);
  const terms = values.map((v) => atom(toFraction(v)));

  let modes: SearchMode[] = ['whole', 'nonNegative', 'any'];
  if (options.wholeNumbersOnly) modes = ['whole'];

  for (const mode of modes) {
    const solution = search(terms, [], targetFraction, mode);
    if (solution !== null) return solution;
  }
  return null;
}

export function isSolvable(numbers: readonly number[], target = 24, options: SolveOptions = {}): boolean {
  return findSolution(numbers, target, options) !== null;
}

function toFraction(value: Fraction | number): Fraction {
  if (typeof value === 'number') return new Fraction(value);
  return value;
}

/* ------------------------------------------------------------------ */
/* Puzzle generation                                                   */
/* ------------------------------------------------------------------ */

/** How many random hands to try before giving up. Practically never reached for 24. */
const MAX_PUZZLE_ATTEMPTS = 2000;

/** Used only if every attempt failed; it's always solvable for 24. */
const FALLBACK_PUZZLE = [1, 2, 3, 4];

/** Order-independent key, e.g. [8, 3, 8, 3] → "3,3,8,8". */
export function puzzleKey(numbers: readonly number[]): string {
  return [...numbers].sort((a, b) => a - b).join(',');
}

export interface GenerateOptions {
  target?: number;
  /** Random source in [0, 1). Pass a seeded function for repeatable puzzles. */
  rng?: () => number;
  /** Puzzle keys (see puzzleKey) to avoid, e.g. the one just played. */
  avoid?: Iterable<string>;
}

/** A random puzzle for the difficulty that the solver confirms can be solved. */
export function generatePuzzle(difficulty: Difficulty = 'normal', options: GenerateOptions = {}): number[] {
  const { maxNumber, wholeNumbersOnly } = DIFFICULTIES[difficulty];
  const target = options.target ?? 24;
  const random = options.rng ?? Math.random;
  const avoid = new Set(options.avoid ?? []);

  const rollNumber = () => 1 + Math.floor(random() * maxNumber);

  for (let attempt = 0; attempt < MAX_PUZZLE_ATTEMPTS; attempt++) {
    const hand = [rollNumber(), rollNumber(), rollNumber(), rollNumber()];
    if (avoid.has(puzzleKey(hand))) continue;
    if (isSolvable(hand, target, { wholeNumbersOnly })) return hand;
  }

  if (target === 24) return [...FALLBACK_PUZZLE];
  throw new Error(`Could not generate a ${difficulty} puzzle for target ${target}`);
}
