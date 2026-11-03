import { createGameUI } from './main menu/index';
import { createPauseMenu } from './pause menu/index';
import './main menu/game-ui.css';
import './pause menu/pause-menu.css';
import './preview.css';

const stage = document.querySelector<HTMLElement>('#stage')!;
const selection = document.querySelector<HTMLElement>('#selection')!;
const ui = createGameUI(stage, {
  menu: {
    disabled: { settings: true, quit: true },
    callbacks: {
      newGame: () => ui.showMap(),
      continue: () => ui.showMap(),
    },
  },
  onLevelSelect: ({ roomId, levelId }) => {
    selection.textContent = `Selected ${roomId}: ${levelId}. This preview does not start gameplay.`;
  },
});

const pause = createPauseMenu(stage, {
  visible: false,
  disabled: { restart: true, settings: true },
  callbacks: {
    resume: () => pause.setVisible(false),
    quit: () => {
      pause.setVisible(false);
      ui.showMainMenu();
    },
  },
});

document.querySelector<HTMLButtonElement>('#main-menu')!.addEventListener('click', () => {
  pause.setVisible(false);
  ui.showMainMenu();
});
document.querySelector<HTMLButtonElement>('#pause-preview')!.addEventListener('click', () => {
  pause.setVisible(true);
});
window.addEventListener('pagehide', () => {
  pause.destroy();
  ui.destroy();
}, { once: true });
