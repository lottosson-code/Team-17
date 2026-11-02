import type { PauseLabels } from './types.js';

// placeholder：Pause window heading, replace through options.title.
export const defaultTitle = 'Paused';
export const defaultLabels: PauseLabels = {
  // placeholder：Return to the current gameplay session.
  resume: 'Resume',
  // placeholder：Restart the current level.
  restart: 'Restart',
  // placeholder：Open the host game's settings.
  settings: 'Settings',
  // placeholder：Leave gameplay and return to the existing main menu.
  quit: 'Quit to Menu',
  // placeholder：Accessible name of the action group; not visible copy.
  navigation: 'Pause menu',
  // placeholder：Accessible error status; the host handles visible errors.
  error: 'Something went wrong. Please try again.',
};
