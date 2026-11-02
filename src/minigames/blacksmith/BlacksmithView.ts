import Konva from 'konva';
import {
    Difficulty,
    ForgeEquation,
    ForgeItem,
    ItemId,
    ValidationResult,
} from './BlacksmithModel';

export interface BlacksmithViewInterface {
    renderPuzzle(
        difficulty: Difficulty,
        items: ForgeItem[],
        equations: ForgeEquation[],
        guesses: Record<ItemId, number | null>
    ): void;
    updateGuessDisplay(itemId: ItemId, value: number | null): void;
    updateStatsDisplay(defense: number, maxHp: number): void;
    showFeedback(result: ValidationResult): void;
    onSelectDifficulty(callback: (difficulty: Difficulty) => void): void;
    onAdjustGuess(callback: (itemId: ItemId, delta: number) => void): void;
    onSubmitForge(callback: () => void): void;
    onBackToMap(callback: () => void): void;
}

/**
 * BlacksmithView - Minimal Sprint 1 Konva view for the Armor Forge minigame.
 */
export class BlacksmithView implements BlacksmithViewInterface {
    private rootGroup: Konva.Group;
    private boardGroup: Konva.Group;
    private answersGroup: Konva.Group;
    private feedbackText: Konva.Text;
    private statsText: Konva.Text;

    private difficultyCallback?: (difficulty: Difficulty) => void;
    private adjustGuessCallback?: (itemId: ItemId, delta: number) => void;
    private submitForgeCallback?: () => void;
    private backToMapCallback?: () => void;

    constructor(layer: Konva.Layer, width: number = 960, height: number = 600) {
        this.rootGroup = new Konva.Group({ x: 0, y: 0 });
        layer.add(this.rootGroup);

        // Plain background
        this.rootGroup.add(
            new Konva.Rect({ x: 0, y: 0, width, height, fill: '#222222' })
        );

        // Title
        this.rootGroup.add(
            new Konva.Text({
                x: width / 2 - 120,
                y: 20,
                width: 240,
                text: 'ARMOR FORGE',
                fontSize: 26,
                fontStyle: 'bold',
                fill: '#ffffff',
                align: 'center',
            })
        );

        // Back to Map button
        const backBtn = this.createButton(20, 20, 120, 36, 'Back to Map');
        backBtn.on('click tap', () => this.backToMapCallback?.());
        this.rootGroup.add(backBtn);

        // Difficulty buttons
        const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
        for (let i = 0; i < difficulties.length; i++) {
            const diff = difficulties[i];
            const btn = this.createButton(680 + i * 85, 20, 75, 36, diff.toUpperCase());
            btn.on('click tap', () => this.difficultyCallback?.(diff));
            this.rootGroup.add(btn);
        }

        // Chalkboard box
        this.rootGroup.add(
            new Konva.Rect({
                x: 180,
                y: 80,
                width: 520,
                height: 240,
                fill: '#1b3b2b',
                stroke: '#555555',
                strokeWidth: 4,
            })
        );

        this.boardGroup = new Konva.Group({ x: 200, y: 110 });
        this.rootGroup.add(this.boardGroup);

        // Simple stats text
        this.statsText = new Konva.Text({
            x: 720,
            y: 120,
            width: 200,
            text: 'Defense: 0\nMax HP: 100',
            fontSize: 18,
            fill: '#ffffff',
        });
        this.rootGroup.add(this.statsText);

        this.answersGroup = new Konva.Group({ x: 200, y: 350 });
        this.rootGroup.add(this.answersGroup);

        // Submit button
        const forgeBtn = this.createButton(width / 2 - 90, 470, 180, 44, 'FORGE ARMOR');
        forgeBtn.on('click tap', () => this.submitForgeCallback?.());
        this.rootGroup.add(forgeBtn);

        this.feedbackText = new Konva.Text({
            x: 180,
            y: 535,
            width: 600,
            text: '',
            fontSize: 16,
            fill: '#ffffff',
            align: 'center',
        });
        this.rootGroup.add(this.feedbackText);
    }

    private createButton(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string
    ): Konva.Group {
        const group = new Konva.Group({ x, y });
        group.add(
            new Konva.Rect({
                width,
                height,
                fill: '#444444',
                stroke: '#888888',
                strokeWidth: 2,
            })
        );
        group.add(
            new Konva.Text({
                width,
                y: height / 2 - 7,
                text: label,
                fontSize: 14,
                fill: '#ffffff',
                align: 'center',
            })
        );
        return group;
    }

    public renderPuzzle(
        _difficulty: Difficulty,
        _items: ForgeItem[],
        _equations: ForgeEquation[],
        _guesses: Record<ItemId, number | null>
    ): void {}

    public updateGuessDisplay(_itemId: ItemId, _value: number | null): void {}

    public updateStatsDisplay(_defense: number, _maxHp: number): void {}

    public showFeedback(_result: ValidationResult): void {}

    public onSelectDifficulty(callback: (difficulty: Difficulty) => void): void {
        this.difficultyCallback = callback;
    }

    public onAdjustGuess(callback: (itemId: ItemId, delta: number) => void): void {
        this.adjustGuessCallback = callback;
    }

    public onSubmitForge(callback: () => void): void {
        this.submitForgeCallback = callback;
    }

    public onBackToMap(callback: () => void): void {
        this.backToMapCallback = callback;
    }
}