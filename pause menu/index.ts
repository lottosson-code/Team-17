/**
 * Public entry point for gameplay code. Import createPauseMenu from this file.
 *
 * Integration checklist:
 * 1. Load pause-menu.css separately in the host page.
 * 2. Pass a positioned HTMLElement with a definite width and height.
 * 3. Create one controller with visible: false and connect its callbacks.
 * 4. Pause the game model, then call controller.setVisible(true).
 * 5. Call controller.destroy() when unloading the gameplay scene.
 *
 * Size and position are CSS settings, not PauseMenuOptions fields:
 * - Host element: the game area covered by the transparent overlay.
 * - .cse-pause-menu: overlay placement, alignment, padding and stacking order.
 * - .cse-pause-menu__board: blackboard width and aspect ratio.
 * See pause-menu.css for the exact defaults and override examples, and
 * ../README.md for a complete mounting example.
 */
export { createPauseMenu } from './pause-menu.js';
export { PAUSE_ACTIONS } from './types.js';
export type {
  PauseAction, PauseActionContext, PauseHandler, PauseCallbacks, PauseLabels,
  PauseTheme, PauseMenuOptions, PauseMenuController, PauseState,
} from './types.js';
