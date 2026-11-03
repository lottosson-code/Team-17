import { describe, expect, test } from 'vitest';
import {
    LANE_BORDERS, LANE_END_X, LANE_PATHS, REFERENCE_Y, SCREEN_WIDTH, SPAWN_MARGIN, VANISHING_POINT,
    columnX, floorRowY, perspectiveBox, project, scaleAt,
} from '../combat/laneLayout';

/** Slope (dx/dy) of the line from a point to the vanishing point. */
const slopeToVanishing = (x: number, y: number) => (VANISHING_POINT.x - x) / (VANISHING_POINT.y - y);

describe('floor perspective', () => {
    test('floor columns pass through their reference x and converge on the vanishing point', () => {
        expect(columnX(500, REFERENCE_Y)).toBeCloseTo(500);
        expect(columnX(500, VANISHING_POINT.y)).toBeCloseTo(VANISHING_POINT.x);
        // Straight lines: same slope toward the vanishing point at every height.
        expect(slopeToVanishing(columnX(500, 300), 300)).toBeCloseTo(slopeToVanishing(columnX(500, 550), 550));
    });

    test('lanes have equal depth in the room, so they get wider on screen toward the front', () => {
        const widths = LANE_BORDERS.slice(1).map((y, i) => y - LANE_BORDERS[i]);
        for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1]);
        // floorRowY lands exactly on the borders at whole numbers.
        LANE_BORDERS.forEach((y, i) => expect(floorRowY(i)).toBeCloseTo(y));
    });

    test('each lane centre is half a lane deep, between its borders', () => {
        LANE_PATHS.forEach((path, lane) => {
            expect(path.spawn.y).toBeCloseTo(floorRowY(lane + 0.5));
            expect(path.spawn.y).toBeGreaterThan(LANE_BORDERS[lane]);
            expect(path.spawn.y).toBeLessThan(LANE_BORDERS[lane + 1]);
        });
    });

    test('lane ends are not lined up vertically: they follow the floor columns', () => {
        const ends = LANE_PATHS.map(path => path.end.x);
        // Back lanes end further right, like a floor tile seam receding into the room.
        for (let i = 1; i < ends.length; i++) expect(ends[i]).toBeLessThan(ends[i - 1]);
        LANE_PATHS.forEach(path => expect(path.end.x).toBeCloseTo(columnX(LANE_END_X, path.end.y)));
    });

    test('enemies spawn off the right edge, far enough that they and their bubbles walk in', () => {
        LANE_PATHS.forEach(path => {
            // Wider than half the widest enemy or bubble at that depth (~85 px at scale 1).
            expect(path.spawn.x - SCREEN_WIDTH).toBeGreaterThan(85 * path.spawn.scale);
            expect(path.spawn.x).toBeCloseTo(SCREEN_WIDTH + SPAWN_MARGIN * path.spawn.scale);
        });
    });

    test('size shrinks in proportion to distance below the vanishing point', () => {
        expect(scaleAt(LANE_PATHS[3].spawn.y)).toBeCloseTo(1);
        const [a, b] = [LANE_PATHS[0].spawn, LANE_PATHS[2].spawn];
        expect(a.scale / b.scale).toBeCloseTo((a.y - VANISHING_POINT.y) / (b.y - VANISHING_POINT.y));
    });

    test('perspectiveBox recedes toward the vanishing point and places points on its top', () => {
        const box = perspectiveBox({ left: 100, right: 200, bottom: 500, height: 50 }, 0.2);
        const [frontTopRight, backTopRight] = box.right;
        expect(slopeToVanishing(frontTopRight.x, frontTopRight.y)).toBeCloseTo(slopeToVanishing(backTopRight.x, backTopRight.y));
        expect(box.topPoint(0, 0)).toEqual({ x: 100, y: 450 });
        expect(box.topPoint(1, 1)).toEqual(box.top[2]);
    });
});

describe('project', () => {
    test('progress 0 is the spawn point and 1 is the end at the wizard', () => {
        expect(project(2, 0)).toEqual(LANE_PATHS[2].spawn);
        expect(project(2, 1)).toEqual(LANE_PATHS[2].end);
    });

    test('progress 0.5 is halfway between spawn and end', () => {
        const { spawn, end } = LANE_PATHS[1];
        const mid = project(1, 0.5);
        expect(mid.x).toBeCloseTo((spawn.x + end.x) / 2);
        expect(mid.y).toBeCloseTo((spawn.y + end.y) / 2);
        expect(mid.scale).toBeCloseTo((spawn.scale + end.scale) / 2);
    });

    test('halfWidth stops a wider enemy short, so its left side (not its centre) reaches the end', () => {
        const { end } = LANE_PATHS[3];
        const arrived = project(3, 1, 100);
        expect(arrived.x).toBeCloseTo(end.x + 100 * end.scale);
        expect(arrived.x - 100 * arrived.scale).toBeCloseTo(end.x);
        // The spawn point doesn't move.
        expect(project(3, 0, 100)).toEqual(project(3, 0));
    });

    test('progress outside 0-1 is clamped', () => {
        expect(project(0, -1)).toEqual(project(0, 0));
        expect(project(0, 2)).toEqual(project(0, 1));
    });

    test('lanes further back are higher on screen and smaller', () => {
        for (let lane = 1; lane < LANE_PATHS.length; lane++) {
            const back = project(lane - 1, 0.5);
            const front = project(lane, 0.5);
            expect(back.y).toBeLessThan(front.y);
            expect(back.scale).toBeLessThan(front.scale);
        }
    });

    test('rejects lanes that do not exist', () => {
        expect(() => project(-1, 0)).toThrow(RangeError);
        expect(() => project(4, 0)).toThrow(RangeError);
    });
});
