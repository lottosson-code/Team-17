// What the "New enemy" tag and its info card say about each enemy, and which enemy kinds share
// an intro. Kept free of Phaser so it can be unit-tested.

export interface EnemyIntro {
    id: string; // Remembered by seenEnemiesStore once the player has met this enemy
    art: string; // Theme enemy art to show (theme.enemies key)
    name: string;
    description: string;
    tip: string;
}

const INTROS: Record<string, EnemyIntro> = {
    pencil: {
        id: 'pencil',
        art: 'pencil',
        name: 'Pencil',
        description: 'A cursed pencil that rushes down its lane. One correct answer knocks it out.',
        tip: 'Fast but fragile: solve it before it reaches your desk.',
    },
    textbook: {
        id: 'textbook',
        art: 'textbook',
        name: 'Textbook',
        description: 'A heavy textbook: slow, but it hits twice as hard as a pencil. '
            + 'It takes two correct answers, and shows a new problem after the first.',
        tip: 'Read its new problem after the first hit.',
    },
    eraser: {
        id: 'eraser',
        art: 'eraser',
        name: 'Eraser',
        description: 'When defeated, it splits into two smaller, faster erasers in the lanes next to it. '
            + 'Bigger erasers keep splitting until only babies are left.',
        tip: 'Deal with the smaller erasers first: they move quickly, but their problems are easier.',
    },
};

/** Every eraser size is tagged once, as "Eraser", since they all work the same way. */
const INTRO_OF_KIND: Record<string, string> = {
    pencil: 'pencil',
    textbook: 'textbook',
    eraser: 'eraser',
    eraser_baby: 'eraser',
    eraser_large: 'eraser',
    eraser_giant: 'eraser',
    eraser_miniboss: 'eraser',
};

/** The intro for an enemy kind, or undefined if that kind is never tagged. */
export function introFor(kindId: string): EnemyIntro | undefined {
    const id = INTRO_OF_KIND[kindId];
    return id === undefined ? undefined : INTROS[id];
}

/**
 * Called when an enemy of `kindId` appears. Returns its intro if this is the first time the
 * player meets it (and remembers that it has now been met), otherwise undefined.
 */
export function meetEnemy(kindId: string, seen: { markSeen(id: string): boolean }): EnemyIntro | undefined {
    const intro = introFor(kindId);
    return intro && seen.markSeen(intro.id) ? intro : undefined;
}
