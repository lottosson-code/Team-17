import { CURSED_CLASSROOM, type BattlefieldTheme } from './theme';

// [Added] Each classroom, and each level inside it, gets a slightly different battlefield.
// Same room layout, enemies and lanes everywhere; only colours, the moon's position and the
// chalkboard change, so the levels feel different without changing how they play.
//   Classroom 1 (amber): the original purple night.
//   Classroom 2 (olive): greener walls and moonlight.
//   Classroom 3 (blue):  deep blue night, warmer candles.
// Within a classroom the moon moves across the window and the room gets a little darker each level.

type Colors = BattlefieldTheme['colors'];

interface ClassroomStyle {
    colors: Partial<Colors>;
    /** Starting chalkboard text for levels 1-5 (Lora has ×, ÷, −, ², ³, °, ½ but not π or √). */
    boards: string[][];
}

const CLASSROOM_STYLES: Record<number, ClassroomStyle> = {
    1: {
        colors: {},
        boards: [
            ['3 + 4 = 7', '12 − 5 = ?', '9 + 9 = 18'],
            ['6 × 7 = 42', '8 × 8 = ?', '5 × 12 = 60'],
            ['7 × 8 = ?', '12 + 9 = 21', '11 × 19 = ?'],
            ['48 ÷ 6 = 8', '9 × 9 = ?', '100 − 37 = ?'],
            ['7 × 16 = ?', '13 × 11 = 143', '½ + ½ = 1'],
        ],
    },
    2: {
        colors: {
            wallTop: 0x14201f, wallBottom: 0x2d4642, floorBack: 0x28363a, floorFront: 0x45504a,
            moonlight: 0xb4f0c8, candle: 0xffb24a, skyTop: 0x1e4a52, skyBottom: 0x6aa890,
        },
        boards: [
            ['90° + 90° = ?', 'square: 4 sides', 'P = 4 × s'],
            ['A = l × w', '6 × 4 = 24', 'triangle: 180°'],
            ['a² + b² = c²', '3² + 4² = 5²', 'A = ½ b h'],
            ['V = s³', '2³ = 8', 'hexagon: 6 sides'],
            ['360° ÷ 4 = ?', 'A = ½ × 6 × 8', 'c² = 25'],
        ],
    },
    3: {
        colors: {
            wallTop: 0x10162e, wallBottom: 0x26365e, floorBack: 0x262c46, floorFront: 0x3a3c58,
            moonlight: 0xa6c2ff, candle: 0xff9a50, skyTop: 0x161c62, skyBottom: 0x4f6ad6,
        },
        boards: [
            ['x + 3 = 7', 'x = ?', '2 + y = 9'],
            ['2x = 14', 'x = 7', '3y − 1 = 8'],
            ['y = 2x + 1', 'if x = 3, y = ?', 'a + b = b + a'],
            ['x² − 9 = 0', 'x = 3 or −3', '(x + 1)² = ?'],
            ['2x + 3 = 11', 'x² = 49', 'x = ?'],
        ],
    },
};

/** Moon centre for levels 1-5: it drifts across the big window as the classroom goes on.
 *  Kept low in the window (y >= 112) because the HUD's HP panel covers the window's top half. */
const MOON_PATH = [
    { x: 236, y: 128 },
    { x: 270, y: 120 },
    { x: 306, y: 115 },
    { x: 340, y: 116 },
    { x: 372, y: 122 },
];
/** How much darker the walls and floor get per level (0.03 = 3 %). */
const DARKEN_PER_LEVEL = 0.03;

// Multiplies a 0xRRGGBB colour's brightness by `factor`.
function shade(color: number, factor: number): number {
    const r = Math.round(((color >> 16) & 0xff) * factor);
    const g = Math.round(((color >> 8) & 0xff) * factor);
    const b = Math.round((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
}

// The battlefield theme for one level: CURSED_CLASSROOM with this classroom's colours,
// this level's moon and chalkboard, and walls/floor a little darker for later levels.
// Unknown classrooms or levels fall back to the nearest one, so this never throws.
export function classroomTheme(moduleId: number, levelId: number): BattlefieldTheme {
    const style = CLASSROOM_STYLES[moduleId] ?? CLASSROOM_STYLES[1];
    const level = Math.min(Math.max(Math.round(levelId), 1), MOON_PATH.length);
    const colors: Colors = { ...CURSED_CLASSROOM.colors, ...style.colors };
    const dim = 1 - DARKEN_PER_LEVEL * (level - 1);
    for (const key of ['wallTop', 'wallBottom', 'floorBack', 'floorFront'] as const) colors[key] = shade(colors[key], dim);
    return {
        ...CURSED_CLASSROOM,
        colors,
        moon: { ...CURSED_CLASSROOM.moon, ...MOON_PATH[level - 1] },
        chalkboard: { ...CURSED_CLASSROOM.chalkboard, lines: style.boards[level - 1] ?? CURSED_CLASSROOM.chalkboard.lines },
    };
}
