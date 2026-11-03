import Phaser from 'phaser';
import { DEPTH } from './theme';
import { TEX } from './textures';

// One-off visual effects: the spell bolt, impact sparks, paper bursts and floating text.

type Vec = Phaser.Math.Vector2;

/**
 * A jagged lightning path from `from` to `to` by midpoint displacement.
 * `roughness` is how far (relative to length) the middle can bend.
 */
export function lightningPath(from: Vec, to: Vec, roughness = 0.18, depth = 5, random: () => number = Math.random): Vec[] {
    let points = [from.clone(), to.clone()];
    let offset = from.distance(to) * roughness;
    for (let level = 0; level < depth; level++) {
        const next: Vec[] = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const mid = a.clone().lerp(b, 0.5);
            // Push the midpoint sideways (perpendicular to the segment).
            const normal = new Phaser.Math.Vector2(-(b.y - a.y), b.x - a.x).normalize();
            mid.add(normal.scale((random() * 2 - 1) * offset));
            next.push(mid, b);
        }
        points = next;
        offset /= 2;
    }
    return points;
}

export class Effects {
    private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
    private readonly papers: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(private readonly scene: Phaser.Scene) {
        this.sparks = scene.add.particles(0, 0, TEX.spark, {
            emitting: false,
            lifespan: { min: 250, max: 550 },
            speed: { min: 140, max: 420 },
            scale: { start: 1.1, end: 0 },
            tint: [0xffffff, 0x9ff3ff, 0xffe27a],
            gravityY: 500,
            blendMode: Phaser.BlendModes.ADD,
        }).setDepth(DEPTH.effects + 1);
        this.papers = scene.add.particles(0, 0, TEX.paper, {
            emitting: false,
            lifespan: { min: 600, max: 1100 },
            speed: { min: 120, max: 300 },
            angle: { min: 200, max: 340 },
            rotate: { start: 0, end: 720 },
            scale: { start: 1, end: 0.4 },
            alpha: { start: 1, end: 0 },
            gravityY: 520,
        }).setDepth(DEPTH.effects);
    }

    /** The wizard's spell: a flickering, branching bolt with a glow at both ends. */
    bolt(from: Vec, to: Vec): void {
        const g = this.scene.add.graphics().setDepth(DEPTH.effects).setBlendMode(Phaser.BlendModes.ADD);
        const draw = () => {
            g.clear();
            const main = lightningPath(from, to);
            this.strokeBolt(g, main, 1);
            // Two short forks off the main path.
            for (let f = 0; f < 2; f++) {
                const start = main[Phaser.Math.Between(4, main.length - 8)];
                const end = start.clone().add(new Phaser.Math.Vector2(Phaser.Math.Between(20, 70), Phaser.Math.Between(-60, 60)));
                this.strokeBolt(g, lightningPath(start, end, 0.3, 3), 0.5);
            }
        };
        draw();
        // Re-roll the shape twice so the bolt crackles, then fade it.
        this.scene.time.delayedCall(45, draw);
        this.scene.time.delayedCall(95, draw);
        this.scene.tweens.add({ targets: g, alpha: 0, delay: 110, duration: 160, onComplete: () => g.destroy() });

        this.glowBurst(from, 0x8fe9ff, 0.9);
        this.glowBurst(to, 0xb6f4ff, 1.8);
    }

    /** The boss's purple zap that rewrites a problem. */
    curse(from: Vec, to: Vec): void {
        const g = this.scene.add.graphics().setDepth(DEPTH.boss - 1).setBlendMode(Phaser.BlendModes.ADD);
        const points = lightningPath(from, to, 0.12, 4);
        g.lineStyle(10, 0x9b5cff, 0.25).strokePoints(points);
        g.lineStyle(4, 0xc9a6ff, 0.8).strokePoints(points);
        g.lineStyle(1.5, 0xffffff, 1).strokePoints(points);
        this.scene.tweens.add({ targets: g, alpha: 0, duration: 500, onComplete: () => g.destroy() });
        this.glowBurst(to, 0xb18cff, 1.2);
    }

    impact(at: Vec): void {
        this.sparks.explode(22, at.x, at.y);
    }

    paperBurst(at: Vec): void {
        this.papers.explode(12, at.x, at.y);
        this.glowBurst(at, 0xffffff, 1.4);
    }

    correct(at: Vec): void {
        const text = this.scene.add.text(at.x - 70, at.y + 10, 'CORRECT!', {
            fontFamily: 'Poppins', fontSize: '38px', fontStyle: 'italic', color: '#7fe9ff',
            stroke: '#0b2a6b', strokeThickness: 8,
        }).setOrigin(0.5).setAngle(-14).setScale(0.3).setDepth(DEPTH.effects + 2);
        text.setShadow(0, 0, '#3fd6ff', 16, true, true);
        this.scene.tweens.add({ targets: text, scale: 1, duration: 180, ease: 'Back.easeOut' });
        this.scene.tweens.add({
            targets: text, y: text.y - 34, alpha: 0, delay: 520, duration: 320, onComplete: () => text.destroy(),
        });
    }

    damage(at: Vec, amount: number): void {
        const text = this.scene.add.text(at.x + 50, at.y - 20, `-${amount}`, {
            fontFamily: 'Poppins', fontSize: '34px', color: '#ff5c7a', stroke: '#3a0614', strokeThickness: 7,
        }).setOrigin(0.5).setDepth(DEPTH.effects + 2);
        this.scene.tweens.add({ targets: text, y: text.y - 46, duration: 650, ease: 'Quad.easeOut' });
        this.scene.tweens.add({ targets: text, alpha: 0, delay: 380, duration: 270, onComplete: () => text.destroy() });
    }

    /** Big gold text, used when the player takes damage or for short callouts. */
    callout(at: Vec, label: string, color: string): void {
        const text = this.scene.add.text(at.x, at.y, label, {
            fontFamily: 'Poppins', fontSize: '28px', color, stroke: '#140818', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(DEPTH.effects + 2);
        this.scene.tweens.add({ targets: text, y: at.y - 36, alpha: 0, duration: 800, onComplete: () => text.destroy() });
    }

    shake(strength = 0.006, duration = 140): void {
        this.scene.cameras.main.shake(duration, strength);
    }

    private glowBurst(at: Vec, color: number, scale: number): void {
        const glow = this.scene.add.image(at.x, at.y, TEX.glow).setTint(color).setScale(scale * 0.4)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.effects + 1);
        this.scene.tweens.add({ targets: glow, scale, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
    }

    private strokeBolt(g: Phaser.GameObjects.Graphics, points: Vec[], strength: number): void {
        g.lineStyle(16 * strength, 0x3f8cff, 0.18).strokePoints(points);
        g.lineStyle(7 * strength, 0x6fdcff, 0.55).strokePoints(points);
        g.lineStyle(2.5 * strength, 0xffffff, 1).strokePoints(points);
    }
}
