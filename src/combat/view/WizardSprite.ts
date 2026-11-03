import Phaser from 'phaser';
import { starPoints } from './Battlefield';
import { DEPTH, type Point } from './theme';
import { TEX } from './textures';

// The player's wizard: body art, a pencil wand that glows when casting, and pose animations.
// Until painted art exists, the body is drawn in code into the 'wizard-body' texture.
// To use painted art instead, load a texture called 'wizard-body' (feet at the bottom, facing right).

const BODY = 'wizard-body';
const WAND = 'wizard-wand';
const BODY_W = 130;
const BODY_H = 176;
/** Hand position relative to the feet. */
const HAND = { x: 46, y: -74 };
const WAND_LENGTH = 62;

export class WizardSprite {
    readonly container: Phaser.GameObjects.Container;
    private readonly body: Phaser.GameObjects.Image;
    private readonly wand: Phaser.GameObjects.Image;
    private readonly tipGlow: Phaser.GameObjects.Image;
    private readonly aura: Phaser.GameObjects.Image;
    private readonly idle: Phaser.Tweens.Tween;
    private defeated = false;

    constructor(private readonly scene: Phaser.Scene, private readonly feet: Point) {
        createWizardTextures(scene);
        this.aura = scene.add.image(0, -80, TEX.glow).setTint(0x6fb8ff).setScale(2.6, 3).setAlpha(0.18)
            .setBlendMode(Phaser.BlendModes.ADD);
        const shadow = scene.add.image(0, 0, TEX.glow).setTint(0x000000).setAlpha(0.55).setScale(0.9, 0.22);
        this.body = scene.add.image(0, 0, BODY).setOrigin(0.5, 1);
        this.wand = scene.add.image(HAND.x, HAND.y, WAND).setOrigin(0.08, 0.5).setAngle(-22);
        this.tipGlow = scene.add.image(0, 0, TEX.glow).setTint(0x8fe9ff).setScale(0.35).setAlpha(0.7)
            .setBlendMode(Phaser.BlendModes.ADD);
        this.container = scene.add.container(feet.x, feet.y, [this.aura, shadow, this.body, this.wand, this.tipGlow])
            .setDepth(DEPTH.wizard);
        this.placeTipGlow();

        this.idle = scene.tweens.add({
            targets: this.body, scaleY: 1.025, y: -1, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        scene.tweens.add({
            targets: this.wand, angle: -28, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            onUpdate: () => this.placeTipGlow(),
        });
        scene.tweens.add({ targets: this.tipGlow, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
    }

    /** Where spells leave the wand, in screen coordinates. */
    tip(): Phaser.Math.Vector2 {
        return new Phaser.Math.Vector2(this.container.x + this.tipGlow.x, this.container.y + this.tipGlow.y);
    }

    /** Points the wand at `target` and flashes the tip; the bolt itself is drawn by Effects. */
    cast(target: Phaser.Math.Vector2): void {
        if (this.defeated) return;
        const hand = new Phaser.Math.Vector2(this.feet.x + HAND.x, this.feet.y + HAND.y);
        const angle = Phaser.Math.RadToDeg(Phaser.Math.Angle.BetweenPoints(hand, target));
        this.scene.tweens.killTweensOf(this.wand);
        this.wand.setAngle(angle);
        this.placeTipGlow();
        this.tipGlow.setScale(0.9).setAlpha(1);
        this.scene.tweens.add({ targets: this.tipGlow, scale: 0.35, alpha: 0.7, duration: 260 });
        this.scene.tweens.add({ targets: this.body, x: -6, duration: 60, yoyo: true });
        this.scene.tweens.add({ targets: this.aura, alpha: 0.45, duration: 80, yoyo: true });
    }

    hurt(): void {
        if (this.defeated) return;
        this.body.setTintFill(0xff4d5e);
        this.scene.time.delayedCall(90, () => this.defeated || this.body.clearTint());
        this.scene.tweens.add({ targets: this.body, x: -12, angle: -7, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    }

    /** Wrong answer: a startled jump, a shiver and a sweat drop. */
    scared(): void {
        if (this.defeated) return;
        this.body.setTint(0xb8c8ff);
        this.scene.time.delayedCall(450, () => this.defeated || this.body.clearTint());
        this.scene.tweens.add({ targets: this.body, y: -14, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        this.scene.tweens.add({ targets: this.body, x: { from: -4, to: 4 }, duration: 45, yoyo: true, repeat: 4, onComplete: () => { this.body.x = 0; } });
        const drop = this.scene.add.text(this.feet.x + 22, this.feet.y - BODY_H + 18, '💧', { fontSize: '22px' })
            .setOrigin(0.5).setDepth(DEPTH.effects);
        const marks = this.scene.add.text(this.feet.x - 30, this.feet.y - BODY_H - 4, '!!', {
            fontFamily: 'Poppins', fontSize: '30px', color: '#ff5a5f', stroke: '#1b0b10', strokeThickness: 5,
        }).setOrigin(0.5).setAngle(-12).setDepth(DEPTH.effects).setScale(0.3);
        this.scene.tweens.add({ targets: marks, scale: 1, duration: 160, ease: 'Back.easeOut' });
        this.scene.tweens.add({ targets: [drop, marks], alpha: 0, delay: 650, duration: 250, onComplete: () => { drop.destroy(); marks.destroy(); } });
        this.scene.tweens.add({ targets: drop, y: drop.y + 20, duration: 900 });
    }

    defeat(): void {
        this.defeated = true;
        this.idle.stop();
        this.scene.tweens.killTweensOf([this.wand, this.tipGlow]);
        this.body.setTint(0x6b6b80);
        this.tipGlow.setAlpha(0);
        this.scene.tweens.add({ targets: this.container, angle: -80, y: this.feet.y + 10, duration: 600, ease: 'Bounce.easeOut' });
    }

    private placeTipGlow(): void {
        const radians = Phaser.Math.DegToRad(this.wand.angle);
        this.tipGlow.setPosition(HAND.x + Math.cos(radians) * WAND_LENGTH, HAND.y + Math.sin(radians) * WAND_LENGTH);
    }
}

/** Draws the placeholder wizard and wand textures (skipped if painted art is already loaded). */
function createWizardTextures(scene: Phaser.Scene): void {
    if (!scene.textures.exists(BODY)) {
        const g = scene.make.graphics({}, false);
        const cx = BODY_W / 2;
        const outline = 0x1a1230;
        // Boots.
        g.fillStyle(0x4a2b1b).fillRoundedRect(cx - 26, BODY_H - 14, 22, 14, 5).fillRoundedRect(cx + 4, BODY_H - 14, 24, 14, 5);
        // Robe with gold trim.
        const robe = [
            new Phaser.Math.Vector2(cx - 24, 82), new Phaser.Math.Vector2(cx + 24, 82),
            new Phaser.Math.Vector2(cx + 40, BODY_H - 10), new Phaser.Math.Vector2(cx - 40, BODY_H - 10),
        ];
        g.fillStyle(0x24306e).fillPoints(robe, true);
        g.lineStyle(3, outline).strokePoints(robe, true);
        g.fillStyle(0x1a2252).fillTriangle(cx - 6, 90, cx + 6, 90, cx, BODY_H - 12);
        g.lineStyle(4, 0xd8b45a).lineBetween(cx - 40, BODY_H - 12, cx + 40, BODY_H - 12);
        g.fillStyle(0xb02a35).fillTriangle(cx - 10, 84, cx + 10, 84, cx, 100); // tie
        // Satchel strap.
        g.lineStyle(5, 0x6b4429).lineBetween(cx - 20, 86, cx + 28, 140);
        g.fillStyle(0x7a4e2c).fillRoundedRect(cx - 44, 118, 26, 30, 5);
        // Arm reaching to the wand hand.
        g.lineStyle(14, 0x24306e).lineBetween(cx + 14, 96, cx + HAND.x - 4, BODY_H + HAND.y);
        g.fillStyle(0xffd9b8).fillCircle(cx + HAND.x, BODY_H + HAND.y, 7);
        // Head and hair.
        g.fillStyle(0xffd9b8).fillCircle(cx, 62, 21);
        g.lineStyle(3, outline).strokeCircle(cx, 62, 21);
        g.fillStyle(0x6b3a1f).fillEllipse(cx - 6, 47, 46, 18).fillTriangle(cx - 26, 50, cx - 12, 50, cx - 22, 70);
        g.fillStyle(0x1a1230).fillEllipse(cx + 7, 63, 6, 9).fillEllipse(cx + 17, 63, 6, 9);
        g.fillStyle(0xffffff).fillCircle(cx + 8, 61, 1.6).fillCircle(cx + 18, 61, 1.6);
        g.fillStyle(0xff9d9d, 0.6).fillEllipse(cx + 4, 72, 8, 4);
        g.lineStyle(2, 0x7a3a2a).lineBetween(cx + 9, 76, cx + 16, 75);
        // Hat: bent cone, brim, star.
        const hat = [
            new Phaser.Math.Vector2(cx - 30, 46), new Phaser.Math.Vector2(cx + 28, 46),
            new Phaser.Math.Vector2(cx + 8, 14), new Phaser.Math.Vector2(cx - 22, 2),
            new Phaser.Math.Vector2(cx - 6, 18),
        ];
        g.fillStyle(0x2f3d8f).fillPoints(hat, true);
        g.lineStyle(3, outline).strokePoints(hat, true);
        g.fillStyle(0x223077).fillEllipse(cx, 47, 86, 15);
        g.lineStyle(3, outline).strokeEllipse(cx, 47, 86, 15);
        g.fillStyle(0xffd447).fillPoints(starPoints(cx + 2, 30, 9, 4), true);
        g.generateTexture(BODY, BODY_W, BODY_H);
        g.destroy();
    }
    if (!scene.textures.exists(WAND)) {
        const g = scene.make.graphics({}, false);
        // A pencil wand pointing right: eraser, ferrule, yellow body, sharpened tip.
        g.fillStyle(0xe56b7a).fillRect(0, 2, 8, 10);
        g.fillStyle(0xb8b8c4).fillRect(8, 2, 6, 10);
        g.fillStyle(0xf2b632).fillRect(14, 2, 38, 10);
        g.fillStyle(0xd99a1c).fillRect(14, 8, 38, 4);
        g.fillStyle(0xf5d9a8).fillTriangle(52, 2, 52, 12, 62, 7);
        g.fillStyle(0x2b2b33).fillTriangle(58, 5, 58, 9, 62, 7);
        g.lineStyle(1.5, 0x1a1230).strokeRect(0, 2, 52, 10);
        g.generateTexture(WAND, 64, 14);
        g.destroy();
    }
}
