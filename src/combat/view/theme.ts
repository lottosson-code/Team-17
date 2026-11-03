import { LANE_PATHS, perspectiveBox } from '../laneLayout';

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

/** A walk cycle: one row of equally sized frames, made with scripts/make-spritesheet.py. */
export interface WalkAnimation {
    texture: string; // Spritesheet key, loaded from public/assets/combat/enemies/<file>.webp
    file: string;
    frames: number;
    frameWidth: number;
    frameHeight: number;
    fps: number; // Frame rate the animation is defined with; sped up or slowed to match the walking speed
    stride: number; // Distance one full cycle should cover, in pixels at depth scale 1 (stops the feet sliding)
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
        pencil: { texture: 'enemy-pencil', file: 'pencil', name: 'Pencil', height: 132 },
        textbook: {
            texture: 'enemy-red-book', file: 'red-book', name: 'Textbook', height: 128,
            walk: {
                texture: 'enemy-red-book-walk', file: 'red-book-walk',
                frames: 12, frameWidth: 266, frameHeight: 300, fps: 12, stride: 80, faceLeft: true,
            },
        },
        miniBoss: { texture: 'enemy-sharpener', file: 'pencil-sharpener', name: 'Sharpener Brute', height: 220 },
    },
    boss: { texture: 'enemy-charcoal-book', file: 'charcoal-book', name: 'The Cursed Tome', height: 200 },
};

/** Art for an enemy kind, with a fallback so a new kind never crashes the scene. */
export function enemyArt(theme: BattlefieldTheme, kindId: string): EnemyArt {
    return theme.enemies[kindId] ?? theme.enemies.pencil;
}

/**
 * How much faster (> 1) or slower (< 1) than its defined fps a walk cycle should play, so that
 * one cycle covers `stride` while walking down `lane` in `walkMs`. Lanes are horizontal, so
 * the depth scale is the same along the whole lane.
 */
export function walkTimeScale(art: EnemyArt, lane: number, walkMs: number): number {
    const walk = art.walk;
    const path = LANE_PATHS[lane];
    if (!walk || !path) return 1;
    const laneLength = (path.spawn.x - path.end.x) / path.end.scale; // Pixels at scale 1
    const cyclesPerSecond = ((laneLength / walkMs) * 1000) / walk.stride;
    return (cyclesPerSecond * walk.frames) / walk.fps;
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
