import {
    LANE_COUNT,
    type CombatEvent,
    type CombatStatus,
    type Enemy,
    type LevelSpec,
    type ProblemSource,
    type SpawnSpec,
} from './types';

/**
 * The rules of one combat level, with no Phaser or DOM code.
 * The scene calls `tick` every frame and `submit` when the player casts a spell,
 * then draws `getEnemies()` and plays animations for the returned events.
 */
export class CombatModel {
    private readonly level: LevelSpec;
    private readonly nextProblem: ProblemSource;

    private status: CombatStatus = 'playing';
    private playerHp: number;
    private enemies: Enemy[] = [];
    private nextEnemyId = 1;

    private waveIndex = 0;
    private waveElapsedMs = 0;
    private nextSpawnIndex = 0;
    private waveSpawns: SpawnSpec[] = [];
    private betweenWavesLeftMs = 0;

    /** Events produced outside tick/submit, delivered on the next tick. */
    private pending: CombatEvent[] = [];

    constructor(level: LevelSpec, nextProblem: ProblemSource) {
        validateLevel(level);
        this.level = level;
        this.nextProblem = nextProblem;
        this.playerHp = level.playerMaxHp;
        this.startWave(0, this.pending);
    }

    /** Advances time: spawns, moves and attacks. Returns what happened. */
    public tick(dtMs: number): CombatEvent[] {
        const events = this.pending;
        this.pending = [];
        if (this.isOver() || dtMs <= 0) return events;

        if (this.status === 'betweenWaves') {
            this.betweenWavesLeftMs -= dtMs;
            if (this.betweenWavesLeftMs <= 0) this.startWave(this.waveIndex + 1, events);
            return events;
        }

        this.waveElapsedMs += dtMs;
        // Move existing enemies before spawning, so new ones start at progress 0.
        for (const enemy of this.enemies) {
            this.advanceEnemy(enemy, dtMs, events);
            if (this.isOver()) return events;
        }
        this.spawnDueEnemies(events);
        this.checkWaveCleared(events);
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
            events.push({ type: 'enemyDefeated', enemyId: target.id });
            this.checkWaveCleared(events);
        } else {
            // A surviving enemy gets a fresh problem, so the same answer can't hit it twice.
            target.problem = this.createProblem();
            events.push({ type: 'newProblem', enemyId: target.id });
        }
        return events;
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

    /** 0-based index of the current (or just-cleared) wave. */
    public getWaveIndex(): number {
        return this.waveIndex;
    }

    public getWaveCount(): number {
        return this.level.waves.length;
    }

    private isOver(): boolean {
        return this.status === 'won' || this.status === 'lost';
    }

    private startWave(index: number, events: CombatEvent[]): void {
        this.status = 'playing';
        this.waveIndex = index;
        this.waveElapsedMs = 0;
        this.nextSpawnIndex = 0;
        this.waveSpawns = [...this.level.waves[index].spawns].sort((a, b) => a.atMs - b.atMs);
        events.push({ type: 'waveStarted', wave: index });
        // Spawns at 0 ms appear immediately rather than one frame later.
        this.spawnDueEnemies(events);
    }

    private spawnDueEnemies(events: CombatEvent[]): void {
        while (
            this.nextSpawnIndex < this.waveSpawns.length &&
            this.waveSpawns[this.nextSpawnIndex].atMs <= this.waveElapsedMs
        ) {
            const spawn = this.waveSpawns[this.nextSpawnIndex++];
            const kind = this.level.enemyKinds[spawn.kind];
            const enemy: Enemy = {
                id: this.nextEnemyId++,
                kind,
                lane: spawn.lane,
                progress: 0,
                hp: kind.maxHp,
                problem: this.createProblem(),
                state: 'walking',
                attackCooldownMs: 0,
            };
            this.enemies.push(enemy);
            events.push({ type: 'enemySpawned', enemyId: enemy.id });
        }
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

    private checkWaveCleared(events: CombatEvent[]): void {
        const allSpawned = this.nextSpawnIndex >= this.waveSpawns.length;
        if (this.status !== 'playing' || !allSpawned || this.enemies.length > 0) return;

        events.push({ type: 'waveCleared', wave: this.waveIndex });
        if (this.waveIndex === this.level.waves.length - 1) {
            this.status = 'won';
            events.push({ type: 'won' });
        } else {
            this.status = 'betweenWaves';
            this.betweenWavesLeftMs = this.level.betweenWavesMs;
        }
    }

    /** Enforces the rule that no two enemies on screen share an answer. */
    private createProblem(): Enemy['problem'] {
        const live = new Set(this.enemies.map(enemy => enemy.problem.answer));
        const problem = this.nextProblem(live);
        if (live.has(problem.answer)) {
            throw new Error(`Problem source returned duplicate answer ${problem.answer}`);
        }
        return problem;
    }
}

function validateLevel(level: LevelSpec): void {
    if (level.waves.length === 0) throw new Error('Level needs at least one wave');
    if (level.playerMaxHp <= 0) throw new Error('playerMaxHp must be positive');
    if (level.damagePerHit <= 0) throw new Error('damagePerHit must be positive');
    for (const [id, kind] of Object.entries(level.enemyKinds)) {
        if (kind.maxHp <= 0 || kind.walkMs <= 0 || kind.attackIntervalMs <= 0) {
            throw new Error(`Enemy kind "${id}" needs positive maxHp, walkMs and attackIntervalMs`);
        }
    }
    level.waves.forEach((wave, w) => {
        if (wave.spawns.length === 0) throw new Error(`Wave ${w} has no spawns`);
        for (const spawn of wave.spawns) {
            if (!level.enemyKinds[spawn.kind]) throw new Error(`Wave ${w}: unknown enemy kind "${spawn.kind}"`);
            if (!Number.isInteger(spawn.lane) || spawn.lane < 0 || spawn.lane >= LANE_COUNT) {
                throw new Error(`Wave ${w}: lane ${spawn.lane} is outside 0-${LANE_COUNT - 1}`);
            }
        }
    });
}
