/**
 * Make 24 minigame for Math Nightmare.
 *
 * mountMake24 connects the game state (Make24Model) to the screen (Make24View):
 * it turns the player's clicks and key presses into model calls, then tells the
 * view to redraw. It reports results to the rest of the game through callbacks.
 *
 *   import { mountMake24 } from './minigames/make24/src/make24';
 *   import './minigames/make24/src/make24.css';
 *
 *   const game = mountMake24(container, {
 *     difficulty: 'normal',
 *     onSolve: (result) => { player.coins = result.totalCoins; },
 *     onExit: () => { game.destroy(); showMap(); },
 *   });
 */
import { OP_SYMBOL } from './logic';
import type { Difficulty, Op } from './logic';
import { Make24Model } from './Make24Model';
import type { CoinReward, Hint, Make24Result, MoveOutcome } from './Make24Model';
import { Make24View } from './Make24View';
import { browserStorage, rememberTutorialSeen, shouldShowTutorialAtStart } from './tutorial';
import type { TutorialMode, TutorialStorage } from './tutorial';

export type { Difficulty, Op, Step } from './logic';
export { TUTORIAL_SEEN_KEY } from './tutorial';
export type { TutorialMode, TutorialStorage } from './tutorial';
export { DEFAULT_COIN_REWARD } from './Make24Model';
export type { CoinRewardInfo, Make24Result } from './Make24Model';

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
  /** Keyboard shortcuts (1–4, + − * /, Backspace, R, N, H, ?, Esc). Defaults to true. */
  keyboard?: boolean;
  /**
   * When the how-to-play card opens by itself. 'first-time' (default): the first time
   * on this device. 'always': every time the game opens. 'never': only from the ? button.
   */
  tutorial?: TutorialMode;
  /** Where "seen the how-to-play card" is remembered. Defaults to the browser's localStorage. */
  tutorialStorage?: TutorialStorage;
  /** Player's coin balance when the minigame opens (e.g. from their save). Defaults to 0. */
  coins?: number;
  /** Coins per solve: a fixed number, or a function. Defaults to Easy 5 / Normal 10 / Hard 15. */
  coinReward?: CoinReward;
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
  /** Open the how-to-play card. */
  showTutorial(): void;
  /** Stop timers, remove listeners and remove the game from the page. */
  destroy(): void;
}

/** Pause before the win screen appears, so the player sees the final card first. */
const WIN_SCREEN_DELAY_MS = 650;

/** How often the on-screen timer updates. */
const TIMER_UPDATE_MS = 500;

/** Keys that choose an operation. */
const KEY_TO_OPERATION = new Map<string, Op>([
  ['+', '+'],
  ['-', '-'],
  ['*', '*'],
  ['x', '*'],
  ['X', '*'],
  ['/', '/'],
]);

export function mountMake24(host: HTMLElement, options: Make24Options = {}): Make24Controller {
  // ---- settings, with defaults --------------------------------------------
  const target = options.target ?? 24;

  let exitLabel: string | undefined;
  if (options.onExit) exitLabel = options.exitLabel ?? 'Map';

  // ---- model and view -----------------------------------------------------
  const model = new Make24Model({
    target,
    difficulty: options.difficulty ?? 'normal',
    coins: options.coins ?? 0,
    coinReward: options.coinReward,
  });
  // Deal the first puzzle before building the screen, so invalid numbers
  // throw before anything is added to the page.
  model.startPuzzle(options.numbers);

  const view = new Make24View(host, {
    target,
    title: options.title ?? `Make ${target}`,
    exitLabel,
    showDifficulty: options.showDifficulty !== false,
    backgroundSrc: options.backgroundSrc,
  });
  view.render(model);

  // ---- actions ------------------------------------------------------------

  function startNewPuzzle(numbers?: number[]): void {
    model.startPuzzle(numbers);
    view.hideWinScreen();
    view.render(model);
  }

  /** Show what happened after the player picked a card or an operation. */
  function handleMove(outcome: MoveOutcome | null): void {
    if (outcome === null) return; // nothing changed

    switch (outcome.kind) {
      case 'no-card-selected':
        view.setFeedback('Pick a number first.');
        return;
      case 'selection-changed':
        break;
      case 'divide-by-zero':
        view.setFeedback("You can't divide by zero. Try another operation.", 'warn');
        break;
      case 'combined':
        view.setFeedback('');
        break;
      case 'wrong-total':
        view.setFeedback(`That makes ${outcome.value}, not ${target}. Undo a step or reset.`, 'warn');
        break;
      case 'solved':
        celebrate(outcome.result);
        return;
    }
    view.render(model);
  }

  function celebrate(result: Make24Result): void {
    view.setFeedback(`${result.expression} = ${target}`, 'good');
    view.render(model);
    view.bumpCoins();
    view.fillWinScreen(result, model.streak);
    window.setTimeout(showWinScreenIfStillSolved, WIN_SCREEN_DELAY_MS);
    if (options.onSolve) options.onSolve(result);
  }

  function showWinScreenIfStillSolved(): void {
    // The player may have moved on, or the game may have been closed, during the pause.
    if (model.solved && view.root.isConnected) view.showWinScreen();
  }

  function undo(): void {
    if (!model.undo()) return;
    view.setFeedback('');
    view.render(model);
  }

  function reset(): void {
    if (!model.reset()) return;
    view.setFeedback('');
    view.render(model);
  }

  /** "New puzzle" or "Next puzzle". Skipping an unsolved puzzle shows one way to solve it. */
  function skipPuzzle(): void {
    const skipped = model.leavePuzzle(); // null when the puzzle was already solved
    if (skipped !== null && options.onSkip) options.onSkip(skipped.numbers);

    startNewPuzzle();

    if (skipped !== null && skipped.answer !== null) {
      view.setFeedback(`Last one: ${skipped.answer.expression} = ${target}`);
    } else {
      view.setFeedback('');
    }
  }

  /** Highlight a next move that still reaches the target, and say it in words. */
  function showHint(): void {
    if (model.solved) return;

    const hint = model.useHint();
    if (hint === null) {
      view.setFeedback(`These numbers can't make ${target} anymore. Try Undo or Reset.`, 'warn');
    } else {
      view.setFeedback(`Hint: try ${hintText(hint)}. Hints halve this puzzle's coins.`);
    }
    view.render(model);
  }

  /** The hinted move in words, e.g. "8 ÷ 3". */
  function hintText(hint: Hint): string {
    const left = model.cardById(hint.leftId);
    const right = model.cardById(hint.rightId);
    if (left === undefined || right === undefined) return '';
    return `${left.term.value} ${OP_SYMBOL[hint.op]} ${right.term.value}`;
  }

  function changeDifficulty(difficulty: Difficulty): void {
    const changed = model.setDifficulty(difficulty);
    if (!changed) return;
    view.setFeedback('');
    startNewPuzzle();
  }

  function exitGame(): void {
    if (options.onExit) options.onExit();
  }

  function pickCardInSlot(slot: number): void {
    const card = model.cardInSlot(slot);
    if (card !== undefined) handleMove(model.pickCard(card.id));
  }

  function clearSelection(): void {
    model.clearSelection();
    view.render(model);
  }

  /** Open the how-to-play card. The clock pauses so reading it doesn't count as playing time. */
  function openTutorial(): void {
    if (view.isTutorialShown) return;
    model.pauseClock();
    view.showTutorial();
  }

  function closeTutorial(): void {
    if (!view.isTutorialShown) return;
    model.resumeClock();
    view.hideTutorial();
    view.renderTime(model);
    rememberTutorialSeen(tutorialStorage());
  }

  function tutorialStorage(): TutorialStorage | undefined {
    if (options.tutorialStorage) return options.tutorialStorage;
    return browserStorage();
  }

  // ---- clicks -------------------------------------------------------------
  // One listener for the whole game: each button says what it does in a data- attribute.

  function handleClick(event: MouseEvent): void {
    // Clicking the dark area around the how-to-play card closes it.
    if (view.isTutorialBackdrop(event.target)) {
      closeTutorial();
      return;
    }

    const button = clickedButton(event.target);
    if (button === null) return;

    // While the how-to-play card is open, only its own buttons work. Tab can still
    // reach the buttons behind it, and pressing Enter on one would act on the game.
    if (view.isTutorialShown && !view.isInsideTutorial(button)) return;

    const { card, op, difficulty, action } = button.dataset;
    if (card !== undefined) handleMove(model.pickCard(Number(card)));
    else if (op !== undefined) handleMove(model.pickOperation(op as Op));
    else if (difficulty !== undefined) changeDifficulty(difficulty as Difficulty);
    else if (action !== undefined) runAction(action);
  }

  function clickedButton(target: EventTarget | null): HTMLButtonElement | null {
    if (!(target instanceof Element)) return null;
    const button = target.closest('button');
    if (button === null || button.disabled || !view.root.contains(button)) return null;
    return button;
  }

  function runAction(action: string): void {
    switch (action) {
      case 'hint':
        showHint();
        break;
      case 'undo':
        undo();
        break;
      case 'reset':
        reset();
        break;
      case 'skip':
      case 'next':
        skipPuzzle();
        break;
      case 'exit':
        exitGame();
        break;
      case 'help':
        openTutorial();
        break;
      case 'close-tutorial':
        closeTutorial();
        break;
    }
  }

  // ---- keyboard -----------------------------------------------------------

  function handleKey(event: KeyboardEvent): void {
    if (!view.isVisible) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingInAField(event.target)) return;

    let handled: boolean;
    if (view.isTutorialShown) handled = handleTutorialKey(event.key);
    else if (view.isWinScreenShown) handled = handleWinScreenKey(event.key, event.repeat);
    else handled = handleGameKey(event.key, event.repeat);

    if (handled) event.preventDefault();
  }

  /** While the card is open only Esc works; Enter and Space press its focused "Got it" button. */
  function handleTutorialKey(key: string): boolean {
    if (key !== 'Escape') return false;
    closeTutorial();
    return true;
  }

  /** Returns true if the key did something. */
  function handleWinScreenKey(key: string, isRepeat: boolean): boolean {
    if (key === 'n' || key === 'N') {
      // Holding the key fires repeats. Without this check the repeats would reach
      // the next puzzle and skip it, which breaks the streak.
      if (!isRepeat) skipPuzzle();
      return true;
    }
    if (key === 'Escape' && options.onExit) {
      exitGame();
      return true;
    }
    return false;
  }

  /** Returns true if the key did something. */
  function handleGameKey(key: string, isRepeat: boolean): boolean {
    if (/^[1-4]$/.test(key)) {
      pickCardInSlot(Number(key) - 1);
      return true;
    }

    const op = KEY_TO_OPERATION.get(key);
    if (op !== undefined) {
      handleMove(model.pickOperation(op));
      return true;
    }

    if (key === 'Backspace' || key === 'u' || key === 'U') undo();
    else if (key === 'r' || key === 'R') reset();
    else if (key === 'n' || key === 'N') {
      // A held key repeats; only the first press should skip the puzzle.
      if (!isRepeat) skipPuzzle();
    } else if (key === 'h' || key === 'H') showHint();
    else if (key === '?') openTutorial();
    else if (key === 'Escape') clearSelection();
    else return false;
    return true;
  }

  // ---- listeners and timer ------------------------------------------------

  view.root.addEventListener('click', handleClick);

  const keyboard = options.keyboard ?? true;
  if (keyboard) document.addEventListener('keydown', handleKey);

  const timerId = window.setInterval(() => {
    if (!model.solved) view.renderTime(model);
  }, TIMER_UPDATE_MS);

  // Show the how-to-play card at the start if the tutorial option says so.
  let tutorialMode: TutorialMode = 'first-time';
  if (options.tutorial !== undefined) {
    tutorialMode = options.tutorial;
  }
  if (shouldShowTutorialAtStart(tutorialMode, tutorialStorage())) {
    openTutorial();
  }

  // ---- what the rest of the game can call ----------------------------------

  return {
    element: view.root,
    newPuzzle(numbers) {
      view.setFeedback('');
      startNewPuzzle(numbers);
    },
    setDifficulty: changeDifficulty,
    getCoins() {
      return model.coins;
    },
    setCoins(coins) {
      model.setCoins(coins);
      view.renderStats(model);
    },
    showTutorial: openTutorial,
    destroy() {
      window.clearInterval(timerId);
      document.removeEventListener('keydown', handleKey);
      view.remove();
    },
  };
}

/** True when the player is typing in a text box, where game shortcuts shouldn't fire. */
function isTypingInAField(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, textarea, select, [contenteditable="true"]') !== null;
}
