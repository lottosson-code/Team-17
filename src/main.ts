import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CombatScene } from './scenes/CombatScene';
import { Make24Scene } from './scenes/Make24Scene';
import { BlacksmithScene } from './scenes/BlacksmithScene';
import '../main menu/game-ui.css';
import '../pause menu/pause-menu.css';
import './ui/game-ui.css';
import './minigames/make24/src/make24.css';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#17172d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MainMenuScene, CombatScene, Make24Scene, BlacksmithScene],
});
