import Phaser from 'phaser';
import { createTextButton } from '../ui/components/createTextButton';

export class WorldMapScene extends Phaser.Scene {
  constructor() {
    super('WorldMap');
  }

  create(): void {
    // Back to Main Menu button
    createTextButton(
      this,
      '← Back to Main Menu',
      180,
      50,
      () => {
        this.scene.start('MainMenu');
      },
      240,
      { variant: 'secondary', height: 44 },
    );

    this.add.text(640, 160, 'World Map', {
      fontFamily: 'Arial',
      fontSize: '48px',
      color: '#ffffff',
    }).setOrigin(0.5);

    [1, 2, 3].forEach((moduleId, index) => {
      const x = 280 + index * 360;

      this.add.text(x, 380, `Module ${moduleId}`, {
        fontFamily: 'Arial',
        fontSize: '30px',
        color: '#ffffff',
        backgroundColor: '#365fb0',
      })
        .setOrigin(0.5)
        .setPadding(24, 18)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.scene.start('LevelSelect', { moduleId });
        });
    });
  }
}
