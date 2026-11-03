import { describe, expect, test } from 'vitest';
import { makeProblem } from '../combat/problems';
import type { Enemy, EnemyKind } from '../combat/types';
import { DANGER_START, heartFills, laneDanger, lowHealthLevel } from '../combat/view/hudLogic';

const KIND: EnemyKind = { id: 'grunt', maxHp: 10, walkMs: 1000, attackDamage: 1, attackIntervalMs: 500 };

function enemy(id: number, lane: number, progress: number, state: Enemy['state'] = 'walking'): Enemy {
    const problem = makeProblem(id, '+', 0);
    return { id, kind: KIND, lane, progress, hp: 10, problem, problems: () => problem, state, attackCooldownMs: 0 };
}

describe('laneDanger', () => {
    test('is 0 for every lane while enemies are far away', () => {
        expect(laneDanger([enemy(1, 0, 0.1), enemy(2, 3, DANGER_START)])).toEqual([0, 0, 0, 0]);
    });

    test('rises from DANGER_START to 1 at the wizard, per lane', () => {
        const halfway = DANGER_START + (1 - DANGER_START) / 2;
        const danger = laneDanger([enemy(1, 1, halfway), enemy(2, 2, 1)]);
        expect(danger[0]).toBe(0);
        expect(danger[1]).toBeCloseTo(0.5);
        expect(danger[2]).toBe(1);
        expect(danger[3]).toBe(0);
    });

    test('an attacking enemy makes its lane fully dangerous', () => {
        expect(laneDanger([enemy(1, 3, 0.2, 'attacking')])[3]).toBe(1);
    });

    test('uses the closest enemy when a lane has several', () => {
        const danger = laneDanger([enemy(1, 0, DANGER_START + 0.05), enemy(2, 0, 1)]);
        expect(danger[0]).toBe(1);
    });
});

describe('heartFills', () => {
    test('full HP fills every heart; 0 HP empties them', () => {
        expect(heartFills(100, 100)).toEqual([1, 1, 1, 1, 1]);
        expect(heartFills(0, 100)).toEqual([0, 0, 0, 0, 0]);
    });

    test('partial HP partly fills one heart', () => {
        expect(heartFills(50, 100)).toEqual([1, 1, 0.5, 0, 0]);
        expect(heartFills(70, 100, 5)[3]).toBeCloseTo(0.5);
    });

    test('works for other heart counts and max HP', () => {
        expect(heartFills(30, 60, 3)).toEqual([1, 0.5, 0]);
    });
});

describe('lowHealthLevel', () => {
    test('is 0 above 40% HP and rises to 1 at 0 HP', () => {
        expect(lowHealthLevel(100, 100)).toBe(0);
        expect(lowHealthLevel(40, 100)).toBe(0);
        expect(lowHealthLevel(20, 100)).toBeCloseTo(0.5);
        expect(lowHealthLevel(0, 100)).toBe(1);
    });
});
