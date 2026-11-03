import { describe, expect, test } from 'vitest';
import { LANE_PATHS, project } from '../combat/laneLayout';

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
