/**
 * Picks which recording to play for a sound that has several (e.g. key presses): a random index
 * from 0 to count - 1 that isn't `previous`, so the same one never plays twice in a row.
 */
export function randomVariant(count: number, previous: number | undefined, rng: () => number = Math.random): number {
    if (count <= 1) return 0;
    if (previous === undefined || previous < 0 || previous >= count) return Math.floor(rng() * count);
    // Choose among the other count - 1, then skip over `previous`.
    const pick = Math.floor(rng() * (count - 1));
    return pick >= previous ? pick + 1 : pick;
}
