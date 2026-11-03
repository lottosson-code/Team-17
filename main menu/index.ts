export { createMainMenu } from './main-menu.js';
export { DEFAULT_MENU_CHARACTERS } from './characters.js';
// Full menu + map entry. The host passes its game actions as callbacks.
export { createGameUI } from './game-ui.js';
export type { GameUIController, GameUIOptions, GameUIState } from './game-ui-types.js';
export type { LevelSelection } from '../map/index.js';
export { MENU_ACTIONS } from './types.js';
export type { MainMenuController, MainMenuOptions, MenuAction, MenuActionContext, MenuCallbacks, MenuHandler, MenuLabels, MenuLayout, MenuTheme, MenuCharacter } from './types.js';
