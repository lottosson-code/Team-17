import { describe, expect, it } from 'vitest';
import { classroomTheme } from '../combat/view/classroomThemes';
import { CURSED_CLASSROOM } from '../combat/view/theme';

// [Added] The per-classroom battlefield variants stay small: same layout and art, different look.
describe('classroomTheme', () => {
    it('keeps the layout, enemies and desk of the original room', () => {
        const theme = classroomTheme(2, 3);
        expect(theme.desk).toEqual(CURSED_CLASSROOM.desk);
        expect(theme.windows).toEqual(CURSED_CLASSROOM.windows);
        expect(theme.enemies).toBe(CURSED_CLASSROOM.enemies);
        expect(theme.colors.lane).toBe(CURSED_CLASSROOM.colors.lane);
    });

    it('gives each classroom its own colours for the same level', () => {
        const walls = [1, 2, 3].map(room => classroomTheme(room, 1).colors.wallBottom);
        expect(new Set(walls).size).toBe(3);
        expect(classroomTheme(1, 1).colors.wallBottom).toBe(CURSED_CLASSROOM.colors.wallBottom);
    });

    it('gives each level in a classroom its own moon and chalkboard', () => {
        const levels = [1, 2, 3, 4, 5].map(level => classroomTheme(1, level));
        expect(new Set(levels.map(t => `${t.moon.x},${t.moon.y}`)).size).toBe(5);
        expect(new Set(levels.map(t => t.chalkboard.lines.join('|'))).size).toBe(5);
    });

    it('keeps the moon inside the big window', () => {
        const window = CURSED_CLASSROOM.windows[0];
        for (let level = 1; level <= 5; level++) {
            const { moon } = classroomTheme(3, level);
            expect(moon.x - moon.r).toBeGreaterThanOrEqual(window.x);
            expect(moon.x + moon.r).toBeLessThanOrEqual(window.x + window.w);
            expect(moon.y - moon.r).toBeGreaterThanOrEqual(window.y);
            expect(moon.y + moon.r).toBeLessThanOrEqual(window.y + window.h);
        }
    });

    it('falls back instead of throwing for unknown classrooms or levels', () => {
        expect(() => classroomTheme(9, 99)).not.toThrow();
        expect(classroomTheme(9, 1).colors.wallTop).toBe(CURSED_CLASSROOM.colors.wallTop);
    });
});
