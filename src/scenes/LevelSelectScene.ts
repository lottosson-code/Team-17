import Phaser from 'phaser';

export class LevelSelectScene extends Phaser.Scene {
  private moduleId = 1;

  constructor() {
    super('LevelSelect');
  }

  init(data: { moduleId: number }): void {
    this.moduleId = data.moduleId;
  }

  create(): void {
    this.add.text(640, 190, `Module ${this.moduleId} — Level Select`, {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: '#ffffff',
    }).setOrigin(0.5);

    [1, 2].forEach((levelId, i) => {
      this.add.text(640, 365 + i * 110, `Level ${levelId}`, {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#365fb0',
      })
        .setOrigin(0.5)
        .setPadding(28, 18)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.scene.start('Combat', { moduleId: this.moduleId, levelId });
        });
    });
  }
}
