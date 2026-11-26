import { perspectiveBox } from '../laneLayout';

// Look and layout of a battlefield. Everything the scene draws reads its positions and colours
// from a theme, so another module can reuse all the drawing code with different values and art.
// Coordinates are for the 1280x720 game; the floor perspective and lanes come from laneLayout.ts.

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** A walk cycle of equally sized frames, ordered left to right and top to bottom. */
export interface WalkAnimation {
    texture: string; // Spritesheet key, loaded from public/assets/combat/enemies/<file>.webp
    file: string;
    frames: number;
    frameWidth: number;
    frameHeight: number;
    stride: number; // Full-cycle travel in unscaled frame pixels
    faceLeft?: boolean; // True if the frames already face left (towards the wizard)
}

export interface EnemyArt {
    texture: string; // Texture key, loaded from public/assets/combat/enemies/<file>.webp
    file: string;
    name: string; // Display name
    height: number; // Drawn height in pixels at depth scale 1
    faceLeft?: boolean; // True if the art already faces left (towards the wizard)
    walk?: WalkAnimation; // Played while the enemy moves; otherwise the still art bobs instead
}

/** The wizard's teacher's desk: a box in the floor's perspective. */
export interface DeskSpec {
    left: number; // Front face, screen x
    right: number;
    bottom: number; // Front face bottom, screen y
    height: number;
    depth: number; // Fraction of the way to the vanishing point
    wizard: { u: number; v: number }; // Where the wizard stands on the top (0-1 across, 0-1 front to back)
}

export interface BattlefieldTheme {
    name: string; // HUD banner title
    colors: {
        wallTop: number;
        wallBottom: number;
        floorBack: number;
        floorFront: number;
        lane: number; // Lane lines
        laneCore: number;
        danger: number;
        moonlight: number;
        candle: number;
        skyTop?: number; // [Added] Night sky in the windows (top/bottom); optional, defaults to the original purple
        skyBottom?: number;
    };
    wallBottom: number; // y where the back wall meets the floor
    floorBottom: number; // y where the floor disappears behind the HUD
    windows: Rect[];
    moon: Point & { r: number }; // Inside windows[0]
    chalkboard: Rect & { lines: string[] };
    shelf: Rect;
    candles: (Point & { scale: number })[]; // On the walls and shelves; the desk has its own
    desk: DeskSpec;
    enemies: Record<string, EnemyArt>; // By EnemyKind id
    boss: EnemyArt; // The module boss in cutscenes
}

export const CURSED_CLASSROOM: BattlefieldTheme = {
    name: 'Cursed Classroom',
    colors: {
        wallTop: 0x1b1430,
        wallBottom: 0x3a2a58,
        floorBack: 0x2e2840,
        floorFront: 0x4a3c50,
        lane: 0x3fe0ff,
        laneCore: 0xc8fbff,
        danger: 0xff3b3b,
        moonlight: 0xb9a8ff,
        candle: 0xffa040,
    },
    wallBottom: 190,
    floorBottom: 600,
    windows: [
        { x: 200, y: 26, w: 210, h: 132 },
        { x: 470, y: 40, w: 116, h: 108 },
    ],
    moon: { x: 372, y: 122, r: 22 },
    chalkboard: {
        x: 960, y: 22, w: 296, h: 132,
        lines: ['7 × 8 = ?', '12 + 9 = 21', 'a² + b² = c²'],
    },
    shelf: { x: 820, y: 58, w: 104, h: 132 },
    candles: [
        { x: 318, y: 160, scale: 0.9 },
        { x: 872, y: 58, scale: 0.8 },
        { x: 1172, y: 152, scale: 0.9 },
        { x: 1246, y: 238, scale: 1.1 },
    ],
    desk: { left: 14, right: 288, bottom: 548, height: 122, depth: 0.15, wizard: { u: 0.5, v: 0.42 } },
    enemies: {
        // Generated stride distances come from the planted travel in scripts/make-walk-frames.py.
        pencil: {
            texture: 'enemy-pencil', file: 'pencil', name: 'Pencil', height: 138,
            walk: {
                texture: 'enemy-pencil-walk', file: 'pencil-walk',
                frames: 24, frameWidth: 190, frameHeight: 300, stride: 90.8696, faceLeft: true,
            },
        },
        textbook: {
            texture: 'enemy-red-book', file: 'red-book', name: 'Textbook', height: 118,
            walk: {
                texture: 'enemy-red-book-walk', file: 'red-book-walk',
                frames: 24, frameWidth: 266, frameHeight: 300, stride: 172, faceLeft: true,
            },
        },
        miniBoss: {
            texture: 'enemy-sharpener', file: 'pencil-sharpener', name: 'Sharpener Brute', height: 205,
            walk: {
                texture: 'enemy-sharpener-walk', file: 'pencil-sharpener-walk',
                frames: 24, frameWidth: 269, frameHeight: 300, stride: 74.2069, faceLeft: true,
            },
        },
        // Made from one drawing by scripts/make-eraser-variants.py. The mini-boss's height includes its horns.
        eraser_miniboss: {
            texture: 'enemy-eraser-boss', file: 'eraser-boss', name: 'Eraser Overlord', height: 317, faceLeft: true,
            walk: {
                texture: 'enemy-eraser-boss-walk', file: 'eraser-boss-walk',
                frames: 24, frameWidth: 222, frameHeight: 300, stride: 59.2, faceLeft: true,
            },
        },
        eraser_giant: {
            texture: 'enemy-eraser-giant', file: 'eraser-giant', name: 'Giant Eraser', height: 173, faceLeft: true,
            walk: {
                texture: 'enemy-eraser-giant-walk', file: 'eraser-giant-walk',
                frames: 24, frameWidth: 265, frameHeight: 300, stride: 72.0209, faceLeft: true,
            },
        },
        eraser_large: {
            texture: 'enemy-eraser-big', file: 'eraser-big', name: 'Large Eraser', height: 140, faceLeft: true,
            walk: {
                texture: 'enemy-eraser-big-walk', file: 'eraser-big-walk',
                frames: 24, frameWidth: 277, frameHeight: 300, stride: 72.02, faceLeft: true,
            },
        },
        eraser: {
            texture: 'enemy-eraser', file: 'eraser', name: 'Eraser', height: 117, faceLeft: true,
            walk: {
                texture: 'enemy-eraser-walk', file: 'eraser-walk',
                frames: 24, frameWidth: 265, frameHeight: 300, stride: 72.0209, faceLeft: true,
            },
        },
        eraser_baby: {
            texture: 'enemy-eraser-baby', file: 'eraser-baby', name: 'Baby Eraser', height: 75, faceLeft: true,
            walk: {
                texture: 'enemy-eraser-baby-walk', file: 'eraser-baby-walk',
                frames: 24, frameWidth: 308, frameHeight: 300, stride: 68.2395, faceLeft: true,
            },
        },
    },
    boss: { texture: 'enemy-charcoal-book', file: 'charcoal-book', name: 'The Cursed Tome', height: 200 },
};

/** Art for an enemy kind, with a fallback so a new kind never crashes the scene. */
export function enemyArt(theme: BattlefieldTheme, kindId: string): EnemyArt {
    return theme.enemies[kindId] ?? theme.enemies.pencil;
}

/** Attack sheets use one row per motion and preserve the walking frame's foot origin. */
export const ENEMY_PUNCH = {
    leftPadding: 96,
    framesPerMotion: 8,
    motions: [
        { durationMs: 280, contactPose: 3 },
        { durationMs: 380, contactPose: 4 },
    ],
} as const;

export function enemyPunchTexture(art: EnemyArt): string {
    return `${art.texture}-attack`;
}

/** The nearest authored pose for the distance travelled, in unscaled frame pixels. */
export function walkFrameAtDistance(walk: WalkAnimation, distance: number, startFrame: number): number {
    const steps = Math.round((distance / walk.stride) * walk.frames);
    return (startFrame + steps) % walk.frames;
}

/** The desk's faces and a way to place things on its top. */
export function deskShape(theme: BattlefieldTheme) {
    const { left, right, bottom, height, depth } = theme.desk;
    return perspectiveBox({ left, right, bottom, height }, depth);
}

/** Where the wizard's feet are, on top of the desk. */
export function wizardFeet(theme: BattlefieldTheme): Point {
    return deskShape(theme).topPoint(theme.desk.wizard.u, theme.desk.wizard.v);
}

/** Every texture the theme needs, for preloading. */
export function themeTextures(theme: BattlefieldTheme): EnemyArt[] {
    const all = [...Object.values(theme.enemies), theme.boss];
    return all.filter((art, i) => all.findIndex(other => other.texture === art.texture) === i);
}

// Draw order, back to front. Enemies use their feet y (about 200-560) as depth.
export const DEPTH = {
    room: -1000,
    floor: -900,
    lanes: -800,
    danger: -790,
    desk: 600, // The desk stands at the front of the room, in front of every lane
    wizard: 601,
    foreground: 1000,
    darken: 1500,
    air: 1600,
    effects: 2000,
    vignette: 3000,
    boss: 3500,
    hud: 5000,
    banner: 6000,
    overlay: 7000,
} as const;
