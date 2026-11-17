/**
 * The Make 24 "How to play" card: its HTML, and remembering whether the player has seen it.
 * Make24View puts the card on the page; make24.ts decides when to open and close it.
 */

/**
 * When the card opens by itself:
 * 'first-time' = the first time on this device, 'always' = every time the game opens,
 * 'never' = only when the player presses the ? button.
 */
export type TutorialMode = 'first-time' | 'always' | 'never';

/** Storage key that remembers the player has seen the card. */
export const TUTORIAL_SEEN_KEY = 'cse-make24-tutorial-seen';

/** Same class prefix as the rest of the minigame. */
const PREFIX = 'cse-make24';

/**
 * The two storage methods the tutorial needs.
 * The browser's localStorage has them, and tests can pass in a fake one.
 */
export interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

// ---- remembering that the card was seen ------------------------------------

/**
 * The browser's localStorage, or undefined if there isn't one
 * (some test setups, or storage blocked by the browser).
 */
export function browserStorage(): TutorialStorage | undefined {
  try {
    const storage = globalThis.localStorage;
    if (storage === undefined || storage === null) {
      return undefined;
    }
    return storage;
  } catch {
    return undefined;
  }
}

/** Whether the card should open by itself when the game starts. */
export function shouldShowTutorialAtStart(
  mode: TutorialMode,
  storage: TutorialStorage | undefined,
): boolean {
  if (mode === 'always') {
    return true;
  }
  if (mode === 'never') {
    return false;
  }
  return !hasSeenTutorial(storage);
}

// Storage can be missing or blocked (private browsing, strict settings),
// so these never throw. The game must still work without them.
function hasSeenTutorial(storage: TutorialStorage | undefined): boolean {
  if (storage === undefined) {
    return false;
  }
  try {
    return storage.getItem(TUTORIAL_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberTutorialSeen(storage: TutorialStorage | undefined): void {
  if (storage === undefined) {
    return;
  }
  try {
    storage.setItem(TUTORIAL_SEEN_KEY, '1');
  } catch {
    // Not saved, so the card may show again next time. That's harmless.
  }
}

// ---- HTML -------------------------------------------------------------------

/** The round ? button that opens the card. */
export function helpButtonHTML(): string {
  return `
    <button type="button" class="${PREFIX}__help" data-action="help"
      aria-label="How to play" title="How to play">?</button>`;
}

/** The card itself, hidden until it's opened. Four steps, each with a small picture. */
export function tutorialHTML(target: number): string {
  const step1 = stepHTML(
    cardPicture('8', 'is-selected'),
    'Tap a number',
    "It lifts up to show it's picked.",
  );
  const step2 = stepHTML(
    operationPicture('÷'),
    'Tap an operation',
    'Choose + − × or ÷.',
  );
  const step3 = stepHTML(
    mergePicture(),
    'Tap another number',
    'The two cards merge into one.',
  );
  const step4 = stepHTML(
    cardPicture(String(target), 'is-win'),
    `Make ${target}`,
    'Keep going until one card is left.',
  );

  return `
    <div class="${PREFIX}__tutorial" hidden>
      <div class="${PREFIX}__tutorial-card" role="dialog" aria-modal="true"
        aria-labelledby="${PREFIX}-tutorial-title">
        <h3 id="${PREFIX}-tutorial-title" class="${PREFIX}__tutorial-title">How to play</h3>
        <p class="${PREFIX}__tutorial-goal">
          Use all four numbers exactly once to make <b>${target}</b>.
        </p>
        <ol class="${PREFIX}__tutorial-steps">${step1}${step2}${step3}${step4}</ol>
        <p class="${PREFIX}__tutorial-tip">
          Made a mistake? <b>Undo</b> goes back one step and <b>Reset</b> starts over.
        </p>
        <button type="button" class="${PREFIX}__primary" data-action="close-tutorial">
          Got it
        </button>
      </div>
    </div>`;
}

/** One numbered step: a small picture, a title and one line of detail. */
function stepHTML(picture: string, title: string, detail: string): string {
  return `
    <li>
      <div class="${PREFIX}__tut-art" aria-hidden="true">${picture}</div>
      <b>${title}</b>
      <span>${detail}</span>
    </li>`;
}

/** A small number card. `state` is an extra class like 'is-selected', or '' for none. */
function cardPicture(value: string, state: string): string {
  return `<span class="${PREFIX}__tut-card ${state}">${value}</span>`;
}

/** A small, picked operation button. */
function operationPicture(symbol: string): string {
  return `<span class="${PREFIX}__tut-op is-selected">${symbol}</span>`;
}

/** "3 → 8/3": the second card, an arrow, then the merged card. */
function mergePicture(): string {
  const fraction = `<span class="${PREFIX}__tut-frac"><span>8</span><span>3</span></span>`;
  const arrow = `<span class="${PREFIX}__tut-arrow">→</span>`;
  return cardPicture('3', '') + arrow + cardPicture(fraction, '');
}
