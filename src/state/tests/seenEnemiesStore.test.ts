import { describe, expect, it } from 'vitest';
import { SEEN_ENEMIES_STORAGE_KEY, SeenEnemiesStore } from '../seenEnemiesStore';

/** In-memory stand-in for localStorage. */
function fakeStorage(initial?: string) {
    const data = new Map<string, string>();
    if (initial !== undefined) data.set(SEEN_ENEMIES_STORAGE_KEY, initial);
    return {
        data,
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
    };
}

describe('SeenEnemiesStore', () => {
    it('starts with no enemies seen', () => {
        const store = new SeenEnemiesStore(fakeStorage());
        expect(store.hasSeen('pencil')).toBe(false);
    });

    it('reports the first meeting only once', () => {
        const store = new SeenEnemiesStore(fakeStorage());
        expect(store.markSeen('pencil')).toBe(true);
        expect(store.markSeen('pencil')).toBe(false);
        expect(store.hasSeen('pencil')).toBe(true);
        expect(store.hasSeen('textbook')).toBe(false);
    });

    it('remembers seen enemies across sessions', () => {
        const storage = fakeStorage();
        new SeenEnemiesStore(storage).markSeen('eraser');

        const later = new SeenEnemiesStore(storage);
        expect(later.hasSeen('eraser')).toBe(true);
        expect(later.markSeen('eraser')).toBe(false);
    });

    it('reset() makes every enemy new again, also after reloading', () => {
        const storage = fakeStorage();
        const store = new SeenEnemiesStore(storage);
        store.markSeen('pencil');
        store.markSeen('textbook');

        store.reset();

        expect(store.hasSeen('pencil')).toBe(false);
        expect(new SeenEnemiesStore(storage).hasSeen('textbook')).toBe(false);
    });

    it('treats a corrupted or unexpected save as nothing seen', () => {
        expect(new SeenEnemiesStore(fakeStorage('{not json')).hasSeen('pencil')).toBe(false);
        expect(new SeenEnemiesStore(fakeStorage('{"pencil":true}')).hasSeen('pencil')).toBe(false);
        // Non-string entries are dropped, the rest are kept.
        const mixed = new SeenEnemiesStore(fakeStorage('["pencil", 3, null]'));
        expect(mixed.hasSeen('pencil')).toBe(true);
    });

    it('still works for this session when storage is missing or throws', () => {
        const noStorage = new SeenEnemiesStore(null);
        expect(noStorage.markSeen('pencil')).toBe(true);
        expect(noStorage.markSeen('pencil')).toBe(false);

        const broken = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('quota exceeded'); },
        };
        const store = new SeenEnemiesStore(broken);
        expect(store.markSeen('textbook')).toBe(true);
        expect(store.hasSeen('textbook')).toBe(true);
    });
});
