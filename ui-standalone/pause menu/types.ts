import type { MenuTheme } from '../main menu/types.js';

export const PAUSE_ACTIONS = ['resume', 'restart', 'settings', 'quit'] as const;
export type PauseAction = typeof PAUSE_ACTIONS[number];

/** Same field names and async contract as MenuActionContext. */
export interface PauseActionContext {
  /** The activated action key, not the translated button text. */
  action: PauseAction;
  /** This pause window's controller; use it to hide or update this instance. */
  menu: PauseMenuController;
  /** Aborted on destroy. Check this before applying a late async result. */
  signal: AbortSignal;
}
/** All actions are locked until a returned Promise settles. */
export type PauseHandler = (context: PauseActionContext) => void | Promise<void>;
export interface PauseCallbacks {
  /** Resume -> host hides this window and resumes its current game model. */
  resume?: PauseHandler;
  /** Restart -> host resets the current level, hides the window and resumes. */
  restart?: PauseHandler;
  /** Settings -> host opens settings; keep gameplay paused until Resume. */
  settings?: PauseHandler;
  /** Quit to Menu -> host ends gameplay and shows its existing main menu. */
  quit?: PauseHandler;
}
export interface PauseLabels {
  resume: string;
  restart: string;
  settings: string;
  quit: string;
  navigation: string;
  error: string;
}
/** Reuses the main menu's theme keys, fonts and button colors. */
export type PauseTheme = Pick<MenuTheme,
  'titleColor' | 'titleFont' | 'bodyFont' | 'panelColor' | 'frameColor' |
  'buttonColor' | 'buttonHoverColor' | 'buttonTextColor' | 'focusColor'>;

/**
 * Presentation and model-integration options passed to createPauseMenu/update.
 * There are no width, height, x or y options. Configure layout in pause-menu.css:
 * .cse-pause-menu controls placement; .cse-pause-menu__board controls size.
 * The positioned host element supplies the overlay's available game area.
 */
export interface PauseMenuOptions {
  /** Window heading; defaults to the placeholder in labels.ts. */
  title?: string;
  /** Override individual button labels and accessible status text. */
  labels?: Partial<PauseLabels>;
  /** Override shared menu colors/fonts; this does not change the layout. */
  theme?: Partial<PauseTheme>;
  /** Host-owned actions. Omitted handlers only record a press and animate. */
  callbacks?: PauseCallbacks;
  /** Disable selected actions, for example { restart: true }. */
  disabled?: Partial<Record<PauseAction, boolean>>;
  /** Defaults to true. Use false when mounting once at game startup. */
  visible?: boolean;
  /** Report a rejected/thrown action to the host's visible error UI. */
  onError?: (error: unknown, context: PauseActionContext) => void;
}
export interface PauseState {
  /** UI visibility only, not the model's paused/running state. */
  visible: boolean;
  /** True while an action callback is pending. */
  busy: boolean;
  /** Most recently pressed enabled action, or null before the first press. */
  lastAction: PauseAction | null;
  /** Number of accepted presses, including presses without a callback. */
  activationCount: number;
}
/** Matches the main menu controller's vocabulary; no game-model dependency. */
export interface PauseMenuController {
  /** Transparent overlay root, appended to the supplied host. */
  readonly element: HTMLElement;
  /**
   * Merge labels, theme, disabled state and callbacks without remounting.
   * Omitted callback keys are retained; use setCallbacks({}) to clear them.
   */
  update(options: PauseMenuOptions): void;
  /** Replace every callback; {} disconnects all actions. */
  setCallbacks(callbacks: PauseCallbacks): void;
  /** Enable or disable one action without replacing the remaining settings. */
  setDisabled(action: PauseAction, disabled: boolean): void;
  /**
   * Show/hide this window only; the host must pause/resume the game model.
   * Opening focuses Resume; closing returns focus if it is still in this UI.
   * Hiding does not abort an action that is already pending.
   */
  setVisible(visible: boolean): void;
  /** Focus an action; fall back to the first enabled button when unavailable. */
  focus(action?: PauseAction): void;
  /** Returns a copy; unconnected button presses still record the last action. */
  getState(): PauseState;
  /** Abort pending work, restore focus and remove only this window. Idempotent. */
  destroy(): void;
}
