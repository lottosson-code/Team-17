import type { LevelSpec } from './types';

/**
 * PLACEHOLDER level for testing the combat loop. Wave design is still to be decided;
 * replace these numbers once it is.
 */
export const TEST_LEVEL: LevelSpec = {
    playerMaxHp: 100,
    damagePerHit: 10,
    betweenWavesMs: 3000,
    enemyKinds: {
        pencil: { id: 'pencil', maxHp: 10, walkMs: 20000, attackDamage: 10, attackIntervalMs: 2000 },
        textbook: { id: 'textbook', maxHp: 20, walkMs: 28000, attackDamage: 20, attackIntervalMs: 3000 },
    },
    waves: [
        {
            spawns: [
                { atMs: 0, lane: 1, kind: 'pencil' },
                { atMs: 3000, lane: 3, kind: 'pencil' },
                { atMs: 6000, lane: 0, kind: 'pencil' },
            ],
        },
        {
            spawns: [
                { atMs: 0, lane: 2, kind: 'textbook' },
                { atMs: 2000, lane: 0, kind: 'pencil' },
                { atMs: 4000, lane: 3, kind: 'pencil' },
                { atMs: 6000, lane: 1, kind: 'textbook' },
            ],
        },
    ],
};
