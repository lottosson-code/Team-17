import {
    BlacksmithModel,
    Difficulty,
    ItemId,
    ValidationResult,
} from './BlacksmithModel';
import { BlacksmithViewInterface } from './BlacksmithView';

export interface BlacksmithControllerCallbacks {
    onStatsUpgraded?: (defense: number, maxHitpoints: number) => void;
    onExitToMap?: () => void;
}

/**
 * BlacksmithController - Connects BlacksmithView events to BlacksmithModel state.
 */
export class BlacksmithController {
    private model: BlacksmithModel;
    private view: BlacksmithViewInterface;
    private callbacks: BlacksmithControllerCallbacks;

    constructor(
        model: BlacksmithModel,
        view: BlacksmithViewInterface,
        callbacks: BlacksmithControllerCallbacks = {}
    ) {
        this.model = model;
        this.view = view;
        this.callbacks = callbacks;

        this.view.onSelectDifficulty((difficulty: Difficulty) => {
            this.handleDifficultyChange(difficulty);
        });

        this.view.onTypeGuess((itemId: ItemId, rawText: string) => {
            this.handleTypeGuess(itemId, rawText);
        });

        this.view.onSubmitForge(() => {
            this.handleSubmitForge();
        });

        this.view.onBackToMap(() => {
            this.handleBackToMap();
        });

        this.refreshView();
    }

    public refreshView(): void {
        this.view.renderPuzzle(
            this.model.getDifficulty(),
            this.model.getItems(),
            this.model.getEquations(),
            this.model.getPlayerGuesses()
        );
        this.view.updateStatsDisplay(
            this.model.getDefense(),
            this.model.getMaxHitpoints()
        );
    }

    public handleDifficultyChange(difficulty: Difficulty): void {
        this.model.setDifficulty(difficulty);
        this.refreshView();
    }

    /**
     * Reads the player's typed string and updates the model guess.
     * Empty text sets the guess to null; mistyped text becomes NaN so the
     * model's INVALID_NUMBER check catches it when forging.
     */
    public handleTypeGuess(itemId: ItemId, rawText: string): void {
        const trimmed = rawText.trim();

        if (trimmed === '') {
            this.model.setPlayerGuess(itemId, null);
        } else {
            const parsedValue = Number(trimmed);
            this.model.setPlayerGuess(itemId, parsedValue);
        }

        this.view.updateGuessDisplay(itemId, trimmed);
    }

    public handleSubmitForge(): ValidationResult {
        const result = this.model.submitForgeAttempt();
        this.view.showFeedback(result);

        if (result.isValid) {
            this.refreshView();
            if (this.callbacks.onStatsUpgraded) {
                this.callbacks.onStatsUpgraded(
                    this.model.getDefense(),
                    this.model.getMaxHitpoints()
                );
            }
        }

        return result;
    }

    public handleBackToMap(): void {
        if (this.callbacks.onExitToMap) {
            this.callbacks.onExitToMap();
        }
    }
}