import { describe, it, expect } from 'vitest';
import { BlacksmithModel } from '../BlacksmithModel';

// Returning 0.6 makes (rng() < 0.5) false, so equations use '+'
function additionRng(): number {
    return 0.6;
}

// Returning 0.1 makes (rng() < 0.5) true, so equations use '-'
function subtractionRng(): number {
    return 0.1;
}

describe('BlacksmithModel', function () {
    it('generates a 2-variable puzzle on easy difficulty', function () {
        const model = new BlacksmithModel('easy', additionRng);

        expect(model.getDifficulty()).toBe('easy');
        expect(model.getItems()).toHaveLength(2);
        expect(model.getEquations()).toHaveLength(2);

        // Verify the generated solution actually solves all equations
        const solution = model.getSolutionForTesting();
        model.setPlayerGuess('feather', solution.feather);
        model.setPlayerGuess('potion', solution.potion);

        expect(model.submitForgeAttempt().isValid).toBe(true);
    });

    it('allows switching to medium and hard difficulties with 3 variables', function () {
        const model = new BlacksmithModel('easy', additionRng);

        model.setDifficulty('medium');
        expect(model.getDifficulty()).toBe('medium');
        expect(model.getItems()).toHaveLength(3);
        expect(model.getEquations()).toHaveLength(3);

        model.setDifficulty('hard');
        expect(model.getDifficulty()).toBe('hard');
        expect(model.getItems()).toHaveLength(3);
        expect(model.getEquations()).toHaveLength(3);
    });

    it('grants higher defense and hitpoint rewards depending on chosen difficulty', function () {
        // Test Easy difficulty reward (+1 Defense, +10 HP)
        const easyModel = new BlacksmithModel('easy', additionRng);
        let solution = easyModel.getSolutionForTesting();
        easyModel.setPlayerGuess('feather', solution.feather);
        easyModel.setPlayerGuess('potion', solution.potion);

        let result = easyModel.submitForgeAttempt();
        expect(result.defenseGained).toBe(1);
        expect(result.hitpointsGained).toBe(10);
        expect(easyModel.getDefense()).toBe(1);

        // Test Hard difficulty reward (+5 Defense, +50 HP)
        const hardModel = new BlacksmithModel('hard', additionRng);
        solution = hardModel.getSolutionForTesting();
        hardModel.setPlayerGuess('feather', solution.feather);
        hardModel.setPlayerGuess('potion', solution.potion);
        hardModel.setPlayerGuess('ingot', solution.ingot);

        result = hardModel.submitForgeAttempt();
        expect(result.defenseGained).toBe(5);
        expect(result.hitpointsGained).toBe(50);
        expect(hardModel.getDefense()).toBe(5);
    });

    it('allows infinite replayability by generating a new puzzle after submission', function () {
        const model = new BlacksmithModel('easy', additionRng);
        const firstEquations = model.getEquations();

        const solution = model.getSolutionForTesting();
        model.setPlayerGuess('feather', solution.feather);
        model.setPlayerGuess('potion', solution.potion);

        model.submitForgeAttempt();

        // After submitting, a new puzzle array is created for endless play
        const secondEquations = model.getEquations();
        expect(model.getDefense()).toBe(1);
        expect(secondEquations).not.toBe(firstEquations);
    });

    it('rejects incomplete inputs when an item guess is null', function () {
        const model = new BlacksmithModel('easy', additionRng);
        model.setPlayerGuess('feather', 4);

        const result = model.submitForgeAttempt();
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('INCOMPLETE_INPUTS');
        expect(model.getDefense()).toBe(0);
    });

    it('rejects zero, negative, or decimal numbers', function () {
        const model = new BlacksmithModel('easy', additionRng);

        model.setPlayerGuess('feather', 0);
        model.setPlayerGuess('potion', 5);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');

        model.setPlayerGuess('feather', -2);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');

        model.setPlayerGuess('feather', 3.5);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');
    });

    it('rejects wrong guesses and marks which equation failed', function () {
        const model = new BlacksmithModel('easy', additionRng);

        // Use 999 so guesses are guaranteed to be wrong
        model.setPlayerGuess('feather', 999);
        model.setPlayerGuess('potion', 999);

        const result = model.submitForgeAttempt();
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('INCORRECT_VALUES');

        // Check using a simple loop that at least one equation failed
        let foundFailedEquation = false;
        for (let i = 0; i < result.equationResults.length; i++) {
            if (result.equationResults[i].isSatisfied === false) {
                foundFailedEquation = true;
            }
        }
        expect(foundFailedEquation).toBe(true);
        expect(model.getDefense()).toBe(0);
    });

    it('adjusts guesses and keeps the minimum value at 1', function () {
        const model = new BlacksmithModel('easy', additionRng);

        expect(model.adjustPlayerGuess('feather', 1)).toBe(1);
        expect(model.adjustPlayerGuess('feather', 2)).toBe(3);
        expect(model.adjustPlayerGuess('feather', -10)).toBe(1);
    });

    it('throws an error for invalid difficulty settings or inactive items', function () {
        const model = new BlacksmithModel('easy', additionRng);

        expect(function () {
            model.setDifficulty('extreme' as any);
        }).toThrow(/Invalid difficulty/);

        expect(function () {
            model.setPlayerGuess('ingot', 5);
        }).toThrow(/not active/);
    });

    it('supports subtraction equations and never generates negative target sums', function () {
        const model = new BlacksmithModel('medium', subtractionRng);
        const equations = model.getEquations();

        let foundSubtraction = false;
        for (let i = 0; i < equations.length; i++) {
            const eq = equations[i];
            expect(eq.targetSum).toBeGreaterThanOrEqual(0);
            if (eq.operator === '-') {
                foundSubtraction = true;
            }
        }

        expect(foundSubtraction).toBe(true);

        const solution = model.getSolutionForTesting();
        model.setPlayerGuess('feather', solution.feather);
        model.setPlayerGuess('potion', solution.potion);
        model.setPlayerGuess('ingot', solution.ingot);

        const result = model.submitForgeAttempt();
        expect(result.isValid).toBe(true);
        expect(result.reason).toBe('SUCCESS');
    });
});