import { describe, expect, test } from 'vitest';
import { makeProblem } from '../combat/problems';
import type { Enemy, EnemyKind, PowerUpKind } from '../combat/types';
import { DANGER_START, heartFills, laneDanger, lowHealthLevel, overlayLayout, POWER_UP_TEXTURE, statLines } from '../combat/view/hudLogic';
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

describe('POWER_UP_TEXTURE', () => {
    test('gives every power-up kind its own texture', () => {
        const kinds: PowerUpKind[] = ['freeze', 'heal', 'zap'];
        const keys = kinds.map(kind => POWER_UP_TEXTURE[kind]);
        expect(new Set(keys).size).toBe(kinds.length);
    });
});
describe('statLines', () => {
    test('shows solved, missed and accuracy as a whole percentage', () => {
        expect(statLines({ solved: 12, missed: 3, accuracy: 0.8 })).toEqual([
            { label: 'Solved', value: '12' },
            { label: 'Missed', value: '3' },
            { label: 'Accuracy', value: '80%' },
        ]);
    });

    test('rounds accuracy to the nearest percent', () => {
        expect(statLines({ solved: 2, missed: 1, accuracy: 2 / 3 })[2].value).toBe('67%');
        expect(statLines({ solved: 1, missed: 199, accuracy: 1 / 200 })[2].value).toBe('1%');
    });

    test('shows a dash for accuracy when nothing was answered', () => {
        expect(statLines({ solved: 0, missed: 0, accuracy: null })[2].value).toBe('—');
    });

    test('shows 0% and 100% at the extremes', () => {
        expect(statLines({ solved: 0, missed: 4, accuracy: 0 })[2].value).toBe('0%');
        expect(statLines({ solved: 9, missed: 0, accuracy: 1 })[2].value).toBe('100%');
    });
});

describe('overlayLayout', () => {
    // Half-heights of what each row draws: title 54 px text, stats value + label, buttons 58 / 52 px, hint 16 px.
    const HALF = { title: 30, statsTop: 18, statsBottom: 32 + 10, continue: 29, buttons: 26, hint: 10 };

    const rows = (hasStats: boolean, hasContinue: boolean) => {
        const l = overlayLayout(hasStats, hasContinue);
        const spans: [number, number][] = [[l.title - HALF.title, l.title + HALF.title]];
        if (l.stats !== undefined) spans.push([l.stats - HALF.statsTop, l.stats + HALF.statsBottom]);
        if (l.continue !== undefined) spans.push([l.continue - HALF.continue, l.continue + HALF.continue]);
        spans.push([l.buttons - HALF.buttons, l.buttons + HALF.buttons], [l.hint - HALF.hint, l.hint + HALF.hint]);
        return { l, spans };
    };

    test.each([
        ['pause menu', false, false],
        ['defeat with stats', true, false],
        ['victory with Continue', false, true],
        ['victory with stats and Continue', true, true],
    ])('%s: rows go top to bottom without overlapping, inside the panel', (_name, hasStats, hasContinue) => {
        const { l, spans } = rows(hasStats, hasContinue);
        for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1]);
        expect(spans[0][0]).toBeGreaterThan(l.boxY);
        expect(spans[spans.length - 1][1]).toBeLessThan(l.boxY + l.boxHeight);
    });

    test('only places a stats row or Continue button when there is one', () => {
        expect(overlayLayout(false, false).stats).toBeUndefined();
        expect(overlayLayout(false, false).continue).toBeUndefined();
        expect(overlayLayout(true, true).stats).toBeDefined();
        expect(overlayLayout(true, true).continue).toBeDefined();
    });

    test('keeps the panel above the bottom HUD bar', () => {
        for (const [s, c] of [[false, false], [true, false], [false, true], [true, true]] as const) {
            const l = overlayLayout(s, c);
            expect(l.boxY + l.boxHeight).toBeLessThan(600);
        }
    });
});
