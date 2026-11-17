/**
 * Make 24 game state and rules.
 *
 * This file has no page code. The view (Make24View.ts) reads this state to draw
 * the screen, and the controller (make24.ts) calls these methods when the player
 * clicks or presses a key.
 */
import {
  DIFFICULTIES,
  Fraction,
  applyOp,
  atom,
  findSolution,
  generatePuzzle,
  joinTerms,
  puzzleKey,
} from './logic';
import type { Difficulty, Op, Solution, Step, Term } from './logic';

/** Number of cards in a puzzle. */
export const CARD_COUNT = 4;

/** Coins per solve when the game doesn't set its own reward. */
export const DEFAULT_COIN_REWARD: Record<Difficulty, number> = { easy: 5, normal: 10, hard: 15 };

/** One card on the table. */
export interface Card {
  /** Unique id, so two cards with the same value can be told apart. */
  id: number;
  /** Position on screen, 0 to 3. */
  slot: number;
  /** The card's value and how it was made (e.g. "8 ÷ 3"). */
  term: Term;
}

/** What the game reports when a puzzle is solved. */
export interface Make24Result {
  /** The four starting numbers. */
  numbers: number[];
  target: number;
  difficulty: Difficulty;
  /** The student's own expression, e.g. "(8 − 4) × (3 + 3)". */
  expression: string;
  steps: Step[];
  timeMs: number;
  /** Coins awarded for this solve. */
  coinsEarned: number;
  /** Coin balance after this solve. */
  totalCoins: number;
}

/** What a coin reward function gets to decide the payout. */
export interface CoinRewardInfo {
  difficulty: Difficulty;
  timeMs: number;
  streak: number;
}

/** Coins per solve: a fixed number, or a function that decides. */
export type CoinReward = number | ((info: CoinRewardInfo) => number);

export interface ModelSettings {
  target: number;
  difficulty: Difficulty;
  /** Starting coin balance. */
  coins: number;
  coinReward?: CoinReward;
}

/** What happened after the player picked a card or an operation. */
export type MoveOutcome =
  | { kind: 'selection-changed' }
  | { kind: 'no-card-selected' }
  | { kind: 'divide-by-zero' }
  | { kind: 'combined' }
  | { kind: 'wrong-total'; value: Fraction }
  | { kind: 'solved'; result: Make24Result };

/** What the player walked away from when skipping an unsolved puzzle. */
export interface SkippedPuzzle {
  numbers: number[];
  /** One way to solve it, or null if it had no solution. */
  answer: Solution | null;
}

/** The cards and steps at one moment, saved so Undo can go back to it. */
interface Snapshot {
  cards: Card[];
  steps: Step[];
}

export class Make24Model {
  readonly target: number;
  difficulty: Difficulty;

  /** The starting numbers of the current puzzle. */
  numbers: number[] = [];
  cards: Card[] = [];
  /** The moves made so far, e.g. "9 − 7 = 2". */
  steps: Step[] = [];
  selectedId: number | null = null;
  pendingOp: Op | null = null;
  /** The card made by the latest move, so the view can animate it. */
  freshId: number | null = null;
  solved = false;

  coins: number;
  solvedCount = 0;
  streak = 0;

  private readonly coinReward: CoinReward | undefined;
  private history: Snapshot[] = [];
  private nextCardId = 1;
  private lastPuzzleKey = '';
  private startedAt = 0;
  private solveTimeMs = 0;

  constructor(settings: ModelSettings) {
    this.target = settings.target;
    this.difficulty = settings.difficulty;
    this.coins = toWholeCoins(settings.coins);
    this.coinReward = settings.coinReward;
  }

  // ---- reading the state -------------------------------------------------

  /** True when there is a move to undo. */
  get canUndo(): boolean {
    return !this.solved && this.history.length > 0;
  }

  /** True when choosing an operation makes sense: a card is picked and there's another to combine it with. */
  get canPickOperation(): boolean {
    return !this.solved && this.selectedId !== null && this.cards.length > 1;
  }

  cardById(id: number): Card | undefined {
    return this.cards.find((card) => card.id === id);
  }

  cardInSlot(slot: number): Card | undefined {
    return this.cards.find((card) => card.slot === slot);
  }

  /** Time spent on the current puzzle. Stops counting once it's solved. */
  elapsedMs(): number {
    if (this.solved) return this.solveTimeMs;
    return Date.now() - this.startedAt;
  }

  // ---- starting puzzles --------------------------------------------------

  /** Start a new puzzle: the given four numbers, or a random solvable one. */
  startPuzzle(fixedNumbers?: number[]): void {
    if (fixedNumbers) {
      checkPuzzleNumbers(fixedNumbers);
      if (findSolution(fixedNumbers, this.target) === null) {
        console.warn(`[make24] ${fixedNumbers.join(' ')} has no solution for ${this.target}`);
      }
      this.numbers = [...fixedNumbers];
    } else {
      // Never deal the same hand twice in a row.
      const avoid: string[] = [];
      if (this.lastPuzzleKey !== '') avoid.push(this.lastPuzzleKey);
      this.numbers = generatePuzzle(this.difficulty, { target: this.target, avoid });
    }

    this.lastPuzzleKey = puzzleKey(this.numbers);
    this.cards = this.numbers.map((n, slot) => this.makeCard(slot, atom(new Fraction(n))));
    this.steps = [];
    this.history = [];
    this.clearSelection();
    this.freshId = null;
    this.solved = false;
    this.startedAt = Date.now();
  }

  /**
   * Leave the current puzzle. Leaving an unsolved puzzle ends the streak and
   * returns what was skipped; leaving a solved one returns null.
   */
  leavePuzzle(): SkippedPuzzle | null {
    if (this.solved) return null;
    this.streak = 0;
    return { numbers: [...this.numbers], answer: findSolution(this.numbers, this.target) };
  }

  /** Change difficulty. Returns false if it was already that difficulty. */
  setDifficulty(difficulty: Difficulty): boolean {
    if (!Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty)) {
      throw new RangeError(`Unknown difficulty: ${difficulty}`);
    }
    if (difficulty === this.difficulty) return false;
    this.difficulty = difficulty;
    return true;
  }

  setCoins(coins: number): void {
    this.coins = toWholeCoins(coins);
  }

  // ---- player moves ------------------------------------------------------

  /** The player tapped a card. Returns null if nothing happened. */
  pickCard(id: number): MoveOutcome | null {
    if (this.solved || !this.cardById(id)) return null;
    this.freshId = null;

    // Tapping the selected card again un-selects it.
    if (this.selectedId === id) {
      this.clearSelection();
      return { kind: 'selection-changed' };
    }

    // A card and an operation are already chosen, so this is the second card.
    if (this.selectedId !== null && this.pendingOp !== null) {
      return this.combine(this.selectedId, this.pendingOp, id);
    }

    this.selectedId = id;
    return { kind: 'selection-changed' };
  }

  /** The player tapped an operation. Tapping the chosen one again un-chooses it. */
  pickOperation(op: Op): MoveOutcome | null {
    if (this.solved) return null;
    if (this.selectedId === null) return { kind: 'no-card-selected' };

    if (this.pendingOp === op) {
      this.pendingOp = null;
    } else {
      this.pendingOp = op;
    }
    return { kind: 'selection-changed' };
  }

  clearSelection(): void {
    this.selectedId = null;
    this.pendingOp = null;
  }

  /** Go back one move. Returns false if there was nothing to undo. */
  undo(): boolean {
    if (!this.canUndo) return false;
    const previous = this.history.pop();
    if (previous === undefined) return false;
    this.restore(previous);
    return true;
  }

  /** Go back to the starting cards. Returns false if no moves were made. */
  reset(): boolean {
    if (!this.canUndo) return false;
    const start = this.history[0];
    this.history = [];
    this.restore(start);
    return true;
  }

  // ---- internals ---------------------------------------------------------

  /** Merge two cards into one, in the second card's spot. */
  private combine(leftId: number, op: Op, rightId: number): MoveOutcome | null {
    const left = this.cardById(leftId);
    const right = this.cardById(rightId);
    if (left === undefined || right === undefined) return null;

    const value = applyOp(left.term.value, op, right.term.value);
    if (value === null) {
      this.pendingOp = null;
      return { kind: 'divide-by-zero' };
    }

    // Save the table as it is now, so Undo can come back to it.
    this.history.push({ cards: this.cards, steps: this.steps });

    const merged = this.makeCard(right.slot, joinTerms(left.term, op, right.term, value));
    const untouched = this.cards.filter((card) => card !== left && card !== right);
    this.cards = [...untouched, merged].sort((a, b) => a.slot - b.slot);
    this.steps = [...this.steps, { left: left.term.value, op, right: right.term.value, result: value }];
    this.pendingOp = null;
    this.freshId = merged.id;

    if (this.cards.length > 1) {
      // Keep the new card selected so the player can go straight on.
      this.selectedId = merged.id;
      return { kind: 'combined' };
    }

    this.selectedId = null;
    if (value.equals(this.target)) {
      return { kind: 'solved', result: this.win(merged) };
    }
    return { kind: 'wrong-total', value };
  }

  private win(finalCard: Card): Make24Result {
    this.solved = true;
    this.solveTimeMs = Date.now() - this.startedAt;
    this.solvedCount += 1;
    this.streak += 1;

    const coinsEarned = this.coinsForThisSolve();
    this.coins += coinsEarned;

    return {
      numbers: [...this.numbers],
      target: this.target,
      difficulty: this.difficulty,
      expression: finalCard.term.text,
      steps: [...this.steps],
      timeMs: this.solveTimeMs,
      coinsEarned,
      totalCoins: this.coins,
    };
  }

  private coinsForThisSolve(): number {
    if (this.coinReward === undefined) {
      return DEFAULT_COIN_REWARD[this.difficulty];
    }
    if (typeof this.coinReward === 'function') {
      const info = { difficulty: this.difficulty, timeMs: this.solveTimeMs, streak: this.streak };
      return toWholeCoins(this.coinReward(info));
    }
    return toWholeCoins(this.coinReward);
  }

  private restore(snapshot: Snapshot): void {
    this.cards = snapshot.cards;
    this.steps = snapshot.steps;
    this.clearSelection();
    this.freshId = null;
  }

  private makeCard(slot: number, term: Term): Card {
    const id = this.nextCardId;
    this.nextCardId += 1;
    return { id, slot, term };
  }
}

/** Throws if a fixed puzzle isn't exactly four positive whole numbers. */
function checkPuzzleNumbers(numbers: readonly number[]): void {
  const allValid = numbers.every((n) => Number.isInteger(n) && n >= 1);
  if (numbers.length !== CARD_COUNT || !allValid) {
    throw new RangeError('Make 24 needs exactly four positive whole numbers');
  }
}

/** Coins are never negative or fractional: rounds down, and anything invalid becomes 0. */
function toWholeCoins(amount: number): number {
  const whole = Math.floor(Number(amount));
  if (!Number.isFinite(whole) || whole < 0) return 0;
  return whole;
}
