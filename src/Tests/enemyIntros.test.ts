import { describe, expect, it } from 'vitest';
import { introFor, meetEnemy } from '../combat/view/enemyIntros';
import { MODULE1_LEVEL3 } from '../combat/levels';
import { CURSED_CLASSROOM } from '../combat/view/theme';
import { SeenEnemiesStore } from '../state/seenEnemiesStore';

const TAGGED = ['pencil', 'textbook', 'eraser'];

describe('introFor', () => {
    it('has an intro for pencils, textbooks and erasers', () => {
        for (const kind of TAGGED) {
            const intro = introFor(kind);
            expect(intro?.id).toBe(kind);
            expect(intro?.name).not.toBe('');
            expect(intro?.description).not.toBe('');
            expect(intro?.tip).not.toBe('');
        }
    });

    it('gives every eraser size the eraser intro', () => {
        const eraserKinds = Object.keys(MODULE1_LEVEL3.enemyKinds).filter(id => id.startsWith('eraser'));
        expect(eraserKinds.length).toBeGreaterThan(1);
        for (const kind of eraserKinds) expect(introFor(kind)?.id).toBe('eraser');
    });

    it('has no intro for untagged or unknown kinds', () => {
        expect(introFor('miniBoss')).toBeUndefined();
        expect(introFor('dragon')).toBeUndefined();
    });

    it('only uses art the theme has', () => {
        for (const kind of TAGGED) {
            expect(CURSED_CLASSROOM.enemies[introFor(kind)!.art]).toBeDefined();
        }
    });
});

describe('meetEnemy', () => {
    it('returns the intro the first time only', () => {
        const seen = new SeenEnemiesStore(null);
        expect(meetEnemy('pencil', seen)?.id).toBe('pencil');
        expect(meetEnemy('pencil', seen)).toBeUndefined();
        expect(meetEnemy('textbook', seen)?.id).toBe('textbook');
    });

    it('tags the eraser family once, whichever size appears first', () => {
        const seen = new SeenEnemiesStore(null);
        expect(meetEnemy('eraser', seen)?.id).toBe('eraser');
        // Its split children are babies: already introduced.
        expect(meetEnemy('eraser_baby', seen)).toBeUndefined();
        expect(meetEnemy('eraser_miniboss', seen)).toBeUndefined();
    });

    it('does not remember kinds that are never tagged', () => {
        const seen = new SeenEnemiesStore(null);
        expect(meetEnemy('miniBoss', seen)).toBeUndefined();
        expect(seen.hasSeen('miniBoss')).toBe(false);
    });
});
