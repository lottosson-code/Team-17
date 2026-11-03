import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MODULE1_LEVEL1, MODULE1_LEVEL2, TEST_LEVEL } from '../combat/levels';
import { LANE_END_X, LANE_PATHS, VANISHING_POINT, columnX } from '../combat/laneLayout';
import { CURSED_CLASSROOM, deskShape, enemyArt, themeTextures, walkTimeScale, wizardFeet, type Point } from '../combat/view/theme';

const LEVELS = [MODULE1_LEVEL1, MODULE1_LEVEL2, TEST_LEVEL];

/** Width and height from a WebP file's header (lossy, lossless or extended format). */
function webpSize(data: Buffer): { width: number; height: number } {
    const chunk = data.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    if (chunk === 'VP8L') {
        const bits = data.readUInt32LE(21);
        return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
    }
    return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
}

/** True if the three points lie on one straight line. */
function collinear(a: Point, b: Point, c: Point): boolean {
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(cross) < 1e-6 * Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - a.x, c.y - a.y);
}

describe('CURSED_CLASSROOM theme', () => {
    test('every enemy kind used by a level has its own art', () => {
        for (const level of LEVELS) {
            for (const kind of Object.keys(level.enemyKinds)) {
                expect(CURSED_CLASSROOM.enemies[kind], `art for "${kind}"`).toBeDefined();
            }
        }
    });

    test('every art file exists in public/assets', () => {
        for (const art of themeTextures(CURSED_CLASSROOM)) {
            expect(existsSync(`public/assets/combat/enemies/${art.file}.webp`), art.file).toBe(true);
        }
    });

    test('every walk spritesheet exists and is exactly frames × frameWidth by frameHeight', () => {
        const walks = themeTextures(CURSED_CLASSROOM).flatMap(art => (art.walk ? [art.walk] : []));
        expect(walks.length).toBeGreaterThan(0);
        for (const walk of walks) {
            const size = webpSize(readFileSync(`public/assets/combat/enemies/${walk.file}.webp`));
            expect(size, walk.file).toEqual({ width: walk.frames * walk.frameWidth, height: walk.frameHeight });
        }
    });

    test('textbooks have a walk cycle that already faces the wizard', () => {
        const walk = CURSED_CLASSROOM.enemies.textbook.walk;
        expect(walk?.frames).toBe(12);
        expect(walk?.faceLeft).toBe(true);
    });

    test('a walk cycle plays at the speed that covers one stride per loop', () => {
        const art = CURSED_CLASSROOM.enemies.textbook;
        const walk = art.walk!;
        const walkMs = MODULE1_LEVEL1.enemyKinds.textbook.walkMs;
        for (let lane = 0; lane < LANE_PATHS.length; lane++) {
            const path = LANE_PATHS[lane];
            const loopMs = (walk.frames / (walk.fps * walkTimeScale(art, lane, walkMs))) * 1000;
            const loops = walkMs / loopMs;
            // Number of loops across the lane × stride = lane length at scale 1.
            expect(loops * walk.stride).toBeCloseTo((path.spawn.x - path.end.x) / path.end.scale, 6);
        }
        // Slower walkers animate more slowly; art without a walk cycle is unaffected.
        expect(walkTimeScale(art, 3, walkMs * 2)).toBeCloseTo(walkTimeScale(art, 3, walkMs) / 2, 9);
        expect(walkTimeScale(CURSED_CLASSROOM.enemies.pencil, 3, walkMs)).toBe(1);
    });

    test('themeTextures lists each texture once, including the boss', () => {
        const keys = themeTextures(CURSED_CLASSROOM).map(art => art.texture);
        expect(new Set(keys).size).toBe(keys.length);
        expect(keys).toContain(CURSED_CLASSROOM.boss.texture);
    });

    test('an unknown enemy kind falls back to pencil art instead of crashing', () => {
        expect(enemyArt(CURSED_CLASSROOM, 'dragon')).toBe(CURSED_CLASSROOM.enemies.pencil);
    });

    test('the wizard stands on top of the desk', () => {
        const desk = deskShape(CURSED_CLASSROOM);
        const feet = wizardFeet(CURSED_CLASSROOM);
        const [frontLeft, frontRight, backRight, backLeft] = desk.top;
        expect(feet.y).toBeLessThan(frontLeft.y);
        expect(feet.y).toBeGreaterThan(backLeft.y);
        expect(feet.x).toBeGreaterThan(Math.min(frontLeft.x, backLeft.x));
        expect(feet.x).toBeLessThan(Math.max(frontRight.x, backRight.x));
    });

    test('the desk stands left of the line where the lanes end, at every depth', () => {
        const desk = deskShape(CURSED_CLASSROOM);
        // Each corner of the desk's right side is left of the end line at that corner's own height.
        for (const corner of desk.right) {
            expect(columnX(LANE_END_X, corner.y)).toBeGreaterThan(corner.x + 20);
        }
        // An enemy at the end of the front lane (about 60 px half-width) doesn't overlap the desk's front.
        const front = LANE_PATHS[LANE_PATHS.length - 1].end;
        expect(front.x - 60 * front.scale).toBeGreaterThan(CURSED_CLASSROOM.desk.right);
    });

    test("the desk's receding edges point at the floor's vanishing point", () => {
        const desk = deskShape(CURSED_CLASSROOM);
        const [frontTopRight, backTopRight, backBottomRight, frontBottomRight] = desk.right;
        expect(collinear(frontTopRight, backTopRight, VANISHING_POINT)).toBe(true);
        expect(collinear(frontBottomRight, backBottomRight, VANISHING_POINT)).toBe(true);
        expect(collinear(desk.top[0], desk.top[3], VANISHING_POINT)).toBe(true);
    });
});
