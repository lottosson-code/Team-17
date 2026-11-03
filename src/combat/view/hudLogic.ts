import { LANE_COUNT, type Enemy } from '../types';

// Pure helpers behind the HUD and battlefield, kept free of Phaser so they can be unit-tested.

/** Progress at which a lane starts glowing red. */
export const DANGER_START = 0.55;

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

/** Low-health warning strength: 0 above 40% HP, rising to 1 at 0 HP. */
export function lowHealthLevel(hp: number, maxHp: number): number {
    const fraction = hp / maxHp;
    return fraction >= 0.4 ? 0 : 1 - fraction / 0.4;
}
