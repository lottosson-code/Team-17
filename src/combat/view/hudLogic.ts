import { LANE_COUNT, type CombatStats, type Enemy, type PowerUpKind } from '../types';
// Pure helpers behind the HUD and battlefield, kept free of Phaser so they can be unit-tested.

/** Progress at which a lane starts glowing red. */
export const DANGER_START = 0.55;

/** Texture key for each power-up's icon (drawn in textures.ts). */
export const POWER_UP_TEXTURE: Record<PowerUpKind, string> = {
    freeze: 'pu-freeze',
    heal: 'pu-heal',
    zap: 'pu-zap',
};

/** Danger per lane from 0 (safe) to 1 (an enemy is at the wizard), based on the closest enemy in it. */
export function laneDanger(enemies: readonly Readonly<Enemy>[]): number[] {
    const danger = new Array<number>(LANE_COUNT).fill(0);
    for (const enemy of enemies) {
        const level = enemy.state === 'attacking' ? 1 : Math.max(0, (enemy.progress - DANGER_START) / (1 - DANGER_START));
        danger[enemy.lane] = Math.max(danger[enemy.lane], Math.min(1, level));
    }
    return danger;
}

/** How full each heart is (0-1), left to right, when `hearts` hearts show the whole HP bar. */
export function heartFills(hp: number, maxHp: number, hearts = 5): number[] {
    const perHeart = maxHp / hearts;
    return Array.from({ length: hearts }, (_, i) => Math.min(1, Math.max(0, (hp - i * perHeart) / perHeart)));
}

/** The end screen's statistics, in display order. Accuracy is a whole percentage, or "—" with no answers. */
export function statLines(stats: CombatStats): { label: string; value: string }[] {
    return [
        { label: 'Solved', value: String(stats.solved) },
        { label: 'Missed', value: String(stats.missed) },
        { label: 'Accuracy', value: stats.accuracy === null ? '—' : `${Math.round(stats.accuracy * 100)}%` },
    ];
}

/** Low-health warning strength: 0 above 40% HP, rising to 1 at 0 HP. */
export function lowHealthLevel(hp: number, maxHp: number): number {
    const fraction = hp / maxHp;
    return fraction >= 0.4 ? 0 : 1 - fraction / 0.4;
}

/** Vertical positions (centres, except boxY = top) on the pause / end-of-level panel. */
export interface OverlayLayout {
    boxY: number;
    boxHeight: number;
    title: number;
    stats?: number; // The stats row's values; their labels sit 32 px below
    continue?: number;
    buttons: number;
    hint: number;
}

/** The panel grows to fit an end screen's stats row and the victory screen's Continue button. */
export function overlayLayout(hasStats: boolean, hasContinue: boolean): OverlayLayout {
    if (hasStats && hasContinue) return { boxY: 150, boxHeight: 400, title: 212, stats: 280, continue: 374, buttons: 448, hint: 512 };
    if (hasContinue) return { boxY: 185, boxHeight: 350, title: 248, continue: 336, buttons: 416, hint: 484 };
    if (hasStats) return { boxY: 210, boxHeight: 300, title: 268, stats: 336, buttons: 428, hint: 484 };
    return { boxY: 210, boxHeight: 300, title: 290, buttons: 410, hint: 470 };
}
