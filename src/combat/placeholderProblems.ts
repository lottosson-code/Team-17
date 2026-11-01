import type { CombatProblem, ProblemSource } from './types';

/**
 * TEMPORARY problem source so combat can be played before the math engine supports
 * per-level ranges and on-screen answer checks. Replace with an adapter around
 * src/Math/ProblemGenerator once it takes the live answers as a parameter.
 *
 * Single-digit addition and subtraction (answers 0-18).
 */
export function createPlaceholderProblems(rng: () => number = Math.random, maxTries = 100): ProblemSource {
    const digit = () => 1 + Math.floor(rng() * 9);

    return (liveAnswers): CombatProblem => {
        for (let i = 0; i < maxTries; i++) {
            const a = digit();
            const b = digit();
            const problem = rng() < 0.5
                ? { text: `${a} + ${b} = ?`, answer: a + b }
                : { text: `${Math.max(a, b)} − ${Math.min(a, b)} = ?`, answer: Math.max(a, b) - Math.min(a, b) };
            if (!liveAnswers.has(problem.answer)) return problem;
        }
        throw new Error(`No unique problem found in ${maxTries} tries`);
    };
}
