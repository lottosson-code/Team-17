import Phaser from 'phaser';

// The "COMPLETED" banner played after the last level of the last classroom.
// The art is public/assets/ui/completed.png (made by scripts/make-completed-banner.py).
// Timings live in COMPLETED_BANNER so they're easy to tune in one place.

/** Texture key of the banner art. */
export const COMPLETED_TEXTURE = 'ui-completed';

/** Look and timing of the banner animation (ms). */
export const COMPLETED_BANNER = {
    width: 820, // Drawn width in game pixels (the game is 1280 × 720)
    popInMs: 380, // Grows in from small and transparent
    holdMs: 2000, // Stays on screen, pulsing
    pulseMs: 500, // One beat of the pulse (grow then shrink back)
    pulseScale: 1.06, // How much bigger it gets on each beat
    fadeOutMs: 450,
    dimAlpha: 0.35, // Darkens the game behind it so the word stands out
    depth: 7500, // Above the HUD and the end-of-level panel
};

// Queues the banner art for loading; call from a scene's preload().
export function preloadCompletedBanner(scene: Phaser.Scene): void {
    if (!scene.textures.exists(COMPLETED_TEXTURE)) scene.load.image(COMPLETED_TEXTURE, 'assets/ui/completed.png');
}

// Plays the banner in the middle of the screen: pops in, pulses like a heartbeat for holdMs,
// then fades out. Resolves once it's gone (or straight away if the art is missing).
export function playCompletedBanner(scene: Phaser.Scene): Promise<void> {
    if (!scene.textures.exists(COMPLETED_TEXTURE)) return Promise.resolve();
    const cfg = COMPLETED_BANNER;
    const { width, height } = scene.scale;
    const cx = width / 2;
    const cy = height / 2 - 20;

    const dim = scene.add.rectangle(cx, height / 2, width, height, 0x05020c, 0).setDepth(cfg.depth);
    // Soft ring of light that swells out behind the word on each beat.
    const ring = scene.add.image(cx, cy, 'fx-glow').setTint(0xffc860).setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(cfg.depth);
    const banner = scene.add.image(cx, cy, COMPLETED_TEXTURE).setDepth(cfg.depth);
    const baseScale = cfg.width / banner.width;
    banner.setScale(baseScale * 0.55).setAlpha(0);
    const hasRing = scene.textures.exists('fx-glow');
    if (!hasRing) ring.setVisible(false);

    return new Promise<void>(resolve => {
        scene.tweens.add({ targets: dim, fillAlpha: cfg.dimAlpha, duration: cfg.popInMs });
        scene.tweens.add({
            targets: banner, alpha: 1, scale: baseScale, duration: cfg.popInMs, ease: 'Back.easeOut',
            onComplete: () => {
                // Heartbeat: grow and shrink back, repeated for the hold time.
                const beats = Math.max(1, Math.round(cfg.holdMs / cfg.pulseMs));
                scene.tweens.add({
                    targets: banner, scale: baseScale * cfg.pulseScale, duration: cfg.pulseMs / 2,
                    yoyo: true, repeat: beats - 1, ease: 'Sine.easeInOut',
                });
                if (hasRing) {
                    ring.setScale(2).setAlpha(0.55);
                    scene.tweens.add({
                        targets: ring, scale: 7, alpha: 0, duration: cfg.pulseMs, repeat: beats - 1, ease: 'Quad.easeOut',
                    });
                }
                scene.time.delayedCall(cfg.holdMs, () => {
                    scene.tweens.killTweensOf([banner, ring]);
                    scene.tweens.add({
                        targets: [banner, ring], alpha: 0, scale: `*=1.12`, duration: cfg.fadeOutMs, ease: 'Quad.easeIn',
                    });
                    scene.tweens.add({
                        targets: dim, fillAlpha: 0, duration: cfg.fadeOutMs,
                        onComplete: () => {
                            banner.destroy();
                            ring.destroy();
                            dim.destroy();
                            resolve();
                        },
                    });
                });
            },
        });
    });
}
