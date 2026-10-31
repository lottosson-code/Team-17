import { MENU_ACTIONS } from './types.js';
import type { MainMenuController, MainMenuOptions, MenuAction, MenuActionContext, MenuCallbacks, MenuLabels, MenuLayout, MenuTheme } from './types.js';

const defaultBackground = new URL('./assets/classroom.png', import.meta.url).href;
const defaultMap = new URL('./assets/map.svg', import.meta.url).href;
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

    this.element.append(this.background, this.title, this.navigation, mapButton, this.status);
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
    if (patch.callbacks) this.callbacks = { ...this.callbacks, ...patch.callbacks };
    this.title.textContent = this.options.title ?? defaultTitle;
    this.navigation.setAttribute('aria-label', this.labels.navigation);
    this.background.setAttribute('src', this.options.backgroundUrl ?? defaultBackground);
    this.mapIcon.setAttribute('src', this.options.mapIconUrl ?? defaultMap);
    for (const action of MENU_ACTIONS) {
      if (action === 'map') this.mapLabel.textContent = this.labels.map;
      else this.buttons.get(action)!.textContent = this.labels[action];
    }
    for (const [key, value] of Object.entries(patch.layout ?? {})) {
      if (value !== undefined) this.element.style.setProperty(layoutVariables[key as keyof MenuLayout], `${value}%`);
    }
    for (const [key, value] of Object.entries(patch.theme ?? {})) {
      if (value !== undefined) this.element.style.setProperty(themeVariables[key as keyof MenuTheme], value);
    }
    this.refreshDisabledState();
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
    for (const [action, button] of this.buttons) button.disabled = Boolean(this.pending || this.disabled[action]);
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
