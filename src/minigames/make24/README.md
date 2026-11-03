# Make 24 minigame

Students get four numbers and combine them with + − × ÷ until one card is left. If it's 24, they win and earn coins.

## Files

| Path | What it is |
| --- | --- |
| `src/logic.ts` | Pure game logic: exact fractions, a solver, and a random puzzle generator that only returns solvable puzzles. No DOM. |
| `src/make24.ts` | The UI component: `mountMake24(container, options)`. Handles cards, operations, undo/reset, coins and the win screen. |
| `src/make24.css` | Styles. Every class starts with `cse-make24` so nothing leaks into the rest of the game. Colors match the main menu. |
| `fonts/` | Lora (titles) and Poppins (everything else), subset to Latin. SIL Open Font License, see `fonts/FONTS-LICENSE.txt`. |
| `make24-demo.html` | Self-contained demo. Double-click it to play without running the project. |
| `src/Tests/make24/` (repo root) | Unit tests for `logic.ts` and component tests for `make24.ts`. |

## Using it

```ts
import { mountMake24 } from './minigames/make24/src/make24';
import './minigames/make24/src/make24.css';

const game = mountMake24(document.querySelector<HTMLElement>('#scene')!, {
  difficulty: 'normal',                 // 'easy' | 'normal' | 'hard'
  coins: player.coins,                  // balance shown in the top-right
  onSolve: (result) => { player.coins = result.totalCoins; },
  onExit: () => { game.destroy(); showMap(); },
});
```

The scene is 16:9 and scales with the width of its container, like the main menu.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `difficulty` | `'normal'` | Easy: numbers 1–9, always solvable with whole numbers. Normal: 1–10. Hard: 1–13 (may need fractions). |
| `target` | `24` | Number to reach. |
| `numbers` | random | Fixed first puzzle, e.g. `[3, 3, 8, 8]`. Must be four positive whole numbers, otherwise `mountMake24` throws a `RangeError`. |
| `backgroundSrc` | candle-lit gradient | Scene image behind the panel. |
| `title` | `"Make 24"` | |
| `exitLabel` | `"Map"` | The exit buttons only appear when `onExit` is set. |
| `showDifficulty` | `true` | Hide the Easy/Normal/Hard switch if the map decides difficulty. |
| `keyboard` | `true` | Shortcuts: `1`–`4` cards, `+ - * x /` operations, `Backspace`/`U` undo, `R` reset, `N` new puzzle, `Esc` deselect. |
| `coins` | `0` | Player's balance when the minigame opens. |
| `coinReward` | Easy 5 · Normal 10 · Hard 15 | Coins per solve: a number, or a function `({ difficulty, timeMs, streak }) => number`. Negative values pay 0; fractions round down. |
| `onSolve(result)` | — | `{ numbers, target, difficulty, expression, steps, timeMs, coinsEarned, totalCoins }` |
| `onSkip(numbers)` | — | The player pressed "New puzzle" without solving. |
| `onExit()` | — | The player pressed the Map / Back to map button. |

`mountMake24` returns `{ element, newPuzzle(numbers?), setDifficulty(d), getCoins(), setCoins(n), destroy() }`.
Call `destroy()` when leaving the scene; it stops the timer and removes the keyboard listener.

The minigame only tracks coins while it's open. Saving them to the player's profile is up to the host game (use `onSolve`).

## How it works

- **Exact arithmetic.** All values are `Fraction`s, so 8 ÷ 3 stays exactly 8/3 and puzzles like `3 3 8 8 → 8 ÷ (3 − 8 ÷ 3)` work with no rounding errors.
- **Solver.** `findSolution` tries every pair of values with every operation, recursively, until one value is left. It prefers solutions with whole numbers only, then without negatives, then anything.
- **Puzzle generator.** `generatePuzzle` rolls four numbers in the difficulty's range and keeps them only if the solver finds an answer (whole numbers only on Easy). It accepts a seeded `rng` for repeatable puzzles.
- **UI state.** The component keeps the current cards, the steps taken and a history for undo. Each combine replaces two cards with one card in the second card's spot, and the new card stays selected so the student can keep going.

## Running the tests

From the repo root:

```bash
npx vitest run src/Tests/make24
```

- `make24Logic.test.ts` tests fractions, the solver (including the known count of 1362 solvable hands out of 1820) and the generator, using a seeded random number generator.
- `make24Component.test.ts` mounts the game in jsdom and clicks through it: combining cards, fractions, negatives, divide by zero, undo/reset, wrong answers, solving, coins, skipping, exiting and cleanup. Timers are faked so time-based results are exact.

The component tests need `jsdom` as a dev dependency (`npm install -D jsdom`). Keyboard shortcuts aren't covered by the tests, because jsdom doesn't lay out the page.
