/**
 * Make 24 minigame — UI component for Math Nightmare.
 *
 *   import { mountMake24 } from './make24.js';
 *   const game = mountMake24(document.querySelector('#scene')!, {
 *     difficulty: 'normal',
 *     onSolve: (result) => monster.takeDamage(10),
 *     onExit: () => showMap(),
 *   });
 *   // later: game.destroy();
 *
 * Also link make24.css. All class names are prefixed `cse-make24` so nothing
 * leaks into the host game.
 */

import {
  DIFFICULTIES, Fraction, OPS, OP_NAME, OP_SYMBOL,
  applyOp, atom, findSolution, generatePuzzle, joinTerms, puzzleKey, stepText,
} from './logic.js';
import type { Difficulty, Op, Step, Term } from './logic.js';

export type { Difficulty, Op, Step } from './logic.js';

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
export interface CoinRewardInfo { difficulty: Difficulty; timeMs: number; streak: number }

/** Default coins per solve. */
export const DEFAULT_COIN_REWARD: Record<Difficulty, number> = { easy: 5, normal: 10, hard: 15 };

export interface Make24Options {
  difficulty?: Difficulty;
  /** Number to reach. Defaults to 24. */
  target?: number;
  /** Fixed first puzzle (four positive whole numbers). Random if omitted. */
  numbers?: number[];
  /** Optional scene image, e.g. the classroom background used by the main menu. */
  backgroundSrc?: string;
  /** Heading text. Defaults to "Make 24". */
  title?: string;
  /** Label of the exit button. Defaults to "Map". Shown only when onExit is set. */
  exitLabel?: string;
  /** Show the Easy / Normal / Hard switch. Defaults to true. */
  showDifficulty?: boolean;
  /** Keyboard shortcuts (1–4, + − * /, Backspace, R, N, Esc). Defaults to true. */
  keyboard?: boolean;
  /** Player's coin balance when the minigame opens (e.g. from their save). Defaults to 0. */
  coins?: number;
  /** Coins per solve: a fixed number, or a function. Defaults to Easy 5 / Normal 10 / Hard 15. */
  coinReward?: number | ((info: CoinRewardInfo) => number);
  onSolve?: (result: Make24Result) => void;
  /** Called when the player gives up on a puzzle with "New puzzle". */
  onSkip?: (numbers: number[]) => void;
  onExit?: () => void;
}

export interface Make24Controller {
  readonly element: HTMLElement;
  /** Start a new puzzle: random, or the given four numbers. */
  newPuzzle(numbers?: number[]): void;
  setDifficulty(difficulty: Difficulty): void;
  /** Current coin balance. */
  getCoins(): number;
  /** Overwrite the displayed balance, e.g. after the player spends coins elsewhere. */
  setCoins(coins: number): void;
  /** Stop timers, remove listeners and remove the game from the page. */
  destroy(): void;
}

interface Card { id: number; slot: number; term: Term }
interface Snapshot { cards: Card[]; steps: Step[] }
type Tone = 'info' | 'good' | 'warn';

const C = 'cse-make24';

export function mountMake24(host: HTMLElement, options: Make24Options = {}): Make24Controller {
  const target = options.target ?? 24;
  const keyboard = options.keyboard ?? true;
  let difficulty: Difficulty = options.difficulty ?? 'normal';

  // ---- state ---------------------------------------------------------
  let numbers: number[] = [];
  let cards: Card[] = [];
  let steps: Step[] = [];
  let history: Snapshot[] = [];
  let selectedId: number | null = null;
  let pendingOp: Op | null = null;
  let freshId: number | null = null;
  let nextId = 1;
  let solved = false;
  let coins = Math.max(0, Math.floor(options.coins ?? 0));
  let startedAt = 0;
  let frozenMs = 0;
  let solvedCount = 0;
  let streak = 0;
  let lastKey = '';

  // ---- markup --------------------------------------------------------
  const root = document.createElement('section');
  root.className = C;
  root.setAttribute('aria-label', `Make ${target} minigame`);
  root.innerHTML = `
    ${options.backgroundSrc ? `<img class="${C}__background" alt="" draggable="false">` : ''}
    <div class="${C}__vignette" aria-hidden="true"></div>
    <button type="button" class="${C}__exit" data-action="exit" hidden>
      <span aria-hidden="true">‹</span> <span class="${C}__exit-label"></span>
    </button>
    <h2 class="${C}__title"></h2>
    <div class="${C}__stats">
      <div class="${C}__stat ${C}__stat--coins"><span>Coins</span><b><i class="${C}__coin" aria-hidden="true"></i><span data-stat="coins">0</span></b></div>
      <div class="${C}__stat"><span>Solved</span><b data-stat="solved">0</b></div>
      <div class="${C}__stat"><span>Streak</span><b data-stat="streak">0</b></div>
      <div class="${C}__stat"><span>Time</span><b data-stat="time">0:00</b></div>
    </div>
    <div class="${C}__panel">
      <div class="${C}__header">
        <p class="${C}__prompt">Use all four numbers once with + − × ÷ to make <b>${target}</b>.</p>
        <div class="${C}__difficulty" role="group" aria-label="Difficulty">
          ${(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) =>
            `<button type="button" data-difficulty="${d}">${DIFFICULTIES[d].label}</button>`).join('')}
        </div>
      </div>
      <div class="${C}__cards" role="group" aria-label="Number cards"></div>
      <div class="${C}__ops" role="group" aria-label="Operations">
        ${OPS.map((op) =>
          `<button type="button" class="${C}__op" data-op="${op}" aria-label="${OP_NAME[op]}">${OP_SYMBOL[op]}</button>`).join('')}
      </div>
      <ol class="${C}__log" aria-label="Your steps"></ol>
      <p class="${C}__feedback" role="status" aria-live="polite"></p>
      <div class="${C}__actions">
        <button type="button" data-action="undo">Undo</button>
        <button type="button" data-action="reset">Reset</button>
        <button type="button" data-action="skip">New puzzle</button>
      </div>
    </div>
    <div class="${C}__overlay" hidden>
      <div class="${C}__result" role="dialog" aria-modal="true" aria-labelledby="${C}-result-title">
        <h3 id="${C}-result-title" class="${C}__result-title">${target}!</h3>
        <p class="${C}__result-expr"></p>
        <p class="${C}__result-coins"><i class="${C}__coin" aria-hidden="true"></i><span></span></p>
        <p class="${C}__result-meta"></p>
        <div class="${C}__result-actions">
          <button type="button" class="${C}__primary" data-action="next">Next puzzle</button>
          <button type="button" class="${C}__secondary" data-action="exit" hidden></button>
        </div>
      </div>
    </div>`;

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const cardsEl = $<HTMLElement>(`.${C}__cards`);
  const logEl = $<HTMLOListElement>(`.${C}__log`);
  const feedbackEl = $<HTMLElement>(`.${C}__feedback`);
  const overlayEl = $<HTMLElement>(`.${C}__overlay`);
  const statEls = {
    coins: $<HTMLElement>('[data-stat="coins"]'),
    solved: $<HTMLElement>('[data-stat="solved"]'),
    streak: $<HTMLElement>('[data-stat="streak"]'),
    time: $<HTMLElement>('[data-stat="time"]'),
  };

  const bg = root.querySelector<HTMLImageElement>(`.${C}__background`);
  if (bg && options.backgroundSrc) bg.src = options.backgroundSrc;

  const titleEl = $<HTMLElement>(`.${C}__title`);
  titleEl.textContent = options.title ?? `Make ${target}`;

  if (options.onExit) {
    const label = options.exitLabel ?? 'Map';
    root.querySelectorAll<HTMLButtonElement>('[data-action="exit"]').forEach((b) => { b.hidden = false; });
    $<HTMLElement>(`.${C}__exit-label`).textContent = label;
    $<HTMLElement>(`.${C}__result-actions [data-action="exit"]`).textContent = `Back to ${label.toLowerCase()}`;
  }
  if (options.showDifficulty === false) $<HTMLElement>(`.${C}__difficulty`).hidden = true;

  host.appendChild(root);

  // ---- helpers -------------------------------------------------------
  const elapsed = () => (solved ? frozenMs : Date.now() - startedAt);
  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const cardById = (id: number | null) => cards.find((c) => c.id === id);

  function valueHTML(f: Fraction) {
    const sign = f.isNegative() ? '−' : '';
    const n = Math.abs(f.num);
    if (f.isInteger()) {
      const text = `${sign}${n}`;
      return `<span class="${C}__int" data-len="${Math.min(text.length, 5)}">${text}</span>`;
    }
    return `${sign ? `<span class="${C}__sign">${sign}</span>` : ''}` +
      `<span class="${C}__frac"><span>${n}</span><span>${f.den}</span></span>`;
  }

  function spokenValue(f: Fraction) {
    const sign = f.isNegative() ? 'negative ' : '';
    return f.isInteger() ? `${sign}${Math.abs(f.num)}` : `${sign}${Math.abs(f.num)} over ${f.den}`;
  }

  function setFeedback(text: string, tone: Tone = 'info') {
    feedbackEl.textContent = text;
    feedbackEl.dataset.tone = tone;
  }

  // ---- rendering -----------------------------------------------------
  function renderCards() {
    const hadFocus = cardsEl.contains(document.activeElement);
    const single = cards.length === 1 ? cards[0] : null;
    let html = '';
    for (let slot = 0; slot < 4; slot++) {
      const card = cards.find((c) => c.slot === slot);
      if (!card) { html += `<div class="${C}__slot" aria-hidden="true"></div>`; continue; }
      const classes = [`${C}__card`];
      if (card.id === selectedId) classes.push('is-selected');
      if (card.id === freshId) classes.push('is-fresh');
      if (single === card) classes.push(card.term.value.equals(target) ? 'is-win' : 'is-wrong');
      html += `<button type="button" class="${classes.join(' ')}" data-card="${card.id}"
        aria-pressed="${card.id === selectedId}" aria-label="Number ${spokenValue(card.term.value)}"
        ${solved ? 'disabled' : ''}><span class="${C}__key" aria-hidden="true">${slot + 1}</span>${valueHTML(card.term.value)}</button>`;
    }
    cardsEl.innerHTML = html;
    if (hadFocus) {
      const focusId = selectedId ?? cards[0]?.id;
      cardsEl.querySelector<HTMLButtonElement>(`[data-card="${focusId}"]`)?.focus();
    }
  }

  function renderControls() {
    root.querySelectorAll<HTMLButtonElement>('[data-op]').forEach((b) => {
      const op = b.dataset.op as Op;
      b.disabled = solved || selectedId === null || cards.length < 2;
      b.setAttribute('aria-pressed', String(op === pendingOp));
      b.classList.toggle('is-selected', op === pendingOp);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-difficulty]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.difficulty === difficulty));
    });
    $<HTMLButtonElement>('[data-action="undo"]').disabled = solved || history.length === 0;
    $<HTMLButtonElement>('[data-action="reset"]').disabled = solved || history.length === 0;
  }

  function renderLog() {
    logEl.innerHTML = steps.length
      ? steps.map((s) => `<li>${stepText(s)}</li>`).join('')
      : `<li class="${C}__log-empty">Pick a number, an operation, then another number.</li>`;
  }

  function renderStats() {
    statEls.coins.textContent = String(coins);
    statEls.solved.textContent = String(solvedCount);
    statEls.streak.textContent = String(streak);
    statEls.time.textContent = fmtTime(elapsed());
  }

  function render() {
    renderCards();
    renderControls();
    renderLog();
    renderStats();
  }

  // ---- game actions --------------------------------------------------
  function startPuzzle(nums?: number[]) {
    if (nums) {
      if (nums.length !== 4 || nums.some((n) => !Number.isInteger(n) || n < 1)) {
        throw new RangeError('Make 24 needs exactly four positive whole numbers');
      }
      if (!findSolution(nums, target)) console.warn(`[make24] ${nums.join(' ')} has no solution for ${target}`);
    }
    numbers = nums ? [...nums] : generatePuzzle(difficulty, { target, avoid: lastKey ? [lastKey] : [] });
    lastKey = puzzleKey(numbers);
    cards = numbers.map((n, slot) => ({ id: nextId++, slot, term: atom(new Fraction(n)) }));
    steps = [];
    history = [];
    selectedId = null;
    pendingOp = null;
    freshId = null;
    solved = false;
    startedAt = Date.now();
    overlayEl.hidden = true;
    render();
  }

  function pickCard(id: number) {
    if (solved || !cardById(id)) return;
    freshId = null;
    if (selectedId === id) {
      selectedId = null;
      pendingOp = null;
    } else if (selectedId !== null && pendingOp !== null) {
      combine(selectedId, pendingOp, id);
      return;
    } else {
      selectedId = id;
    }
    render();
  }

  function pickOp(op: Op) {
    if (solved) return;
    if (selectedId === null) { setFeedback('Pick a number first.'); return; }
    pendingOp = pendingOp === op ? null : op;
    render();
  }

  function combine(leftId: number, op: Op, rightId: number) {
    const left = cardById(leftId)!;
    const right = cardById(rightId)!;
    const value = applyOp(left.term.value, op, right.term.value);
    if (!value) {
      pendingOp = null;
      setFeedback("You can't divide by zero. Try another operation.", 'warn');
      render();
      return;
    }
    history.push({ cards, steps });
    const merged: Card = { id: nextId++, slot: right.slot, term: joinTerms(left.term, op, right.term, value) };
    cards = cards.filter((c) => c !== left && c !== right).concat(merged).sort((a, b) => a.slot - b.slot);
    steps = [...steps, { left: left.term.value, op, right: right.term.value, result: value }];
    pendingOp = null;
    freshId = merged.id;
    // Keep the result selected so the player can chain the next step.
    selectedId = cards.length > 1 ? merged.id : null;

    if (cards.length === 1) {
      if (value.equals(target)) { win(merged); return; }
      setFeedback(`That makes ${value}, not ${target}. Undo a step or reset.`, 'warn');
    } else {
      setFeedback('');
    }
    render();
  }

  function win(finalCard: Card) {
    solved = true;
    frozenMs = Date.now() - startedAt;
    solvedCount++;
    streak++;

    const reward = options.coinReward ?? DEFAULT_COIN_REWARD[difficulty];
    const raw = typeof reward === 'function' ? reward({ difficulty, timeMs: frozenMs, streak }) : reward;
    const coinsEarned = Math.max(0, Math.floor(Number(raw) || 0));
    coins += coinsEarned;

    setFeedback(`${finalCard.term.text} = ${target}`, 'good');
    render();
    bumpCoins();

    const result: Make24Result = {
      numbers: [...numbers], target, difficulty,
      expression: finalCard.term.text, steps: [...steps],
      timeMs: frozenMs, coinsEarned, totalCoins: coins,
    };
    $<HTMLElement>(`.${C}__result-expr`).textContent = `${result.expression} = ${target}`;
    const coinLine = $<HTMLElement>(`.${C}__result-coins`);
    coinLine.hidden = coinsEarned === 0;
    coinLine.querySelector('span')!.textContent = `+${coinsEarned} coin${coinsEarned === 1 ? '' : 's'}`;
    $<HTMLElement>(`.${C}__result-meta`).textContent = `Time ${fmtTime(frozenMs)} · Streak ${streak}`;

    window.setTimeout(() => {
      if (!solved || !root.isConnected) return;
      overlayEl.hidden = false;
      $<HTMLButtonElement>('[data-action="next"]').focus();
    }, 650);
    options.onSolve?.(result);
  }

  function undo() {
    const prev = history.pop();
    if (!prev || solved) return;
    cards = prev.cards;
    steps = prev.steps;
    selectedId = null;
    pendingOp = null;
    freshId = null;
    setFeedback('');
    render();
  }

  function reset() {
    if (!history.length || solved) return;
    const first = history[0];
    history = [];
    cards = first.cards;
    steps = first.steps;
    selectedId = null;
    pendingOp = null;
    freshId = null;
    setFeedback('');
    render();
  }

  /** Little bounce on the coin counter when coins are added. */
  function bumpCoins() {
    const stat = statEls.coins.closest<HTMLElement>(`.${C}__stat`)!;
    stat.classList.remove('is-bumped');
    void stat.offsetWidth; // restart the animation
    stat.classList.add('is-bumped');
  }

  function skip() {
    const wasSolved = solved;
    const answer = wasSolved ? null : findSolution(numbers, target);
    if (!wasSolved) {
      streak = 0;
      options.onSkip?.([...numbers]);
    }
    startPuzzle();
    if (answer) setFeedback(`Last one: ${answer.expression} = ${target}`, 'info');
    else setFeedback('');
  }

  // ---- events --------------------------------------------------------
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!btn || btn.disabled || !root.contains(btn)) return;
    const { card, op, action, difficulty: d } = btn.dataset;
    if (card) pickCard(Number(card));
    else if (op) pickOp(op as Op);
    else if (d) controller.setDifficulty(d as Difficulty);
    else if (action === 'undo') undo();
    else if (action === 'reset') reset();
    else if (action === 'skip' || action === 'next') skip();
    else if (action === 'exit') options.onExit?.();
  });

  const KEY_OPS: Record<string, Op> = { '+': '+', '-': '-', '*': '*', x: '*', X: '*', '/': '/' };
  const onKey = (e: KeyboardEvent) => {
    if (root.getClientRects().length === 0) return; // game is hidden
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as Element | null)?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

    let handled = true;
    if (!overlayEl.hidden) {
      if (e.key === 'n' || e.key === 'N') skip();
      else if (e.key === 'Escape' && options.onExit) options.onExit();
      else handled = false;
    } else if (/^[1-4]$/.test(e.key)) {
      const card = cards.find((c) => c.slot === Number(e.key) - 1);
      if (card) pickCard(card.id);
    } else if (KEY_OPS[e.key]) pickOp(KEY_OPS[e.key]);
    else if (e.key === 'Backspace' || e.key === 'u' || e.key === 'U') undo();
    else if (e.key === 'r' || e.key === 'R') reset();
    else if (e.key === 'n' || e.key === 'N') skip();
    else if (e.key === 'Escape') { selectedId = null; pendingOp = null; render(); }
    else handled = false;
    if (handled) e.preventDefault();
  };
  if (keyboard) document.addEventListener('keydown', onKey);

  const timer = window.setInterval(() => { if (!solved) statEls.time.textContent = fmtTime(elapsed()); }, 500);

  const controller: Make24Controller = {
    element: root,
    newPuzzle(nums) { setFeedback(''); startPuzzle(nums); },
    setDifficulty(d) {
      if (!DIFFICULTIES[d]) throw new RangeError(`Unknown difficulty: ${d}`);
      if (d === difficulty) return;
      difficulty = d;
      setFeedback('');
      startPuzzle();
    },
    getCoins: () => coins,
    setCoins(n) {
      coins = Math.max(0, Math.floor(n));
      renderStats();
    },
    destroy() {
      window.clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      root.remove();
    },
  };

  startPuzzle(options.numbers);
  return controller;
}
