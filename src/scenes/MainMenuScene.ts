import Phaser from 'phaser';
import { createGameUI } from '../../main menu/index.js';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { toGameplaySelection } from '../ui/levelSelection';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const host = createSceneOverlay(this);
    // The real entry now mounts the approved menu/map, not a second placeholder.
    // Save/settings/launcher behavior can be supplied through these same callbacks.
    const ui = createGameUI(host.element, {
      menu: { callbacks: { newGame: () => ui.showMap(), continue: () => ui.showMap() } },
      onLevelSelect: selection => this.scene.start('Combat', toGameplaySelection(selection)),
    });
    this.events.once('shutdown', () => { ui.destroy(); host.destroy(); });
  }
}
