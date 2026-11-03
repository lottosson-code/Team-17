import { LANE_COUNT } from './types';

// The battlefield's 2.5D geometry, in one place. The floor is seen in one-point perspective:
// lines running along the lanes stay horizontal on screen, lines running into the room
// converge on VANISHING_POINT, and rows of equal depth get closer together toward the back.
// Lanes, floor tiles, the wizard's desk and enemy sizes are all derived from this,
// so everything stays consistent if the numbers below change.

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

/** Every line that goes into the room meets here (above the screen, since we look down). */
export const VANISHING_POINT = { x: 820, y: -520 };
/** Screen row used to name floor columns: `columnX(refX, y)` passes through x = refX here. */
export const REFERENCE_Y = 600;
/** Back edge of the back lane and front edge of the front lane. */
const LANES_BACK_Y = 215;
const LANES_FRONT_Y = 592;
/** Floor column where the lanes end at the wizard (on the reference row). */
export const LANE_END_X = 330;
export const SCREEN_WIDTH = 1280;
/**
 * Enemies appear this far past the right edge of the screen (scaled by depth), so they and
 * their problem bubbles walk in from off screen.
 */
export const SPAWN_MARGIN = 120;

/** Screen x, at height y, of the floor line going into the room through (refX, REFERENCE_Y). */
export function columnX(refX: number, y: number): number {
    return VANISHING_POINT.x + (refX - VANISHING_POINT.x) * ((y - VANISHING_POINT.y) / (REFERENCE_Y - VANISHING_POINT.y));
}

/**
 * Screen y of a floor row `t` lanes deep: 0 = back edge of the back lane, LANE_COUNT = front edge
 * of the front lane. Fractions and values outside that range work too. Lanes have equal depth in
 * the room, so on screen they get wider toward the front.
 */
export function floorRowY(t: number): number {
    // Screen distance below the vanishing point is proportional to 1 / depth.
    const back = 1 / (LANES_BACK_Y - VANISHING_POINT.y);
    const front = 1 / (LANES_FRONT_Y - VANISHING_POINT.y);
    const depth = back - ((back - front) / LANE_COUNT) * t;
    return VANISHING_POINT.y + 1 / depth;
}

/** Drawing scale at height y, relative to the front lane's centre (scale 1). */
export function scaleAt(y: number): number {
    return (y - VANISHING_POINT.y) / (floorRowY(LANE_COUNT - 0.5) - VANISHING_POINT.y);
}

/** y of every lane border, back to front (LANE_COUNT + 1 lines). */
export const LANE_BORDERS: readonly number[] = Array.from({ length: LANE_COUNT + 1 }, (_, i) => floorRowY(i));

/** Lane centre lines, lane 0 = furthest from the camera (top of the screen). */
export const LANE_PATHS: readonly LanePath[] = Array.from({ length: LANE_COUNT }, (_, lane) => {
    const y = floorRowY(lane + 0.5);
    const scale = scaleAt(y);
    return {
        spawn: { x: SCREEN_WIDTH + SPAWN_MARGIN * scale, y, scale },
        end: { x: columnX(LANE_END_X, y), y, scale },
    };
});

/**
 * Converts a lane and walk progress (0 at spawn, 1 at the wizard) to a screen position.
 * Use `y` as the sprite's depth so enemies lower on screen draw in front.
 *
 * `halfWidth` is how far the enemy's left edge is from its centre (in pixels at scale 1).
 * It stops the enemy that much short of the end line, so at progress 1 (when it starts
 * attacking) its left edge is exactly on the line, however wide it is.
 */
export function project(lane: number, progress: number, halfWidth = 0, paths: readonly LanePath[] = LANE_PATHS): ScreenPoint {
    if (paths.length !== LANE_COUNT) throw new Error(`Expected ${LANE_COUNT} lane paths`);
    const path = paths[lane];
    if (!path) throw new RangeError(`Lane ${lane} is outside 0-${LANE_COUNT - 1}`);
    const t = Math.min(1, Math.max(0, progress));
    return {
        x: lerp(path.spawn.x, path.end.x + halfWidth * path.end.scale, t),
        y: lerp(path.spawn.y, path.end.y, t),
        scale: lerp(path.spawn.scale, path.end.scale, t),
    };
}

/**
 * Corners of a box standing on the floor, in this perspective. `front` is the box's front face
 * (left x, right x, bottom y, height); `depth` is how far back it goes, as a fraction of the way
 * to the vanishing point. Faces are listed as point arrays ready to fill.
 */
export function perspectiveBox(front: { left: number; right: number; bottom: number; height: number }, depth: number) {
    const back = (x: number, y: number) => ({
        x: x + (VANISHING_POINT.x - x) * depth,
        y: y + (VANISHING_POINT.y - y) * depth,
    });
    const top = front.bottom - front.height;
    const ftl = { x: front.left, y: top };
    const ftr = { x: front.right, y: top };
    const fbl = { x: front.left, y: front.bottom };
    const fbr = { x: front.right, y: front.bottom };
    const btl = back(ftl.x, ftl.y);
    const btr = back(ftr.x, ftr.y);
    const bbr = back(fbr.x, fbr.y);
    return {
        front: [ftl, ftr, fbr, fbl],
        top: [ftl, ftr, btr, btl],
        // Visible because the box is left of the vanishing point.
        right: [ftr, btr, bbr, fbr],
        /** A point on the top face: u = 0 left → 1 right, v = 0 front → 1 back. */
        topPoint(u: number, v: number) {
            const frontPoint = { x: lerp(ftl.x, ftr.x, u), y: top };
            const backPoint = { x: lerp(btl.x, btr.x, u), y: btl.y };
            return { x: lerp(frontPoint.x, backPoint.x, v), y: lerp(frontPoint.y, backPoint.y, v) };
        },
    };
}

/** Exact at both ends (t = 0 gives `from`, t = 1 gives `to`), unlike from + (to - from) * t. */
function lerp(from: number, to: number, t: number): number {
    return from * (1 - t) + to * t;
}
