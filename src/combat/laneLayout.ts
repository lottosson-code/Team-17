import { LANE_COUNT } from './types';

export interface ScreenPoint {
    x: number;
    y: number;
    /** Sprite scale at this point; smaller = further from the camera. */
    scale: number;
}

/** Where a lane's centre line starts (enemy spawn) and ends (at the wizard). */
export interface LanePath {
    spawn: ScreenPoint;
    end: ScreenPoint;
}

/**
 * Lane centre lines for a 1280x720 scene, lane 0 = furthest from the camera (top).
 * ROUGH values estimated from the concept art; re-measure against the final background.
 */
export const LANE_PATHS: readonly LanePath[] = [
    { spawn: { x: 1250, y: 250, scale: 0.7 }, end: { x: 380, y: 250, scale: 0.7 } },
    { spawn: { x: 1250, y: 320, scale: 0.8 }, end: { x: 375, y: 320, scale: 0.8 } },
    { spawn: { x: 1250, y: 405, scale: 0.9 }, end: { x: 370, y: 405, scale: 0.9 } },
    { spawn: { x: 1250, y: 510, scale: 1.0 }, end: { x: 365, y: 510, scale: 1.0 } },
];

/**
 * Converts a lane and walk progress (0 at spawn, 1 at the wizard) to a screen position.
 * Use `y` as the sprite's depth so enemies lower on screen draw in front.
 */
export function project(lane: number, progress: number, paths: readonly LanePath[] = LANE_PATHS): ScreenPoint {
    if (paths.length !== LANE_COUNT) throw new Error(`Expected ${LANE_COUNT} lane paths`);
    const path = paths[lane];
    if (!path) throw new RangeError(`Lane ${lane} is outside 0-${LANE_COUNT - 1}`);
    const t = Math.min(1, Math.max(0, progress));
    return {
        x: lerp(path.spawn.x, path.end.x, t),
        y: lerp(path.spawn.y, path.end.y, t),
        scale: lerp(path.spawn.scale, path.end.scale, t),
    };
}

function lerp(from: number, to: number, t: number): number {
    return from + (to - from) * t;
}
