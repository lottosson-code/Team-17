
export type Op = '+' | '-' | '*' | '/';
export type Difficulty = 'easy' | 'normal' | 'hard';

export const OPS: readonly Op[] = ['+', '-', '*', '/'];
export const OP_SYMBOL: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };
export const OP_NAME: Record<Op, string> = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' };

export const DIFFICULTIES: Record<Difficulty, { label: string; maxNumber: number; wholeNumbersOnly: boolean }> = {
  // Numbers 1–9, always solvable without fractions or negatives.
  easy: { label: 'Easy', maxNumber: 9, wholeNumbersOnly: true },
  // Numbers 1–10, any solvable puzzle.
  normal: { label: 'Normal', maxNumber: 10, wholeNumbersOnly: false },
  // Numbers 1–13 (a full deck of cards), any solvable puzzle.
  hard: { label: 'Hard', maxNumber: 13, wholeNumbersOnly: false },
};

/* ------------------------------------------------------------------ */
/* Fractions                                                           */
/* ------------------------------------------------------------------ */

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

export class Fraction {
  readonly num: number;
  readonly den: number;

  constructor(num: number, den = 1) {
    if (!Number.isInteger(num) || !Number.isInteger(den)) throw new TypeError('Fraction parts must be integers');
    if (den === 0) throw new RangeError('Denominator cannot be zero');
    if (den < 0) { num = -num; den = -den; }
    const g = gcd(Math.abs(num), den) || 1;
    this.num = num / g + 0; // "+ 0" turns -0 into 0
    this.den = den / g;
  }

  add(o: Fraction) { return new Fraction(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o: Fraction) { return new Fraction(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(o: Fraction) { return new Fraction(this.num * o.num, this.den * o.den); }
  div(o: Fraction) { return new Fraction(this.num * o.den, this.den * o.num); }

  isZero() { return this.num === 0; }
  isInteger() { return this.den === 1; }
  isNegative() { return this.num < 0; }
  equals(o: Fraction | number) {
    const f = typeof o === 'number' ? new Fraction(o) : o;
    return this.num === f.num && this.den === f.den;
  }
  /** Plain-text form using a real minus sign: "24", "8/3", "−5". */
  toString() {
    const sign = this.num < 0 ? '−' : '';
    const n = Math.abs(this.num);
    return this.den === 1 ? `${sign}${n}` : `${sign}${n}/${this.den}`;
  }
}

/** Returns null for division by zero. */
export function applyOp(a: Fraction, op: Op, b: Fraction): Fraction | null {
  switch (op) {
    case '+': return a.add(b);
    case '-': return a.sub(b);
    case '*': return a.mul(b);
    case '/': return b.isZero() ? null : a.div(b);
  }
}

/* ------------------------------------------------------------------ */
/* Expressions (value + readable text with minimal parentheses)       */
/* ------------------------------------------------------------------ */

export interface Term {
  value: Fraction;
  text: string;
  /** 3 = plain number, 2 = × ÷, 1 = + −, 0 = negative number. */
  prec: number;
}

const PREC: Record<Op, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export function atom(value: Fraction): Term {
  if (value.isNegative()) return { value, text: value.toString(), prec: 0 };
  // A fraction card like 8/3 behaves like a division when it sits inside a bigger expression.
  return { value, text: value.toString(), prec: value.isInteger() ? 3 : 2 };
}

export function joinTerms(left: Term, op: Op, right: Term, value: Fraction): Term {
  const p = PREC[op];
  const l = left.prec < p ? `(${left.text})` : left.text;
  const needsRight = right.prec < p || (right.prec === p && (op === '-' || op === '/'));
  const r = needsRight ? `(${right.text})` : right.text;
  return { value, text: `${l} ${OP_SYMBOL[op]} ${r}`, prec: p };
}

/* ------------------------------------------------------------------ */
/* Solver                                                              */
/* ------------------------------------------------------------------ */

export interface Step { left: Fraction; op: Op; right: Fraction; result: Fraction }
export interface Solution { expression: string; steps: Step[] }

export function stepText(s: Step) {
  return `${s.left} ${OP_SYMBOL[s.op]} ${s.right} = ${s.result}`;
}

type Mode = 'whole' | 'nonNegative' | 'any';

function search(terms: Term[], steps: Step[], target: Fraction, mode: Mode): Solution | null {
  if (terms.length === 1) return terms[0].value.equals(target) ? { expression: terms[0].text, steps } : null;

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const a = terms[i];
      const b = terms[j];
      const rest = terms.filter((_, k) => k !== i && k !== j);
      // Ordered so friendlier operations are tried first.
      const tries: [Term, Op, Term][] = [[a, '+', b], [a, '*', b], [a, '-', b], [b, '-', a], [a, '/', b], [b, '/', a]];
      for (const [l, op, r] of tries) {
        const v = applyOp(l.value, op, r.value);
        if (!v) continue;
        if (mode !== 'any' && v.isNegative()) continue;
        if (mode === 'whole' && !v.isInteger()) continue;
        const found = search(
          [...rest, joinTerms(l, op, r, v)],
          [...steps, { left: l.value, op, right: r.value, result: v }],
          target,
          mode,
        );
        if (found) return found;
      }
    }
  }
  return null;
}

/**
 * Finds a solution, preferring the friendliest kind: whole numbers only, then no
 * negatives, then anything. Works on any number of values (used for mid-game hints).
 */
export function findSolution(values: readonly (Fraction | number)[], target = 24, opts: { wholeNumbersOnly?: boolean } = {}): Solution | null {
  const t = new Fraction(target);
  const terms = values.map((v) => atom(typeof v === 'number' ? new Fraction(v) : v));
  const modes: Mode[] = opts.wholeNumbersOnly ? ['whole'] : ['whole', 'nonNegative', 'any'];
  for (const mode of modes) {
    const s = search(terms, [], t, mode);
    if (s) return s;
  }
  return null;
}

export function isSolvable(numbers: readonly number[], target = 24, opts: { wholeNumbersOnly?: boolean } = {}) {
  return findSolution(numbers, target, opts) !== null;
}

/* ------------------------------------------------------------------ */
/* Puzzle generation                                                   */
/* ------------------------------------------------------------------ */

/** Order-independent key, e.g. [8, 3, 8, 3] -> "3,3,8,8". */
export function puzzleKey(numbers: readonly number[]) {
  return [...numbers].sort((a, b) => a - b).join(',');
}

export interface GenerateOptions {
  target?: number;
  /** Random source in [0, 1). Pass a seeded function for repeatable puzzles. */
  rng?: () => number;
  /** Puzzle keys (see puzzleKey) to avoid, e.g. the one just played. */
  avoid?: Iterable<string>;
}

export function generatePuzzle(difficulty: Difficulty = 'normal', opts: GenerateOptions = {}): number[] {
  const { maxNumber, wholeNumbersOnly } = DIFFICULTIES[difficulty];
  const target = opts.target ?? 24;
  const rng = opts.rng ?? Math.random;
  const avoid = new Set(opts.avoid ?? []);
  const roll = () => 1 + Math.floor(rng() * maxNumber);

  for (let attempt = 0; attempt < 2000; attempt++) {
    const nums = [roll(), roll(), roll(), roll()];
    if (avoid.has(puzzleKey(nums))) continue;
    if (isSolvable(nums, target, { wholeNumbersOnly })) return nums;
  }
  // Practically unreachable for target 24; a safe fallback for unusual targets.
  if (target === 24) return [1, 2, 3, 4];
  throw new Error(`Could not generate a ${difficulty} puzzle for target ${target}`);
}
