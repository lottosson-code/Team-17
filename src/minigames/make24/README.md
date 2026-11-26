# Make 24 minigame

Students get four numbers and combine them with + − × ÷ until one card is left. If it's 24, they win and earn coins.

## Files

| Path | What it is |
| --- | --- |
| `src/logic.ts` | Math rules: exact fractions, a solver, and a random puzzle generator that only returns solvable puzzles. No page code. |
| `src/Make24Model.ts` | **Model.** The game state and rules: the cards, picking and combining, undo/reset, winning, coins, streak and timer. No page code. |
| `src/Make24View.ts` | **View.** Builds the HTML and redraws it from the model. Never changes the game. |
| `src/tutorial.ts` | The "How to play" card: its HTML, and remembering (in browser storage) that the player has seen it. |
| `src/make24.ts` | **Controller.** `mountMake24(container, options)`: turns clicks and keys into model calls, tells the view to redraw, and reports results through callbacks. |
| `src/make24.css` | Styles. Every class starts with `cse-make24` so nothing leaks into the rest of the game. Colors match the main menu. |
| `fonts/` | Lora (titles) and Poppins (everything else), subset to Latin. SIL Open Font License, see `fonts/FONTS-LICENSE.txt`. |
| `make24-demo.html` | Self-contained demo. Double-click it to play without running the project. |
| `src/Tests/make24/` (repo root) | Unit tests for `logic.ts` and `Make24Model.ts`, and component tests for the whole minigame. |

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
| `keyboard` | `true` | Shortcuts: `1`–`4` cards, `+ - * x /` operations, `Backspace`/`U` undo, `R` reset, `N` new puzzle, `H` hint, `?` how to play, `Esc` deselect or close. Holding a key down only counts as one press for `N`, so a held key can't skip several puzzles. |
| `tutorial` | `'first-time'` | When the how-to-play card opens by itself: `'first-time'` (first time on this device), `'always'`, or `'never'` (only from the **?** button). |
| `tutorialStorage` | browser `localStorage` | Where "seen the card" is remembered. Tests pass a fake one so they don't depend on the environment. |
| `coins` | `0` | Player's balance when the minigame opens. |
| `coinReward` | Easy 5 · Normal 10 · Hard 15 | Coins per solve: a number, or a function `({ difficulty, timeMs, streak }) => number`. Negative values pay 0; fractions round down. |
| `onSolve(result)` | — | `{ numbers, target, difficulty, expression, steps, timeMs, coinsEarned, totalCoins, hintsUsed }` |
| `onSkip(numbers)` | — | The player pressed "New puzzle" without solving. |
| `onExit()` | — | The player pressed the Map / Back to map button. |

`mountMake24` returns `{ element, newPuzzle(numbers?), setDifficulty(d), getCoins(), setCoins(n), showTutorial(), destroy() }`.
Call `destroy()` when leaving the scene; it stops the timer and removes the keyboard listener.

The minigame only tracks coins while it's open. Saving them to the player's profile is up to the host game (use `onSolve`).

## How it works

- **Exact arithmetic.** All values are `Fraction`s, so 8 ÷ 3 stays exactly 8/3 and puzzles like `3 3 8 8 → 8 ÷ (3 − 8 ÷ 3)` work with no rounding errors.
- **Solver.** `findSolution` tries every pair of values with every operation, recursively, until one value is left. It prefers solutions with whole numbers only, then without negatives, then anything.
- **Puzzle generator.** `generatePuzzle` rolls four numbers in the difficulty's range and keeps them only if the solver finds an answer (whole numbers only on Easy). It accepts a seeded `rng` for repeatable puzzles.
- **Model / View / Controller.** A click goes to the controller (`make24.ts`), which calls the model (for example `model.pickCard(id)`). The model returns what happened (`'combined'`, `'divide-by-zero'`, `'solved'`…), the controller shows the right message, and the view redraws from the model.
- **How to play.** A card with four illustrated steps opens the first time a player starts the game; the **?** button next to the difficulty switch (or the `?` key) reopens it. "Seen" is remembered in browser storage under `cse-make24-tutorial-seen`; if storage is blocked, the card just shows again next time. The model's clock is paused while the card is open, and while it is open only the card's own buttons work, so the game behind it can't be changed with Tab and Enter.
- **Hints.** The **Hint** button (or the `H` key) asks the solver for a way to finish from the cards on the table right now, and lights up the first step: two cards and an operation, plus a message like "Hint: try 8 ÷ 3". If those cards can't make 24 anymore, it says so and suggests Undo or Reset. Using any hint halves that puzzle's coins (rounded down), and `onSolve` reports `hintsUsed`. The hint goes away after the next move, Undo, Reset or a new puzzle.
- **Combining cards.** Each combine saves a snapshot for Undo, then replaces two cards with one card in the second card's spot. The new card stays selected so the student can keep going. With only one card left there is nothing to combine, so choosing an operation does nothing.

## Running the tests

From the repo root:

```bash
npx vitest run src/Tests/make24
```

- `make24Logic.test.ts` tests fractions, the solver (including the known count of 1362 solvable hands out of 1820) and the generator, using a seeded random number generator.
- `make24Model.test.ts` tests the game rules directly, with no page: picking, combining, divide by zero, wrong totals, solving, coins, undo/reset, skipping, the timer and pausing it, and hints.
- `make24Component.test.ts` mounts the game in jsdom and clicks through it: combining cards, fractions, negatives, divide by zero, undo/reset, wrong answers, solving, coins, skipping, exiting, cleanup, the how-to-play card and the Hint button. Timers are faked so time-based results are exact.

The component tests need `jsdom` as a dev dependency (`npm install -D jsdom`). A few keyboard behaviors (held keys, an operation key with one card left) are tested by sending key events to the page; because jsdom doesn't lay out the page, those tests tell the game it is on screen. The rest of the keyboard shortcuts aren't covered by tests.
