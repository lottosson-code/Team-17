import Phaser from 'phaser';
import type { EnemyIntro } from './enemyIntros';
import { bannerShape, menuButton } from './Hud';
import { DEPTH, enemyArt, type BattlefieldTheme, type EnemyArt } from './theme';

// "New enemy!" tags: one appears at the bottom right, just above the HUD panel, the first time
// the player meets an enemy. It stays for TAG_VISIBLE_MS of game time; clicking it opens an
// EnemyInfoCard. Several tags stack upwards. Pausing and the card itself are the scene's job.

/** How long a tag stays up. Counted in game time, so it waits while the game is paused. */
export const TAG_VISIBLE_MS = 5000;

const TAG = { w: 236, h: 68, right: 1256, bottom: 590, gap: 10 };
const PORTRAIT = { x: -TAG.w / 2 + 36, r: 27, size: 44 };
const TEXT_X = -TAG.w / 2 + 74;
const TIMER = { x: -TAG.w / 2 + 12, y: TAG.h / 2 - 7, w: TAG.w - 24, h: 3 };

interface Tag {
    intro: EnemyIntro;
    container: Phaser.GameObjects.Container;
    glow: Phaser.GameObjects.Graphics;
    timer: Phaser.GameObjects.Graphics;
    remainingMs: number;
}

export class NewEnemyTags {
    private readonly tags: Tag[] = [];

    /** `onOpen` is called when a tag is clicked; return false if the card can't open now. */
    constructor(
        private readonly scene: Phaser.Scene,
        private readonly theme: BattlefieldTheme,
        private readonly onOpen: (intro: EnemyIntro) => boolean,
    ) {}

    show(intro: EnemyIntro): void {
        const { scene } = this;
        const glow = scene.add.graphics();
        glow.lineStyle(6, 0xffd76a).strokeRoundedRect(-TAG.w / 2 - 3, -TAG.h / 2 - 3, TAG.w + 6, TAG.h + 6, 15);

        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.4).fillRoundedRect(-TAG.w / 2 + 4, -TAG.h / 2 + 5, TAG.w, TAG.h, 12);
        bg.fillGradientStyle(0x2c2152, 0x2c2152, 0x140f2a, 0x140f2a, 1).fillRoundedRect(-TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 12);
        bg.lineStyle(3, 0xd8b45a).strokeRoundedRect(-TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 12);
        bg.fillStyle(0x0b0918).fillCircle(PORTRAIT.x, 0, PORTRAIT.r);
        bg.lineStyle(2, 0x9a8462).strokeCircle(PORTRAIT.x, 0, PORTRAIT.r);

        const portrait = enemyPortrait(scene, enemyArt(this.theme, intro.art), PORTRAIT.x, 0, PORTRAIT.size);
        const label = scene.add.text(TEXT_X, -20, 'NEW ENEMY!', {
            fontFamily: 'Lora', fontSize: '15px', fontStyle: 'bold', color: '#ffd76a',
        }).setOrigin(0, 0.5);
        const name = scene.add.text(TEXT_X, 0, intro.name, {
            fontFamily: 'Lora', fontSize: '21px', fontStyle: 'bold', color: '#efe3c8',
        }).setOrigin(0, 0.5);
        const hint = scene.add.text(TEXT_X, 19, 'Click to learn more', {
            fontFamily: 'Lora', fontSize: '12px', color: '#a99ccc',
        }).setOrigin(0, 0.5);
        const timer = scene.add.graphics();

        // Starts off screen to the right and slides in.
        const container = scene.add.container(TAG.right + TAG.w, slotY(this.tags.length), [glow, bg, portrait, label, name, hint, timer])
            .setDepth(DEPTH.hud)
            .setSize(TAG.w, TAG.h)
            .setInteractive({ useHandCursor: true });
        const tag: Tag = { intro, container, glow, timer, remainingMs: TAG_VISIBLE_MS };
        this.tags.push(tag);
        this.drawTimer(tag);

        container.on('pointerover', () => container.setScale(1.04));
        container.on('pointerout', () => container.setScale(1));
        container.on('pointerdown', () => container.setScale(0.97));
        container.on('pointerup', () => {
            container.setScale(1);
            if (this.onOpen(intro)) this.remove(tag, false);
        });

        scene.tweens.add({ targets: container, x: TAG.right - TAG.w / 2, duration: 380, ease: 'Back.easeOut' });
        scene.tweens.add({ targets: glow, alpha: { from: 0.9, to: 0.15 }, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    /** Counts the tags down; call it only while the game is running. */
    update(deltaMs: number): void {
        for (const tag of [...this.tags]) {
            tag.remainingMs -= deltaMs;
            if (tag.remainingMs <= 0) {
                this.remove(tag, true);
            } else {
                this.drawTimer(tag);
            }
        }
    }

    private drawTimer(tag: Tag): void {
        const fraction = Math.max(0, tag.remainingMs / TAG_VISIBLE_MS);
        tag.timer.clear();
        tag.timer.fillStyle(0xffd76a, 0.9).fillRect(TIMER.x, TIMER.y, TIMER.w * fraction, TIMER.h);
    }

    /** Takes a tag away (sliding it out if `animate`) and moves the ones above it down. */
    private remove(tag: Tag, animate: boolean): void {
        const index = this.tags.indexOf(tag);
        if (index < 0) return;
        this.tags.splice(index, 1);
        const { container, glow } = tag;
        container.disableInteractive();
        this.scene.tweens.killTweensOf([container, glow]);
        if (animate) {
            this.scene.tweens.add({
                targets: container, x: TAG.right + TAG.w, alpha: 0, duration: 300, ease: 'Sine.easeIn',
                onComplete: () => container.destroy(),
            });
        } else {
            container.destroy();
        }
        this.tags.forEach((other, i) => {
            this.scene.tweens.add({ targets: other.container, y: slotY(i), duration: 250, ease: 'Sine.easeOut' });
        });
    }
}

/**
 * A card over the battlefield with the enemy's picture, description and a tip. It only draws;
 * the scene pauses the game while it is open and closes it (button, Enter or Esc).
 */
export class EnemyInfoCard {
    private readonly container: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, intro: EnemyIntro, art: EnemyArt, onClose: () => void) {
        const add = scene.add;
        const card = { cx: 640, y: 130, w: 660, h: 400 };
        const left = card.cx - card.w / 2;
        const textX = left + 276;
        const textWidth = card.w - 276 - 36;

        // Covers the whole screen so clicks don't reach the HUD or other tags underneath.
        const dim = add.rectangle(640, 360, 1280, 720, 0x05020c, 0.6).setInteractive();
        const box = add.graphics();
        bannerShape(box, card.cx, card.y, card.w, card.h);
        box.fillStyle(0x0b0918).fillRoundedRect(left + 30, card.y + 70, 220, 220, 14);
        box.lineStyle(2, 0x9a8462).strokeRoundedRect(left + 30, card.y + 70, 220, 220, 14);
        const picture = enemyPortrait(scene, art, left + 140, card.y + 180, 190);

        const label = add.text(textX, card.y + 54, 'NEW ENEMY', {
            fontFamily: 'Lora', fontSize: '16px', fontStyle: 'bold', color: '#ffd76a',
        }).setOrigin(0, 0.5);
        const name = add.text(textX, card.y + 92, intro.name, {
            fontFamily: 'Lora', fontSize: '40px', fontStyle: 'bold', color: '#f3e6c4', stroke: '#140818', strokeThickness: 6,
        }).setOrigin(0, 0.5);
        const description = add.text(textX, card.y + 128, intro.description, {
            fontFamily: 'Lora', fontSize: '18px', color: '#e8dcc0', lineSpacing: 4,
            wordWrap: { width: textWidth, useAdvancedWrap: true },
        });
        const tip = add.text(textX, description.y + description.height + 14, `Tip: ${intro.tip}`, {
            fontFamily: 'Lora', fontSize: '16px', fontStyle: 'bold', color: '#ffd76a', lineSpacing: 3,
            wordWrap: { width: textWidth, useAdvancedWrap: true },
        });

        const button = menuButton(scene, card.cx, card.y + card.h - 62, 'Got it!', onClose);
        const hint = add.text(card.cx, card.y + card.h - 22, 'Enter or Esc to continue', {
            fontFamily: 'Lora', fontSize: '14px', color: '#a99ccc',
        }).setOrigin(0.5);

        // No fade-in: the scene pauses every tween while the card is open, so it would never run.
        this.container = add.container(0, 0, [dim, box, picture, label, name, description, tip, button, hint])
            .setDepth(DEPTH.overlay);
    }

    destroy(): void {
        this.container.destroy();
    }
}

/** Centre y of the tag in `slot`; slot 0 is the lowest. */
function slotY(slot: number): number {
    return TAG.bottom - TAG.h / 2 - slot * (TAG.h + TAG.gap);
}

/** The enemy's art scaled to fit a `size` square, facing left like it does in the lanes. */
function enemyPortrait(scene: Phaser.Scene, art: EnemyArt, x: number, y: number, size: number): Phaser.GameObjects.Image {
    const image = scene.add.image(x, y, art.texture).setFlipX(!art.faceLeft);
    return image.setScale(Math.min(size / image.width, size / image.height));
}
