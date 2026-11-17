import Konva from 'konva';
import {
    Difficulty,
    ForgeEquation,
    ForgeItem,
    ItemId,
    ValidationResult,
} from './BlacksmithModel';

import clickSoundUrl from './assets/click-tap.wav';
import successSoundUrl from './assets/success.wav';
import failSoundUrl from './assets/fail.mp3';

import featherImgUrl from './assets/feather.png';
import potionImgUrl from './assets/potion.png';
import ingotImgUrl from './assets/ingot.png';

const ITEM_IMAGES: Record<ItemId, string> = {
    feather: featherImgUrl,
    potion: potionImgUrl,
    ingot: ingotImgUrl,
};

// Gothic classroom theme constants
const FONT_FAMILY = 'Georgia, serif';
const COLOR_BG = '#181412';
const COLOR_CHALKBOARD = '#1b3324';
const COLOR_WOOD_BORDER = '#6b4423';
const COLOR_BTN_FILL = '#6e5438';
const COLOR_BTN_BORDER = '#d9c5a0';
const COLOR_ACTIVE_GLOW = '#e09f3e';
const COLOR_PARCHMENT = '#e8dcc5';
const COLOR_CREAM_TEXT = '#f5e6c8';

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
 * BlacksmithView - Konva view for the blacksmith minigame.
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
    private difficultyRects: Record<Difficulty, Konva.Rect | null> = {
        easy: null,
        medium: null,
        hard: null,
    };

    // listener variables
    private difficultyCallback: ((difficulty: Difficulty) => void) | null = null;
    private typeGuessCallback: ((itemId: ItemId, rawText: string) => void) | null = null;
    private submitForgeCallback: (() => void) | null = null;
    private backToMapCallback: (() => void) | null = null;

    constructor(layer: Konva.Layer, width: number = 960, height: number = 600) {
        this.rootGroup = new Konva.Group({ x: 0, y: 0 });
        layer.add(this.rootGroup);

        // Dark wood background
        const bg = new Konva.Rect({
            x: 0,
            y: 0,
            width: width,
            height: height,
            fill: COLOR_BG,
        });
        this.rootGroup.add(bg);

        // Title text
        const title = new Konva.Text({
            x: width / 2 - 140,
            y: 20,
            width: 280,
            text: 'ARMOR FORGE',
            fontFamily: FONT_FAMILY,
            fontSize: 28,
            fontStyle: 'bold',
            fill: COLOR_CREAM_TEXT,
            shadowColor: '#000000',
            shadowBlur: 4,
            align: 'center',
        });
        this.rootGroup.add(title);

        // Back to Map button
        const backBtn = this.createButton(20, 20, 120, 36, 'Back to Map');
        backBtn.on('click tap', () => {
            this.playSound(clickSoundUrl);
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

            const rectNode = btn.findOne('Rect') as Konva.Rect;
            this.difficultyRects[diff] = rectNode;

            btn.on('click tap', () => {
                this.playSound(clickSoundUrl);
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
            fill: COLOR_CHALKBOARD,
            stroke: COLOR_WOOD_BORDER,
            strokeWidth: 8,
            cornerRadius: 6,
        });
        this.rootGroup.add(chalkboard);

        this.boardGroup = new Konva.Group({ x: 200, y: 105 });
        this.rootGroup.add(this.boardGroup);

        // Simple player stats display
        this.statsText = new Konva.Text({
            x: 725,
            y: 120,
            width: 200,
            text: 'Defense: 0\nMax HP: 100',
            fontFamily: FONT_FAMILY,
            fontSize: 18,
            fill: COLOR_CREAM_TEXT,
        });
        this.rootGroup.add(this.statsText);

        // Group to hold clickable answer input boxes
        this.answersGroup = new Konva.Group({ x: 180, y: 340 });
        this.rootGroup.add(this.answersGroup);

        // Submit button
        const forgeBtn = this.createButton(width / 2 - 90, 485, 180, 44, 'FORGE ARMOR');
        forgeBtn.on('click tap', () => {
            if (this.submitForgeCallback !== null) {
                this.submitForgeCallback();
            }
        });
        this.rootGroup.add(forgeBtn);

        // Bottom feedback text
        this.feedbackText = new Konva.Text({
            x: 180,
            y: 545,
            width: 600,
            text: '',
            fontFamily: FONT_FAMILY,
            fontSize: 16,
            fill: COLOR_CREAM_TEXT,
            align: 'center',
        });
        this.rootGroup.add(this.feedbackText);

        this.setupKeyboardInput();
    }

    private playSound(soundPath: string): void {
        if (typeof Audio === 'undefined') {
            return;
        }
        try {
            const sound = new Audio(soundPath);
            sound.play();
        } catch {
            // Ignore audio errors in tests
        }
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
            fill: COLOR_BTN_FILL,
            stroke: COLOR_BTN_BORDER,
            strokeWidth: 2,
            cornerRadius: 6,
        });

        const text = new Konva.Text({
            width: width,
            y: height / 2 - 7,
            text: label,
            fontFamily: FONT_FAMILY,
            fontSize: 14,
            fontStyle: 'bold',
            fill: COLOR_CREAM_TEXT,
            align: 'center',
        });

        group.add(rect);
        group.add(text);
        return group;
    }

    private selectInputBox(itemId: ItemId): void {
        this.playSound(clickSoundUrl);
        this.selectedItem = itemId;

        const allIds: ItemId[] = ['feather', 'potion', 'ingot'];
        for (let i = 0; i < allIds.length; i++) {
            const id = allIds[i];
            const rect = this.guessBoxRects[id];
            if (rect !== null) {
                if (id === itemId) {
                    rect.stroke(COLOR_ACTIVE_GLOW);
                    rect.strokeWidth(3);
                } else {
                    rect.stroke('#5c3d24');
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
        difficulty: Difficulty,
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

        // Highlight the active difficulty button
        const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];
        for (let i = 0; i < difficulties.length; i++) {
            const diff = difficulties[i];
            const rect = this.difficultyRects[diff];
            if (rect !== null) {
                if (diff === difficulty) {
                    rect.stroke(COLOR_ACTIVE_GLOW);
                    rect.strokeWidth(3);
                } else {
                    rect.stroke(COLOR_BTN_BORDER);
                    rect.strokeWidth(2);
                }
            }
        }

        // Draw equation rows on the chalkboard
        for (let i = 0; i < equations.length; i++) {
            const eq = equations[i];
            const rowY = i * 65;

            let cursorX = 110;
            if (eq.terms.length === 3) {
                cursorX = 65;
            }

            for (let j = 0; j < eq.terms.length; j++) {
                const termId = eq.terms[j];

                if (j > 0) {
                    const opText = new Konva.Text({
                        x: cursorX,
                        y: rowY + 8,
                        width: 35,
                        text: eq.operator,
                        fontFamily: FONT_FAMILY,
                        fontSize: 24,
                        fontStyle: 'bold',
                        fill: COLOR_CREAM_TEXT,
                        align: 'center',
                    });
                    this.boardGroup.add(opText);
                    cursorX += 35;
                }

                // Save x position for this icon and use Konva.Image.fromURL to draw it
                const iconX = cursorX;
                Konva.Image.fromURL(ITEM_IMAGES[termId], (imgNode) => {
                    imgNode.setAttrs({
                        x: iconX,
                        y: rowY,
                        width: 40,
                        height: 40,
                        image: undefined
                    });
                    this.boardGroup.add(imgNode);
                });
                cursorX += 40;
            }

            const sumText = new Konva.Text({
                x: cursorX + 10,
                y: rowY + 8,
                text: '= ' + String(eq.targetSum),
                fontFamily: FONT_FAMILY,
                fontSize: 24,
                fontStyle: 'bold',
                fill: COLOR_CREAM_TEXT,
            });
            this.boardGroup.add(sumText);
        }

        // Draw a clickable text input box for each active item
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const colX = i * 185;

            // Draw small icon above the input label
            Konva.Image.fromURL(ITEM_IMAGES[item.id], (imgNode) => {
                imgNode.setAttrs({
                    x: colX + 64,
                    y: 0,
                    width: 32,
                    height: 32,
                    image: undefined
                });
                this.answersGroup.add(imgNode);
            });

            const labelText = new Konva.Text({
                x: colX,
                y: 36,
                width: 160,
                text: item.label + ' (click to type)',
                fontFamily: FONT_FAMILY,
                fontSize: 13,
                fill: COLOR_CREAM_TEXT,
                align: 'center',
            });
            this.answersGroup.add(labelText);

            const boxGroup = new Konva.Group({ x: colX + 40, y: 58 });
            const boxRect = new Konva.Rect({
                width: 80,
                height: 45,
                fill: COLOR_PARCHMENT,
                stroke: '#5c3d24',
                strokeWidth: 2,
                cornerRadius: 4,
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
                y: 12,
                text: displayString,
                fontFamily: FONT_FAMILY,
                fontSize: 20,
                fontStyle: 'bold',
                fill: '#2b1d0e',
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

        if (result.isValid) {
            this.playSound(successSoundUrl);
        } else {
            this.playSound(failSoundUrl);
        }

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