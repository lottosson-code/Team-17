import Phaser from 'phaser';
import { LANE_BORDERS, LANE_END_X, columnX, floorRowY, perspectiveBox } from '../laneLayout';
import { LANE_COUNT } from '../types';
import { DEPTH, deskShape, type BattlefieldTheme, type Point } from './theme';
import { TEX } from './textures';

// The room behind the fight: walls, windows, chalkboard, floor, lanes, the wizard's desk, lights
// and drifting air. Everything that moves is driven from update(); the scene calls the reaction
// methods (gust, setBossMood, setLaneDanger, setLowHealth, writeOnBoard) when game events happen.
// The floor, lanes and desk all use the perspective in laneLayout.ts, so they line up.
// The room is drawn in code for now; painted layers can replace each part without changing the API.

interface Candle {
    flame: Phaser.GameObjects.Image;
    halo: Phaser.GameObjects.Image;
    scale: number;
    seed: number;
}

interface FlowDot {
    image: Phaser.GameObjects.Image;
    y: number;
    left: number; // Where this border line ends at the wizard
    right: number; // Where it starts, just off the right edge
    offset: number;
}

const SCREEN_W = 1280;
const SCREEN_H = 720;
/** Lane energy drifts toward the wizard at this speed (px per ms). */
const FLOW_SPEED = 0.09;
/** Width of one floor tile, measured on the reference row. */
const TILE = 140;

/** Smooth pseudo-random wobble in about -1..1, for flickering lights. */
function flicker(time: number, seed: number): number {
    return 0.5 * Math.sin(time * 0.013 + seed) + 0.3 * Math.sin(time * 0.031 + seed * 2.1) + 0.2 * Math.sin(time * 0.077 + seed * 3.7);
}

const vec = (p: Point) => new Phaser.Math.Vector2(p.x, p.y);

export class Battlefield {
    private readonly borders = LANE_BORDERS;
    private candles: Candle[] = [];
    private flowDots: FlowDot[] = [];
    private dangerBands: Phaser.GameObjects.Graphics[] = [];
    private danger: number[] = new Array(LANE_COUNT).fill(0);
    private clouds: Phaser.GameObjects.Ellipse[] = [];
    private boardTexts: Phaser.GameObjects.Text[] = [];

    private laneFlare!: Phaser.GameObjects.Graphics;
    private moon!: Phaser.GameObjects.Arc;
    private moonGlow!: Phaser.GameObjects.Image;
    private windowFlash!: Phaser.GameObjects.Graphics;
    private darken!: Phaser.GameObjects.Rectangle;
    private lowHealth!: Phaser.GameObjects.Image;

    private gustUntil = 0;
    private bossMood = false;
    private nextLightningAt = 0;
    private lowHealthLevel = 0;

    constructor(private readonly scene: Phaser.Scene, private readonly theme: BattlefieldTheme) {
        this.drawWall();
        this.drawWindows();
        this.drawShelfAndBoard();
        this.drawFloor();
        this.drawLanes();
        this.drawDesk();
        this.addCandles();
        this.addAir();
        this.addOverlays();
    }

    update(time: number): void {
        for (const candle of this.candles) {
            const gusting = time < this.gustUntil;
            const wobble = flicker(time, candle.seed);
            const amount = gusting ? 0.45 : 0.12;
            candle.halo.setAlpha(0.32 * (1 + amount * wobble));
            candle.halo.setScale(2.6 * candle.scale * (1 + 0.04 * wobble));
            candle.flame.setScale(0.11 * candle.scale, (0.2 + 0.03 * wobble) * candle.scale);
            candle.flame.setAngle(gusting ? -18 + 10 * wobble : 3 * wobble);
        }

        for (const dot of this.flowDots) {
            const span = dot.right - dot.left;
            const travelled = (time * FLOW_SPEED + dot.offset) % span;
            dot.image.setPosition(dot.right - travelled, dot.y);
            // Fade in at the far end and out near the wizard.
            dot.image.setAlpha(0.85 * Math.min(1, travelled / 120, (span - travelled) / 120));
        }

        const pulse = 0.65 + 0.35 * Math.sin(time * 0.012);
        this.dangerBands.forEach((band, lane) => band.setAlpha(this.danger[lane] * pulse));

        for (const cloud of this.clouds) {
            cloud.x += (cloud.getData('speed') as number) * 0.2;
            const window = this.theme.windows[cloud.getData('window') as number];
            if (cloud.x - cloud.width / 2 > window.x + window.w) cloud.x = window.x - cloud.width / 2;
        }
        this.moonGlow.setAlpha(0.55 + 0.1 * Math.sin(time * 0.0015));

        this.lowHealth.setAlpha(this.lowHealthLevel * (0.55 + 0.45 * Math.sin(time * 0.006)));

        if (this.bossMood && time > this.nextLightningAt) {
            this.flashWindows();
            this.nextLightningAt = time + Phaser.Math.Between(1400, 3400);
        }
    }

    /** A wave starts: candles gutter and the lanes flare. */
    gust(): void {
        this.gustUntil = this.scene.time.now + 1600;
        this.scene.tweens.killTweensOf(this.laneFlare);
        this.laneFlare.setAlpha(1);
        this.scene.tweens.add({ targets: this.laneFlare, alpha: 0, duration: 1100, ease: 'Quad.easeOut' });
    }

    /** The boss is here: the room darkens, the moon turns red, lightning flashes behind the windows. */
    setBossMood(on: boolean): void {
        this.bossMood = on;
        this.scene.tweens.add({ targets: this.darken, alpha: on ? 0.4 : 0, duration: 700 });
        this.moon.setFillStyle(on ? 0xff6b6b : 0xf3ecff);
        this.moonGlow.setTint(on ? 0xff4d4d : this.theme.colors.moonlight);
        if (on) this.flashWindows();
    }

    /** 0 = safe, 1 = an enemy is about to reach the wizard, per lane. */
    setLaneDanger(levels: readonly number[]): void {
        this.danger = levels.map(level => Phaser.Math.Clamp(level, 0, 1));
    }

    /** 0 = healthy, 1 = nearly dead; pulses red at the screen edges. */
    setLowHealth(level: number): void {
        this.lowHealthLevel = Phaser.Math.Clamp(level, 0, 1);
    }

    /** Rewrites the chalkboard, letter by letter. */
    writeOnBoard(lines: string[]): void {
        const board = this.theme.chalkboard;
        for (const old of this.boardTexts) {
            this.scene.tweens.add({ targets: old, alpha: 0, duration: 300, onComplete: () => old.destroy() });
        }
        this.boardTexts = lines.map((line, i) => {
            const text = this.scene.add.text(board.x + 22 + (i % 2) * 18, board.y + 16 + i * 36, '', {
                fontFamily: 'Lora', fontSize: '24px', fontStyle: 'italic', color: '#eaf4ee',
            }).setAlpha(0.82).setAngle(-2 + i).setDepth(DEPTH.room + 6);
            let shown = 0;
            this.scene.time.addEvent({
                delay: 45, repeat: line.length - 1, startAt: -400 - i * 350,
                callback: () => text.setText(line.slice(0, ++shown)),
            });
            return text;
        });
    }

    // ------------------------------------------------------------ room

    private drawWall(): void {
        const { colors, wallBottom } = this.theme;
        const g = this.scene.add.graphics().setDepth(DEPTH.room);
        g.fillGradientStyle(colors.wallTop, colors.wallTop, colors.wallBottom, colors.wallBottom, 1);
        g.fillRect(0, 0, SCREEN_W, wallBottom);
        // Faint wall panels.
        g.lineStyle(2, 0x000000, 0.18);
        for (let x = 80; x < SCREEN_W; x += 150) g.lineBetween(x, 0, x, wallBottom - 30);
        // Wainscot along the bottom of the wall.
        g.fillStyle(0x221630).fillRect(0, wallBottom - 30, SCREEN_W, 30);
        g.lineStyle(3, 0x6a4c86, 0.8).lineBetween(0, wallBottom - 30, SCREEN_W, wallBottom - 30);
        g.lineStyle(2, 0x000000, 0.35);
        for (let x = 40; x < SCREEN_W; x += 70) g.strokeRect(x, wallBottom - 24, 52, 18);

        // Desks pushed against the back wall.
        for (const x of [600, 700, 1050]) {
            g.fillStyle(0x1d1428).fillRect(x, wallBottom - 18, 74, 9);
            g.fillRect(x + 4, wallBottom - 9, 5, 18).fillRect(x + 65, wallBottom - 9, 5, 18);
            g.fillStyle(0x281c35).fillRect(x + 22, wallBottom - 36, 30, 20);
        }

        // Notes pinned to the wall, swaying slightly.
        for (const [x, y, angle] of [[120, 70, -8], [640, 62, 6], [760, 96, -4], [1110, 172, 9]]) {
            const note = this.scene.add.image(x, y, TEX.paper).setScale(1.6).setAngle(angle).setDepth(DEPTH.room + 2).setTint(0xb8a9cc);
            this.scene.tweens.add({
                targets: note, angle: angle + 4, duration: Phaser.Math.Between(1800, 2600),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            });
        }
    }

    private drawWindows(): void {
        const { windows, moon, colors } = this.theme;
        const g = this.scene.add.graphics().setDepth(DEPTH.room + 1);
        for (const w of windows) {
            g.fillStyle(0x140d1c).fillRect(w.x - 9, w.y - 9, w.w + 18, w.h + 18);
            g.fillGradientStyle(0x2a2a78, 0x2a2a78, 0x8a62d0, 0x8a62d0, 1).fillRect(w.x, w.y, w.w, w.h);
        }

        this.moonGlow = this.scene.add.image(moon.x, moon.y, TEX.glow)
            .setTint(colors.moonlight).setScale(1.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.room + 1);
        this.moon = this.scene.add.circle(moon.x, moon.y, moon.r, 0xf3ecff).setDepth(DEPTH.room + 1);

        // Clouds drift across the windows, clipped to the glass.
        const glass = this.scene.make.graphics({}, false);
        glass.fillStyle(0xffffff);
        for (const w of windows) glass.fillRect(w.x, w.y, w.w, w.h);
        const mask = glass.createGeometryMask();
        windows.forEach((w, i) => {
            for (let c = 0; c < 2; c++) {
                const cloud = this.scene.add.ellipse(w.x + c * w.w * 0.6, w.y + 24 + c * 30, 90, 22, 0x2a1d4a, 0.85)
                    .setDepth(DEPTH.room + 1).setMask(mask);
                cloud.setData('speed', 0.6 + c * 0.5 + i * 0.3).setData('window', i);
                this.clouds.push(cloud);
            }
        });

        // Window frames drawn over the glass and clouds.
        const frames = this.scene.add.graphics().setDepth(DEPTH.room + 2);
        for (const w of windows) {
            frames.lineStyle(7, 0x140d1c).strokeRect(w.x, w.y, w.w, w.h);
            frames.lineStyle(5, 0x140d1c).lineBetween(w.x + w.w / 2, w.y, w.x + w.w / 2, w.y + w.h);
            frames.lineBetween(w.x, w.y + w.h * 0.45, w.x + w.w, w.y + w.h * 0.45);
            frames.fillStyle(0x2c1f38).fillRect(w.x - 14, w.y + w.h + 6, w.w + 28, 8);
        }

        this.windowFlash = this.scene.add.graphics().setDepth(DEPTH.room + 3).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        this.windowFlash.fillStyle(0xd9ccff);
        for (const w of windows) this.windowFlash.fillRect(w.x, w.y, w.w, w.h);

        // Moonlight falling through the big window onto the floor.
        const main = windows[0];
        const beam = this.scene.add.graphics().setDepth(DEPTH.lanes - 1).setBlendMode(Phaser.BlendModes.ADD);
        beam.fillStyle(colors.moonlight, 0.07);
        beam.fillPoints([
            new Phaser.Math.Vector2(main.x, main.y + main.h),
            new Phaser.Math.Vector2(main.x + main.w, main.y + main.h),
            new Phaser.Math.Vector2(main.x + main.w + 330, 520),
            new Phaser.Math.Vector2(main.x + 90, 520),
        ], true);
        this.scene.tweens.add({ targets: beam, alpha: 0.6, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    private drawShelfAndBoard(): void {
        const { shelf, chalkboard: board } = this.theme;
        const g = this.scene.add.graphics().setDepth(DEPTH.room + 4);

        // Bookshelf.
        g.fillStyle(0x2c1d28).fillRect(shelf.x, shelf.y, shelf.w, shelf.h);
        const bookColors = [0x8e2f3b, 0x2f5d8e, 0x6b4f9e, 0x9a7a2e, 0x2e7a5c, 0x7a3b6b];
        for (let row = 0; row < 3; row++) {
            const y = shelf.y + 8 + row * 42;
            let x = shelf.x + 6;
            let i = row * 2;
            while (x < shelf.x + shelf.w - 12) {
                const width = 8 + ((i * 7) % 6);
                const height = 26 + ((i * 5) % 9);
                g.fillStyle(bookColors[i % bookColors.length]).fillRect(x, y + 34 - height, width, height);
                x += width + 2;
                i++;
            }
            g.fillStyle(0x47303c).fillRect(shelf.x, y + 34, shelf.w, 6);
        }

        // Chalkboard.
        g.fillStyle(0x4a2f1f).fillRect(board.x - 10, board.y - 10, board.w + 20, board.h + 20);
        g.fillGradientStyle(0x22423a, 0x22423a, 0x162c27, 0x162c27, 1).fillRect(board.x, board.y, board.w, board.h);
        g.fillStyle(0xffffff, 0.04).fillEllipse(board.x + board.w * 0.35, board.y + board.h * 0.5, 160, 60);
        g.fillStyle(0xffffff, 0.03).fillEllipse(board.x + board.w * 0.75, board.y + board.h * 0.3, 120, 40);
        g.fillStyle(0x5b3b27).fillRect(board.x - 6, board.y + board.h + 4, board.w + 12, 7);
        g.fillStyle(0xf2efe6).fillRect(board.x + 30, board.y + board.h, 16, 4);
        this.writeOnBoard(board.lines);
    }

    private drawFloor(): void {
        const { colors, wallBottom, floorBottom } = this.theme;
        const g = this.scene.add.graphics().setDepth(DEPTH.floor);
        g.fillGradientStyle(colors.floorBack, colors.floorBack, colors.floorFront, colors.floorFront, 1);
        g.fillRect(0, wallBottom, SCREEN_W, floorBottom - wallBottom);

        // Worn highlights on alternate flagstones, in a checkerboard.
        g.fillStyle(0xffffff, 0.03);
        for (let t = -1; t < 9; t++) {
            for (let k = -6; k < 10; k++) {
                if ((t + k) % 2 !== 0) continue;
                const top = Math.max(wallBottom, floorRowY(t * 0.5));
                const bottom = Math.min(floorBottom, floorRowY(t * 0.5 + 0.5));
                if (bottom > top) this.fillFloorQuad(g, LANE_END_X + k * TILE, LANE_END_X + (k + 1) * TILE, top, bottom);
            }
        }

        // Tile seams: two rows per lane at equal depth steps (so lane borders fall on seams),
        // and columns that converge on the vanishing point (one of them is where the lanes end).
        g.lineStyle(2, 0x000000, 0.22);
        for (let t = -2; t < 8; t += 0.5) {
            const y = floorRowY(t);
            if (y > wallBottom && y < floorBottom) g.lineBetween(0, y, SCREEN_W, y);
        }
        for (let k = -8; k <= 12; k++) {
            const refX = LANE_END_X + k * TILE;
            g.lineBetween(columnX(refX, floorBottom), floorBottom, columnX(refX, wallBottom), wallBottom);
        }

        // Pools of light: warm candlelight near the desk, cool moonlight further back.
        this.scene.add.image(320, 520, TEX.glow).setTint(colors.candle).setScale(5, 2.4).setAlpha(0.22)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floor + 1);
        this.scene.add.image(560, 380, TEX.glow).setTint(colors.moonlight).setScale(7, 2).setAlpha(0.16)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.floor + 1);
    }

    private drawLanes(): void {
        const { colors } = this.theme;
        const first = this.borders[0];
        const last = this.borders[LANE_COUNT];
        // Every line of the lane grid: the borders, which run off the right edge (where enemies
        // come from), and the end line by the wizard, which runs into the room like a tile seam.
        const segments: [number, number, number, number][] = this.borders.map(y => [
            columnX(LANE_END_X, y), y, SCREEN_W + 20, y,
        ]);
        segments.push([columnX(LANE_END_X, first), first, columnX(LANE_END_X, last), last]);

        const drawLines = (g: Phaser.GameObjects.Graphics, strength: number) => {
            for (const [x1, y1, x2, y2] of segments) {
                g.lineStyle(14, colors.lane, 0.08 * strength).lineBetween(x1, y1, x2, y2);
                g.lineStyle(6, colors.lane, 0.3 * strength).lineBetween(x1, y1, x2, y2);
                g.lineStyle(2, colors.laneCore, 0.85 * strength).lineBetween(x1, y1, x2, y2);
            }
            // Bright corners where the wizard's end line meets the outer borders.
            for (const y of [first, last]) {
                g.fillStyle(colors.laneCore, Math.min(1, 0.9 * strength)).fillCircle(columnX(LANE_END_X, y), y, 3.5);
            }
        };

        // Red warning zones by the wizard, one per lane, faded in by setLaneDanger.
        for (let lane = 0; lane < LANE_COUNT; lane++) {
            const top = this.borders[lane];
            const bottom = this.borders[lane + 1];
            const band = this.scene.add.graphics().setDepth(DEPTH.danger).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
            const strips = 7;
            for (let k = 0; k < strips; k++) {
                band.fillStyle(colors.danger, 0.5 * (1 - k / strips));
                this.fillFloorQuad(band, LANE_END_X + k * 70, LANE_END_X + (k + 1) * 70, top, bottom);
            }
            this.dangerBands.push(band);
        }

        const lines = this.scene.add.graphics().setDepth(DEPTH.lanes).setBlendMode(Phaser.BlendModes.ADD);
        drawLines(lines, 1);
        this.scene.tweens.add({ targets: lines, alpha: 0.7, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.laneFlare = this.scene.add.graphics().setDepth(DEPTH.lanes).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
        drawLines(this.laneFlare, 2.5);

        // Sparks of energy that run along each border toward the wizard.
        this.borders.forEach((y, i) => {
            const left = columnX(LANE_END_X, y);
            const right = SCREEN_W + 30;
            for (let d = 0; d < 3; d++) {
                const image = this.scene.add.image(0, y, TEX.glow).setTint(colors.laneCore).setScale(0.45, 0.07)
                    .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.lanes + 1);
                this.flowDots.push({ image, y, left, right, offset: (d / 3) * (right - left) + i * 97 });
            }
        });
    }

    /** Fills the floor between two columns (named by their x on the reference row) and two rows. */
    private fillFloorQuad(g: Phaser.GameObjects.Graphics, refLeft: number, refRight: number, top: number, bottom: number): void {
        g.fillPoints([
            new Phaser.Math.Vector2(columnX(refLeft, top), top), new Phaser.Math.Vector2(columnX(refRight, top), top),
            new Phaser.Math.Vector2(columnX(refRight, bottom), bottom), new Phaser.Math.Vector2(columnX(refLeft, bottom), bottom),
        ], true);
    }

    /** The wizard's teacher's desk: a box in the floor's perspective, with things on top. */
    private drawDesk(): void {
        const desk = deskShape(this.theme);
        const spec = this.theme.desk;
        const top = spec.bottom - spec.height;
        const g = this.scene.add.graphics().setDepth(DEPTH.desk);

        // Shadow cast back and to the right on the floor.
        this.scene.add.image(desk.right[2].x + 20, spec.bottom - 50, TEX.glow).setTint(0x000000).setAlpha(0.55)
            .setScale(3.4, 1.6).setDepth(DEPTH.desk - 1);

        // Right side, with an inset panel that follows the perspective.
        g.fillStyle(0x2b170f).fillPoints(desk.right.map(vec), true);
        // The side face of a slightly shorter box, pulled in from the front and back edges.
        const [ftr, btr, bbr, fbr] = perspectiveBox({ left: spec.right, right: spec.right, bottom: spec.bottom - 14, height: spec.height - 30 }, spec.depth).right;
        const along = (a: Point, b: Point, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        const panel = [along(ftr, btr, 0.15), along(ftr, btr, 0.85), along(fbr, bbr, 0.85), along(fbr, bbr, 0.15)];
        g.lineStyle(2, 0x000000, 0.45).strokePoints(panel.map(vec), true);

        // Top: polished wood with a green leather blotter and a light edge.
        g.fillStyle(0x7d4e2d).fillPoints(desk.top.map(vec), true);
        const blotter = [desk.topPoint(0.08, 0.16), desk.topPoint(0.64, 0.16), desk.topPoint(0.64, 0.86), desk.topPoint(0.08, 0.86)];
        g.fillStyle(0x2f5a42).fillPoints(blotter.map(vec), true);
        g.lineStyle(2, 0x1c3a2a).strokePoints(blotter.map(vec), true);
        g.lineStyle(3, 0xb07a48, 0.9).lineBetween(desk.top[0].x, top, desk.top[1].x, top);
        g.lineStyle(2, 0xb07a48, 0.6).lineBetween(desk.top[1].x, top, desk.top[2].x, desk.top[2].y);

        // Front: a thick top edge, a carved modesty panel on the left, a pedestal of drawers on the right.
        g.fillGradientStyle(0x5c3621, 0x5c3621, 0x2a170d, 0x2a170d, 1).fillRect(spec.left, top, spec.right - spec.left, spec.height);
        g.fillStyle(0x8c5a34).fillRect(spec.left - 4, top, spec.right - spec.left + 4, 10);
        g.lineStyle(2, 0x000000, 0.5).lineBetween(spec.left - 4, top + 10, spec.right, top + 10);
        const pedestal = spec.left + (spec.right - spec.left) * 0.62;
        g.lineStyle(3, 0x1a0d07, 0.8).lineBetween(pedestal, top + 10, pedestal, spec.bottom);
        g.lineStyle(2, 0x000000, 0.35).strokeRect(spec.left + 14, top + 22, pedestal - spec.left - 28, spec.height - 40);
        g.lineStyle(1.5, 0xb07a48, 0.35).strokeRect(spec.left + 20, top + 28, pedestal - spec.left - 40, spec.height - 52);
        const drawerH = (spec.height - 22) / 3;
        for (let d = 0; d < 3; d++) {
            const y = top + 14 + d * drawerH;
            g.fillStyle(0x6a3f24).fillRect(pedestal + 8, y, spec.right - pedestal - 16, drawerH - 8);
            g.lineStyle(2, 0x000000, 0.45).strokeRect(pedestal + 8, y, spec.right - pedestal - 16, drawerH - 8);
            g.fillStyle(0xe0b54e).fillCircle((pedestal + spec.right) / 2, y + (drawerH - 8) / 2, 4);
        }

        // Teal banner with a star hanging over the modesty panel.
        const bx = spec.left + 60;
        g.fillStyle(0x1f5f63).fillRect(bx, top + 6, 64, 92);
        g.fillTriangle(bx, top + 98, bx + 32, top + 82, bx + 64, top + 98);
        g.lineStyle(2, 0xd8b45a).strokeRect(bx + 4, top + 10, 56, 72);
        g.fillStyle(0x7ff0ff).fillPoints(starPoints(bx + 32, top + 44, 15, 6.5), true);

        // Things on the desk, in the same perspective. Behind the wizard: books and an inkwell.
        const behind = this.scene.add.graphics().setDepth(DEPTH.desk + 0.1);
        const stack = desk.topPoint(0.16, 0.72);
        [0x7d2531, 0x2d4f7a, 0x6e5a2a].forEach((color, i) => {
            const width = 50 - i * 6;
            const book = perspectiveBox({
                left: stack.x - width / 2 + i * 3, right: stack.x + width / 2 + i * 3, bottom: stack.y - i * 10, height: 10,
            }, 0.035);
            behind.fillStyle(color).fillPoints(book.front.map(vec), true);
            behind.fillStyle(Phaser.Display.Color.ValueToColor(color).lighten(15).color).fillPoints(book.top.map(vec), true);
            behind.fillStyle(0xe9dfc8).fillPoints(book.right.map(vec), true);
        });
        const ink = desk.topPoint(0.8, 0.78);
        const inkwell = perspectiveBox({ left: ink.x - 8, right: ink.x + 8, bottom: ink.y, height: 14 }, 0.02);
        behind.fillStyle(0x1a1a2e).fillPoints(inkwell.front.map(vec), true);
        behind.fillStyle(0x2c2c48).fillPoints(inkwell.top.map(vec), true);
        behind.lineStyle(3, 0xf2efe6).lineBetween(ink.x + 2, ink.y - 14, ink.x + 18, ink.y - 46);
        behind.lineStyle(6, 0xf2efe6, 0.6).lineBetween(ink.x + 10, ink.y - 30, ink.x + 18, ink.y - 46);

        // In front of the wizard: an apple for the teacher.
        const front = this.scene.add.graphics().setDepth(DEPTH.wizard + 0.1);
        const apple = desk.topPoint(0.86, 0.22);
        front.fillStyle(0xc0242f).fillCircle(apple.x, apple.y - 9, 10);
        front.fillStyle(0xffffff, 0.45).fillCircle(apple.x - 4, apple.y - 13, 3);
        front.lineStyle(2.5, 0x4a2c16).lineBetween(apple.x, apple.y - 18, apple.x + 2, apple.y - 24);
        front.fillStyle(0x3fa34d).fillEllipse(apple.x + 7, apple.y - 22, 9, 5);

        // Foreground clutter in the bottom-right corner, in front of everything on the battlefield.
        const fg = this.scene.add.graphics().setDepth(DEPTH.foreground);
        [[1150, 606, 120, 22, 0x5a2430], [1162, 584, 100, 22, 0x2c3e66], [1156, 562, 108, 22, 0x6e5a2a]].forEach(([x, bottom, width, h, color]) => {
            // Close to the camera and below the vanishing point's height, so only a sliver of top shows.
            const book = perspectiveBox({ left: x, right: x + width, bottom, height: h }, 0.012);
            fg.fillStyle(color).fillPoints(book.front.map(vec), true);
            fg.fillStyle(Phaser.Display.Color.ValueToColor(color).lighten(15).color).fillPoints(book.top.map(vec), true);
            fg.lineStyle(2, 0x000000, 0.5).strokePoints(book.front.map(vec), true);
        });
        for (const [x, y, angle] of [[480, 584, 12], [780, 590, -20], [1000, 578, 35]]) {
            this.scene.add.image(x, y, TEX.paper).setScale(1.4, 0.8).setAngle(angle).setTint(0xb7a7a0).setDepth(DEPTH.foreground);
        }
    }

    private addCandles(): void {
        const { candles, colors } = this.theme;
        const wall = this.scene.add.graphics().setDepth(DEPTH.room + 5);
        candles.forEach((c, i) => this.addCandle(wall, c, c.scale, DEPTH.room + 5, i * 1.7));

        // A candle on the back corner of the desk, behind the wizard.
        const desk = deskShape(this.theme);
        const onDesk = this.scene.add.graphics().setDepth(DEPTH.desk + 0.2);
        this.addCandle(onDesk, desk.topPoint(0.95, 0.62), 1, DEPTH.desk + 0.2, 5.1);

        // A lantern on the front-left corner of the desk.
        const lantern = desk.topPoint(0.06, 0.3);
        const lg = this.scene.add.graphics().setDepth(DEPTH.wizard + 0.2);
        lg.fillStyle(0x2b1d17).fillRect(lantern.x - 15, lantern.y - 6, 30, 6);
        lg.fillStyle(0xffc46b, 0.85).fillRect(lantern.x - 11, lantern.y - 40, 22, 34);
        lg.lineStyle(3, 0x2b1d17).strokeRect(lantern.x - 12, lantern.y - 40, 24, 34);
        lg.lineBetween(lantern.x, lantern.y - 40, lantern.x, lantern.y - 6);
        lg.fillStyle(0x2b1d17).fillTriangle(lantern.x - 15, lantern.y - 40, lantern.x + 15, lantern.y - 40, lantern.x, lantern.y - 54);
        lg.lineStyle(2.5, 0x2b1d17).strokeCircle(lantern.x, lantern.y - 59, 5);
        const halo = this.scene.add.image(lantern.x, lantern.y - 24, TEX.glow).setTint(colors.candle)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.wizard + 0.3);
        const flame = this.scene.add.image(lantern.x, lantern.y - 12, TEX.glow).setTint(0xffe2a0).setOrigin(0.5, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.wizard + 0.3);
        this.candles.push({ flame, halo, scale: 1.3, seed: 9.3 });
    }

    private addCandle(g: Phaser.GameObjects.Graphics, at: Point, scale: number, depth: number, seed: number): void {
        const h = 26 * scale;
        const w = 9 * scale;
        g.fillStyle(0xe8dcc0).fillRect(at.x - w / 2, at.y - h, w, h);
        g.fillStyle(0xcfc0a0).fillRect(at.x - w / 2 - 3 * scale, at.y - 4 * scale, w + 6 * scale, 4 * scale);
        const halo = this.scene.add.image(at.x, at.y - h - 6, TEX.glow).setTint(this.theme.colors.candle)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
        const flame = this.scene.add.image(at.x, at.y - h - 1, TEX.glow).setTint(0xffe2a0).setOrigin(0.5, 0.9)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.1);
        this.candles.push({ flame, halo, scale, seed });
    }

    private addAir(): void {
        const { colors, windows } = this.theme;
        const main = windows[0];
        // Dust motes glinting in the moonlight.
        this.scene.add.particles(0, 0, TEX.glow, {
            x: { min: main.x, max: main.x + main.w + 300 },
            y: { min: main.y + main.h, max: 520 },
            lifespan: 7000,
            frequency: 160,
            speedX: { min: -6, max: 10 },
            speedY: { min: -8, max: 4 },
            scale: { min: 0.02, max: 0.05 },
            alpha: { start: 0.55, end: 0 },
            tint: colors.moonlight,
            blendMode: Phaser.BlendModes.ADD,
        }).setDepth(DEPTH.air);

        // Loose pages drifting across the room.
        this.scene.add.particles(0, 0, TEX.paper, {
            x: SCREEN_W + 20,
            y: { min: 140, max: 540 },
            lifespan: 45000,
            frequency: 5200,
            speedX: { min: -38, max: -22 },
            speedY: { min: -6, max: 8 },
            rotate: { start: 0, end: 540 },
            scale: { min: 0.7, max: 1.1 },
            alpha: 0.6,
            tint: 0xc8bbd6,
        }).setDepth(DEPTH.air);
    }

    private addOverlays(): void {
        this.darken = this.scene.add.rectangle(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H, 0x0a0418)
            .setAlpha(0).setDepth(DEPTH.darken);
        this.scene.add.image(SCREEN_W / 2, SCREEN_H / 2, TEX.vignette).setDepth(DEPTH.vignette);
        this.lowHealth = this.scene.add.image(SCREEN_W / 2, SCREEN_H / 2, TEX.redEdge)
            .setAlpha(0).setDepth(DEPTH.vignette + 1);
    }

    private flashWindows(): void {
        this.scene.tweens.killTweensOf(this.windowFlash);
        this.windowFlash.setAlpha(0.9);
        this.scene.tweens.add({
            targets: this.windowFlash, alpha: 0, duration: 450, ease: 'Quad.easeIn',
            onUpdate: tween => {
                // A double flicker, like real lightning.
                if (tween.progress > 0.3 && tween.progress < 0.38) this.windowFlash.setAlpha(0.7);
            },
        });
    }
}

/** Points of a five-pointed star, for fillPoints. */
export function starPoints(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push(new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle)));
    }
    return points;
}
