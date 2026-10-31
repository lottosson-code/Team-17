import { PAUSE_ACTIONS } from './types.js';
import type { PauseAction, PauseActionContext, PauseCallbacks, PauseMenuController, PauseMenuOptions, PauseTheme } from './types.js';
import { defaultLabels, defaultTitle } from './labels.js';

const themeVariables: Record<keyof PauseTheme, string> = {
  titleColor: '--pause-title-color', titleFont: '--pause-title-font', bodyFont: '--pause-body-font',
  panelColor: '--pause-panel-color', frameColor: '--pause-frame-color', buttonColor: '--pause-button-color',
  buttonHoverColor: '--pause-button-hover-color', buttonTextColor: '--pause-button-text-color', focusColor: '--pause-focus-color',
};
let nextId = 0;

/**
 * Create the independent pause window and append it without clearing the host.
 * Load ./pause-menu.css separately; importing this function does not load CSS.
 *
 * @param host The gameplay overlay container. Give it position: relative,
 * absolute or fixed, plus a definite width and height. The window fills this
 * area, not necessarily the entire browser viewport. An unpositioned host can
 * cause absolute positioning to use a different ancestor instead.
 * @param options Initial text, colors, callbacks, disabled actions and visibility.
 * Defaults to visible. For a real game, mount once with visible: false.
 * @returns A controller for updating, opening, hiding and destroying this UI.
 *
 * Layout is configured in pause-menu.css:
 * - .cse-pause-menu uses inset: 0 to fill the positioned host; place-items and
 *   padding determine where the board sits inside that overlay.
 * - .cse-pause-menu__board uses a responsive width capped at 430px and a
 *   430 / 544 aspect ratio. See those CSS rules to resize or reposition it.
 * - options.theme changes colors/fonts only; it has no size/position fields.
 *
 * Callbacks receive { action, menu, signal }. The host model owns Resume,
 * Restart, Settings and Quit to Menu. setVisible() changes presentation only.
 *
 * @example
 * // Import from this module's public index.js, with a path relative to your file.
 * // CSS and a positioned, sized gameOverlay must already exist.
 * const pause = createPauseMenu(gameOverlay, {
 *   visible: false,
 *   callbacks: {
 *     resume: ({ menu }) => {
 *       gameModel.resume();
 *       menu.setVisible(false);
 *     },
 *   },
 * });
 * gameModel.pause();
 * pause.setVisible(true);
 * // When leaving gameplay permanently: pause.destroy();
 */
export function createPauseMenu(host: HTMLElement, options: PauseMenuOptions = {}): PauseMenuController {
  const doc = host.ownerDocument;
  const root = doc.createElement('section');
  // This class owns the full transparent overlay. Set its alignment in CSS.
  root.className = 'cse-pause-menu';
  root.hidden = true;
  root.dataset.lastAction = '';
  const board = doc.createElement('div');
  // This class owns the visible board. Set its width/aspect ratio in CSS.
  board.className = 'cse-pause-menu__board';
  board.setAttribute('role', 'dialog');
  board.setAttribute('aria-modal', 'true');
  board.tabIndex = -1;
  // Decorative artwork is CSS only: no scene background, network or image assets.
  for (const part of ['hanger-left', 'hanger-right', 'corner-tl', 'corner-tr', 'corner-bl', 'corner-br', 'tray']) {
    const decoration = doc.createElement('span');
    decoration.className = 'cse-pause-menu__' + part;
    decoration.setAttribute('aria-hidden', 'true');
    board.append(decoration);
  }
  const title = doc.createElement('h2');
  title.className = 'cse-pause-menu__title';
  title.id = 'cse-pause-menu-title-' + ++nextId;
  board.setAttribute('aria-labelledby', title.id);
  const navigation = doc.createElement('nav');
  navigation.className = 'cse-pause-menu__actions';
  const buttons = new Map<PauseAction, HTMLButtonElement>();
  for (const action of PAUSE_ACTIONS) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'cse-pause-menu__button';
    button.dataset.action = action;
    button.dataset.activationCount = '0';
    button.onclick = () => { void activate(action); };
    buttons.set(action, button);
    navigation.append(button);
  }
  const status = doc.createElement('span');
  status.className = 'cse-pause-menu__sr';
  status.setAttribute('role', 'status');
  board.append(title, navigation, status);
  root.append(board);
  host.append(root);

  let config: PauseMenuOptions = {};
  let labels = { ...defaultLabels };
  let callbacks: PauseCallbacks = {};
  let disabled: Partial<Record<PauseAction, boolean>> = {};
  let pending: AbortController | undefined;
  let returnFocus: HTMLElement | null = null;
  let destroyed = false;
  let lastAction: PauseAction | null = null;
  let activationCount = 0;

  function available(): PauseAction[] {
    return PAUSE_ACTIONS.filter(action => !buttons.get(action)!.disabled);
  }
  function refresh(): void {
    for (const [action, button] of buttons) button.disabled = Boolean(pending || disabled[action]);
    root.setAttribute('aria-busy', String(Boolean(pending)));
    board.setAttribute('aria-busy', String(Boolean(pending)));
  }
  function focus(action: PauseAction = 'resume'): void {
    if (destroyed || root.hidden) return;
    const target = buttons.get(action);
    if (target && !target.disabled) target.focus({ preventScroll: true });
    else (buttons.get(available()[0]!) ?? board).focus({ preventScroll: true });
  }
  function restoreFocus(): void {
    if (root.contains(doc.activeElement) && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  // Open after the model pauses; hiding here does not resume or unload the model.
  function setVisible(visible: boolean): void {
    if (destroyed || visible === !root.hidden) return;
    if (visible) {
      returnFocus = doc.activeElement as HTMLElement | null;
      root.hidden = false;
      focus();
    } else {
      restoreFocus();
      root.hidden = true;
    }
  }
  function update(patch: PauseMenuOptions): void {
    if (destroyed) return;
    config = { ...config, ...patch };
    labels = { ...labels, ...patch.labels };
    callbacks = { ...callbacks, ...patch.callbacks };
    disabled = { ...disabled, ...patch.disabled };
    title.textContent = config.title ?? defaultTitle;
    navigation.setAttribute('aria-label', labels.navigation);
    for (const [action, button] of buttons) button.textContent = labels[action];
    for (const [key, value] of Object.entries(patch.theme ?? {})) {
      if (value !== undefined) root.style.setProperty(themeVariables[key as keyof PauseTheme], value);
    }
    refresh();
    if (patch.visible !== undefined) setVisible(patch.visible);
  }
  async function activate(action: PauseAction): Promise<void> {
    if (destroyed || root.hidden || pending || disabled[action]) return;
    const button = buttons.get(action)!;
    lastAction = action;
    activationCount++;
    root.dataset.lastAction = action;
    root.dataset.activationCount = String(activationCount);
    button.dataset.activationCount = String(Number(button.dataset.activationCount) + 1);
    if (!doc.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      button.getAnimations().forEach(animation => animation.cancel());
      button.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 180 });
    }
    // The UI records an action even without a model. It never navigates itself.
    const callback = callbacks[action];
    if (!callback) return;
    const operation = new AbortController();
    const hadFocus = doc.activeElement === button;
    pending = operation;
    status.textContent = '';
    refresh();
    // Keep keyboard events inside the dialog while its buttons are disabled.
    if (hadFocus) board.focus({ preventScroll: true });
    // Public handoff to the game model. The callback decides the destination.
    // destroy() aborts signal; setVisible(false) intentionally does not.
    const context: PauseActionContext = { action, menu: controller, signal: operation.signal };
    try { await callback(context); }
    catch (error) {
      if (!destroyed && !operation.signal.aborted) {
        status.textContent = labels.error;
        root.dispatchEvent(new CustomEvent('pausemenu:error', { detail: { error, action }, bubbles: true }));
        try { config.onError?.(error, context); }
        catch { /* A reporting failure must not leave the UI locked. */ }
      }
    } finally {
      if (!destroyed && pending === operation) {
        pending = undefined;
        refresh();
        if (hadFocus && !root.hidden && doc.activeElement === board) focus(action);
      }
    }
  }
  function handleKeydown(event: KeyboardEvent): void {
    if (destroyed || root.hidden || event.defaultPrevented) return;
    const actions = available();
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); void activate('resume'); return;
    }
    if (!['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (!actions.length) { board.focus(); return; }
    const current = actions.findIndex(action => buttons.get(action) === doc.activeElement);
    const backwards = event.key === 'ArrowUp' || event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey);
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? actions.length - 1 :
      current < 0 ? (backwards ? actions.length - 1 : 0) : (current + (backwards ? -1 : 1) + actions.length) % actions.length;
    focus(actions[index]);
  }
  const controller: PauseMenuController = {
    element: root, update, setVisible, focus,
    setCallbacks(next) { if (!destroyed) callbacks = { ...next }; },
    setDisabled(action, value) { if (!destroyed) { disabled[action] = value; refresh(); } },
    getState: () => ({ visible: !root.hidden, busy: Boolean(pending), lastAction, activationCount }),
    destroy() {
      if (destroyed) return;
      restoreFocus();
      destroyed = true;
      pending?.abort();
      pending = undefined;
      callbacks = {};
      root.hidden = true;
      root.removeEventListener('keydown', handleKeydown);
      for (const button of buttons.values()) { button.onclick = null; button.getAnimations().forEach(animation => animation.cancel()); }
      root.remove();
    },
  };
  root.addEventListener('keydown', handleKeydown);
  update(options);
  setVisible(options.visible ?? true);
  return controller;
}
