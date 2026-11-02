import type { CombatProblem, Operator, ProblemSource } from './types';

// Combat-side problem sources. TEMPORARY until src/Math/ProblemGenerator supports
// per-level ranges and on-screen answer checks; then these should wrap it instead.

const SYMBOLS: Record<Operator, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export function compute(left: number, operator: Operator, right: number): number {
    switch (operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
    }
}

export function makeProblem(left: number, operator: Operator, right: number): CombatProblem {
    return { left, operator, right, answer: compute(left, operator, right) };
}

// Text shown in the enemy's bubble, e.g. "6 × 7 = ?"
export function problemText(problem: CombatProblem): string {
    return `${problem.left} ${SYMBOLS[problem.operator]} ${problem.right} = ?`;
}

// Addition with answers from 2 to maxAnswer. Picks the answer first, so a free answer is always found quickly.
export function createAdditionProblems(maxAnswer = 99, rng: () => number = Math.random): ProblemSource {
    return liveAnswers => {
        const free: number[] = [];
        for (let answer = 2; answer <= maxAnswer; answer++) {
            if (!liveAnswers.has(answer)) free.push(answer);
        }
        if (free.length === 0) throw new Error(`No free addition answer up to ${maxAnswer}`);
        const answer = pick(free, rng);
        const left = 1 + Math.floor(rng() * (answer - 1));
        return makeProblem(left, '+', answer - left);
    };
}

// Multiplication of two numbers from min to max (default: single digits 2-9).
export function createMultiplicationProblems(min = 2, max = 9, rng: () => number = Math.random): ProblemSource {
    return liveAnswers => pickPair(min, max, '*', rng, (left, right) => !liveAnswers.has(left * right));
}

// Multiplication where one operand is 0 (the other from 1 to max). Every answer is 0,
// so only one can be on screen at a time; mix it with other sources (createMixedProblems).
export function createZeroProblems(max = 11, rng: () => number = Math.random): ProblemSource {
    return liveAnswers => {
        if (liveAnswers.has(0)) throw new Error('A × 0 problem is already on screen');
        const other = 1 + Math.floor(rng() * max);
        return rng() < 0.5 ? makeProblem(0, '*', other) : makeProblem(other, '*', 0);
    };
}

/**
 * Picks one of several sources at random by weight. If the picked source can't produce a
 * unique problem (it throws), the others are tried, so e.g. a second "× 0" becomes another kind.
 */
export function createMixedProblems(
    options: { source: ProblemSource; weight: number }[],
    rng: () => number = Math.random,
): ProblemSource {
    return (liveAnswers, liveProblems) => {
        const remaining = [...options];
        let lastError: unknown = new Error('No problem sources given');
        while (remaining.length > 0) {
            const option = pickWeighted(remaining, rng);
            remaining.splice(remaining.indexOf(option), 1);
            try {
                return option.source(liveAnswers, liveProblems);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    };
}

/**
 * For EnemyKind.ownProblems: each enemy works through one times table in order,
 * 1 × a, 2 × a, ..., count × a, where a is picked from "tables" when it spawns.
 * Meant for an enemy that is alone on screen, since its answers are fixed in advance.
 */
export function createTimesTableProblems(
    tables: number[],
    count: number,
    rng: () => number = Math.random,
): () => ProblemSource {
    return () => {
        const table = pick(tables, rng);
        let step = 1;
        return liveAnswers => {
            const problem = makeProblem(step, '*', table);
            if (liveAnswers.has(problem.answer)) {
                throw new Error(`${problem.answer} is already on screen; times-table enemies should be alone`);
            }
            step = Math.min(step + 1, count);
            return problem;
        };
    };
}

/**
 * Problems using "from" that stay unique after twistOperators() rewrites them to "to".
 * Both the current answer and the twisted answer avoid every answer on screen,
 * including the twisted answers of other problems that will be twisted.
 */
export function createTwistableProblems(
    from: Operator,
    to: Operator,
    min = 2,
    max = 9,
    rng: () => number = Math.random,
): ProblemSource {
    return (liveAnswers, liveProblems) => {
        const afterTwist = new Set(liveProblems.map(p =>
            p.operator === from ? compute(p.left, to, p.right) : p.answer));
        return pickPair(min, max, from, rng, (left, right) => {
            const twisted = compute(left, to, right);
            return !liveAnswers.has(compute(left, from, right)) && !afterTwist.has(twisted)
                && Number.isInteger(twisted) && twisted >= 0;
        });
    };
}

function pickPair(
    min: number,
    max: number,
    operator: Operator,
    rng: () => number,
    allowed: (left: number, right: number) => boolean,
): CombatProblem {
    const options: [number, number][] = [];
    for (let left = min; left <= max; left++) {
        for (let right = min; right <= max; right++) {
            if (allowed(left, right)) options.push([left, right]);
        }
    }
    if (options.length === 0) throw new Error(`No unique ${operator} problem with numbers ${min}-${max}`);
    const [left, right] = pick(options, rng);
    return makeProblem(left, operator, right);
}

function pick<T>(items: T[], rng: () => number): T {
    return items[Math.floor(rng() * items.length)];
}

function pickWeighted<T extends { weight: number }>(items: T[], rng: () => number): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = rng() * total;
    for (const item of items) {
        roll -= item.weight;
        if (roll < 0) return item;
    }
    return items[items.length - 1];
}
