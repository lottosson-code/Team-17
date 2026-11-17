import { MENU_ACTIONS } from './types.js';
import { ASSETS, chalkGlyphUrl, type ChalkColor } from '../assets/index.js';
import { DEFAULT_MENU_CHARACTERS } from './characters.js';
import type { MainMenuController, MainMenuOptions, MenuAction, MenuActionContext, MenuCallbacks, MenuLabels, MenuLayout, MenuTheme, MenuCharacter, MenuProgress } from './types.js';

const defaultBackground = ASSETS.mainMenuBackground;
const defaultMap = ASSETS.mapIcon;
// placeholder：Default game title; the host can override options.title.
const defaultTitle = 'Math Nightmare';
const defaultLabels: MenuLabels = {
  // placeholder：Start a fresh game button label.
  newGame: 'New Game',
  // placeholder：Resume a saved game button label.
  continue: 'Continue',
  // placeholder：Settings button label.
  settings: 'Settings',
  // placeholder：Quit button label.
  quit: 'Quit Game',
  // placeholder：Open the classroom map button label.
  map: 'Map',
  // placeholder：Accessible title of the main menu button group.
  navigation: 'Main menu',
  // placeholder：Accessible action error message.
  error: 'Something went wrong. Please try again.',
};
const layoutVariables: Record<keyof MenuLayout, string> = {
  titleTop: '--menu-title-top', panelTop: '--menu-panel-top', panelLeft: '--menu-panel-left',
  panelWidth: '--menu-panel-width', mapTop: '--menu-map-top', mapLeft: '--menu-map-left', mapWidth: '--menu-map-width',
};
const themeVariables: Record<keyof MenuTheme, string> = {
  titleColor: '--menu-title-color', titleOutline: '--menu-title-outline', titleFont: '--menu-title-font',
  bodyFont: '--menu-body-font', panelColor: '--menu-panel-color', frameColor: '--menu-frame-color',
  buttonColor: '--menu-button-color', buttonHoverColor: '--menu-button-hover-color',
  buttonTextColor: '--menu-button-text-color', focusColor: '--menu-focus-color',
};
let nextId = 0;

/** Mounts an independent menu without clearing or taking ownership of its host. */
export function createMainMenu(container: HTMLElement, options: MainMenuOptions = {}): MainMenuController {
  return new MainMenu(container, options);
}

class MainMenu implements MainMenuController {
  readonly element: HTMLElement;
  private readonly background: HTMLImageElement;
  private readonly characterLayer: HTMLDivElement;
  /** Chalk equation on the blackboard. */
  private readonly chalk: HTMLDivElement;
  /** Pencil bar: the div is the track, its <span> is the pencil. */
  private readonly pencil: HTMLDivElement;
  private readonly title: HTMLHeadingElement;
  private readonly navigation: HTMLElement;
  private readonly mapIcon: HTMLImageElement;
  private readonly mapLabel: HTMLSpanElement;
  private readonly status: HTMLParagraphElement;
  private readonly buttons = new Map<MenuAction, HTMLButtonElement>();
  private options: MainMenuOptions = {};
  private labels: MenuLabels = { ...defaultLabels };
  private callbacks: MenuCallbacks = {};
  private disabled: Partial<Record<MenuAction, boolean>> = {};
  /** Which buttons are hidden, e.g. Continue with no saved level (set through options.hidden). */
  private hidden: Partial<Record<MenuAction, boolean>> = {};
  private pending: AbortController | undefined;
  private destroyed = false;

  constructor(container: HTMLElement, options: MainMenuOptions) {
    const doc = container.ownerDocument;
    this.element = doc.createElement('section');
    this.element.className = 'cse-main-menu';
    this.element.setAttribute('aria-busy', 'false');

    this.background = doc.createElement('img');
    this.background.className = 'cse-main-menu__background';
    this.background.alt = '';
    this.background.draggable = false;
    this.background.fetchPriority = 'high';

    this.characterLayer = doc.createElement('div');
    this.characterLayer.className = 'cse-main-menu__characters';
    this.characterLayer.setAttribute('aria-hidden', 'true');

    // Filled by renderChalk(); read by screen readers as one image.
    this.chalk = doc.createElement('div');
    this.chalk.className = 'cse-main-menu__chalk';
    this.chalk.setAttribute('role', 'img');

    // Drawn entirely in CSS; hidden from screen readers (chalk already says it).
    this.pencil = doc.createElement('div');
    this.pencil.className = 'cse-main-menu__pencil';
    this.pencil.setAttribute('aria-hidden', 'true');
    this.pencil.append(doc.createElement('span'));

    this.title = doc.createElement('h1');
    this.title.className = 'cse-main-menu__title';
    this.title.id = `cse-main-menu-title-${++nextId}`;
    this.element.setAttribute('aria-labelledby', this.title.id);

    this.navigation = doc.createElement('nav');
    this.navigation.className = 'cse-main-menu__panel';
    for (const action of ['newGame', 'continue', 'settings', 'quit'] as const) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'cse-main-menu__button';
      button.dataset.action = action;
      this.buttons.set(action, button);
      this.navigation.append(button);
    }

    const mapButton = doc.createElement('button');
    mapButton.type = 'button';
    mapButton.className = 'cse-main-menu__map';
    mapButton.dataset.action = 'map';
    this.mapIcon = doc.createElement('img');
    this.mapIcon.className = 'cse-main-menu__map-icon';
    this.mapIcon.alt = '';
    this.mapIcon.draggable = false;
    this.mapLabel = doc.createElement('span');
    this.mapLabel.className = 'cse-main-menu__map-label';
    mapButton.append(this.mapIcon, this.mapLabel);
    this.buttons.set('map', mapButton);

    this.status = doc.createElement('p');
    this.status.className = 'cse-main-menu__status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    // Chalk and pencil sit just above the background, below characters and UI.
    this.element.append(this.background, this.chalk, this.pencil, this.characterLayer, this.title, this.navigation, mapButton, this.status);
    this.update(options);
    this.element.addEventListener('click', this.handleClick);
    this.element.addEventListener('keydown', this.handleKeydown);
    container.append(this.element);
  }

  update(patch: MainMenuOptions): void {
    if (this.destroyed) return;
    // Reject invalid geometry before changing any part of the current menu.
    for (const [key, value] of Object.entries(patch.layout ?? {})) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
        throw new RangeError(`Menu layout ${key} must be a percentage between 0 and 100`);
      }
    }
    this.options = { ...this.options, ...patch };
    this.labels = { ...this.labels, ...patch.labels };
    this.disabled = { ...this.disabled, ...patch.disabled };
    // Keep earlier hidden settings; the patch only changes the buttons it names.
    this.hidden = { ...this.hidden, ...patch.hidden };
    if (patch.callbacks) this.callbacks = { ...this.callbacks, ...patch.callbacks };
    this.title.textContent = this.options.title ?? defaultTitle;
    this.navigation.setAttribute('aria-label', this.labels.navigation);
    this.background.setAttribute('src', this.options.backgroundUrl ?? defaultBackground);
    this.mapIcon.setAttribute('src', this.options.mapIconUrl ?? defaultMap);
    if (patch.characters !== undefined || this.characterLayer.childElementCount === 0) {
      this.renderCharacters(this.options.characters ?? DEFAULT_MENU_CHARACTERS);
    }
    // Redraw progress on first render or when a new `progress` is passed.
    if (patch.progress !== undefined || this.chalk.childElementCount === 0) {
      this.renderChalk(this.options.progress ?? null);
      this.pencil.hidden = !this.options.progress;
      // CSS turns this ratio into the pencil length.
      this.pencil.style.setProperty('--pencil-progress', String(this.options.progress?.completedRatio ?? 0));
    }
    for (const action of MENU_ACTIONS) {
      if (action === 'map') this.mapLabel.textContent = this.labels.map;
      else this.buttons.get(action)!.textContent = this.labels[action];
    }
    // Show or hide each button; CSS shrinks the panel when one is hidden.
    for (const [action, button] of this.buttons) button.hidden = Boolean(this.hidden[action]);
    for (const [key, value] of Object.entries(patch.layout ?? {})) {
      if (value !== undefined) this.element.style.setProperty(layoutVariables[key as keyof MenuLayout], `${value}%`);
    }
    for (const [key, value] of Object.entries(patch.theme ?? {})) {
      if (value !== undefined) this.element.style.setProperty(themeVariables[key as keyof MenuTheme], value);
    }
    this.refreshDisabledState();
  }

  private renderCharacters(characters: readonly MenuCharacter[]): void {
    const doc = this.element.ownerDocument;
    this.characterLayer.replaceChildren();
    characters.forEach((character, index) => {
      const anchor = doc.createElement('span');
      anchor.className = 'cse-main-menu__character';
      anchor.dataset.characterId = character.id;
      anchor.dataset.idle = String(character.idle !== false);
      anchor.style.left = character.x + '%';
      anchor.style.top = character.y + '%';
      anchor.style.width = character.width + '%';
      anchor.style.setProperty('--character-index', String(index));
      // Random speed, start point, height and tilt so each figure moves on its own.
      const idleDuration = 1.4 + Math.random() * 2;
      anchor.style.setProperty('--idle-duration', idleDuration.toFixed(2) + 's');
      // Phase: spread the start points over the full up-and-down cycle, plus random jitter.
      const phase = (index * 0.618 + Math.random() * 0.35) % 1;
      anchor.style.setProperty('--idle-delay', (-phase * 2 * idleDuration).toFixed(2) + 's');
      anchor.style.setProperty('--idle-rise', (0.6 + Math.random() * 1.4).toFixed(2) + 'cqw');
      anchor.style.setProperty('--idle-tilt', ((Math.random() - 0.5) * 6).toFixed(1) + 'deg');
      const image = doc.createElement('img');
      image.src = character.imageUrl;
      image.alt = '';
      image.draggable = false;
      anchor.append(image);
      this.characterLayer.append(anchor);
    });
  }

  /** Writes "classroom x 10 + level = code" on the blackboard, one image per character. */
  private renderChalk(progress: MenuProgress | null): void {
    const doc = this.element.ownerDocument;
    this.chalk.replaceChildren();
    this.chalk.hidden = !progress;
    if (!progress) return;
    const { classroom, level } = progress;
    // [characters, colour] per group; numbers split into digits; each group is one <span>.
    const groups: Array<[string[], ChalkColor]> = [
      [[...String(classroom)], 'yellow'], [['times'], 'white'], [['1', '0'], 'white'], [['plus'], 'white'],
      [[...String(level)], 'orange'], [['equals'], 'white'], [[...String(classroom * 10 + level)], 'white'],
    ];
    for (const [glyphs, color] of groups) {
      const group = doc.createElement('span');
      for (const glyph of glyphs) {
        const image = doc.createElement('img');
        image.src = chalkGlyphUrl(color, glyph);
        image.alt = '';
        image.draggable = false;
        group.append(image);
      }
      this.chalk.append(group);
    }
    this.chalk.setAttribute('aria-label', `Classroom ${classroom}, Level ${level}`);
  }

  setCallbacks(callbacks: MenuCallbacks): void {
    if (!this.destroyed) this.callbacks = { ...callbacks };
  }

  setDisabled(action: MenuAction, disabled: boolean): void {
    if (this.destroyed) return;
    this.disabled[action] = disabled;
    this.refreshDisabledState();
  }

  setVisible(visible: boolean): void {
    if (!this.destroyed) this.element.hidden = !visible;
  }

  focus(action: MenuAction = 'continue'): void {
    if (this.destroyed || this.element.hidden) return;
    const preferred = this.buttons.get(action);
    const target = preferred && !preferred.disabled ? preferred : [...this.buttons.values()].find(button => !button.disabled);
    target?.focus();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pending?.abort();
    this.callbacks = {};
    this.element.removeEventListener('click', this.handleClick);
    this.element.removeEventListener('keydown', this.handleKeydown);
    this.element.remove();
  }

  private refreshDisabledState(): void {
    // A hidden button is also disabled, so arrow keys and focus skip it.
    for (const [action, button] of this.buttons) button.disabled = Boolean(this.pending || this.disabled[action] || this.hidden[action]);
    this.element.setAttribute('aria-busy', String(Boolean(this.pending)));
  }

  private actionFromTarget(target: EventTarget | null): MenuAction | undefined {
    const ElementInHostDocument = this.element.ownerDocument.defaultView?.Element;
    if (!ElementInHostDocument || !(target instanceof ElementInHostDocument)) return;
    const button = target.closest<HTMLButtonElement>('button[data-action]');
    const action = button?.dataset.action as MenuAction | undefined;
    return action && this.buttons.get(action) === button ? action : undefined;
  }

  private handleClick = (event: MouseEvent): void => {
    const action = this.actionFromTarget(event.target);
    if (action) void this.activate(action);
  };

  private handleKeydown = (event: KeyboardEvent): void => {
    const action = this.actionFromTarget(event.target);
    if (!action || this.element.hidden || this.pending) return;
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const available = MENU_ACTIONS.filter(item => !this.buttons.get(item)!.disabled);
    if (!available.length) return;
    event.preventDefault();
    const current = available.indexOf(action);
    const step = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : (current + step + available.length) % available.length;
    const next = available[index];
    if (next) this.buttons.get(next)!.focus();
  };

  private async activate(action: MenuAction): Promise<void> {
    if (this.destroyed || this.element.hidden || this.pending || this.disabled[action]) return;
    const callback = this.callbacks[action];
    // The unconnected menu is intentionally inert; the host owns all navigation.
    if (!callback) return;
    const operation = new AbortController();
    const doc = this.element.ownerDocument;
    const actionButton = this.buttons.get(action);
    const restoreFocus = doc.activeElement === actionButton;
    this.pending = operation;
    this.status.textContent = '';
    this.refreshDisabledState();
    const context: MenuActionContext = { action, menu: this, signal: operation.signal };
    try {
      await callback(context);
    } catch (error) {
      if (!this.destroyed && !operation.signal.aborted) {
        this.status.textContent = this.labels.error;
        // Also provide an observable error event for hosts using DOM integration.
        this.element.dispatchEvent(new CustomEvent('mainmenu:error', { detail: { error, action }, bubbles: true }));
        try { this.options.onError?.(error, context); }
        catch (reportingError) {
          this.element.dispatchEvent(new CustomEvent('mainmenu:error', { detail: { error: reportingError, action }, bubbles: true }));
        }
      }
    } finally {
      if (!this.destroyed && this.pending === operation) {
        this.pending = undefined;
        this.refreshDisabledState();
        // Disabling a focused button blurs it. Restore focus unless the host
        // moved to another control or hid this menu while changing scenes.
        if (restoreFocus && !this.element.hidden &&
            (doc.activeElement === doc.body || doc.activeElement === doc.documentElement)) {
          actionButton?.focus();
        }
      }
    }
  }
}
