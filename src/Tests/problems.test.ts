import { describe, expect, test } from 'vitest';
import {
    createAdditionProblems,
    createMultiplicationProblems,
    createTwistableProblems,
    makeProblem,
    problemText,
} from '../combat/problems';
import type { CombatProblem } from '../combat/types';

describe('problem sources', () => {
    test('problemText uses display symbols', () => {
        expect(problemText(makeProblem(6, '*', 7))).toBe('6 × 7 = ?');
        expect(problemText(makeProblem(12, '-', 4))).toBe('12 − 4 = ?');
    });

    test('addition answers stay under 100 and avoid live answers', () => {
        const next = createAdditionProblems(99);
        const live = new Set([10, 20, 30]);
        for (let i = 0; i < 500; i++) {
            const p = next(live, []);
            expect(p.operator).toBe('+');
            expect(p.left).toBeGreaterThanOrEqual(1);
            expect(p.right).toBeGreaterThanOrEqual(1);
            expect(p.left + p.right).toBe(p.answer);
            expect(p.answer).toBeLessThan(100);
            expect(live.has(p.answer)).toBe(false);
        }
    });

    test('addition throws when every answer is taken', () => {
        const next = createAdditionProblems(3);
        expect(() => next(new Set([2, 3]), [])).toThrow();
    });

    test('multiplication uses numbers in range and avoids live answers', () => {
        const next = createMultiplicationProblems(2, 9);
        const live = new Set([12, 18, 24]);
        for (let i = 0; i < 300; i++) {
            const p = next(live, []);
            expect(p.operator).toBe('*');
            expect(p.left).toBeGreaterThanOrEqual(2);
            expect(p.right).toBeLessThanOrEqual(9);
            expect(live.has(p.answer)).toBe(false);
        }
    });

    test('twistable problems stay unique both before and after the twist', () => {
        const next = createTwistableProblems('+', '*', 2, 9);
        for (let run = 0; run < 200; run++) {
            const live: CombatProblem[] = [];
            for (let i = 0; i < 4; i++) {
                live.push(next(new Set(live.map(p => p.answer)), live));
            }
            const sums = live.map(p => p.answer);
            const products = live.map(p => p.left * p.right);
            expect(live.every(p => p.operator === '+' && p.left <= 9 && p.right <= 9)).toBe(true);
            expect(new Set(sums).size).toBe(4);
            expect(new Set(products).size).toBe(4);
        }
    });

    test('twistable problems avoid answers already on screen after the twist', () => {
        const next = createTwistableProblems('+', '*', 2, 3);
        // Options: 2+2, 2+3, 3+2, 3+3 (sums 4, 5, 5, 6; products 4, 6, 6, 9).
        // Live: 2 + 3 (answer 5, becomes 6) and 3 × 3 (answer 9, not twisted).
        // 2+3 / 3+2 clash on the sum 5; 3+3 clashes with 9 after the twist; only 2+2 is safe.
        const live = [makeProblem(2, '+', 3), makeProblem(3, '*', 3)];
        expect(next(new Set(live.map(p => p.answer)), live)).toEqual(makeProblem(2, '+', 2));
    });
});
