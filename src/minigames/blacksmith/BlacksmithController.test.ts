import { describe, it, expect, vi } from 'vitest';
import { BlacksmithModel } from './BlacksmithModel';
import { BlacksmithController } from './BlacksmithController';
import { BlacksmithViewInterface } from './BlacksmithView';

function createMockView(): BlacksmithViewInterface {
    return {
        renderPuzzle: vi.fn(),
        updateGuessDisplay: vi.fn(),
        updateStatsDisplay: vi.fn(),
        showFeedback: vi.fn(),
        onSelectDifficulty: vi.fn(),
        onTypeGuess: vi.fn(),
        onSubmitForge: vi.fn(),
        onBackToMap: vi.fn(),
    };
}

describe('BlacksmithController', function () {
    it('renders the initial puzzle and stats on startup', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const mockView = createMockView();

        new BlacksmithController(model, mockView);

        expect(mockView.renderPuzzle).toHaveBeenCalledTimes(1);
        expect(mockView.updateStatsDisplay).toHaveBeenCalledWith(0, 100);
    });

    it('updates the model and refreshes the view when difficulty changes', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const mockView = createMockView();
        const controller = new BlacksmithController(model, mockView);

        controller.handleDifficultyChange('hard');

        expect(model.getDifficulty()).toBe('hard');
        expect(mockView.renderPuzzle).toHaveBeenCalledTimes(2);
    });

    it('parses valid typed integer strings and updates the model', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const mockView = createMockView();
        const controller = new BlacksmithController(model, mockView);

        controller.handleTypeGuess('feather', '5');

        expect(model.getPlayerGuesses().feather).toBe(5);
        expect(mockView.updateGuessDisplay).toHaveBeenCalledWith('feather', '5');
    });

    it('returns INVALID_NUMBER when player mistypes non-numeric text', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const mockView = createMockView();
        const controller = new BlacksmithController(model, mockView);

        controller.handleTypeGuess('feather', 'abc');
        controller.handleTypeGuess('potion', '3');

        const result = controller.handleSubmitForge();

        expect(result.isValid).toBe(false);
        expect(result.reason).toBe('INVALID_NUMBER');
        expect(mockView.showFeedback).toHaveBeenCalledWith(result);
    });

    it('upgrades stats and refreshes puzzle when typed guesses are correct', function () {
        const mockRng = vi.fn().mockReturnValue(0.4);
        const model = new BlacksmithModel('easy', mockRng);
        const mockView = createMockView();
        const onStatsUpgraded = vi.fn();

        const controller = new BlacksmithController(model, mockView, {
            onStatsUpgraded: onStatsUpgraded,
        });

        const solution = model.getSolutionForTesting();
        controller.handleTypeGuess('feather', String(solution.feather));
        controller.handleTypeGuess('potion', String(solution.potion));

        const result = controller.handleSubmitForge();

        expect(result.isValid).toBe(true);
        expect(mockView.showFeedback).toHaveBeenCalledWith(result);
        expect(onStatsUpgraded).toHaveBeenCalledWith(1, 110);
    });
});