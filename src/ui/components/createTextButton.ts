import Phaser from 'phaser';

/** Minimal clickable placeholder button. Replace visual styling with finished UI later. */
export function createTextButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  onClick: () => void,
  width = 330,
): void {
  const background = scene.add.rectangle(x, y, width, 64, 0x414a84)
    .setStrokeStyle(2, 0xd9dffa)
    .setInteractive({ useHandCursor: true });

  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize: '23px',
    color: '#ffffff',
    align: 'center',
  }).setOrigin(0.5);

  background.on('pointerover', () => background.setFillStyle(0x626eb2));
  background.on('pointerout', () => background.setFillStyle(0x414a84));
  background.on('pointerdown', onClick);
  // Clicking the label itself should work too, rather than requiring its padding.
  text.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
}
