import { describe, expect, test } from 'vitest';
import { CombatModel, SPAWN_CLEARANCE } from '../combat/CombatModel';
import { createAdditionProblems, createTwistableProblems, createMultiplicationProblems, makeProblem } from '../combat/problems';
import { MODULE1_LEVEL1, MODULE1_LEVEL2 } from '../combat/levels';
import type { CombatEvent, CombatProblem, LevelSpec, ProblemSource, SpawnGroup } from '../combat/types';

/** Predictable answers 1, 2, 3, ... skipping any answer already on screen. */
function countingProblems(): ProblemSource {
    let next = 1;
    return live => {
        while (live.has(next)) next++;
        const answer = next++;
        return makeProblem(answer, '+', 0);
    };
}

function trickle(enemies: SpawnGroup['enemies'], overrides: Partial<SpawnGroup> = {}): SpawnGroup {
    return { type: 'trickle', enemies, startDelayMs: 0, intervalMs: 1000, ...overrides };
}

function wave(enemies: SpawnGroup['enemies'], overrides: Partial<SpawnGroup> = {}): SpawnGroup {
    return { type: 'wave', enemies, startDelayMs: 0, intervalMs: 100, ...overrides };
}

function level(overrides: Partial<LevelSpec> = {}): LevelSpec {
    return {
        playerMaxHp: 30,
        damagePerHit: 10,
        problems: countingProblems(),
        enemyKinds: {
            grunt: { id: 'grunt', maxHp: 10, walkMs: 1000, attackDamage: 10, attackIntervalMs: 500 },
            tank: { id: 'tank', maxHp: 20, walkMs: 1000, attackDamage: 5, attackIntervalMs: 500 },
        },
        groups: [trickle(['grunt'])],
        ...overrides,
    };
}

function create(spec: LevelSpec): CombatModel {
    return new CombatModel(spec, seededRng(1));
}

const types = (events: CombatEvent[]) => events.map(event => event.type);

/** Defeats the first enemy on screen. */
function solveFirst(model: CombatModel): CombatEvent[] {
    return model.submit(model.getEnemies()[0].problem.answer);
}

describe('CombatModel', () => {
    test('a trickle with no start delay spawns its first enemy immediately', () => {
        const model = create(level());
        expect(model.getEnemies()).toHaveLength(1);
        expect(model.getStatus()).toBe('playing');
        // Start-up events are delivered on the first tick.
        expect(types(model.tick(16))).toEqual(['enemySpawned']);
    });

    test('a trickle spaces its enemies by intervalMs', () => {
        const model = create(level({ groups: [trickle(['grunt', 'grunt'], { intervalMs: 3000 })] }));
        model.tick(2999);
        expect(model.getEnemies()).toHaveLength(1);
        expect(types(model.tick(1))).toContain('enemySpawned');
        expect(model.getEnemies()[1].progress).toBe(0);
    });

    test('endIntervalMs changes the gaps evenly from intervalMs to endIntervalMs', () => {
        // Gaps: 1000, 700, 400.
        const model = create(level({
            groups: [trickle(['grunt', 'grunt', 'grunt', 'grunt'], { intervalMs: 1000, endIntervalMs: 400 })],
            enemyKinds: { grunt: { id: 'grunt', maxHp: 10, walkMs: 100000, attackDamage: 1, attackIntervalMs: 500 } },
        }));
        model.tick(0); // Flush the first enemy's start-up event.
        const spawnTimes: number[] = [0];
        for (let t = 10; t <= 2500; t += 10) {
            if (types(model.tick(10)).includes('enemySpawned')) spawnTimes.push(t);
        }
        expect(spawnTimes).toEqual([0, 1000, 1700, 2100]);
    });

    test('enemies walk along their lane over walkMs', () => {
        const model = create(level());
        model.tick(250);
        expect(model.getEnemies()[0].progress).toBeCloseTo(0.25);
    });

    test('a wave waits until every earlier enemy is defeated', () => {
        const model = create(level({ groups: [trickle(['grunt']), wave(['grunt', 'grunt'])] }));
        model.tick(16);
        model.tick(300);
        expect(model.getEnemies()).toHaveLength(1);

        solveFirst(model);
        expect(model.tick(16)).toEqual([
            { type: 'waveStarted', wave: 0, isFinalWave: true },
            { type: 'enemySpawned', enemyId: 2 },
        ]);
        model.tick(100);
        expect(model.getEnemies()).toHaveLength(2);
    });

    test('a trickle after a wave starts without waiting for the wave to be cleared', () => {
        const model = create(level({
            groups: [wave(['grunt']), trickle(['grunt'], { startDelayMs: 500 })],
            enemyKinds: { grunt: { id: 'grunt', maxHp: 10, walkMs: 100000, attackDamage: 1, attackIntervalMs: 500 } },
        }));
        model.tick(499);
        expect(model.getEnemies()).toHaveLength(1);
        model.tick(1);
        expect(model.getEnemies()).toHaveLength(2);
    });

    test('enemies never spawn into a lane whose spawn point is occupied', () => {
        const model = create(level({ groups: [wave(['grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt'], { intervalMs: 0 })] }));
        // Only 4 lanes, so only 4 appear at once, one per lane.
        expect(new Set(model.getEnemies().map(enemy => enemy.lane)).size).toBe(4);
        expect(model.getEnemies()).toHaveLength(4);

        // walkMs is 1000, so lanes clear after SPAWN_CLEARANCE * 1000 ms.
        model.tick(SPAWN_CLEARANCE * 1000 - 1);
        expect(model.getEnemies()).toHaveLength(4);
        model.tick(1);
        expect(model.getEnemies()).toHaveLength(6);

        for (const enemy of model.getEnemies()) {
            const sameLane = model.getEnemies().filter(other => other !== enemy && other.lane === enemy.lane);
            for (const other of sameLane) {
                expect(Math.abs(other.progress - enemy.progress)).toBeGreaterThanOrEqual(SPAWN_CLEARANCE - 1e-9);
            }
        }
    });

    test('enemies listed together appear at the same moment in different lanes', () => {
        const model = create(level({
            groups: [trickle(['grunt', ['grunt', 'tank'], 'grunt'], { intervalMs: 1000 })],
            enemyKinds: {
                grunt: { id: 'grunt', maxHp: 10, walkMs: 100000, attackDamage: 1, attackIntervalMs: 500 },
                tank: { id: 'tank', maxHp: 20, walkMs: 100000, attackDamage: 1, attackIntervalMs: 500 },
            },
        }));
        expect(model.getEnemies()).toHaveLength(1);
        model.tick(1000);
        expect(model.getEnemies().map(enemy => enemy.kind.id)).toEqual(['grunt', 'grunt', 'tank']);
        expect(model.getEnemies()[1].lane).not.toBe(model.getEnemies()[2].lane);
        // The gap counts entries, not enemies: the next one comes 1000 ms later.
        model.tick(999);
        expect(model.getEnemies()).toHaveLength(3);
        model.tick(1);
        expect(model.getEnemies()).toHaveLength(4);
        // Progress and markers count every enemy.
        solveFirst(model);
        expect(model.getProgress()).toBeCloseTo(1 / 4);
    });

    test('a group with announce reports it when the group starts', () => {
        const model = create(level({ groups: [trickle(['grunt'], { announce: 'Here they come' })] }));
        expect(model.tick(16)).toContainEqual({ type: 'announcement', text: 'Here they come' });
    });


    test('an enemy kind with ownProblems gets a fresh source per enemy', () => {
        let created = 0;
        const model = create(level({
            enemyKinds: {
                grunt: { id: 'grunt', maxHp: 10, walkMs: 1000, attackDamage: 1, attackIntervalMs: 500 },
                boss: {
                    id: 'boss', maxHp: 30, walkMs: 100000, attackDamage: 1, attackIntervalMs: 500,
                    ownProblems: () => {
                        created++;
                        let step = 1;
                        return () => makeProblem(step++, '*', 100);
                    },
                },
            },
            groups: [trickle(['boss'])],
        }));
        const boss = model.getEnemies()[0];
        expect(created).toBe(1);
        expect(boss.problem).toEqual(makeProblem(1, '*', 100));
        model.submit(100);
        expect(boss.problem).toEqual(makeProblem(2, '*', 100));
    });

    test('a correct answer hits only the enemy whose problem it solves', () => {
        const model = create(level({ groups: [trickle(['grunt', 'grunt'], { intervalMs: 0 })] }));
        const [first, second] = model.getEnemies();
        expect(model.submit(second.problem.answer)).toEqual([
            { type: 'hit', enemyId: second.id, damage: 10 },
            { type: 'enemyDefeated', enemyId: second.id },
        ]);
        expect(model.getEnemies().map(enemy => enemy.id)).toEqual([first.id]);
    });

    test('a wrong answer reports wrongAnswer and changes nothing', () => {
        const model = create(level());
        const before = model.getEnemies()[0].hp;
        expect(model.submit(999)).toEqual([{ type: 'wrongAnswer', answer: 999 }]);
        expect(model.getEnemies()[0].hp).toBe(before);
        expect(model.getPlayerHp()).toBe(30);
    });

    test('an enemy that survives a hit gets a new, different problem', () => {
        const model = create(level({ groups: [trickle(['tank'])] }));
        const tank = model.getEnemies()[0];
        const oldAnswer = tank.problem.answer;
        expect(types(model.submit(oldAnswer))).toEqual(['hit', 'newProblem']);
        expect(tank.hp).toBe(10);
        expect(tank.problem.answer).not.toBe(oldAnswer);
        expect(types(model.submit(oldAnswer))).toEqual(['wrongAnswer']);
    });

    test('an enemy that reaches the wizard attacks on arrival and then every attackIntervalMs', () => {
        const model = create(level({ playerMaxHp: 100 }));
        model.tick(16);
        expect(types(model.tick(1000))).toEqual(['enemyReachedPlayer', 'playerDamaged']);
        expect(model.getEnemies()[0].state).toBe('attacking');
        expect(model.getPlayerHp()).toBe(90);

        expect(types(model.tick(499))).toEqual([]);
        expect(types(model.tick(1))).toEqual(['playerDamaged']);
        expect(types(model.tick(1000))).toEqual(['playerDamaged', 'playerDamaged']);
        expect(model.getPlayerHp()).toBe(60);
    });

    test('the player loses at 0 HP and the model stops', () => {
        const model = create(level({ playerMaxHp: 20 }));
        model.tick(16);
        model.tick(1000);
        expect(types(model.tick(500))).toEqual(['playerDamaged', 'lost']);
        expect(model.getStatus()).toBe('lost');
        expect(model.getPlayerHp()).toBe(0);
        expect(model.tick(5000)).toEqual([]);
        expect(model.submit(model.getEnemies()[0].problem.answer)).toEqual([]);
    });

    test('the level is won only after every group has spawned and every enemy is defeated', () => {
        const model = create(level({ groups: [trickle(['grunt', 'grunt'], { intervalMs: 500 })] }));
        expect(types(solveFirst(model))).toEqual(['hit', 'enemyDefeated']);
        expect(model.getStatus()).toBe('playing');
        model.tick(500);
        expect(types(solveFirst(model))).toEqual(['hit', 'enemyDefeated', 'won']);
        expect(model.getStatus()).toBe('won');
    });

    test('progress is the share of enemies defeated; skulls sit where each wave starts', () => {
        const model = create(level({
            groups: [trickle(['grunt', 'grunt'], { intervalMs: 0 }), wave(['grunt', 'grunt']), trickle(['grunt']), wave(['grunt'])],
        }));
        expect(model.getWaveMarkers()).toEqual([2 / 6, 5 / 6]);
        expect(model.getProgress()).toBe(0);
        solveFirst(model);
        expect(model.getProgress()).toBeCloseTo(1 / 6);
        solveFirst(model);
        expect(model.getProgress()).toBeCloseTo(model.getWaveMarkers()[0]);
    });

    test('waveStarted numbers only wave groups and flags the last one', () => {
        const model = create(level({ groups: [wave(['grunt']), trickle(['grunt']), wave(['grunt'])] }));
        const first = model.tick(16).find(event => event.type === 'waveStarted');
        expect(first).toEqual({ type: 'waveStarted', wave: 0, isFinalWave: false });
        solveFirst(model);
        model.tick(16);
        solveFirst(model);
        const second = model.tick(16).find(event => event.type === 'waveStarted');
        expect(second).toEqual({ type: 'waveStarted', wave: 1, isFinalWave: true });
    });

    test('no two enemies on screen ever share an answer', () => {
        const model = new CombatModel({
            ...MODULE1_LEVEL1,
            problems: createAdditionProblems(18, seededRng(42)),
            groups: MODULE1_LEVEL1.groups.filter(group => group.type !== 'finale'),
        }, seededRng(5));
        const rng = seededRng(7);
        for (let frame = 0; frame < 20000 && model.getStatus() === 'playing'; frame++) {
            model.tick(50);
            const answers = model.getEnemies().map(enemy => enemy.problem.answer);
            expect(new Set(answers).size).toBe(answers.length);
            // Occasionally solve a random enemy, so problems keep being replaced.
            const enemies = model.getEnemies();
            if (enemies.length > 0 && rng() < 0.02) {
                model.submit(enemies[Math.floor(rng() * enemies.length)].problem.answer);
            }
        }
    });

    test('throws if the problem source breaks the unique-answer rule', () => {
        const always7: ProblemSource = () => makeProblem(3, '+', 4);
        expect(() => create(level({
            problems: always7,
            groups: [trickle(['grunt', 'grunt'], { intervalMs: 0 })],
        }))).toThrow(/duplicate answer 7/);
    });

    test('rejects invalid level data', () => {
        expect(() => create(level({ groups: [] }))).toThrow();
        expect(() => create(level({ groups: [trickle([])] }))).toThrow(/no enemies/);
        expect(() => create(level({ groups: [trickle(['dragon'])] }))).toThrow(/dragon/);
        expect(() => create(level({ groups: [trickle(['grunt'], { intervalMs: -1 })] }))).toThrow(/negative/);
        expect(() => create(level({
            groups: [wave(['grunt'], { cutscene: { id: 'x' } })],
        }))).toThrow(/finale/);
    });
});

describe('CombatModel cutscenes', () => {
    /** One trickle enemy, then a finale whose 3 enemies get twistable + problems. */
    function twistLevel(): LevelSpec {
        return level({
            playerMaxHp: 100,
            groups: [
                trickle(['grunt']),
                {
                    type: 'finale',
                    enemies: ['tank', 'grunt', 'grunt'],
                    startDelayMs: 0,
                    intervalMs: 0,
                    problems: createTwistableProblems('+', '*', 2, 9, seededRng(3)),
                    cutscene: {
                        id: 'bossTwist',
                        twist: { from: '+', to: '*', problemsAfter: createMultiplicationProblems(2, 9, seededRng(4)) },
                    },
                },
            ],
        });
    }

    /** Clears the trickle enemy so the finale starts. */
    function startCutscene(model: CombatModel): CombatEvent[] {
        model.tick(0); // Flush start-up events.
        solveFirst(model);
        return model.tick(16);
    }

    test('a finale spawns its enemies, then freezes the game for the cutscene', () => {
        const model = create(twistLevel());
        expect(types(startCutscene(model))).toEqual([
            'enemySpawned', 'enemySpawned', 'enemySpawned', 'cutsceneStarted',
        ]);
        expect(model.getStatus()).toBe('cutscene');
        expect(model.getCutscene()?.id).toBe('bossTwist');

        model.tick(5000);
        expect(model.getEnemies()).toHaveLength(3);
        expect(model.getEnemies().every(enemy => enemy.progress === 0)).toBe(true);
        expect(model.submit(model.getEnemies()[0].problem.answer)).toEqual([]);
    });

    test('twistOperators turns + into × and keeps answers unique', () => {
        const model = create(twistLevel());
        startCutscene(model);
        const before = model.getEnemies().map(enemy => ({ ...enemy.problem }));
        expect(before.every(p => p.operator === '+' && p.left <= 9 && p.right <= 9)).toBe(true);

        expect(types(model.twistOperators())).toEqual(['problemTwisted', 'problemTwisted', 'problemTwisted']);
        model.getEnemies().forEach((enemy, i) => {
            expect(enemy.problem).toEqual(makeProblem(before[i].left, '*', before[i].right));
        });
        const answers = model.getEnemies().map(enemy => enemy.problem.answer);
        expect(new Set(answers).size).toBe(3);
    });

    test('after the cutscene, twisted enemies get multiplication and the level is won once they are defeated', () => {
        const model = create(twistLevel());
        startCutscene(model);
        model.twistOperators();
        expect(model.endCutscene()).toEqual([{ type: 'cutsceneEnded', id: 'bossTwist' }]);
        expect(model.getCutscene()).toBeUndefined();
        expect(model.getStatus()).toBe('playing');

        // The 20 HP tank survives one hit and gets a multiplication problem, not addition.
        const tank = model.getEnemies()[0];
        model.submit(tank.problem.answer);
        expect(tank.problem.operator).toBe('*');

        solveFirst(model);
        solveFirst(model);
        expect(types(solveFirst(model))).toEqual(['hit', 'enemyDefeated', 'won']);
    });

    test("a 'beforeSpawn' cutscene plays when the group starts, and its enemies spawn after it ends", () => {
        const model = create(level({
            groups: [
                trickle(['grunt']),
                {
                    type: 'finale', enemies: ['tank'], startDelayMs: 0, intervalMs: 0,
                    cutscene: { id: 'bossTaunt', when: 'beforeSpawn' },
                },
            ],
        }));
        model.tick(0);
        solveFirst(model);
        expect(model.tick(16)).toEqual([{ type: 'cutsceneStarted', id: 'bossTaunt' }]);
        expect(model.getStatus()).toBe('cutscene');

        model.tick(5000);
        expect(model.getEnemies()).toHaveLength(0);
        // Not won while the finale's enemies are still to come.
        expect(model.getStatus()).toBe('cutscene');

        model.endCutscene();
        // Spawns on the next tick, with no second cutscene.
        expect(types(model.tick(16))).toEqual(['enemySpawned']);
        expect(model.getEnemies()[0].kind.id).toBe('tank');
        expect(model.getStatus()).toBe('playing');
    });

    test('with walkInTo, enemies walk in during the cutscene, untouchable, then stop and report ready', () => {
        const model = create(level({
            playerMaxHp: 100,
            groups: [{
                type: 'finale', enemies: ['grunt', 'tank', 'grunt'], startDelayMs: 0, intervalMs: 0,
                cutscene: { id: 'bossTwist', walkInTo: 0.25 },
            }],
        }));
        expect(types(model.tick(0))).toEqual(['enemySpawned', 'enemySpawned', 'enemySpawned', 'cutsceneStarted']);
        // Separate lanes, so they never overlap.
        expect(new Set(model.getEnemies().map(enemy => enemy.lane)).size).toBe(3);

        // Walking in (walkMs is 1000, so 0.25 takes 250 ms); answers do nothing meanwhile.
        expect(model.tick(100)).toEqual([]);
        expect(model.getEnemies()[0].progress).toBeCloseTo(0.1);
        expect(model.submit(model.getEnemies()[0].problem.answer)).toEqual([]);
        expect(model.getStatus()).toBe('cutscene');

        // Arrive together, report once, then stand still until the cutscene ends.
        expect(model.tick(200)).toEqual([{ type: 'cutsceneEnemiesReady' }]);
        expect(model.getEnemies().every(enemy => enemy.progress === 0.25)).toBe(true);
        expect(model.tick(5000)).toEqual([]);
        expect(model.getEnemies().every(enemy => enemy.progress === 0.25 && enemy.state === 'walking')).toBe(true);

        model.endCutscene();
        model.tick(100);
        expect(model.getEnemies()[0].progress).toBeCloseTo(0.35);
    });

    test('walkInTo must be between 0 and 1', () => {
        const finale = (walkInTo: number): SpawnGroup => ({
            type: 'finale', enemies: ['grunt'], startDelayMs: 0, intervalMs: 0, cutscene: { id: 'x', walkInTo },
        });
        expect(() => create(level({ groups: [finale(0)] }))).toThrow(/walkInTo/);
        expect(() => create(level({ groups: [finale(1)] }))).toThrow(/walkInTo/);
    });

    test('twistOperators and endCutscene throw outside a cutscene', () => {
        const model = create(twistLevel());
        expect(() => model.twistOperators()).toThrow();
        expect(() => model.endCutscene()).toThrow();
    });

    test('twistOperators throws if the twist would create duplicate answers', () => {
        // 2 + 6 and 3 + 4 have different sums (8, 7) but 2 × 6 = 3 × 4 = 12.
        const fixed = [makeProblem(2, '+', 6), makeProblem(3, '+', 4)];
        const model = create(level({
            problems: () => fixed.shift()!,
            groups: [{
                type: 'finale', enemies: ['grunt', 'grunt'], startDelayMs: 0, intervalMs: 0,
                cutscene: { id: 'bossTwist', twist: { from: '+', to: '*' } },
            }],
        }));
        expect(() => model.twistOperators()).toThrow(/duplicate answers/);
    });
});

describe('MODULE1_LEVEL1', () => {
    test('is 4 trickle, a wave of 4, 6 faster trickle, a wave of 6, then the boss finale', () => {
        const groups = MODULE1_LEVEL1.groups;
        expect(groups.map(group => [group.type, group.enemies.length])).toEqual([
            ['trickle', 4], ['wave', 4], ['trickle', 6], ['wave', 6], ['finale', 3],
        ]);
        expect(groups[2].endIntervalMs).toBeLessThan(groups[2].intervalMs);
        // Wave enemies come much faster than trickle enemies.
        expect(groups[1].intervalMs * 5).toBeLessThan(groups[0].intervalMs);
        expect(groups[4].cutscene?.id).toBe('bossTwist');
        expect(groups[4].cutscene?.twist).toMatchObject({ from: '+', to: '*' });
        expect(new CombatModel(MODULE1_LEVEL1).getWaveMarkers()).toHaveLength(2);
    });

    test('uses addition under 100 until the finale, which twists 3 single-digit additions', () => {
        const model = new CombatModel(MODULE1_LEVEL1, seededRng(9));
        for (let frame = 0; frame < 20000 && model.getStatus() === 'playing'; frame++) {
            for (const enemy of model.getEnemies()) {
                expect(enemy.problem.operator).toBe('+');
                expect(enemy.problem.answer).toBeLessThan(100);
            }
            const enemies = model.getEnemies();
            if (enemies.length > 0) model.submit(enemies[0].problem.answer);
            model.tick(50);
        }
        expect(model.getStatus()).toBe('cutscene');
        expect(model.getEnemies()).toHaveLength(3);
        expect(model.getEnemies().every(enemy => enemy.problem.left <= 9 && enemy.problem.right <= 9)).toBe(true);
        expect(model.getProgress()).toBeCloseTo(20 / 23);

        // The three come in from off screen, each in its own lane, and walk in before the boss appears.
        const enemies = model.getEnemies();
        expect(new Set(enemies.map(enemy => enemy.lane)).size).toBe(3);
        expect(enemies.every(enemy => enemy.progress < 0.05)).toBe(true);
        let ready = false;
        for (let frame = 0; frame < 400 && !ready; frame++) {
            ready = types(model.tick(50)).includes('cutsceneEnemiesReady');
        }
        expect(ready).toBe(true);
        expect(enemies.every(enemy => enemy.progress === MODULE1_LEVEL1.groups[4].cutscene?.walkInTo)).toBe(true);
    });
});

describe('MODULE1_LEVEL2', () => {
    const count = (group: SpawnGroup) => group.enemies.flat().length;

    test('is 10 trickle, a wave of 6, 12 trickle, a wave of 9, then a mini-boss', () => {
        const groups = MODULE1_LEVEL2.groups;
        expect(groups.map(group => [group.type, count(group)])).toEqual([
            ['trickle', 10], ['wave', 6], ['trickle', 12], ['wave', 9], ['finale', 1],
        ]);
        expect(groups[4].enemies).toEqual(['miniBoss']);
        expect(groups[4].cutscene).toEqual({ id: 'bossTaunt', when: 'beforeSpawn' });
        // Some trickle enemies come in pairs, and trickles are faster than in level 1.
        for (const i of [0, 2]) {
            expect(groups[i].enemies.some(entry => Array.isArray(entry))).toBe(true);
            expect(groups[i].intervalMs).toBeLessThan(MODULE1_LEVEL1.groups[i].intervalMs);
        }
        expect(new CombatModel(MODULE1_LEVEL2).getWaveMarkers()).toEqual([10 / 38, 28 / 38]);
    });

    test('problems are mostly multiplication 1-11, some addition under 100, a few × 0', () => {
        const seen: CombatProblem[] = [];
        for (let i = 0; i < 2000; i++) seen.push(MODULE1_LEVEL2.problems(new Set(), []));
        const share = (test: (p: CombatProblem) => boolean) => seen.filter(test).length / seen.length;

        for (const p of seen) {
            if (p.operator === '+') expect(p.answer).toBeLessThan(100);
            else {
                expect(p.operator).toBe('*');
                expect(Math.max(p.left, p.right)).toBeLessThanOrEqual(11);
            }
        }
        const zero = share(p => p.operator === '*' && p.answer === 0);
        const multiplication = share(p => p.operator === '*' && p.answer !== 0);
        const addition = share(p => p.operator === '+');
        expect(multiplication).toBeGreaterThan(0.6);
        expect(addition).toBeGreaterThan(0.1);
        expect(addition).toBeLessThan(multiplication);
        expect(zero).toBeGreaterThan(0);
        expect(zero).toBeLessThan(addition);
    });

    test('the mini-boss takes 16 hits, from 1 × a to 16 × a with a = 7, 8 or 9', () => {
        const model = new CombatModel(MODULE1_LEVEL2, seededRng(11));
        let sawTaunt = false;
        for (let frame = 0; frame < 40000 && model.getEnemies()[0]?.kind.id !== 'miniBoss'; frame++) {
            if (model.getStatus() === 'cutscene') {
                // The taunt plays before the mini-boss is on screen.
                expect(model.getCutscene()?.id).toBe('bossTaunt');
                expect(model.getEnemies()).toHaveLength(0);
                sawTaunt = true;
                model.endCutscene();
            }
            const enemies = model.getEnemies();
            if (enemies.length > 0) model.submit(enemies[0].problem.answer);
            model.tick(50);
        }
        expect(sawTaunt).toBe(true);
        const boss = model.getEnemies()[0];
        expect(boss.kind.id).toBe('miniBoss');
        expect(model.getEnemies()).toHaveLength(1);

        const table = boss.problem.right;
        expect([7, 8, 9]).toContain(table);
        for (let step = 1; step <= 16; step++) {
            expect(boss.problem).toEqual(makeProblem(step, '*', table));
            const events = types(model.submit(boss.problem.answer));
            expect(events).toContain(step < 16 ? 'newProblem' : 'enemyDefeated');
        }
        expect(model.getStatus()).toBe('won');
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
