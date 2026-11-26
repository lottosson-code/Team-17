// The player's wizard: public/assets/combat/wizard/wizard.webp, 16 painted frames in a 4 x 4 grid.
// Source: assets/characters/wizard-sheet.png. Rebuilt with:
//     python scripts/make-spritesheet.py assets/characters/wizard-sheet.png public/assets/combat/wizard/wizard.webp
//         --cols 4 --rows 4 --keep-background --solid --out-cols 4
// That crops the source cells to 328 x 272 (dropping the top 10 rows), so frame pixel = source cell pixel - (0, 10).

export const WIZARD_SHEET = { texture: 'wizard', file: 'wizard', frameWidth: 328, frameHeight: 272 } as const;

/** Where the feet are inside a frame, in pixels. The sprite is anchored here. */
export const WIZARD_FEET = { x: 144, y: 266 } as const;

/** The middle of the face in frame 0, for the HUD portrait. */
export const WIZARD_FACE = { frame: 0, x: 150, y: 100 } as const;

export type WizardAnimation = 'idle' | 'cast' | 'hurt' | 'scared' | 'defeat' | 'ko';

export const WIZARD_ANIMATIONS: Record<WizardAnimation, { frames: number[]; fps: number; repeat: number }> = {
    idle: { frames: [0], fps: 1, repeat: -1 },
    cast: { frames: [1, 2, 3], fps: 12, repeat: 0 }, // raise the pencil, thrust, burst
    hurt: { frames: [4, 5, 6, 7], fps: 10, repeat: 0 }, // hit, wince, stumble back, recover
    scared: { frames: [8, 9, 10, 11], fps: 7, repeat: 0 }, // startled, sweating, trembling, anxious
    defeat: { frames: [12, 13, 14, 15], fps: 6, repeat: 0 }, // dizzy, falling, seeing stars, out cold
    ko: { frames: [15], fps: 1, repeat: -1 },
};

/** The cast frame the spell leaves from (the thrust), so the bolt starts at its wand tip. */
export const WIZARD_CAST_RELEASE = 2;

/**
 * Pencil tip per frame, in frame pixels, where the art shows it clearly (null otherwise).
 * Frames 2 and 3 are the centre of the painted glow.
 */
export const WIZARD_TIPS: readonly (readonly [number, number] | null)[] = [
    [66, 88], [258, 48], [296, 109], [282, 106],
    null, null, null, null,
    null, null, null, null,
    null, null, null, null,
];
