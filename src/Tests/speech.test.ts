import { describe, expect, test } from 'vitest';
import { BOSS_VOICE, TYPE_MS_PER_CHAR, blipPositions, speechHoldMs, voicePitch } from '../combat/view/speech';

describe('blipPositions', () => {
    test('blips on every other letter', () => {
        expect(blipPositions('Hehehe')).toEqual([0, 2, 4]);
    });

    test('skips spaces and punctuation, and keeps counting letters across them', () => {
        // Letters: N o w M U L T I P L Y -> blips on the 1st, 3rd, 5th, ... letter.
        expect(blipPositions('Now MULTIPLY!')).toEqual([0, 2, 5, 7, 9, 11]);
        expect(blipPositions('... !!! ')).toEqual([]);
    });

    test('counts digits as letters', () => {
        expect(blipPositions('7 x 8')).toEqual([0, 4]);
    });
});

describe('voicePitch', () => {
    test('starts at the base frequency and goes up by semitones', () => {
        expect(voicePitch(BOSS_VOICE, 0)).toBeCloseTo(BOSS_VOICE.base);
        const top = BOSS_VOICE.steps.length - 1;
        expect(voicePitch(BOSS_VOICE, top)).toBeCloseTo(BOSS_VOICE.base * 2 ** (BOSS_VOICE.steps[top] / 12));
    });

    test('keeps the boss voice low and every step within an octave', () => {
        for (let step = 0; step < BOSS_VOICE.steps.length; step++) {
            const pitch = voicePitch(BOSS_VOICE, step);
            expect(pitch).toBeGreaterThanOrEqual(BOSS_VOICE.base);
            expect(pitch).toBeLessThan(BOSS_VOICE.base * 2);
        }
    });
});

describe('speechHoldMs', () => {
    test('keeps the requested time when the line types out well before it', () => {
        expect(speechHoldMs('Hi', 1400)).toBe(1400);
    });

    test('stays up long enough to read a long line after it finishes typing', () => {
        const line = "Boy you think you're clever don't you...";
        expect(speechHoldMs(line, 500)).toBeGreaterThan(line.length * TYPE_MS_PER_CHAR);
    });
});
