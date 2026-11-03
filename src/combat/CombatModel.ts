import { makeProblem } from './problems';
import {
    LANE_COUNT,
    type CombatEvent,
    type CombatProblem,
    type CombatStatus,
    type CutsceneSpec,
    type Enemy,
    type LevelSpec,
    type ProblemSource,
    type SpawnGroup,
} from './types';

/** A lane can take a new enemy once the last one in it has walked this far (0-1). */
export const SPAWN_CLEARANCE = 0.12;

/**
 * The rules of one combat level, with no Phaser or DOM code.
 * The scene calls `tick` every frame and `submit` when the player casts a spell,
 * then draws `getEnemies()` and plays animations for the returned events.
 *
 * Progression: the level's groups play in order (see GroupType). Progress is the share of
 * the level's enemies defeated, so the bar reaches a wave's skull exactly when that wave starts.
 *
 * Cutscenes: when a 'finale' group starts (when: 'beforeSpawn') or once its enemies have
 * appeared (default), status becomes 'cutscene' and time stops. The scene plays the animation, calls `twistOperators()` if the cutscene has
 * a twist, then `endCutscene()` to resume play.
 */
export class CombatModel {
    private readonly level: LevelSpec;
    private readonly rng: () => number;
    private readonly totalEnemies: number;

    private status: CombatStatus = 'playing';
    private playerHp: number;
    private enemies: Enemy[] = [];
    private nextEnemyId = 1;
    private defeatedCount = 0;

    private groupIndex = 0;
    private groupStarted = false;
    private spawnedInGroup = 0; // Entries of group.enemies fully spawned
    private memberIndex = 0; // Members of the current entry spawned, when it is a list
    private spawnTimerMs = 0;
    private activeCutscene: CutsceneSpec | undefined;

    /** Events produced outside tick/submit, delivered on the next tick. */
    private pending: CombatEvent[] = [];

    constructor(level: LevelSpec, rng: () => number = Math.random) {
        validateLevel(level);
        this.level = level;
        this.rng = rng;
        this.playerHp = level.playerMaxHp;
        this.totalEnemies = level.groups.reduce((sum, group) => sum + countEnemies(group), 0);
        // Groups with no start delay spawn immediately rather than one frame later.
        this.advanceSpawning(0, this.pending);
    }

    /** Advances time: spawns, moves and attacks. Returns what happened. */
    public tick(dtMs: number): CombatEvent[] {
        const events = this.pending;
        this.pending = [];
        if (this.isOver() || this.status === 'cutscene' || dtMs <= 0) return events;

        // Move existing enemies before spawning, so new ones start at progress 0.
        for (const enemy of this.enemies) {
            this.advanceEnemy(enemy, dtMs, events);
            if (this.isOver()) return events;
        }
        this.advanceSpawning(dtMs, events);
        this.checkWon(events);
        return events;
    }

    /**
     * The player cast a spell with `answer`. Hits the one enemy whose problem it solves,
     * or reports a wrong answer.
     */
    public submit(answer: number): CombatEvent[] {
        if (this.status !== 'playing') return [];

        const target = this.enemies.find(enemy => enemy.problem.answer === answer);
        if (!target) return [{ type: 'wrongAnswer', answer }];

        const events: CombatEvent[] = [];
        const damage = this.level.damagePerHit;
        target.hp = Math.max(0, target.hp - damage);
        events.push({ type: 'hit', enemyId: target.id, damage });

        if (target.hp === 0) {
            this.enemies = this.enemies.filter(enemy => enemy !== target);
            this.defeatedCount++;
            events.push({ type: 'enemyDefeated', enemyId: target.id });
            this.checkWon(events);
        } else {
            // A surviving enemy gets a fresh problem, so the same answer can't hit it twice.
            target.problem = this.createProblem(target.problems);
            events.push({ type: 'newProblem', enemyId: target.id });
        }
        return events;
    }

    /**
     * During a cutscene with a twist: rewrites every live problem using `twist.from`
     * into `twist.to` (e.g. 3 + 4 becomes 3 × 4). Those enemies then take their
     * later problems from `twist.problemsAfter`.
     */
    public twistOperators(): CombatEvent[] {
        const twist = this.activeCutscene?.twist;
        if (this.status !== 'cutscene' || !twist) throw new Error('No operator twist is running');

        const events: CombatEvent[] = [];
        const twisted = this.enemies.filter(enemy => enemy.problem.operator === twist.from);
        for (const enemy of twisted) {
            enemy.problem = makeProblem(enemy.problem.left, twist.to, enemy.problem.right);
            enemy.problems = twist.problemsAfter ?? this.level.problems;
            events.push({ type: 'problemTwisted', enemyId: enemy.id });
        }
        const answers = this.enemies.map(enemy => enemy.problem.answer);
        if (new Set(answers).size !== answers.length) {
            throw new Error('Twist produced duplicate answers; spawn these enemies with createTwistableProblems');
        }
        return events;
    }

    /** Ends the running cutscene and resumes play. */
    public endCutscene(): CombatEvent[] {
        const cutscene = this.activeCutscene;
        if (this.status !== 'cutscene' || !cutscene) throw new Error('No cutscene is running');
        this.status = 'playing';
        this.activeCutscene = undefined;
        return [{ type: 'cutsceneEnded', id: cutscene.id }];
    }

    /** The cutscene that is playing, if any. */
    public getCutscene(): CutsceneSpec | undefined {
        return this.activeCutscene;
    }

    public getStatus(): CombatStatus {
        return this.status;
    }

    public getPlayerHp(): number {
        return this.playerHp;
    }

    public getPlayerMaxHp(): number {
        return this.level.playerMaxHp;
    }

    /** Current enemies. Read-only for the view; do not modify them. */
    public getEnemies(): readonly Readonly<Enemy>[] {
        return this.enemies;
    }

    public getEnemy(id: number): Readonly<Enemy> | undefined {
        return this.enemies.find(enemy => enemy.id === id);
    }

    /** Level progress from 0 to 1: the share of all the level's enemies defeated. */
    public getProgress(): number {
        return this.defeatedCount / this.totalEnemies;
    }

    /** Where each wave's skull sits on the progress bar (0-1), in order. */
    public getWaveMarkers(): number[] {
        const markers: number[] = [];
        let before = 0;
        for (const group of this.level.groups) {
            if (group.type === 'wave') markers.push(before / this.totalEnemies);
            before += countEnemies(group);
        }
        return markers;
    }

    private isOver(): boolean {
        return this.status === 'won' || this.status === 'lost';
    }

    /** Starts groups and spawns their enemies as time passes. */
    private advanceSpawning(dtMs: number, events: CombatEvent[]): void {
        while (this.groupIndex < this.level.groups.length) {
            const group = this.level.groups[this.groupIndex];

            if (!this.groupStarted) {
                // Waves and finales wait until every earlier enemy is defeated.
                if (group.type !== 'trickle' && this.enemies.length > 0) return;
                this.startGroup(group, events);
                if (this.status === 'cutscene') return;
            } else {
                this.spawnTimerMs -= dtMs;
            }
            // Time is only counted once, by the group running at the start of this tick.
            dtMs = 0;

            while (this.spawnTimerMs <= 0 && this.spawnedInGroup < group.enemies.length) {
                const entry = asList(group.enemies[this.spawnedInGroup]);
                while (this.memberIndex < entry.length) {
                    const lane = this.pickFreeLane();
                    // Every lane's spawn point is occupied; try again next tick.
                    if (lane === undefined) return;
                    this.spawn(group, entry[this.memberIndex], lane, events);
                    this.memberIndex++;
                }
                this.memberIndex = 0;
                this.spawnedInGroup++;
                this.spawnTimerMs += gapAfter(group, this.spawnedInGroup);
            }
            if (this.spawnedInGroup < group.enemies.length) return;

            // Group fully spawned; move on.
            this.groupIndex++;
            this.groupStarted = false;
            if (group.cutscene && group.cutscene.when !== 'beforeSpawn') {
                this.startCutscene(group.cutscene, events);
                return;
            }
        }
    }

    private startGroup(group: SpawnGroup, events: CombatEvent[]): void {
        this.groupStarted = true;
        this.spawnedInGroup = 0;
        this.memberIndex = 0;
        this.spawnTimerMs = group.startDelayMs;
        if (group.announce) events.push({ type: 'announcement', text: group.announce });
        if (group.cutscene?.when === 'beforeSpawn') this.startCutscene(group.cutscene, events);
        if (group.type === 'wave') {
            const waves = this.level.groups.filter(other => other.type === 'wave');
            const wave = waves.indexOf(group);
            events.push({ type: 'waveStarted', wave, isFinalWave: wave === waves.length - 1 });
        }
    }

    private startCutscene(cutscene: CutsceneSpec, events: CombatEvent[]): void {
        this.activeCutscene = cutscene;
        this.status = 'cutscene';
        events.push({ type: 'cutsceneStarted', id: cutscene.id });
    }

    /** A random lane whose spawn point is clear, or undefined if none is. */
    private pickFreeLane(): number | undefined {
        const free: number[] = [];
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const blocked = this.enemies.some(enemy => enemy.lane === lane && enemy.progress < SPAWN_CLEARANCE);
            if (!blocked) free.push(lane);
        }
        return free.length === 0 ? undefined : free[Math.floor(this.rng() * free.length)];
    }

    private spawn(group: SpawnGroup, kindId: string, lane: number, events: CombatEvent[]): void {
        const kind = this.level.enemyKinds[kindId];
        const problems = kind.ownProblems?.() ?? group.problems ?? this.level.problems;
        const enemy: Enemy = {
            id: this.nextEnemyId++,
            kind,
            lane,
            progress: 0,
            hp: kind.maxHp,
            problem: this.createProblem(problems),
            problems,
            state: 'walking',
            attackCooldownMs: 0,
        };
        this.enemies.push(enemy);
        events.push({ type: 'enemySpawned', enemyId: enemy.id });
    }

    private advanceEnemy(enemy: Enemy, dtMs: number, events: CombatEvent[]): void {
        if (enemy.state === 'walking') {
            enemy.progress += dtMs / enemy.kind.walkMs;
            if (enemy.progress < 1) return;
            enemy.progress = 1;
            enemy.state = 'attacking';
            events.push({ type: 'enemyReachedPlayer', enemyId: enemy.id });
            // Attack on arrival, then keep attacking until the enemy is defeated.
            this.attack(enemy, events);
            enemy.attackCooldownMs = enemy.kind.attackIntervalMs;
            return;
        }

        enemy.attackCooldownMs -= dtMs;
        while (enemy.attackCooldownMs <= 0 && !this.isOver()) {
            this.attack(enemy, events);
            enemy.attackCooldownMs += enemy.kind.attackIntervalMs;
        }
    }

    private attack(enemy: Enemy, events: CombatEvent[]): void {
        const damage = enemy.kind.attackDamage;
        this.playerHp = Math.max(0, this.playerHp - damage);
        events.push({ type: 'playerDamaged', enemyId: enemy.id, damage });
        if (this.playerHp === 0) {
            this.status = 'lost';
            events.push({ type: 'lost' });
        }
    }

    /** Won once every group has spawned and every enemy is defeated. */
    private checkWon(events: CombatEvent[]): void {
        const allSpawned = this.groupIndex >= this.level.groups.length;
        if (this.status !== 'playing' || !allSpawned || this.enemies.length > 0) return;
        this.status = 'won';
        events.push({ type: 'won' });
    }

    /** Enforces the rule that no two enemies on screen share an answer. */
    private createProblem(source: ProblemSource): CombatProblem {
        const liveProblems = this.enemies.map(enemy => enemy.problem);
        const live = new Set(liveProblems.map(problem => problem.answer));
        const problem = source(live, liveProblems);
        if (live.has(problem.answer)) {
            throw new Error(`Problem source returned duplicate answer ${problem.answer}`);
        }
        return problem;
    }
}

function asList(entry: string | string[]): string[] {
    return typeof entry === 'string' ? [entry] : entry;
}

function countEnemies(group: SpawnGroup): number {
    return group.enemies.reduce((sum, entry) => sum + asList(entry).length, 0);
}

/** Gap before the next entry, after `spawned` entries of the group have appeared. */
function gapAfter(group: SpawnGroup, spawned: number): number {
    if (group.endIntervalMs === undefined) return group.intervalMs;
    const gaps = group.enemies.length - 1;
    const t = gaps > 1 ? (spawned - 1) / (gaps - 1) : 0;
    return group.intervalMs + (group.endIntervalMs - group.intervalMs) * t;
}

function validateLevel(level: LevelSpec): void {
    if (level.groups.length === 0) throw new Error('Level needs at least one group');
    if (level.playerMaxHp <= 0) throw new Error('playerMaxHp must be positive');
    if (level.damagePerHit <= 0) throw new Error('damagePerHit must be positive');
    for (const [id, kind] of Object.entries(level.enemyKinds)) {
        if (kind.maxHp <= 0 || kind.walkMs <= 0 || kind.attackIntervalMs <= 0) {
            throw new Error(`Enemy kind "${id}" needs positive maxHp, walkMs and attackIntervalMs`);
        }
    }
    level.groups.forEach((group, g) => {
        if (group.enemies.length === 0) throw new Error(`Group ${g} has no enemies`);
        if (group.startDelayMs < 0 || group.intervalMs < 0 || (group.endIntervalMs ?? 0) < 0) {
            throw new Error(`Group ${g}: delays and intervals cannot be negative`);
        }
        if (group.cutscene && group.type !== 'finale') throw new Error(`Group ${g}: only a 'finale' can have a cutscene`);
        for (const entry of group.enemies) {
            const kinds = asList(entry);
            if (kinds.length === 0 || kinds.length > LANE_COUNT) {
                throw new Error(`Group ${g}: enemies appearing together must number 1-${LANE_COUNT}`);
            }
            for (const kind of kinds) {
                if (!level.enemyKinds[kind]) throw new Error(`Group ${g}: unknown enemy kind "${kind}"`);
            }
        }
    });
}
