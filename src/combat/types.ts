export const LANE_COUNT = 4;

/** A problem shown above an enemy. `answer` must be unique among enemies on screen. */
export interface CombatProblem {
    text: string;
    answer: number;
}

/**
 * Returns a new problem whose answer is NOT in `liveAnswers`.
 * Adapter point for the math engine, so combat does not depend on its internals.
 */
export type ProblemSource = (liveAnswers: ReadonlySet<number>) => CombatProblem;

export interface EnemyKind {
    id: string;
    maxHp: number;
    /** Time to walk from the far end of a lane to the wizard. */
    walkMs: number;
    attackDamage: number;
    /** Delay between attacks once the enemy has reached the wizard. */
    attackIntervalMs: number;
}

export interface SpawnSpec {
    /** Time since the wave started. */
    atMs: number;
    lane: number;
    kind: string;
}

export interface WaveSpec {
    spawns: SpawnSpec[];
}

export interface LevelSpec {
    playerMaxHp: number;
    /** Damage a correct answer deals to the enemy it solves. */
    damagePerHit: number;
    /** Pause between clearing a wave and starting the next one. */
    betweenWavesMs: number;
    enemyKinds: Record<string, EnemyKind>;
    waves: WaveSpec[];
}

export type EnemyState = 'walking' | 'attacking';

export interface Enemy {
    readonly id: number;
    readonly kind: EnemyKind;
    readonly lane: number;
    /** 0 = just spawned at the far end, 1 = reached the wizard. */
    progress: number;
    hp: number;
    problem: CombatProblem;
    state: EnemyState;
    /** Time until the next attack while attacking. */
    attackCooldownMs: number;
}

export type CombatStatus = 'playing' | 'betweenWaves' | 'won' | 'lost';

/**
 * Everything the view needs to animate. The model never plays animations itself;
 * the scene reacts to these (e.g. `wrongAnswer` -> wizard's frustrated animation).
 */
export type CombatEvent =
    | { type: 'waveStarted'; wave: number }
    | { type: 'enemySpawned'; enemyId: number }
    | { type: 'hit'; enemyId: number; damage: number }
    | { type: 'newProblem'; enemyId: number }
    | { type: 'enemyDefeated'; enemyId: number }
    | { type: 'wrongAnswer'; answer: number }
    | { type: 'enemyReachedPlayer'; enemyId: number }
    | { type: 'playerDamaged'; enemyId: number; damage: number }
    | { type: 'waveCleared'; wave: number }
    | { type: 'won' }
    | { type: 'lost' };
