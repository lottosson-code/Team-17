// Speech bubbles that type out letter by letter with 8-bit voice blips, like Undertale.
// Kept free of Phaser so it can be unit-tested; CombatScene.say() draws the bubble.

/** How fast a bubble types out. */
export const TYPE_MS_PER_CHAR = 35;

/** Once typed, a bubble stays at least this long so it can be read. */
const READ_MS = 700;

/** A character's voice: the pitches its blips use, as semitone steps above a base frequency. */
export interface Voice {
    base: number; // Hz
    steps: readonly number[];
}

/**
 * The module boss: deep (but not so low that laptop speakers lose it), on a minor pentatonic
 * scale, so it sounds menacing.
 */
export const BOSS_VOICE: Voice = { base: 147, steps: [0, 3, 5, 7, 10] };

/** While a character talks, the music drops to this share of its volume so the voice is heard. */
export const SPEECH_MUSIC_DUCK = 0.4;

/** The frequency of one of the voice's steps. */
export function voicePitch(voice: Voice, step: number): number {
    return voice.base * 2 ** (voice.steps[step] / 12);
}

/**
 * Positions in `text` that make a blip as they appear: every other letter or digit, so the voice
 * chatters rather than buzzes. Spaces and punctuation are silent.
 */
export function blipPositions(text: string): number[] {
    const positions: number[] = [];
    let letters = 0;
    for (let i = 0; i < text.length; i++) {
        if (/[\p{L}\p{N}]/u.test(text[i]) && letters++ % 2 === 0) positions.push(i);
    }
    return positions;
}

/** How long a bubble stays up: at least `holdMs`, and long enough to read once it has typed out. */
export function speechHoldMs(text: string, holdMs: number): number {
    return Math.max(holdMs, text.length * TYPE_MS_PER_CHAR + READ_MS);
}
