import Phaser from 'phaser';
import { project } from '../laneLayout';
import { problemText } from '../problems';
import type { Enemy } from '../types';
import { walkTimeScale, type EnemyArt } from './theme';
import { TEX } from './textures';

// One enemy on the battlefield: art, shadow, and the problem bubble with its HP bar.
// The container sits at the enemy's feet; the scene calls sync() every frame with the model's enemy.
// The bubble is a separate object drawn above every enemy body, so a body never hides a problem.

const BUBBLE_GAP = 10;
/** Bubbles are drawn above all enemy bodies (which use depths up to about 600). */
const BUBBLE_DEPTH = 900;
const WALK_SPEED = 0.011; // Steps per ms, roughly
const HP_HEIGHT = 8;

/** Animation key for an enemy art's walk cycle. */
export function walkAnimationKey(art: EnemyArt): string {
    return `${art.walk?.texture ?? art.texture}-walk`;
}

/** Registers the walk animation for each art that has one (once per game). */
export function createWalkAnimations(scene: Phaser.Scene, arts: EnemyArt[]): void {
    for (const art of arts) {
        if (!art.walk || scene.anims.exists(walkAnimationKey(art))) continue;
        scene.anims.create({
            key: walkAnimationKey(art),
            frames: scene.anims.generateFrameNumbers(art.walk.texture, { start: 0, end: art.walk.frames - 1 }),
            frameRate: art.walk.fps,
            repeat: -1,
        });
    }
}

export class EnemySprite {
    readonly container: Phaser.GameObjects.Container;
    /** A Sprite playing the walk cycle when the art has one, otherwise the still image. */
    private readonly body: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    private readonly shadow: Phaser.GameObjects.Image;
    private readonly bubble: Phaser.GameObjects.Container;
    private readonly panel: Phaser.GameObjects.Graphics;
    private readonly label: Phaser.GameObjects.Text;
    private readonly hpBack: Phaser.GameObjects.Rectangle;
    private readonly hpFill: Phaser.GameObjects.Rectangle;
    private readonly bodyScale: number;
    private readonly shadowScaleX: number;
    /** Distance from the centre to the left side of the art, at scale 1. */
    private readonly halfWidth: number;
    /** Walk cycle speed that matches this enemy's walking speed in its lane. */
    private readonly walkScale: number;
    private readonly phase = Math.random() * Math.PI * 2;

    private shownText = '';
    /** Progress at the previous sync; unchanged means the enemy is standing still. */
    private lastProgress = -1;
    /** True while a hit/attack tween owns the body's position. */
    private busy = false;
    private dying = false;

    constructor(private readonly scene: Phaser.Scene, enemy: Readonly<Enemy>, readonly art: EnemyArt) {
        const walk = art.walk;
        const source = walk
            ? { width: walk.frameWidth, height: walk.frameHeight }
            : scene.textures.get(art.texture).getSourceImage();
        this.bodyScale = art.height / source.height;
        const width = source.width * this.bodyScale;
        // The art is trimmed to its edges, so half its width is where its left side is.
        this.halfWidth = width / 2;
        this.shadowScaleX = (width * 0.95) / 128;
        this.walkScale = walkTimeScale(art, enemy.lane, enemy.kind.walkMs);

        this.shadow = scene.add.image(0, 0, TEX.glow).setTint(0x000000).setAlpha(0.6).setScale(this.shadowScaleX, 0.3);
        this.body = walk
            ? scene.add.sprite(0, 0, walk.texture, 0).setFlipX(!walk.faceLeft)
            : scene.add.image(0, 0, art.texture).setFlipX(!art.faceLeft);
        this.body.setOrigin(0.5, 1).setScale(this.bodyScale);

        this.panel = scene.add.graphics();
        this.label = scene.add.text(0, -9, '', {
            fontFamily: 'Lora', fontSize: '27px', fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5);
        this.hpBack = scene.add.rectangle(0, 15, 10, HP_HEIGHT, 0x2a0d12).setOrigin(0, 0.5);
        this.hpFill = scene.add.rectangle(0, 15, 10, HP_HEIGHT, 0xe8384f).setOrigin(0, 0.5);
        this.bubble = scene.add.container(0, 0, [this.panel, this.label, this.hpBack, this.hpFill]);

        this.container = scene.add.container(0, 0, [this.shadow, this.body]);
        this.sync(enemy, scene.time.now);

        // Rise out of the floor at the far end of the lane.
        this.container.setAlpha(0);
        this.body.setScale(this.bodyScale * 1.15, this.bodyScale * 0.6);
        this.bubble.setAlpha(0);
        scene.tweens.add({ targets: [this.container, this.bubble], alpha: 1, duration: 260 });
        scene.tweens.add({ targets: this.body, scaleX: this.bodyScale, scaleY: this.bodyScale, duration: 380, ease: 'Back.easeOut' });
    }

    sync(enemy: Readonly<Enemy>, time: number): void {
        if (this.dying) return;
        // Arrive (and start attacking) when the left side, not the centre, reaches the end line.
        const { x, y, scale } = project(enemy.lane, enemy.progress, this.halfWidth);
        this.container.setPosition(x, y).setScale(scale).setDepth(y);
        // Bubbles keep a readable size even in the back lanes.
        const bubbleScale = 0.8 + 0.2 * scale;
        // The bubble moves with its enemy, so both walk in from off screen together.
        this.bubble.setPosition(x, y - (this.art.height + BUBBLE_GAP) * scale - 26 * bubbleScale)
            .setScale(bubbleScale).setDepth(BUBBLE_DEPTH + y);

        const text = problemText(enemy.problem);
        if (text !== this.shownText) this.setProblem(text);
        const fraction = enemy.hp / enemy.kind.maxHp;
        this.hpFill.scaleX = fraction;
        this.hpFill.setFillStyle(fraction > 0.5 ? 0xe8384f : fraction > 0.25 ? 0xff8a3d : 0xffd23d);

        // Moving = the model advanced it since last frame. Standing still covers attacking,
        // pausing and cutscene freezes, so nobody walks in place.
        const moving = enemy.progress !== this.lastProgress;
        this.lastProgress = enemy.progress;

        if (this.body instanceof Phaser.GameObjects.Sprite) {
            const key = walkAnimationKey(this.art);
            if (moving && !this.body.anims.isPlaying) this.body.play({ key, startFrame: Math.floor(Math.random() * 4), timeScale: this.walkScale });
            if (!moving && this.body.anims.isPlaying) this.body.anims.stop();
            if (!this.busy) this.body.angle = moving ? 0 : Math.sin((time * WALK_SPEED + this.phase) * 0.5) * 2;
        } else if (!this.busy) {
            const t = time * WALK_SPEED + this.phase;
            if (moving) {
                const step = Math.abs(Math.sin(t));
                this.body.y = -step * 7;
                this.body.angle = Math.sin(t) * 5;
                this.shadow.setScale(this.shadowScaleX * (1 - step * 0.12), 0.3);
            } else {
                // Snarling in place between attacks.
                this.body.y = 0;
                this.body.angle = Math.sin(t * 0.5) * 2;
            }
        }
    }

    /** Hides the problem while the game is paused, so players can't work it out for free. */
    setProblemHidden(hidden: boolean): void {
        if (this.bubble.active) this.bubble.setVisible(!hidden);
    }

    /** Where spells should strike: the middle of the body. */
    centre(): Phaser.Math.Vector2 {
        const s = this.container.scale;
        return new Phaser.Math.Vector2(this.container.x, this.container.y - this.art.height * 0.5 * s);
    }

    /** The problem bubble's position on screen. */
    bubblePoint(): Phaser.Math.Vector2 {
        return new Phaser.Math.Vector2(this.bubble.x, this.bubble.y);
    }

    hit(): void {
        this.body.setTintFill(0xffffff);
        this.scene.time.delayedCall(70, () => this.body.active && this.body.clearTint());
        this.busy = true;
        this.scene.tweens.killTweensOf(this.body);
        this.body.setScale(this.bodyScale);
        this.scene.tweens.add({
            targets: this.body, x: 16, angle: 10, scaleY: this.bodyScale * 0.88, duration: 70, yoyo: true,
            ease: 'Quad.easeOut', onComplete: () => { this.body.x = 0; this.busy = false; },
        });
    }

    attack(): void {
        if (this.dying) return;
        this.busy = true;
        this.scene.tweens.killTweensOf(this.body);
        this.scene.tweens.add({
            targets: this.body, x: -38, angle: -14, duration: 120, yoyo: true, ease: 'Back.easeIn',
            onComplete: () => { this.body.x = 0; this.busy = false; },
        });
    }

    /** The boss rewrote this enemy's problem. */
    popProblem(): void {
        this.label.setColor('#d6c4ff');
        this.scene.tweens.add({ targets: this.label, scale: 1.35, duration: 180, yoyo: true, ease: 'Back.easeOut' });
        this.scene.time.delayedCall(1500, () => this.label.active && this.label.setColor('#ffffff'));
    }

    die(): void {
        this.dying = true;
        this.scene.tweens.killTweensOf([this.body, this.bubble, this.container]);
        this.scene.tweens.add({ targets: this.bubble, alpha: 0, y: this.bubble.y - 20, duration: 200, onComplete: () => this.bubble.destroy() });
        this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 300 });
        this.body.setTintFill(0xffffff);
        this.scene.tweens.add({
            targets: this.body, scaleX: this.bodyScale * 1.35, scaleY: this.bodyScale * 0.15, alpha: 0,
            duration: 280, ease: 'Quad.easeIn', onComplete: () => this.container.destroy(),
        });
    }

    destroy(): void {
        this.container.destroy();
        this.bubble.destroy();
    }

    private setProblem(text: string): void {
        this.shownText = text;
        this.label.setText(text);
        const w = Math.max(120, this.label.width + 36);
        const h = 62;
        const top = -h / 2 - 8;
        this.panel.clear();
        this.panel.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, top + 4, w, h, 10);
        this.panel.fillStyle(0x15142c, 0.94).fillRoundedRect(-w / 2, top, w, h, 10);
        this.panel.lineStyle(2.5, 0xb8c4ff, 0.9).strokeRoundedRect(-w / 2, top, w, h, 10);
        this.panel.fillStyle(0x15142c, 0.94).fillTriangle(-9, top + h - 1, 9, top + h - 1, 0, top + h + 11);
        this.panel.lineStyle(2.5, 0xb8c4ff, 0.9)
            .lineBetween(-9, top + h, 0, top + h + 11).lineBetween(0, top + h + 11, 9, top + h);
        const barW = w - 30;
        this.hpBack.setPosition(-barW / 2, 15).setSize(barW, HP_HEIGHT);
        this.hpFill.setPosition(-barW / 2, 15).setSize(barW, HP_HEIGHT);
    }
}
