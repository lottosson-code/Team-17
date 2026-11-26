import { describe, expect, it } from 'vitest';
import { randomVariant } from '../soundVariants';

/** An rng that returns these values in turn. */
const sequence = (...values: number[]) => () => values.shift() ?? 0;

describe('randomVariant', () => {
    it('picks any recording the first time', () => {
        expect(randomVariant(32, undefined, () => 0)).toBe(0);
        expect(randomVariant(32, undefined, () => 0.999)).toBe(31);
    });

    it('never repeats the previous recording', () => {
        for (let previous = 0; previous < 5; previous++) {
            for (const r of [0, 0.2, 0.4, 0.6, 0.8, 0.999]) {
                const pick = randomVariant(5, previous, () => r);
                expect(pick).not.toBe(previous);
                expect(pick).toBeGreaterThanOrEqual(0);
                expect(pick).toBeLessThan(5);
            }
        }
    });

    it('can still reach every other recording', () => {
        const seen = new Set<number>();
        for (let i = 0; i < 4; i++) seen.add(randomVariant(5, 2, sequence(i / 4 + 0.01)));
        expect([...seen].sort()).toEqual([0, 1, 3, 4]);
    });

    it('handles a single recording or a stale previous index', () => {
        expect(randomVariant(1, 0)).toBe(0);
        expect(randomVariant(0, undefined)).toBe(0);
        const pick = randomVariant(4, 9, () => 0.5);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(4);
    });
});
