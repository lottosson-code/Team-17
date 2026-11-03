import {
    createAdditionProblems,
    createMixedProblems,
    createMultiplicationProblems,
    createTimesTableProblems,
    createTwistableProblems,
    createZeroProblems,
} from './problems';
import type { EnemyKind, LevelSpec } from './types';

const ENEMY_KINDS: Record<string, EnemyKind> = {
    pencil: { id: 'pencil', maxHp: 10, walkMs: 20000, attackDamage: 10, attackIntervalMs: 2000 },
    textbook: { id: 'textbook', maxHp: 20, walkMs: 28000, attackDamage: 20, attackIntervalMs: 3000 },
    // 16 hits: 1 × a up to 16 × a, with a = 7, 8 or 9.
    miniBoss: {
        id: 'miniBoss', maxHp: 160, walkMs: 60000, attackDamage: 30, attackIntervalMs: 2500,
        ownProblems: createTimesTableProblems([7, 8, 9], 16),
    },
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

/**
 * Module 1, Level 2: still easy. Mostly multiplication with operands 1-11, some addition
 * under 100, and a few "× 0" problems. Trickle enemies come faster than in level 1 and
 * sometimes in pairs. 10 trickle -> wave 1 (6) -> 12 trickle -> wave 2 (9) -> the boss
 * taunts the player and sends in the mini-boss.
 * Enemy mix, timings and problem weights are first guesses; tune them while playtesting.
 */
export const MODULE1_LEVEL2: LevelSpec = {
    playerMaxHp: 100,
    damagePerHit: 10,
    problems: createMixedProblems([
        { source: createMultiplicationProblems(1, 11), weight: 70 },
        { source: createAdditionProblems(99), weight: 22 },
        { source: createZeroProblems(11), weight: 8 },
    ]),
    enemyKinds: ENEMY_KINDS,
    groups: [
        {
            type: 'trickle',
            // 10 enemies; a list appears together.
            enemies: ['pencil', 'pencil', ['pencil', 'pencil'], 'textbook', 'pencil', ['pencil', 'textbook'], 'pencil', 'pencil'],
            startDelayMs: 2000,
            intervalMs: 3500,
            endIntervalMs: 2500,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'pencil', 'textbook', 'pencil', 'pencil', 'textbook'],
            startDelayMs: 3000,
            intervalMs: 600,
        },
        {
            type: 'trickle',
            // 12 enemies.
            enemies: [
                'pencil', ['pencil', 'pencil'], 'textbook', 'pencil', ['pencil', 'textbook'],
                'pencil', ['pencil', 'pencil'], 'textbook', 'pencil',
            ],
            startDelayMs: 4000,
            intervalMs: 4500,
            endIntervalMs: 3000,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'textbook', 'pencil', 'pencil', 'pencil', 'textbook', 'pencil', 'pencil', 'textbook'],
            startDelayMs: 3000,
            intervalMs: 600,
        },
        {
            type: 'finale',
            enemies: ['miniBoss'],
            startDelayMs: 0, // Appears as the boss says its last line
            intervalMs: 0,
            cutscene: { id: 'bossTaunt', when: 'beforeSpawn' },
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
    '1-2': MODULE1_LEVEL2,
};

/** The level for a map selection; falls back to TEST_LEVEL for levels not designed yet. */
export function getLevel(moduleId: number, levelId: number): LevelSpec {
    return LEVELS[`${moduleId}-${levelId}`] ?? TEST_LEVEL;
}
