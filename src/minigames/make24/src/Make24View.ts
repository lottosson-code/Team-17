/**
 * Draws the Make 24 minigame on the page.
 *
 * The view never changes the game. It builds the HTML once, then redraws it from
 * a Make24Model whenever the controller (make24.ts) asks it to.
 */
import { DIFFICULTIES, OPS, OP_NAME, OP_SYMBOL, stepText } from './logic';
import type { Difficulty, Fraction } from './logic';
import { CARD_COUNT } from './Make24Model';
import type { Card, Make24Model, Make24Result } from './Make24Model';

/** Every class name starts with this, so nothing clashes with the rest of the game. */
const C = 'cse-make24';

export type FeedbackTone = 'info' | 'good' | 'warn';

export interface ViewSettings {
  target: number;
  /** Heading text. */
  title: string;
  /** Label for the exit button, or undefined to hide the exit buttons. */
  exitLabel: string | undefined;
  showDifficulty: boolean;
  backgroundSrc: string | undefined;
}

export class Make24View {
  /** The whole minigame: one <section> added to the page. */
  readonly root: HTMLElement;

  private readonly cardsEl: HTMLElement;
  private readonly logEl: HTMLElement;
  private readonly feedbackEl: HTMLElement;
  private readonly winScreenEl: HTMLElement;
  private readonly coinsEl: HTMLElement;
  private readonly solvedEl: HTMLElement;
  private readonly streakEl: HTMLElement;
  private readonly timeEl: HTMLElement;

  constructor(host: HTMLElement, settings: ViewSettings) {
    this.root = document.createElement('section');
    this.root.className = C;
    this.root.setAttribute('aria-label', `Make ${settings.target} minigame`);
    this.root.innerHTML = layoutHTML(settings.target, settings.backgroundSrc !== undefined);

    this.cardsEl = this.find(`.${C}__cards`);
    this.logEl = this.find(`.${C}__log`);
    this.feedbackEl = this.find(`.${C}__feedback`);
    this.winScreenEl = this.find(`.${C}__overlay`);
    this.coinsEl = this.find('[data-stat="coins"]');
    this.solvedEl = this.find('[data-stat="solved"]');
    this.streakEl = this.find('[data-stat="streak"]');
    this.timeEl = this.find('[data-stat="time"]');

    this.applySettings(settings);
    host.appendChild(this.root);
  }

  // ---- drawing the game --------------------------------------------------

  /** Redraw everything from the model. */
  render(model: Make24Model): void {
    this.renderCards(model);
    this.renderControls(model);
    this.renderLog(model);
    this.renderStats(model);
  }

  renderStats(model: Make24Model): void {
    this.coinsEl.textContent = String(model.coins);
    this.solvedEl.textContent = String(model.solvedCount);
    this.streakEl.textContent = String(model.streak);
    this.renderTime(model);
  }

  renderTime(model: Make24Model): void {
    this.timeEl.textContent = formatTime(model.elapsedMs());
  }

  setFeedback(text: string, tone: FeedbackTone = 'info'): void {
    this.feedbackEl.textContent = text;
    this.feedbackEl.dataset.tone = tone;
  }

  /** Little bounce on the coin counter when coins are added. */
  bumpCoins(): void {
    const coinStat = this.find(`.${C}__stat--coins`);
    coinStat.classList.remove('is-bumped');
    void coinStat.offsetWidth; // forces the browser to restart the animation
    coinStat.classList.add('is-bumped');
  }

  // ---- win screen --------------------------------------------------------

  /** Fill in the win screen's text. It stays hidden until showWinScreen(). */
  fillWinScreen(result: Make24Result, streak: number): void {
    this.find(`.${C}__result-expr`).textContent = `${result.expression} = ${result.target}`;

    const coinLine = this.find(`.${C}__result-coins`);
    coinLine.hidden = result.coinsEarned === 0;
    this.find(`.${C}__result-coins span`).textContent = coinLabel(result.coinsEarned);

    this.find(`.${C}__result-meta`).textContent = `Time ${formatTime(result.timeMs)} · Streak ${streak}`;
  }

  showWinScreen(): void {
    this.winScreenEl.hidden = false;
    this.find<HTMLButtonElement>('[data-action="next"]').focus();
  }

  hideWinScreen(): void {
    this.winScreenEl.hidden = true;
  }

  get isWinScreenShown(): boolean {
    return !this.winScreenEl.hidden;
  }

  /** False when the game is hidden or not on the page, so keys shouldn't control it. */
  get isVisible(): boolean {
    return this.root.getClientRects().length > 0;
  }

  remove(): void {
    this.root.remove();
  }

  // ---- internals ---------------------------------------------------------

  private applySettings(settings: ViewSettings): void {
    this.find(`.${C}__title`).textContent = settings.title;

    if (settings.backgroundSrc !== undefined) {
      this.find<HTMLImageElement>(`.${C}__background`).src = settings.backgroundSrc;
    }

    if (settings.exitLabel !== undefined) {
      for (const button of Array.from(this.root.querySelectorAll<HTMLElement>('[data-action="exit"]'))) {
        button.hidden = false;
      }
      this.find(`.${C}__exit-label`).textContent = settings.exitLabel;
      this.find(`.${C}__result-actions [data-action="exit"]`).textContent =
        `Back to ${settings.exitLabel.toLowerCase()}`;
    }

    if (!settings.showDifficulty) {
      this.find(`.${C}__difficulty`).hidden = true;
    }
  }

  private renderCards(model: Make24Model): void {
    const hadFocus = this.cardsEl.contains(document.activeElement);

    const slotsHTML: string[] = [];
    for (let slot = 0; slot < CARD_COUNT; slot++) {
      const card = model.cardInSlot(slot);
      if (card === undefined) {
        slotsHTML.push(`<div class="${C}__slot" aria-hidden="true"></div>`);
      } else {
        slotsHTML.push(cardHTML(card, model));
      }
    }
    this.cardsEl.innerHTML = slotsHTML.join('');

    // Redrawing replaced the buttons; keep keyboard focus on a card if it was on one.
    if (hadFocus) this.focusACard(model);
  }

  private focusACard(model: Make24Model): void {
    let focusId = model.selectedId;
    if (focusId === null && model.cards.length > 0) focusId = model.cards[0].id;
    if (focusId === null) return;

    const button = this.cardsEl.querySelector<HTMLButtonElement>(`[data-card="${focusId}"]`);
    if (button !== null) button.focus();
  }

  private renderControls(model: Make24Model): void {
    for (const button of Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-op]'))) {
      const isChosen = button.dataset.op === model.pendingOp;
      button.disabled = !model.canPickOperation;
      button.setAttribute('aria-pressed', String(isChosen));
      button.classList.toggle('is-selected', isChosen);
    }

    for (const button of Array.from(this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]'))) {
      const isCurrent = button.dataset.difficulty === model.difficulty;
      button.setAttribute('aria-pressed', String(isCurrent));
    }

    this.find<HTMLButtonElement>('[data-action="undo"]').disabled = !model.canUndo;
    this.find<HTMLButtonElement>('[data-action="reset"]').disabled = !model.canUndo;
  }

  private renderLog(model: Make24Model): void {
    if (model.steps.length === 0) {
      const hint = 'Pick a number, an operation, then another number.';
      this.logEl.innerHTML = `<li class="${C}__log-empty">${hint}</li>`;
      return;
    }
    this.logEl.innerHTML = model.steps.map((step) => `<li>${stepText(step)}</li>`).join('');
  }

  /** Finds an element inside the game, and fails loudly if the HTML is missing it. */
  private find<T extends HTMLElement = HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (element === null) throw new Error(`Make 24: missing element ${selector}`);
    return element;
  }
}

// ---- HTML pieces -----------------------------------------------------------
// Only numbers and fixed text go into this HTML, never anything a user typed.
// Custom text (title, exit label) is set with textContent in applySettings.

function layoutHTML(target: number, hasBackground: boolean): string {
  let html = '';
  if (hasBackground) html += `<img class="${C}__background" alt="" draggable="false">`;
  html += `<div class="${C}__vignette" aria-hidden="true"></div>`;
  html += exitButtonHTML();
  html += `<h2 class="${C}__title"></h2>`;
  html += statsHTML();
  html += panelHTML(target);
  html += winScreenHTML(target);
  return html;
}

function exitButtonHTML(): string {
  return `
    <button type="button" class="${C}__exit" data-action="exit" hidden>
      <span aria-hidden="true">‹</span> <span class="${C}__exit-label"></span>
    </button>`;
}

function statsHTML(): string {
  return `
    <div class="${C}__stats">
      <div class="${C}__stat ${C}__stat--coins">
        <span>Coins</span><b><i class="${C}__coin" aria-hidden="true"></i><span data-stat="coins">0</span></b>
      </div>
      <div class="${C}__stat"><span>Solved</span><b data-stat="solved">0</b></div>
      <div class="${C}__stat"><span>Streak</span><b data-stat="streak">0</b></div>
      <div class="${C}__stat"><span>Time</span><b data-stat="time">0:00</b></div>
    </div>`;
}

function panelHTML(target: number): string {
  const difficulties = Object.keys(DIFFICULTIES) as Difficulty[];
  const difficultyButtons = difficulties
    .map((d) => `<button type="button" data-difficulty="${d}">${DIFFICULTIES[d].label}</button>`)
    .join('');
  const operationButtons = OPS
    .map((op) => {
      const label = OP_NAME[op];
      const symbol = OP_SYMBOL[op];
      const attributes = `class="${C}__op" data-op="${op}" aria-label="${label}"`;
      return `<button type="button" ${attributes}>${symbol}</button>`;
    })
    .join('');

  return `
    <div class="${C}__panel">
      <div class="${C}__header">
        <p class="${C}__prompt">Use all four numbers once with + − × ÷ to make <b>${target}</b>.</p>
        <div class="${C}__difficulty" role="group" aria-label="Difficulty">${difficultyButtons}</div>
      </div>
      <div class="${C}__cards" role="group" aria-label="Number cards"></div>
      <div class="${C}__ops" role="group" aria-label="Operations">${operationButtons}</div>
      <ol class="${C}__log" aria-label="Your steps"></ol>
      <p class="${C}__feedback" role="status" aria-live="polite"></p>
      <div class="${C}__actions">
        <button type="button" data-action="undo">Undo</button>
        <button type="button" data-action="reset">Reset</button>
        <button type="button" data-action="skip">New puzzle</button>
      </div>
    </div>`;
}

function winScreenHTML(target: number): string {
  return `
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
}

function cardHTML(card: Card, model: Make24Model): string {
  const isSelected = card.id === model.selectedId;

  const classes = [`${C}__card`];
  if (isSelected) classes.push('is-selected');
  if (card.id === model.freshId) classes.push('is-fresh');
  if (model.cards.length === 1) {
    // Last card left: green if it's the target, red if not.
    if (card.term.value.equals(model.target)) classes.push('is-win');
    else classes.push('is-wrong');
  }

  let disabled = '';
  if (model.solved) disabled = 'disabled';

  return `
    <button type="button" class="${classes.join(' ')}" data-card="${card.id}"
      aria-pressed="${isSelected}" aria-label="Number ${spokenValue(card.term.value)}" ${disabled}>
      <span class="${C}__key" aria-hidden="true">${card.slot + 1}</span>${valueHTML(card.term.value)}
    </button>`;
}

/** A card's number: a whole number, or a stacked fraction like ⁸⁄₃. */
function valueHTML(value: Fraction): string {
  let sign = '';
  if (value.isNegative()) sign = '−';
  const top = Math.abs(value.num);

  if (value.isInteger()) {
    const text = `${sign}${top}`;
    // data-len lets the CSS shrink long numbers so they fit on the card.
    const length = Math.min(text.length, 5);
    return `<span class="${C}__int" data-len="${length}">${text}</span>`;
  }

  let signHTML = '';
  if (sign !== '') signHTML = `<span class="${C}__sign">${sign}</span>`;
  return `${signHTML}<span class="${C}__frac"><span>${top}</span><span>${value.den}</span></span>`;
}

/** How a screen reader says a value, e.g. "negative 8 over 3". */
function spokenValue(value: Fraction): string {
  let sign = '';
  if (value.isNegative()) sign = 'negative ';
  const top = Math.abs(value.num);
  if (value.isInteger()) return `${sign}${top}`;
  return `${sign}${top} over ${value.den}`;
}

/** "+1 coin" or "+10 coins". */
function coinLabel(coins: number): string {
  if (coins === 1) return '+1 coin';
  return `+${coins} coins`;
}

/** Milliseconds as minutes:seconds, e.g. 65000 → "1:05". */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
