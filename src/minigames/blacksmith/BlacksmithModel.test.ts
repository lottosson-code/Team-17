import { describe, it, expect, vi } from 'vitest';
import { BlacksmithModel } from './BlacksmithModel';

function fixedRandom(): number {
    return 0.5;
}

describe('BlacksmithModel', function () {
    it('generates a 2-variable puzzle on easy difficulty', function () {
        const mockRng = vi
            .fn()
            .mockReturnValueOnce(0.4) // feather = 5
            .mockReturnValueOnce(0.2); // potion = 3

        const model = new BlacksmithModel('easy', mockRng);

        expect(model.getDifficulty()).toBe('easy');
        expect(model.getItems()).toHaveLength(2);
        expect(model.getEquations()).toEqual([
            { terms: ['feather', 'feather'], operator: '+', targetSum: 10 },
            { terms: ['feather', 'potion'], operator: '+', targetSum: 8 },
        ]);
    });

    it('allows switching to medium and hard difficulties with 3 variables', function () {
        const mockRng = vi.fn().mockReturnValue(0.3);
        const model = new BlacksmithModel('easy', mockRng);

        model.setDifficulty('medium');
        expect(model.getDifficulty()).toBe('medium');
        expect(model.getItems()).toHaveLength(3);
        expect(model.getEquations()[2].terms).toEqual(['potion', 'ingot']);

        model.setDifficulty('hard');
        expect(model.getDifficulty()).toBe('hard');
        expect(model.getItems()).toHaveLength(3);
        expect(model.getEquations()[2].terms).toEqual(['feather', 'potion', 'ingot']);
    });

    it('grants higher defense and hitpoint rewards depending on chosen difficulty', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);

        // Test Easy difficulty reward (+1 Defense, +10 HP)
        const easyModel = new BlacksmithModel('easy', mockRng);
        let solution = easyModel.getSolutionForTesting();
        easyModel.setPlayerGuess('feather', solution.feather);
        easyModel.setPlayerGuess('potion', solution.potion);

        let result = easyModel.submitForgeAttempt();
        expect(result.defenseGained).toBe(1);
        expect(result.hitpointsGained).toBe(10);
        expect(easyModel.getDefense()).toBe(1);

        // Test Hard difficulty reward (+5 Defense, +50 HP)
        const hardModel = new BlacksmithModel('hard', mockRng);
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
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const firstEquations = model.getEquations();

        const solution = model.getSolutionForTesting();
        model.setPlayerGuess('feather', solution.feather);
        model.setPlayerGuess('potion', solution.potion);

        model.submitForgeAttempt();

        // After submitting, a new puzzle should be generated for endless play
        const secondEquations = model.getEquations();
        expect(model.getDefense()).toBe(1);
        expect(secondEquations).toBeDefined();
    });

    it('rejects incomplete inputs when an item guess is null', function () {
        const model = new BlacksmithModel('easy', fixedRandom);
        model.setPlayerGuess('feather', 4);

        const result = model.submitForgeAttempt();
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('INCOMPLETE_INPUTS');
        expect(model.getDefense()).toBe(0);
    });

    it('rejects zero, negative, or decimal numbers', function () {
        const model = new BlacksmithModel('easy', fixedRandom);

        model.setPlayerGuess('feather', 0);
        model.setPlayerGuess('potion', 5);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');

        model.setPlayerGuess('feather', -2);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');

        model.setPlayerGuess('feather', 3.5);
        expect(model.submitForgeAttempt().reason).toBe('INVALID_NUMBER');
    });

    it('rejects wrong guesses and marks which equation failed', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);

        model.setPlayerGuess('feather', 5);
        model.setPlayerGuess('potion', 99);

        const result = model.submitForgeAttempt();
        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('INCORRECT_VALUES');
        expect(result.equationResults[0].isSatisfied).toBe(true);
        expect(result.equationResults[1].isSatisfied).toBe(false);
        expect(model.getDefense()).toBe(0);
    });

    it('adjusts guesses and keeps the minimum value at 1', function () {
        const model = new BlacksmithModel('easy', fixedRandom);

        expect(model.adjustPlayerGuess('feather', 1)).toBe(1);
        expect(model.adjustPlayerGuess('feather', 2)).toBe(3);
        expect(model.adjustPlayerGuess('feather', -10)).toBe(1);
    });

    it('throws an error for invalid difficulty settings or inactive items', function () {
        const model = new BlacksmithModel('easy', fixedRandom);
        expect(function () {
            model.setDifficulty('extreme' as any);
        }).toThrow(/Invalid difficulty/);

        expect(function () {
            model.setPlayerGuess('ingot', 5);
        }).toThrow(/not active/);
    });
});