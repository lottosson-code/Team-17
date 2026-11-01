import { describe, expect, test } from 'vitest';
import { CombatModel } from '../combat/CombatModel';
import { createPlaceholderProblems } from '../combat/placeholderProblems';
import { TEST_LEVEL } from '../combat/levels';
import type { CombatEvent, LevelSpec, ProblemSource } from '../combat/types';

/** Predictable answers 1, 2, 3, ... skipping any answer already on screen. */
function countingProblems(): ProblemSource {
    let next = 1;
    return live => {
        while (live.has(next)) next++;
        const answer = next++;
        return { text: `#${answer}`, answer };
    };
}

function level(overrides: Partial<LevelSpec> = {}): LevelSpec {
    return {
        playerMaxHp: 30,
        damagePerHit: 10,
        betweenWavesMs: 1000,
        enemyKinds: {
            grunt: { id: 'grunt', maxHp: 10, walkMs: 1000, attackDamage: 10, attackIntervalMs: 500 },
            tank: { id: 'tank', maxHp: 20, walkMs: 1000, attackDamage: 5, attackIntervalMs: 500 },
        },
        waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }] }],
        ...overrides,
    };
}

const types = (events: CombatEvent[]) => events.map(event => event.type);

describe('CombatModel', () => {
    test('starts the first wave and spawns 0 ms enemies immediately', () => {
        const model = new CombatModel(level(), countingProblems());
        expect(model.getEnemies()).toHaveLength(1);
        expect(model.getStatus()).toBe('playing');
        // Start-up events are delivered on the first tick.
        expect(types(model.tick(16))).toEqual(['waveStarted', 'enemySpawned']);
    });

    test('spawns later enemies when their time comes', () => {
        const model = new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }, { atMs: 300, lane: 2, kind: 'grunt' }] }],
        }), countingProblems());
        model.tick(200);
        expect(model.getEnemies()).toHaveLength(1);
        expect(types(model.tick(100))).toContain('enemySpawned');
        expect(model.getEnemies()[1].lane).toBe(2);
        expect(model.getEnemies()[1].progress).toBe(0);
    });

    test('enemies walk along their lane over walkMs', () => {
        const model = new CombatModel(level(), countingProblems());
        model.tick(250);
        expect(model.getEnemies()[0].progress).toBeCloseTo(0.25);
    });

    test('a correct answer hits only the enemy whose problem it solves', () => {
        const model = new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }, { atMs: 0, lane: 1, kind: 'grunt' }] }],
        }), countingProblems());
        const [first, second] = model.getEnemies();
        const events = model.submit(second.problem.answer);
        expect(events).toEqual([
            { type: 'hit', enemyId: second.id, damage: 10 },
            { type: 'enemyDefeated', enemyId: second.id },
        ]);
        expect(model.getEnemies().map(enemy => enemy.id)).toEqual([first.id]);
    });

    test('a wrong answer reports wrongAnswer and changes nothing', () => {
        const model = new CombatModel(level(), countingProblems());
        const before = model.getEnemies()[0].hp;
        expect(model.submit(999)).toEqual([{ type: 'wrongAnswer', answer: 999 }]);
        expect(model.getEnemies()[0].hp).toBe(before);
        expect(model.getPlayerHp()).toBe(30);
    });

    test('an enemy that survives a hit gets a new, different problem', () => {
        const model = new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'tank' }] }],
        }), countingProblems());
        const tank = model.getEnemies()[0];
        const oldAnswer = tank.problem.answer;
        expect(types(model.submit(oldAnswer))).toEqual(['hit', 'newProblem']);
        expect(tank.hp).toBe(10);
        expect(tank.problem.answer).not.toBe(oldAnswer);
        // The old answer no longer hits anything.
        expect(types(model.submit(oldAnswer))).toEqual(['wrongAnswer']);
    });

    test('an enemy that reaches the wizard attacks on arrival and then every attackIntervalMs', () => {
        const model = new CombatModel(level({ playerMaxHp: 100 }), countingProblems());
        model.tick(16);
        expect(types(model.tick(1000))).toEqual(['enemyReachedPlayer', 'playerDamaged']);
        expect(model.getEnemies()[0].state).toBe('attacking');
        expect(model.getPlayerHp()).toBe(90);

        expect(types(model.tick(499))).toEqual([]);
        expect(types(model.tick(1))).toEqual(['playerDamaged']);
        expect(types(model.tick(1000))).toEqual(['playerDamaged', 'playerDamaged']);
        expect(model.getPlayerHp()).toBe(60);
    });

    test('an attacking enemy can still be defeated', () => {
        const model = new CombatModel(level({ playerMaxHp: 100 }), countingProblems());
        model.tick(1000);
        expect(model.getEnemies()[0].state).toBe('attacking');
        model.submit(model.getEnemies()[0].problem.answer);
        expect(model.getEnemies()).toHaveLength(0);
    });

    test('the player loses at 0 HP and the model stops', () => {
        const model = new CombatModel(level({ playerMaxHp: 20 }), countingProblems());
        model.tick(16);
        model.tick(1000);
        expect(types(model.tick(500))).toEqual(['playerDamaged', 'lost']);
        expect(model.getStatus()).toBe('lost');
        expect(model.getPlayerHp()).toBe(0);
        expect(model.tick(5000)).toEqual([]);
        expect(model.submit(model.getEnemies()[0].problem.answer)).toEqual([]);
    });

    test('clearing a wave waits betweenWavesMs, then starts the next wave', () => {
        const model = new CombatModel(level({
            waves: [
                { spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }] },
                { spawns: [{ atMs: 0, lane: 3, kind: 'grunt' }] },
            ],
        }), countingProblems());
        model.tick(16);
        expect(types(model.submit(model.getEnemies()[0].problem.answer)))
            .toEqual(['hit', 'enemyDefeated', 'waveCleared']);
        expect(model.getStatus()).toBe('betweenWaves');
        expect(model.submit(1)).toEqual([]);

        expect(model.tick(999)).toEqual([]);
        expect(types(model.tick(1))).toEqual(['waveStarted', 'enemySpawned']);
        expect(model.getWaveIndex()).toBe(1);
        expect(model.getEnemies()[0].lane).toBe(3);
    });

    test('a wave is not cleared while enemies are still due to spawn', () => {
        const model = new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }, { atMs: 500, lane: 1, kind: 'grunt' }] }],
        }), countingProblems());
        expect(types(model.submit(model.getEnemies()[0].problem.answer))).toEqual(['hit', 'enemyDefeated']);
        expect(model.getStatus()).toBe('playing');
    });

    test('clearing the last wave wins the level', () => {
        const model = new CombatModel(level(), countingProblems());
        const events = model.submit(model.getEnemies()[0].problem.answer);
        expect(types(events)).toEqual(['hit', 'enemyDefeated', 'waveCleared', 'won']);
        expect(model.getStatus()).toBe('won');
    });

    test('no two enemies on screen ever share an answer', () => {
        const model = new CombatModel(TEST_LEVEL, createPlaceholderProblems(seededRng(42)));
        const rng = seededRng(7);
        for (let frame = 0; frame < 5000 && model.getStatus() !== 'won' && model.getStatus() !== 'lost'; frame++) {
            model.tick(50);
            const answers = model.getEnemies().map(enemy => enemy.problem.answer);
            expect(new Set(answers).size).toBe(answers.length);
            // Occasionally solve a random enemy, so problems keep being replaced.
            const enemies = model.getEnemies();
            if (enemies.length > 0 && rng() < 0.05) {
                model.submit(enemies[Math.floor(rng() * enemies.length)].problem.answer);
            }
        }
    });

    test('throws if the problem source breaks the unique-answer rule', () => {
        const always7: ProblemSource = () => ({ text: '3 + 4 = ?', answer: 7 });
        expect(() => new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'grunt' }, { atMs: 0, lane: 1, kind: 'grunt' }] }],
        }), always7)).toThrow(/duplicate answer 7/);
    });

    test('rejects invalid level data', () => {
        expect(() => new CombatModel(level({ waves: [] }), countingProblems())).toThrow();
        expect(() => new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 4, kind: 'grunt' }] }],
        }), countingProblems())).toThrow(/lane 4/);
        expect(() => new CombatModel(level({
            waves: [{ spawns: [{ atMs: 0, lane: 0, kind: 'dragon' }] }],
        }), countingProblems())).toThrow(/dragon/);
    });
});

/** Small deterministic RNG (mulberry32) so test runs are repeatable. */
function seededRng(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
