import type { MainMenuOptions } from './types.js';
import type { LevelSelection, MapState } from '../map/index.js';

export interface GameUIOptions {
  // New Game, Continue, Settings and Quit are forwarded to the host as usual.
  // The Map action is reserved for the built-in menu-to-map navigation.
  menu?: MainMenuOptions;
  // Island Level N -> host receives IDs, hides the UI and opens gameplay.
  // The destination receives a return callback that calls showMap/showMainMenu.
  onLevelSelect?: (selection: LevelSelection) => void;
}

export interface GameUIState {
  readonly scene: 'menu' | 'map';
  readonly map: Readonly<MapState>;
}

export interface GameUIController {
  readonly element: HTMLElement;
  getState(): GameUIState;
  // Called by map Main Menu or by gameplay's return-to-menu callback.
  showMainMenu(): void;
  // Called by menu Map or by gameplay's return-to-map callback.
  showMap(): void;
  // Call when removing this UI permanently, not when merely switching scenes.
  destroy(): void;
}

