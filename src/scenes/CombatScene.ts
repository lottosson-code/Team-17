import Phaser from 'phaser';

export class CombatScene extends Phaser.Scene {
  private moduleId = 1;
  private levelId = 1;

  constructor() {
    super('Combat');
  }

  init(data: { moduleId: number; levelId: number }): void {
    this.moduleId = data.moduleId;
    this.levelId = data.levelId;
  }

  create(): void {
    this.add.text(640, 285, 'Combat Scene', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(640, 380, `Module ${this.moduleId} — Level ${this.levelId}`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#bfcdf0',
    }).setOrigin(0.5);
  }
}
