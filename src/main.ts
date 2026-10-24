import Phaser from 'phaser';
import { MainMenuScene } from './scenes/MainMenuScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { CombatScene } from './scenes/CombatScene';

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
  scene: [MainMenuScene, WorldMapScene, LevelSelectScene, CombatScene],
});
