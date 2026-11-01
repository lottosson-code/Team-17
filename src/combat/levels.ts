import { createAdditionProblems, createMultiplicationProblems, createTwistableProblems } from './problems';
import type { EnemyKind, LevelSpec } from './types';

const ENEMY_KINDS: Record<string, EnemyKind> = {
    pencil: { id: 'pencil', maxHp: 10, walkMs: 20000, attackDamage: 10, attackIntervalMs: 2000 },
    textbook: { id: 'textbook', maxHp: 20, walkMs: 28000, attackDamage: 20, attackIntervalMs: 3000 },
};

/**
 * Module 1, Level 1: addition with answers under 100.
 * 4 trickle -> wave 1 (4) -> 6 trickle, getting faster -> wave 2 (6) -> finale:
 * 3 single-digit additions appear, the boss turns every + into ×, then they must be solved to win.
 * Enemy kinds and timings are first guesses; tune them while playtesting.
 */
export const MODULE1_LEVEL1: LevelSpec = {
    playerMaxHp: 100,
    damagePerHit: 10,
    problems: createAdditionProblems(99),
    enemyKinds: ENEMY_KINDS,
    groups: [
        {
            type: 'trickle',
            enemies: ['pencil', 'pencil', 'pencil', 'pencil'],
            startDelayMs: 2000,
            intervalMs: 7000,
            endIntervalMs: 6000,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'pencil', 'textbook', 'pencil'],
            startDelayMs: 3000, // Time to read the "huge wave" banner
            intervalMs: 700,
        },
        {
            type: 'trickle',
            enemies: ['pencil', 'textbook', 'pencil', 'pencil', 'textbook', 'pencil'],
            startDelayMs: 5000,
            intervalMs: 6000,
            endIntervalMs: 4000,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'textbook', 'pencil', 'pencil', 'textbook', 'pencil'],
            startDelayMs: 3000,
            intervalMs: 700,
        },
        {
            type: 'finale',
            enemies: ['pencil', 'pencil', 'pencil'],
            startDelayMs: 2000,
            intervalMs: 0,
            // Single-digit addition that stays unique once + becomes ×.
            problems: createTwistableProblems('+', '*', 2, 9),
            cutscene: {
                id: 'bossTwist',
                twist: { from: '+', to: '*', problemsAfter: createMultiplicationProblems(2, 9) },
            },
        },
    ],
};

/** Short level for quick manual testing. */
export const TEST_LEVEL: LevelSpec = {
    playerMaxHp: 100,
    damagePerHit: 10,
    problems: createAdditionProblems(18),
    enemyKinds: ENEMY_KINDS,
    groups: [
        { type: 'trickle', enemies: ['pencil', 'pencil'], startDelayMs: 0, intervalMs: 3000 },
    ],
};

const LEVELS: Record<string, LevelSpec> = {
    '1-1': MODULE1_LEVEL1,
};

/** The level for a map selection; falls back to TEST_LEVEL for levels not designed yet. */
export function getLevel(moduleId: number, levelId: number): LevelSpec {
    return LEVELS[`${moduleId}-${levelId}`] ?? TEST_LEVEL;
}
