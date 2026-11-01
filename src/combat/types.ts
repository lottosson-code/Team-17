export const LANE_COUNT = 4;

export type Operator = '+' | '-' | '*' | '/';

// Problem shown above an enemy. "answer" must be unique among enemies on screen.
export interface CombatProblem {
    left: number;
    operator: Operator;
    right: number;
    answer: number;
}

// Returns a new problem whose answer is not in "liveAnswers".
// "liveProblems" is for sources that must also plan ahead (e.g. problems that will be twisted later).
export type ProblemSource = (
    liveAnswers: ReadonlySet<number>,
    liveProblems: readonly CombatProblem[],
) => CombatProblem;

export interface EnemyKind {
    id: string;
    maxHp: number;
    walkMs: number; // Time to walk from the far end of a lane to the wizard.
    attackDamage: number;
    attackIntervalMs: number; // Delay between attacks
}

// A scripted pause after a group's enemies appear. The scene plays the animation for "id",
// calls CombatModel.twistOperators() at the right moment, then endCutscene().
export interface CutsceneSpec {
    id: string; // Which animation the scene plays, e.g. 'bossTwist'
    twist?: {
        from: Operator;
        to: Operator; // Rewrites live problems, e.g. + into *
        problemsAfter?: ProblemSource; // Problems for twisted enemies afterwards (default: the level's)
    };
}

// How a group starts:
//   'trickle' - as soon as the previous group has finished spawning
//   'wave'    - once every earlier enemy is defeated; shown as a skull on the progress bar
//   'finale'  - like a wave, but no skull; plays its cutscene after its enemies appear
export type GroupType = 'trickle' | 'wave' | 'finale';

export interface SpawnGroup {
    type: GroupType;
    enemies: string[]; // Enemy kinds, spawned in this order into random free lanes
    startDelayMs: number; // Delay before the first enemy, once the group starts
    intervalMs: number; // Gap between enemies (0 = all at once)
    endIntervalMs?: number; // If set, the gap changes evenly to this by the last enemy
    problems?: ProblemSource; // Overrides the level's problems for this group
    cutscene?: CutsceneSpec; // Only for 'finale'
}

export interface LevelSpec {
    playerMaxHp: number;
    damagePerHit: number;
    problems: ProblemSource; // Default problems for every group
    enemyKinds: Record<string, EnemyKind>;
    groups: SpawnGroup[];
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
    problems: ProblemSource; // Where this enemy's next problem comes from after a non-fatal hit
    state: EnemyState;
    /** Time until the next attack while attacking. */
    attackCooldownMs: number;
}

export type CombatStatus = 'playing' | 'cutscene' | 'won' | 'lost';

/**
 * Everything the view needs to animate. The model never plays animations itself;
 * the scene reacts to these (e.g. `wrongAnswer` -> wizard's frustrated animation).
 */
export type CombatEvent =
    | { type: 'waveStarted'; wave: number; isFinalWave: boolean } // "wave" counts only 'wave' groups, from 0
    | { type: 'enemySpawned'; enemyId: number }
    | { type: 'cutsceneStarted'; id: string }
    | { type: 'problemTwisted'; enemyId: number }
    | { type: 'cutsceneEnded'; id: string }
    | { type: 'hit'; enemyId: number; damage: number }
    | { type: 'newProblem'; enemyId: number }
    | { type: 'enemyDefeated'; enemyId: number }
    | { type: 'wrongAnswer'; answer: number }
    | { type: 'enemyReachedPlayer'; enemyId: number }
    | { type: 'playerDamaged'; enemyId: number; damage: number }
    | { type: 'won' }
    | { type: 'lost' };
