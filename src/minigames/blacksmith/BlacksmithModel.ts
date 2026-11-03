export type Difficulty = 'easy' | 'medium' | 'hard';
export type ItemId = 'feather' | 'potion' | 'ingot';

export interface ForgeItem {
    id: ItemId;
    label: string;
    placeholderIcon: string;
}

export interface ForgeEquation {
    terms: ItemId[];
    operator: '+';
    targetSum: number;
}

export interface EquationResult {
    equationIndex: number;
    evaluatedSum: number;
    targetSum: number;
    isSatisfied: boolean;
}

export interface ValidationResult {
    isValid: boolean;
    reason: 'SUCCESS' | 'INCOMPLETE_INPUTS' | 'INVALID_NUMBER' | 'INCORRECT_VALUES';
    message: string;
    equationResults: EquationResult[];
    defenseGained: number;
    hitpointsGained: number;
}

export const FORGE_ITEMS: ForgeItem[] = [
    { id: 'feather', label: 'Feather', placeholderIcon: '[Feather]' },
    { id: 'potion', label: 'Potion', placeholderIcon: '[Potion]' },
    { id: 'ingot', label: 'Iron Ingot', placeholderIcon: '[Ingot]' },
];

const DIFFICULTY_RULES: Record<
    Difficulty,
    { variableCount: number; minVal: number; maxVal: number; defenseBoost: number }
> = {
    easy: { variableCount: 2, minVal: 1, maxVal: 10, defenseBoost: 1 },
    medium: { variableCount: 3, minVal: 2, maxVal: 12, defenseBoost: 3 },
    hard: { variableCount: 3, minVal: 5, maxVal: 20, defenseBoost: 5 },
};

const BASE_HITPOINTS = 100;
const HP_PER_DEFENSE = 10;

/**
 * BlacksmithModel - Manages equation generation, manual difficulty selection,
 * infinite replayability, and player defense/hitpoint upgrades.
 */
export class BlacksmithModel {
    private difficulty: Difficulty;
    private defense: number = 0;
    private maxHitpoints: number = BASE_HITPOINTS;
    private items: ForgeItem[] = [];
    private equations: ForgeEquation[] = [];
    private solution: Record<ItemId, number> = { feather: 0, potion: 0, ingot: 0 };
    private playerGuesses: Record<ItemId, number | null> = {
        feather: null,
        potion: null,
        ingot: null,
    };
    private rng: () => number;

    constructor(
        initialDifficulty: Difficulty = 'easy',
        rng: () => number = Math.random
    ) {
        this.difficulty = initialDifficulty;
        this.rng = rng;
        this.generateNewPuzzle();
    }

    public getDifficulty(): Difficulty {
        return this.difficulty;
    }

    public setDifficulty(difficulty: Difficulty): void {
        if (!DIFFICULTY_RULES[difficulty]) {
            throw new Error(`Invalid difficulty: ${difficulty}`);
        }
        this.difficulty = difficulty;
        this.generateNewPuzzle();
    }

    private getRandomInt(min: number, max: number): number {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }

    private isItemActive(itemId: ItemId): boolean {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].id === itemId) {
                return true;
            }
        }
        return false;
    }

    /**
     * Picks whole numbers for each item first, then builds the equations
     * from those numbers so every puzzle has a whole-number solution.
     */
    public generateNewPuzzle(): void {
        const config = DIFFICULTY_RULES[this.difficulty];

        this.items = FORGE_ITEMS.slice(0, config.variableCount);

        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            this.solution[item.id] = this.getRandomInt(config.minVal, config.maxVal);
            this.playerGuesses[item.id] = null;
        }

        const first = this.items[0].id;
        const second = this.items[1].id;

        // First two equations use the first two items
        const eqs: ForgeEquation[] = [
            {
                terms: [first, first],
                operator: '+',
                targetSum: this.solution[first] + this.solution[first],
            },
            {
                terms: [first, second],
                operator: '+',
                targetSum: this.solution[first] + this.solution[second],
            },
        ];

        // Add third equation when difficulty has 3 variables
        if (config.variableCount === 3) {
            const third = this.items[2].id;
            let terms: ItemId[];

            if (this.difficulty === 'hard') {
                terms = [first, second, third];
            } else {
                terms = [second, third];
            }

            let targetSum = 0;
            for (let i = 0; i < terms.length; i++) {
                targetSum += this.solution[terms[i]];
            }

            eqs.push({
                terms: terms,
                operator: '+',
                targetSum: targetSum,
            });
        }

        this.equations = eqs;
    }

    public setPlayerGuess(itemId: ItemId, value: number | null): void {
        if (!this.isItemActive(itemId)) {
            throw new Error(`Item ${itemId} is not active in this puzzle.`);
        }
        this.playerGuesses[itemId] = value;
    }

    /**
     * Changes the player's guess by delta and keeps the value at 1 or above.
     */
    public adjustPlayerGuess(itemId: ItemId, delta: number): number {
        if (!this.isItemActive(itemId)) {
            throw new Error(`Item ${itemId} is not active in this puzzle.`);
        }

        let current = this.playerGuesses[itemId];
        if (current === null || current === undefined) {
            current = 0;
        }

        let nextValue = current + delta;
        if (nextValue < 1) {
            nextValue = 1;
        }

        this.playerGuesses[itemId] = nextValue;
        return nextValue;
    }

    /**
     * Checks if the player's guesses solve all equations.
     * If correct, updates defense and max hitpoints based on the chosen difficulty,
     * and generates a brand new puzzle for infinite replayability.
     */
    public submitForgeAttempt(): ValidationResult {
        for (let i = 0; i < this.items.length; i++) {
            const item = this.items[i];
            const guess = this.playerGuesses[item.id];

            if (guess === null || guess === undefined) {
                return {
                    isValid: false,
                    reason: 'INCOMPLETE_INPUTS',
                    message: `Enter a value for ${item.label} before forging.`,
                    equationResults: [],
                    defenseGained: 0,
                    hitpointsGained: 0,
                };
            }

            if (!Number.isInteger(guess) || guess <= 0) {
                return {
                    isValid: false,
                    reason: 'INVALID_NUMBER',
                    message: `${item.label} must be a positive whole number.`,
                    equationResults: [],
                    defenseGained: 0,
                    hitpointsGained: 0,
                };
            }
        }

        const equationResults: EquationResult[] = [];
        let allCorrect = true;

        for (let i = 0; i < this.equations.length; i++) {
            const eq = this.equations[i];
            let evaluatedSum = 0;

            for (let j = 0; j < eq.terms.length; j++) {
                const termId = eq.terms[j];
                const guessValue = this.playerGuesses[termId] as number;
                evaluatedSum += guessValue;
            }

            const isSatisfied = evaluatedSum === eq.targetSum;
            if (!isSatisfied) {
                allCorrect = false;
            }

            equationResults.push({
                equationIndex: i,
                evaluatedSum: evaluatedSum,
                targetSum: eq.targetSum,
                isSatisfied: isSatisfied,
            });
        }

        if (!allCorrect) {
            return {
                isValid: false,
                reason: 'INCORRECT_VALUES',
                message: 'Some equations do not balance. Check your numbers.',
                equationResults: equationResults,
                defenseGained: 0,
                hitpointsGained: 0,
            };
        }

        // Grant rewards based on chosen difficulty tier
        const defenseGained = DIFFICULTY_RULES[this.difficulty].defenseBoost;
        const hitpointsGained = defenseGained * HP_PER_DEFENSE;

        this.defense += defenseGained;
        this.maxHitpoints += hitpointsGained;

        // Generate a new puzzle so the minigame can be played infinitely
        this.generateNewPuzzle();

        return {
            isValid: true,
            reason: 'SUCCESS',
            message: `Armor upgraded: +${defenseGained} Defense (+${hitpointsGained} HP).`,
            equationResults: equationResults,
            defenseGained: defenseGained,
            hitpointsGained: hitpointsGained,
        };
    }

    public getDefense(): number {
        return this.defense;
    }

    public getMaxHitpoints(): number {
        return this.maxHitpoints;
    }

    public getItems(): ForgeItem[] {
        return this.items;
    }

    public getEquations(): ForgeEquation[] {
        return this.equations;
    }

    public getPlayerGuesses(): Record<ItemId, number | null> {
        return { ...this.playerGuesses };
    }

    public getSolutionForTesting(): Record<ItemId, number> {
        return { ...this.solution };
    }
}