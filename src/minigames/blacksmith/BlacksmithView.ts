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
    updateGuessDisplay(itemId: ItemId, rawText: string): void;
    updateStatsDisplay(defense: number, maxHp: number): void;
    showFeedback(result: ValidationResult): void;
    onSelectDifficulty(callback: (difficulty: Difficulty) => void): void;
    onTypeGuess(callback: (itemId: ItemId, rawText: string) => void): void;
    onSubmitForge(callback: () => void): void;
    onBackToMap(callback: () => void): void;
}

/**
 * BlacksmithView - Minimal Sprint 1 Konva view for the Armor Forge minigame.
 * Players click an item box and type their answer on the keyboard.
 */
export class BlacksmithView implements BlacksmithViewInterface {
    private rootGroup: Konva.Group;
    private boardGroup: Konva.Group;
    private answersGroup: Konva.Group;
    private feedbackText: Konva.Text;
    private statsText: Konva.Text;

    private selectedItem: ItemId | null = null;
    private typedInputs: Record<ItemId, string> = {
        feather: '',
        potion: '',
        ingot: '',
    };
    private guessValueTexts: Record<ItemId, Konva.Text | null> = {
        feather: null,
        potion: null,
        ingot: null,
    };
    private guessBoxRects: Record<ItemId, Konva.Rect | null> = {
        feather: null,
        potion: null,
        ingot: null,
    };

    private difficultyCallback: ((difficulty: Difficulty) => void) | null = null;
    private typeGuessCallback: ((itemId: ItemId, rawText: string) => void) | null = null;
    private submitForgeCallback: (() => void) | null = null;
    private backToMapCallback: (() => void) | null = null;

    constructor(layer: Konva.Layer, width: number = 960, height: number = 600) {
        this.rootGroup = new Konva.Group({ x: 0, y: 0 });
        layer.add(this.rootGroup);

        // Plain dark background
        const bg = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: '#222222',
        });
        this.rootGroup.add(bg);

        // Title text
        const title = new Konva.Text({
            x: width / 2 - 120,
            y: 20,
            width: 240,
            text: 'ARMOR FORGE',
            fontSize: 26,
            fontStyle: 'bold',
            fill: '#ffffff',
            align: 'center',
        });
        this.rootGroup.add(title);

        // Back to Map button
        const backBtn = this.createButton(20, 20, 120, 36, 'Back to Map');
        backBtn.on('click tap', () => {
            if (this.backToMapCallback !== null) {
                this.backToMapCallback();
            }
        });
        this.rootGroup.add(backBtn);

        // Difficulty selection buttons
        const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
        for (let i = 0; i < difficulties.length; i++) {
            const diff = difficulties[i];
            const btnX = 680 + i * 85;
            const btn = this.createButton(btnX, 20, 75, 36, diff.toUpperCase());
            btn.on('click tap', () => {
                if (this.difficultyCallback !== null) {
                    this.difficultyCallback(diff);
                }
            });
            this.rootGroup.add(btn);
        }

        // Chalkboard box for displaying equations
        const chalkboard = new Konva.Rect({
            x: 180,
            y: 80,
            width: 520,
            height: 240,
            fill: '#1b3b2b',
            stroke: '#555555',
            strokeWidth: 4,
        });
        this.rootGroup.add(chalkboard);

        this.boardGroup = new Konva.Group({ x: 200, y: 110 });
        this.rootGroup.add(this.boardGroup);

        // Simple player stats display
        this.statsText = new Konva.Text({
            x: 720,
            y: 120,
            width: 200,
            text: 'Defense: 0\nMax HP: 100',
            fontSize: 18,
            fill: '#ffffff',
        });
        this.rootGroup.add(this.statsText);

        // Group to hold clickable answer input boxes
        this.answersGroup = new Konva.Group({ x: 200, y: 350 });
        this.rootGroup.add(this.answersGroup);

        // Submit button
        const forgeBtn = this.createButton(width / 2 - 90, 470, 180, 44, 'FORGE ARMOR');
        forgeBtn.on('click tap', () => {
            if (this.submitForgeCallback !== null) {
                this.submitForgeCallback();
            }
        });
        this.rootGroup.add(forgeBtn);

        // Bottom feedback text
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

        this.setupKeyboardInput();
    }

    private setupKeyboardInput(): void {
        if (typeof window === 'undefined') {
            return;
        }

        window.addEventListener('keydown', (event: KeyboardEvent) => {
            if (this.selectedItem === null) {
                return;
            }

            const currentText = this.typedInputs[this.selectedItem];

            if (event.key === 'Backspace') {
                const shortened = currentText.slice(0, currentText.length - 1);
                this.typedInputs[this.selectedItem] = shortened;
                this.updateGuessDisplay(this.selectedItem, shortened);
                if (this.typeGuessCallback !== null) {
                    this.typeGuessCallback(this.selectedItem, shortened);
                }
            } else if (event.key === 'Enter') {
                if (this.submitForgeCallback !== null) {
                    this.submitForgeCallback();
                }
            } else if (event.key.length === 1 && currentText.length < 5) {
                // Sprint 1: allow any typed character; model validation catches mistypes
                const updated = currentText + event.key;
                this.typedInputs[this.selectedItem] = updated;
                this.updateGuessDisplay(this.selectedItem, updated);
                if (this.typeGuessCallback !== null) {
                    this.typeGuessCallback(this.selectedItem, updated);
                }
            }
        });
    }

    private createButton(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string
    ): Konva.Group {
        const group = new Konva.Group({ x: x, y: y });

        const rect = new Konva.Rect({
            width: width,
            height: height,
            fill: '#444444',
            stroke: '#888888',
            strokeWidth: 2,
        });

        const text = new Konva.Text({
            width: width,
            y: height / 2 - 7,
            text: label,
            fontSize: 14,
            fill: '#ffffff',
            align: 'center',
        });

        group.add(rect);
        group.add(text);
        return group;
    }

    private selectInputBox(itemId: ItemId): void {
        this.selectedItem = itemId;

        const allIds: ItemId[] = ['feather', 'potion', 'ingot'];
        for (let i = 0; i < allIds.length; i++) {
            const id = allIds[i];
            const rect = this.guessBoxRects[id];
            if (rect !== null) {
                if (id === itemId) {
                    rect.stroke('#f5d76e');
                    rect.strokeWidth(3);
                } else {
                    rect.stroke('#666666');
                    rect.strokeWidth(2);
                }
            }
        }

        const layer = this.rootGroup.getLayer();
        if (layer !== null) {
            layer.batchDraw();
        }
    }

    public renderPuzzle(
        _difficulty: Difficulty,
        items: ForgeItem[],
        equations: ForgeEquation[],
        guesses: Record<ItemId, number | null>
    ): void {
        this.boardGroup.destroyChildren();
        this.answersGroup.destroyChildren();

        this.selectedItem = null;
        this.typedInputs = { feather: '', potion: '', ingot: '' };
        this.guessValueTexts = { feather: null, potion: null, ingot: null };
        this.guessBoxRects = { feather: null, potion: null, ingot: null };

        // Map item IDs to their placeholder text icons
        const iconById: Record<ItemId, string> = {
            feather: '[Feather]',
            potion: '[Potion]',
            ingot: '[Ingot]',
        };
        for (let i = 0; i < items.length; i++) {
            iconById[items[i].id] = items[i].placeholderIcon;
        }

        // Draw equation rows on the chalkboard
        for (let i = 0; i < equations.length; i++) {
            const eq = equations[i];
            let line = '';

            for (let j = 0; j < eq.terms.length; j++) {
                const termId = eq.terms[j];
                if (j > 0) {
                    line += ' ' + eq.operator + ' ';
                }
                line += iconById[termId];
            }
            line += ' = ' + String(eq.targetSum);

            const eqText = new Konva.Text({
                x: 0,
                y: i * 55,
                width: 480,
                text: line,
                fontSize: 22,
                fill: '#ffffff',
                align: 'center',
            });
            this.boardGroup.add(eqText);
        }

        // Draw a clickable text input box for each active item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const colX = i * 170;

            const labelText = new Konva.Text({
                x: colX,
                y: 0,
                width: 120,
                text: item.label + ' (click to type)',
                fontSize: 13,
                fill: '#ffffff',
                align: 'center',
            });
            this.answersGroup.add(labelText);

            const boxGroup = new Konva.Group({ x: colX + 20, y: 25 });
            const boxRect = new Konva.Rect({
                width: 80,
                height: 45,
                fill: '#eeeeee',
                stroke: '#666666',
                strokeWidth: 2,
            });
            boxGroup.add(boxRect);
            this.guessBoxRects[item.id] = boxRect;

            const currentGuess = guesses[item.id];
            let displayString = '?';
            if (currentGuess !== null && currentGuess !== undefined) {
                displayString = String(currentGuess);
                this.typedInputs[item.id] = displayString;
            }

            const valText = new Konva.Text({
                width: 80,
                y: 13,
                text: displayString,
                fontSize: 20,
                fill: '#111111',
                align: 'center',
            });
            boxGroup.add(valText);
            this.guessValueTexts[item.id] = valText;

            boxGroup.on('click tap', () => {
                this.selectInputBox(item.id);
            });

            this.answersGroup.add(boxGroup);
        }

        const layer = this.rootGroup.getLayer();
        if (layer !== null) {
            layer.batchDraw();
        }
    }

    public updateGuessDisplay(itemId: ItemId, rawText: string): void {
        const textNode = this.guessValueTexts[itemId];
        if (textNode !== null) {
            if (rawText === '') {
                textNode.text('?');
            } else {
                textNode.text(rawText);
            }
            const layer = this.rootGroup.getLayer();
            if (layer !== null) {
                layer.batchDraw();
            }
        }
    }

    public updateStatsDisplay(defense: number, maxHp: number): void {
        this.statsText.text('Defense: ' + defense + '\nMax HP: ' + maxHp);
        const layer = this.rootGroup.getLayer();
        if (layer !== null) {
            layer.batchDraw();
        }
    }

    public showFeedback(result: ValidationResult): void {
        this.feedbackText.text(result.message);
        const layer = this.rootGroup.getLayer();
        if (layer !== null) {
            layer.batchDraw();
        }
    }

    public onSelectDifficulty(callback: (difficulty: Difficulty) => void): void {
        this.difficultyCallback = callback;
    }

    public onTypeGuess(callback: (itemId: ItemId, rawText: string) => void): void {
        this.typeGuessCallback = callback;
    }

    public onSubmitForge(callback: () => void): void {
        this.submitForgeCallback = callback;
    }

    public onBackToMap(callback: () => void): void {
        this.backToMapCallback = callback;
    }
}