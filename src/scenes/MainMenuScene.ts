import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    this.add.text(640, 220, 'Game Title Here', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(640, 420, 'Start Game', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#365fb0',
    })
      .setOrigin(0.5)
      .setPadding(28, 18)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('WorldMap'));
  }
}
