import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CombatScene } from './scenes/CombatScene';
import '../main menu/game-ui.css';
import '../pause menu/pause-menu.css';
import './ui/game-ui.css';

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
  scene: [MainMenuScene, CombatScene],
});
