import Phaser from 'phaser';
import { DEPTH, type Point } from './theme';
import { TEX } from './textures';
import {
    WIZARD_ANIMATIONS, WIZARD_CAST_RELEASE, WIZARD_FEET, WIZARD_SHEET, WIZARD_TIPS, type WizardAnimation,
} from './wizardArt';

// The player's wizard: painted animation frames (see wizardArt.ts) for standing, casting, getting
// hit, a wrong answer and defeat, plus a glow on the pencil tip. After a one-off animation he goes
// back to standing; after defeat he stays down.

/** Draws the art at about 185 px tall. */
const SCALE = 0.72;

/** Loads the wizard art; call from the scene's preload(). */
export function preloadWizard(scene: Phaser.Scene): void {
    if (!scene.textures.exists(WIZARD_SHEET.texture)) {
        scene.load.spritesheet(WIZARD_SHEET.texture, `assets/combat/wizard/${WIZARD_SHEET.file}.webp`, {
            frameWidth: WIZARD_SHEET.frameWidth, frameHeight: WIZARD_SHEET.frameHeight,
        });
    }
}

const animKey = (name: WizardAnimation) => `wizard-${name}`;

export class WizardSprite {
    readonly container: Phaser.GameObjects.Container;
    private readonly sprite: Phaser.GameObjects.Sprite;
    private readonly tipGlow: Phaser.GameObjects.Image;
    private readonly aura: Phaser.GameObjects.Image;
    private readonly breathing: Phaser.Tweens.Tween;
    private defeated = false;

    constructor(private readonly scene: Phaser.Scene, feet: Point) {
        createAnimations(scene);
        this.aura = scene.add.image(0, -90, TEX.glow).setTint(0x6fb8ff).setScale(2.6, 3).setAlpha(0.16)
            .setBlendMode(Phaser.BlendModes.ADD);
        // The art has its own floor shadow.
        this.sprite = scene.add.sprite(0, 0, WIZARD_SHEET.texture, 0)
            .setOrigin(WIZARD_FEET.x / WIZARD_SHEET.frameWidth, WIZARD_FEET.y / WIZARD_SHEET.frameHeight)
            .setScale(SCALE);
        this.tipGlow = scene.add.image(0, 0, TEX.glow).setTint(0x8fe9ff).setScale(0.3).setAlpha(0.55)
            .setBlendMode(Phaser.BlendModes.ADD);
        this.container = scene.add.container(feet.x, feet.y, [this.aura, this.sprite, this.tipGlow])
            .setDepth(DEPTH.wizard);

        this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, () => this.placeTipGlow());
        this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => this.finished(animation.key));
        this.play('idle');
        // Standing is a single frame, so it breathes instead.
        this.breathing = scene.tweens.add({
            targets: this.sprite, scaleY: SCALE * 1.018, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        });
        scene.tweens.add({ targets: this.tipGlow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1 });
    }

    /** Where spells leave the pencil, in screen coordinates. While casting, the thrust frame's tip. */
    tip(): Phaser.Math.Vector2 {
        const frame = this.current() === 'cast' ? WIZARD_CAST_RELEASE : Number(this.sprite.frame.name);
        const local = tipOffset(frame);
        return new Phaser.Math.Vector2(this.container.x + local.x, this.container.y + local.y);
    }

    /** Raises the pencil and thrusts it; the bolt itself is drawn by Effects from tip(). */
    cast(): void {
        if (this.defeated) return;
        this.play('cast');
        this.scene.tweens.add({ targets: this.aura, alpha: 0.42, duration: 80, yoyo: true });
    }

    /** An enemy hit the wizard: he winces and stumbles back, with a red flash. */
    hurt(): void {
        if (this.defeated) return;
        this.play('hurt');
        this.sprite.setTintFill(0xff4d5e);
        this.scene.time.delayedCall(90, () => this.defeated || this.sprite.clearTint());
    }

    /** Wrong answer: he jumps, sweats and trembles with fright. */
    scared(): void {
        if (this.defeated) return;
        this.play('scared');
    }

    /** The player lost: he falls and stays down. */
    defeat(): void {
        if (this.defeated) return;
        this.defeated = true;
        this.breathing.stop();
        this.sprite.setScale(SCALE).clearTint();
        this.scene.tweens.killTweensOf(this.tipGlow);
        this.tipGlow.setVisible(false);
        this.play('defeat');
    }

    /** Freezes the animation while the game is paused. */
    setPaused(paused: boolean): void {
        if (paused) this.sprite.anims.pause();
        else this.sprite.anims.resume();
    }

    private play(name: WizardAnimation): void {
        this.sprite.play(animKey(name));
        this.placeTipGlow();
    }

    private current(): WizardAnimation | undefined {
        const key = this.sprite.anims.currentAnim?.key;
        return key?.startsWith('wizard-') ? key.slice('wizard-'.length) as WizardAnimation : undefined;
    }

    /** After a one-off animation: back to standing, or out cold after defeat. */
    private finished(key: string): void {
        if (key === animKey('defeat')) this.play('ko');
        else if (!this.defeated && key !== animKey('ko')) this.play('idle');
    }

    /** The glow sits on the pencil tip in frames that show it, and hides in the others. */
    private placeTipGlow(): void {
        const frame = Number(this.sprite.frame.name);
        const known = WIZARD_TIPS[frame] !== null && !this.defeated;
        this.tipGlow.setVisible(known);
        if (known) {
            const at = tipOffset(frame);
            this.tipGlow.setPosition(at.x, at.y);
        }
    }
}

/** A frame's pencil tip relative to the feet, on screen. Frames without one use the standing pose's. */
function tipOffset(frame: number): Phaser.Math.Vector2 {
    const [x, y] = WIZARD_TIPS[frame] ?? WIZARD_TIPS[0]!;
    return new Phaser.Math.Vector2((x - WIZARD_FEET.x) * SCALE, (y - WIZARD_FEET.y) * SCALE);
}

function createAnimations(scene: Phaser.Scene): void {
    for (const [name, spec] of Object.entries(WIZARD_ANIMATIONS)) {
        const key = animKey(name as WizardAnimation);
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
            key,
            frames: scene.anims.generateFrameNumbers(WIZARD_SHEET.texture, { frames: spec.frames }),
            frameRate: spec.fps,
            repeat: spec.repeat,
        });
    }
}
