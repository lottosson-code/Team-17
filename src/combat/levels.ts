import {
    createAdditionProblems,
    createMixedProblems,
    createMultiplicationProblems,
    createTimesTableProblems,
    createTwistableProblems,
    createZeroProblems,
    createPivotProblems,
    createDifferenceOfSquaresProblems,
} from './problems';
import type { EnemyKind, LevelSpec, ProblemSource } from './types';

// A two-digit number (11-30) × a pivot of 11 or 19. Used as ownProblems, so each enemy picks its own pivot.
const PIVOTS = [11, 19];
const randomPivotProblems = (): ProblemSource => createPivotProblems(PIVOTS[Math.floor(Math.random() * PIVOTS.length)]);

const ENEMY_KINDS: Record<string, EnemyKind> = {
    pencil: { id: 'pencil', maxHp: 10, walkMs: 20000, attackDamage: 10, attackIntervalMs: 2000 },
    textbook: { id: 'textbook', maxHp: 20, walkMs: 28000, attackDamage: 20, attackIntervalMs: 3000 },
    // 16 hits: 1 × a up to 16 × a, with a = 7, 8 or 9.
    miniBoss: {
        id: 'miniBoss', maxHp: 160, walkMs: 60000, attackDamage: 30, attackIntervalMs: 2500,
        ownProblems: createTimesTableProblems([7, 8, 9], 16),
    },
    // Erasers split in two when defeated, and each size is its own kind. The mini-boss splits 4 times:
    // eraser_miniboss -> 2 giant -> 4 large -> 8 eraser -> 16 baby = 31 enemies, at most 16 at once.
    // Smaller erasers walk faster. Problems: difference of squares for the mini-boss, pivot problems
    // for giant, large and regular erasers, level 2's easy multiplication for babies.
    // Stats and problems are first guesses; tune them while playtesting.
    eraser_miniboss: {
        id: 'eraser_miniboss', maxHp: 10, walkMs: 80000, attackDamage: 40, attackIntervalMs: 2500,
        ownProblems: () => createDifferenceOfSquaresProblems(),
        split: { into: 'eraser_giant', count: 2 },
    },
    eraser_giant: {
        id: 'eraser_giant', maxHp: 10, walkMs: 60000, attackDamage: 25, attackIntervalMs: 2500,
        ownProblems: randomPivotProblems,
        split: { into: 'eraser_large', count: 2 },
    },
    eraser_large: {
        id: 'eraser_large', maxHp: 10, walkMs: 50000, attackDamage: 15, attackIntervalMs: 2000,
        ownProblems: randomPivotProblems,
        split: { into: 'eraser', count: 2 },
    },
    // A regular eraser: put it in any group and it splits once.
    eraser: {
        id: 'eraser', maxHp: 10, walkMs: 35000, attackDamage: 10, attackIntervalMs: 2000,
        ownProblems: randomPivotProblems,
        split: { into: 'eraser_baby', count: 2 },
    },
    eraser_baby: {
        id: 'eraser_baby', maxHp: 10, walkMs: 20000, attackDamage: 5, attackIntervalMs: 1500,
        ownProblems: () => createMultiplicationProblems(1, 11),
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
                // They walk in from off screen (untouchable), stop, then the boss appears.
                walkInTo: 0.22,
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

/**
 * Module 1, Level 3: erasers. Pencils and textbooks get mostly 6-12 × 6-12; erasers bring pivot
 * problems (11-30 × 11 or 19) and split into babies with 1-11 × 1-11.
 * trickle -> wave 1 -> trickle -> wave 2 -> the eraser mini-boss (no cutscene), which splits 4 times.
 * The progress bar counts every enemy the erasers split into.
 * Enemy mix, timings and problem weights are first guesses; tune them while playtesting.
 */
export const MODULE1_LEVEL3: LevelSpec = {
    playerMaxHp: 100,
    damagePerHit: 10,
    problems: createMixedProblems([
        { source: createMultiplicationProblems(6, 12), weight: 80 },
        { source: createAdditionProblems(99), weight: 15 },
        { source: createZeroProblems(11), weight: 5 },
    ]),
    enemyKinds: ENEMY_KINDS,
    groups: [
        {
            type: 'trickle',
            enemies: ['pencil', ['pencil', 'textbook'], ['pencil', 'pencil'], 'eraser', ['pencil', 'pencil', 'pencil'], 
                      'textbook', 'eraser', ['pencil', 'textbook'], ['pencil', 'eraser']],
            startDelayMs: 5000,
            intervalMs: 3500,
            endIntervalMs: 3500,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'eraser', 'textbook', 'pencil', 'textbook', 'eraser', 'pencil'],
            startDelayMs: 3000,
            intervalMs: 600,
        },
        {
            type: 'trickle',
            enemies: [
                'pencil', ['pencil', 'pencil'], 'textbook', 'eraser', ['pencil', 'eraser'],
                'textbook', ['pencil', 'pencil', 'textbook'], 'eraser', ['pencil', 'textbook'], ['eraser', 'eraser']
            ],
            startDelayMs: 4000,
            intervalMs: 4000,
            endIntervalMs: 3000,
        },
        {
            type: 'wave',
            enemies: ['pencil', 'pencil', 'textbook', 'eraser', 'pencil', 'eraser', 'textbook', 'eraser', 'pencil', 'eraser'],
            startDelayMs: 3000,
            intervalMs: 600,
        },
        {
            type: 'finale',
            enemies: ['eraser_miniboss'],
            startDelayMs: 600,
            intervalMs: 0,
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
    '1-3': MODULE1_LEVEL3,
};

/** The level for a map selection; falls back to TEST_LEVEL for levels not designed yet. */
export function getLevel(moduleId: number, levelId: number): LevelSpec {
    return LEVELS[`${moduleId}-${levelId}`] ?? TEST_LEVEL;
}
