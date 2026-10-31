export const MENU_ACTIONS = ['newGame', 'continue', 'settings', 'quit', 'map'] as const;
export type MenuAction = typeof MENU_ACTIONS[number];

export interface MenuActionContext {
  action: MenuAction;
  menu: MainMenuController;
  /** Aborted when this menu is destroyed. Async integrations should honor it. */
  signal: AbortSignal;
}
export type MenuHandler = (context: MenuActionContext) => void | Promise<void>;
export interface MenuCallbacks {
  /** New Game -> host starts a fresh session and shows its initial gameplay scene. */
  newGame?: MenuHandler;
  /** Continue -> host resumes a saved game and shows its gameplay view. */
  continue?: MenuHandler;
  /** Settings -> host opens its settings screen and returns focus on close. */
  settings?: MenuHandler;
  /** Quit Game -> host decides whether to quit or return to its launcher. */
  quit?: MenuHandler;
  /** Map -> open the map. createGameUI connects this automatically. */
  map?: MenuHandler;
}

export interface MenuLabels {
  newGame: string;
  continue: string;
  settings: string;
  quit: string;
  map: string;
  navigation: string;
  error: string;
}
export interface MenuLayout {
  titleTop: number;
  panelTop: number;
  panelLeft: number;
  panelWidth: number;
  mapTop: number;
  mapLeft: number;
  mapWidth: number;
}
export interface MenuTheme {
  titleColor: string;
  titleOutline: string;
  titleFont: string;
  bodyFont: string;
  panelColor: string;
  frameColor: string;
  buttonColor: string;
  buttonHoverColor: string;
  buttonTextColor: string;
  focusColor: string;
}
export interface MainMenuOptions {
  // See ../README.md for button destinations and host responsibilities.
  title?: string;
  backgroundUrl?: string;
  mapIconUrl?: string;
  labels?: Partial<MenuLabels>;
  layout?: Partial<MenuLayout>;
  theme?: Partial<MenuTheme>;
  callbacks?: MenuCallbacks;
  disabled?: Partial<Record<MenuAction, boolean>>;
  onError?: (error: unknown, context: MenuActionContext) => void;
}
export interface MainMenuController {
  readonly element: HTMLElement;
  /** Patch configuration without rebuilding buttons or losing focus. */
  update(options: MainMenuOptions): void;
  /** Replace all action callbacks. Use {} to disconnect them. */
  setCallbacks(callbacks: MenuCallbacks): void;
  setDisabled(action: MenuAction, disabled: boolean): void;
  setVisible(visible: boolean): void;
  focus(action?: MenuAction): void;
  /** Remove only this menu, detach listeners, abort pending action; idempotent. */
  destroy(): void;
}
