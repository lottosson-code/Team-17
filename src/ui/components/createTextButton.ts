import Phaser from 'phaser';
import { soundManager } from '../../audio/soundManager';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'figmaTeal';

export interface CreateTextButtonOptions {
  variant?: ButtonVariant;
  height?: number;
  textColor?: string;
  fontSize?: string;
}

interface VariantColorConfig {
  defaultFill: number;
  hoverFill: number;
  activeFill: number;
  stroke: number;
  innerHighlight: number;
  defaultText: string;
}

const VARIANT_CONFIGS: Record<ButtonVariant, VariantColorConfig> = {
  primary: {
    defaultFill: 0x365fb0,
    hoverFill: 0x4876d6,
    activeFill: 0x294988,
    stroke: 0x82a9ff,
    innerHighlight: 0x6895ff,
    defaultText: '#ffffff',
  },
  secondary: {
    defaultFill: 0x3d3f66,
    hoverFill: 0x515485,
    activeFill: 0x2c2e4d,
    stroke: 0x8f93cf,
    innerHighlight: 0x6e72ab,
    defaultText: '#ffffff',
  },
  danger: {
    defaultFill: 0x6b2b3a,
    hoverFill: 0x8c3449,
    activeFill: 0x4d1d29,
    stroke: 0xeb6e85,
    innerHighlight: 0xb54c61,
    defaultText: '#ffffff',
  },
  figmaTeal: {
    defaultFill: 0xcaedf5,
    hoverFill: 0xaee2f0,
    activeFill: 0x92d3e2,
    stroke: 0x5ba3b8,
    innerHighlight: 0xecf9fc,
    defaultText: '#203f4c',
  },
};

export interface TextButtonContainer extends Phaser.GameObjects.Container {
  buttonBg?: Phaser.GameObjects.Rectangle;
  buttonLabel?: Phaser.GameObjects.Text;
  buttonInnerBorder?: Phaser.GameObjects.Rectangle;
  triggerClick?: () => void;
  setEnabled?: (enabled: boolean) => TextButtonContainer;
}

/**
 * Enhanced reusable text button component with rich animations, Web Audio feedback,
 * and support for primary, secondary, danger, and figmaTeal visual themes.
 */
export function createTextButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  onClick: () => void,
  width = 330,
  options?: CreateTextButtonOptions,
): Phaser.GameObjects.Container {
  const variant: ButtonVariant = options?.variant ?? 'primary';
  const height = options?.height ?? 60;
  const fontSize = options?.fontSize ?? '22px';
  const colors = VARIANT_CONFIGS[variant] || VARIANT_CONFIGS.primary;
  const textColor = options?.textColor ?? colors.defaultText;

  const container = scene.add.container(x, y) as TextButtonContainer;

  // Background rectangle
  const background = scene.add.rectangle(0, 0, width, height, colors.defaultFill)
    .setStrokeStyle(2, colors.stroke)
    .setInteractive({ useHandCursor: true });

  // Subtle inner highlight border
  const innerBorder = scene.add.rectangle(0, 0, Math.max(10, width - 8), Math.max(10, height - 8))
    .setStrokeStyle(1, colors.innerHighlight, 0.45);

  // Label text
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial, sans-serif',
    fontSize,
    fontStyle: 'bold',
    color: textColor,
    align: 'center',
  }).setOrigin(0.5);

  container.add([background, innerBorder, text]);
  container.buttonBg = background;
  container.buttonLabel = text;
  container.buttonInnerBorder = innerBorder;

  let isEnabled = true;

  const doClick = () => {
    if (!isEnabled) return;
    onClick();
  };
  container.triggerClick = doClick;

  background.on('pointerover', () => {
    if (!isEnabled) return;
    soundManager.playSfx('hover');
    background.setFillStyle(colors.hoverFill);
    background.setStrokeStyle(2, 0xffffff);

    if (scene.tweens) {
      scene.tweens.add({
        targets: container,
        scale: 1.04,
        duration: 120,
        ease: 'Sine.easeOut',
      });
    } else {
      container.setScale(1.04);
    }
  });

  background.on('pointerout', () => {
    if (!isEnabled) return;
    background.setFillStyle(colors.defaultFill);
    background.setStrokeStyle(2, colors.stroke);

    if (scene.tweens) {
      scene.tweens.add({
        targets: container,
        scale: 1.0,
        duration: 120,
        ease: 'Sine.easeOut',
      });
    } else {
      container.setScale(1.0);
    }
  });

  background.on('pointerdown', () => {
    if (!isEnabled) return;
    soundManager.playSfx('click');

    if (scene.tweens) {
      scene.tweens.add({
        targets: container,
        scale: 0.96,
        duration: 60,
        yoyo: true,
        onComplete: () => {
          doClick();
        },
      });
    } else {
      doClick();
    }
  });

  container.setEnabled = (enabled: boolean): TextButtonContainer => {
    isEnabled = enabled;
    if (!enabled) {
      background.setFillStyle(0xd4dcde);
      background.setStrokeStyle(2, 0xa1acad);
      text.setColor('#8a9699');
      background.disableInteractive();
    } else {
      background.setFillStyle(colors.defaultFill);
      background.setStrokeStyle(2, colors.stroke);
      text.setColor(textColor);
      background.setInteractive({ useHandCursor: true });
    }
    return container;
  };

  return container;
}
