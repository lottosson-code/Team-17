import { describe, expect, test } from 'vitest';
import {
    WIZARD_ANIMATIONS, WIZARD_CAST_RELEASE, WIZARD_FACE, WIZARD_FEET, WIZARD_SHEET, WIZARD_TIPS,
} from '../combat/view/wizardArt';

// The wizard's frame data is written by hand against the painted sheet; these keep it consistent.

const FRAME_COUNT = 16; // 4 x 4 grid
const inside = ([x, y]: readonly [number, number]) =>
    x >= 0 && x <= WIZARD_SHEET.frameWidth && y >= 0 && y <= WIZARD_SHEET.frameHeight;

describe('wizard art', () => {
    test('has every animation the wizard plays', () => {
        for (const name of ['idle', 'cast', 'hurt', 'scared', 'defeat', 'ko']) {
            expect(WIZARD_ANIMATIONS).toHaveProperty(name);
        }
    });

    test('only uses frames that exist', () => {
        for (const animation of Object.values(WIZARD_ANIMATIONS)) {
            expect(animation.frames.length).toBeGreaterThan(0);
            for (const frame of animation.frames) {
                expect(frame).toBeGreaterThanOrEqual(0);
                expect(frame).toBeLessThan(FRAME_COUNT);
            }
        }
        expect(WIZARD_TIPS).toHaveLength(FRAME_COUNT);
    });

    test('keeps looping animations looping and one-off animations one-off', () => {
        expect(WIZARD_ANIMATIONS.idle.repeat).toBe(-1);
        expect(WIZARD_ANIMATIONS.ko.repeat).toBe(-1);
        for (const name of ['cast', 'hurt', 'scared', 'defeat'] as const) {
            expect(WIZARD_ANIMATIONS[name].repeat).toBe(0);
        }
    });

    test('ends the defeat on the frame he stays down in', () => {
        const defeat = WIZARD_ANIMATIONS.defeat.frames;
        expect(WIZARD_ANIMATIONS.ko.frames).toEqual([defeat[defeat.length - 1]]);
    });

    test('puts the feet, the face and every known pencil tip inside the frame', () => {
        expect(inside([WIZARD_FEET.x, WIZARD_FEET.y])).toBe(true);
        expect(inside([WIZARD_FACE.x, WIZARD_FACE.y])).toBe(true);
        for (const tip of WIZARD_TIPS) if (tip) expect(inside(tip)).toBe(true);
    });

    test('releases the spell from a cast frame with a known tip, in front of the wizard', () => {
        expect(WIZARD_ANIMATIONS.cast.frames).toContain(WIZARD_CAST_RELEASE);
        const tip = WIZARD_TIPS[WIZARD_CAST_RELEASE];
        expect(tip).not.toBeNull();
        expect(tip![0]).toBeGreaterThan(WIZARD_FEET.x);
        expect(WIZARD_TIPS[WIZARD_ANIMATIONS.idle.frames[0]]).not.toBeNull();
    });
});
