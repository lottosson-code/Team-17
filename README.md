# Team 17 – Math RPG

A fantasy math game for grades 3–5, built with **Phaser 3 + TypeScript + Vite**. Players fight monsters by solving arithmetic problems, explore a classroom map, and play math minigames (Make 24, the Blacksmith's Armor Forge) to earn coins and upgrades.

| | |
| --- | --- |
| **Repository** | https://github.com/lottosson-code/Team-17 |
| **Backlog (user stories)** | https://github.com/lottosson-code/Team-17/issues |
| **CI (GitHub Actions)** | https://github.com/lottosson-code/Team-17/actions |
| **Team documentation** | [Central doc (Google Docs)](https://docs.google.com/document/d/1tDDdLpe68Lj6zzUeSxWi1jh3r_CDwnUiyNUmfILgeLU/edit?tab=t.bqwmq1mqcsdu) |

## Contents

1. [Getting started](#getting-started)
2. [Project status](#project-status)
3. [Project structure](#project-structure)
4. [Architecture overview](#architecture-overview)
5. [Modules](#modules)
   - [5.1 State management](#51-state-management-srcstate)
   - [5.2 Procedural audio engine](#52-procedural-audio-engine-srcaudio)
   - [5.3 Scenes and game flow](#53-scenes-and-game-flow-srcscenes)
   - [5.4 UI modals and helpers](#54-ui-modals-and-helpers-srcui)
   - [5.5 Combat / main level](#55-combat--main-level-srccombat)
   - [5.6 Math engine and Enemy](#56-math-engine-and-enemy-srcmath-srcmainlevel)
   - [5.7 Blacksmith minigame](#57-blacksmith-minigame-srcminigamesblacksmith)
   - [5.8 Make 24 minigame](#58-make-24-minigame-srcminigamesmake24)
6. [Testing](#testing)
7. [Contributing](#contributing)
8. [Team and ownership](#team-and-ownership)
9. [Known issues and next steps](#known-issues-and-next-steps)

---

## Getting started

Requires **Node 22.12+** (see `.nvmrc`).

```bash
npm install       # install dependencies
npm run dev       # start the dev server, then open the printed localhost link
npm test          # run all unit tests once (Vitest)
npm run build     # type-check and build for production
```

`npm run test:watch` reruns tests on every change, and `npm run typecheck` type-checks without building.

---

## Project status

| Area | Status | Pull requests |
| --- | --- | --- |
| Combat engine, Levels 1-1 and 1-2 | Merged | [#28](https://github.com/lottosson-code/Team-17/pull/28) |
| Battlefield art, animations and HUD | Merged | [#31](https://github.com/lottosson-code/Team-17/pull/31), [#33](https://github.com/lottosson-code/Team-17/pull/33) |
| Math engine and Enemy | Merged | [#24](https://github.com/lottosson-code/Team-17/pull/24), [#25](https://github.com/lottosson-code/Team-17/pull/25), [#30](https://github.com/lottosson-code/Team-17/pull/30) |
| Make 24 minigame and tests | Merged | [#27](https://github.com/lottosson-code/Team-17/pull/27), [#32](https://github.com/lottosson-code/Team-17/pull/32) |
| Blacksmith minigame | Merged | [#29](https://github.com/lottosson-code/Team-17/pull/29) |
| CI workflow | Merged | [#23](https://github.com/lottosson-code/Team-17/pull/23) |
| Main menu, map UI, settings, audio, progress tracking | Merged | [#26](https://github.com/lottosson-code/Team-17/pull/26) |

---

## Project structure

```text
.github/workflows/test.yml   CI: tests, type-check and build on every push and PR
docs/art/ART_BRIEF.md        Art direction and prompts for the battlefield art
public/assets/combat/        Enemy art and spritesheets (WebP), fonts
scripts/                     Python tools that turn source art into WebP files and spritesheets
src/
  main.ts                    Phaser game config (1280×720) and scene list
  scenes/                    Phaser scenes (menu, map, level select, combat)
  combat/                    Combat rules (no Phaser): model, levels, problems, lane layout
  combat/view/               Combat rendering (Phaser): battlefield, sprites, effects, HUD
  Math/                      Math engine: ProblemGenerator, MathProblem
  MainLevel/                 Enemy class used with the math engine
  minigames/blacksmith/      Armor Forge minigame (MVC, Konva) and its tests
  minigames/make24/          Make 24 minigame (HTML/CSS) with its own README
  Tests/                     Unit tests for combat, math engine, Enemy and Make 24
  ui/                        Shared UI helpers
  state/, audio/             Stores and sound manager (in PR #26)
```

---

## Architecture overview

```text
┌─────────────────────── Phaser game (src/main.ts) ───────────────────────┐
│  MainMenuScene ──start('Combat', {moduleId, levelId})──► CombatScene    │
│  DOM overlay: menu,                                      combat/view/   │
│  map, modals                                                            │
└────────┬──────────────────────────────────────────────────────┬─────────┘
         │                                                      │  tick(dt), submit(answer)
         ▼                                                      ▼  returns CombatEvent[]
┌───────── Singletons ─────────┐                  ┌─────── CombatModel ────────┐
│ SettingsStore → SoundManager │                  │ src/combat/ (no Phaser)    │
│ MapProgressStore             │                  │ LevelSpec · ProblemSource  │
│ src/state/ · src/audio/      │                  │ Enemy data · CombatEvent   │
└──────────────────────────────┘                  └────────────────────────────┘

Minigames (src/minigames/): Make 24 (HTML) · Blacksmith (Konva)
Math engine (src/Math/): ProblemGenerator · MathProblem · Enemy
```

**Connections in place:**
- The menu and map read settings and progress from the singleton stores (PR #26).
- `CombatScene` drives `CombatModel` and animates the events it returns.

**Planned (next sprint):**
- On victory, combat marks the level complete in `MapProgressStore` and returns to the map.
- The map opens the minigames.
- Minigame rewards (coins, defense, max HP) go into a shared player-stats store that combat reads.
- Combat gets its problems from the math engine through a `ProblemSource` adapter.

**Design principles used across modules**
- **Game logic is separate from rendering.** `CombatModel`, `BlacksmithModel` and Make 24's `logic.ts` contain no drawing code, so they can be unit tested without a browser.
- **Modules talk through small typed interfaces**, e.g. `CombatEvent`, `LevelSpec`, `BlacksmithViewInterface`, `MathProblem`, and Make 24's `onSolve` / `onExit` callbacks.
- **Randomness can be injected.** Models accept a random number generator, so tests are repeatable.

---

## Modules

### 5.1 State management (`src/state/`)

#### `settingsStore.ts` (`SettingsStore`)
Centralized store for all user and audio preferences.
- **Key responsibilities:**
  - Manages `musicVolume` (0–100), `sfxVolume` (0–100), `muted` (boolean), and `difficulty` (`Easy` | `Normal` | `Hard`).
  - Implements a reactive pub/sub listener pattern (`subscribe(listener)`) so audio and UI update immediately when settings change.
  - Automatically synchronizes with browser `localStorage` (`team17_math_rpg_settings_v1`), with an in-memory fallback for non-browser and test environments.
- **Key methods:**
  - `getSettings()`: returns a copy of the current configuration.
  - `setMusicVolume(val)` / `setSfxVolume(val)`: clamps input (0–100) and saves.
  - `toggleMute()` / `setMuted(boolean)`: toggles or explicitly sets audio muting.
  - `resetSettings()`: reverts settings to defaults.

#### `mapProgressStore.ts` (`MapProgressStore`)
Tracks level completion and unlock gating across classrooms (modules).
- **Key responsibilities:**
  - Defines the progression graph: Level 1 unlocks Levels 2 and 3; Level 3 opens the minigame branch; Boss Level 5 unlocks the next classroom.
  - Persists completed and unlocked level IDs to `localStorage` (`team17_math_rpg_map_progress_v1`).
  - Guards against invalid scene transitions via `attemptSelectLevel(moduleId, levelId)`.
- **Key methods:**
  - `isLevelUnlocked(moduleId, levelId)` / `isLevelCompleted(moduleId, levelId)`: progression checks used by the map UI.
  - `isModuleUnlocked(moduleId)`: whether Classroom 1, 2 or 3 is accessible.
  - `completeLevel(moduleId, levelId)`: marks a level complete, unlocks its targets, and saves.
  - `resetProgress()`: resets progress to the initial state (only Module 1 Level 1 unlocked) when starting a new game.

To reset progress by hand during testing, run `localStorage.removeItem('team17_math_rpg_map_progress_v1')` in the browser console.

### 5.2 Procedural audio engine (`src/audio/`)

> **Status:** in PR [#26](https://github.com/lottosson-code/Team-17/pull/26), not yet merged.

#### `soundManager.ts` (`SoundManager`)
A Web Audio API synthesizer that generates sound effects and music in real time, with no `.mp3` or `.wav` files.
- **Key responsibilities:**
  - **Autoplay handling:** registers passive listeners (`pointerdown`, `keydown`, `touchstart`) to unlock and resume a suspended browser `AudioContext`.
  - **Volume routing:** routes music and sound effects through separate `GainNode` channels (`musicGainNode` and `sfxGainNode`).
  - **Reactive volume control:** subscribes to `settingsStore` and recalculates gains smoothly, without audible pops.
- **Audio synthesizers:**
  - `playSfx(type)`: procedural sound effects built from waveform envelopes:
    - `'hover'`: high-frequency sine with rapid exponential decay (button hover).
    - `'click'`: two-tone triangle/sine chime (button clicks, checkboxes).
    - `'start'`: three-note ascending RPG arpeggio (level launch).
    - `'modalOpen'` / `'modalClose'`: ascending and descending pitch slides.
  - `startMenuMusic()` / `stopMenuMusic()`: loops a calm pentatonic arpeggio using scheduled oscillators.

### 5.3 Scenes and game flow (`src/scenes/`)

**On `main` today:** a placeholder flow, `MainMenu → WorldMap → LevelSelect → Combat`. `LevelSelectScene` starts combat with `scene.start('Combat', { moduleId, levelId })`. PR #26 replaces the menu, map and level-select scenes with the scenes below.

#### `MainMenuScene.ts` (PR #26)
The entry Phaser scene, combining the canvas and DOM UI layers.
- **Key responsibilities:**
  - Mounts the combined DOM menu and map UI into a responsive overlay (`createSceneOverlay`).
  - Connects menu actions:
    - **New Game:** clears progress (`mapProgressStore.resetProgress()`) and opens the map.
    - **Continue:** opens the map, keeping existing saves.
    - **Settings / Quit:** open accessible DOM modals.
  - Starts background music on create, and shuts down audio and UI cleanly on scene transitions.
  - Accepts `{ showMap: true, roomIndex }` in `init()` to return players to their classroom map after a battle.

#### `CombatScene.ts`
The combat scene is documented in [5.5](#55-combat--main-level-srccombat). PR #26 adds a bridge to the menu:
- Receives `moduleId`, `levelId` and `activity` from the map.
- Opens the in-game pause menu and settings without leaving the battle.
- On victory, marks the level complete in `mapProgressStore` and returns to `MainMenuScene` with `{ showMap: true, roomIndex }`.

### 5.4 UI modals and helpers (`src/ui/`)

> **Status:** in PR [#26](https://github.com/lottosson-code/Team-17/pull/26), not yet merged, except `components/createTextButton.ts`, which is on `main`.

- **`sceneOverlay.ts` (`createSceneOverlay`):** creates an overlay `div` positioned over the Phaser canvas, and resizes it to match Phaser's `FIT` scale mode so the DOM menu, map and modals line up with the game.
- **`settingsModal.ts` (`createSettingsModal`):** an accessible modal in the DOM overlay with volume sliders, a mute toggle and difficulty radio buttons. It connects directly to `settingsStore` and plays sound effects through `soundManager`.
- **`quitModal.ts` (`createQuitModal`):** a confirmation dialog before quitting. It supports Escape to dismiss and resolves a promise with the player's choice.
- **`levelSelection.ts` (`toGameplaySelection`):** converts map selection events (`roomId`, `levelId`, `levelNumber`) into what `CombatScene` expects (`moduleId`, `levelId`, `activity`).

### 5.5 Combat / main level (`src/combat/`)

**What it does:** enemies walk down 4 lanes toward the wizard, each showing a math problem. Typing the answer and pressing Enter damages the enemy whose problem it solves. No two enemies on screen ever share an answer, so every answer has exactly one target. Enemies that reach the wizard attack until defeated, and the player loses at 0 HP. Levels follow a Plants vs. Zombies-style pattern: trickles of enemies, then waves (shown as skulls on the progress bar), then a finale that can play a boss cutscene. Levels 1-1 (addition under 100, with the boss turning + into ×) and 1-2 (times tables and ×0, with a 16-hit mini-boss) are playable.

**Structure**

| File | Responsibility |
| --- | --- |
| `CombatModel.ts` | All game rules, in plain TypeScript with no Phaser code. The scene calls `tick(dt)` every frame and `submit(answer)` on Enter. Both return a list of `CombatEvent`s (`hit`, `wrongAnswer`, `playerDamaged`, `won`…) that the scene animates. |
| `types.ts` | Data shapes: `LevelSpec`, `SpawnGroup`, `EnemyKind`, `Enemy`, `CombatEvent`. |
| `levels.ts` | Levels are data, so a new level is a new `LevelSpec` with no engine changes. `validateLevel` rejects mistakes. |
| `problems.ts` | Problem sources with the signature `(liveAnswers, liveProblems) => problem`. Temporary, until combat uses the shared math engine. |
| `laneLayout.ts` | 2.5D perspective math. Enemies store `progress` (0 = spawn, 1 = at the wizard); this file turns it into screen x / y / scale. |
| `view/` | Phaser rendering only: `Battlefield` (room and lanes), `EnemySprite`, `WizardSprite`, `Effects`, `Hud`. `theme.ts` holds all art and layout values, so another module can reskin it. |
| `src/scenes/CombatScene.ts` | Connects input, the model and the view: loads art, runs the model each frame, and plays cutscenes. |

**Using it**

```ts
const model = new CombatModel(getLevel(1, 1));   // optional 2nd argument: a random number generator
for (const event of model.tick(deltaMs)) { /* animate 'enemySpawned', 'playerDamaged', 'won', … */ }
for (const event of model.submit(42))    { /* 'hit' / 'enemyDefeated', or 'wrongAnswer' */ }
```

**Connecting to other modules:** start a level with `scene.start('Combat', { moduleId, levelId })`. On `won`, the scene should mark the level complete in the map progress store; this goes in once PR #26 merges.

**Tests:** `npx vitest run src/Tests/CombatModel.test.ts src/Tests/problems.test.ts src/Tests/laneLayout.test.ts src/Tests/hudLogic.test.ts src/Tests/theme.test.ts` (74 tests, with a seeded random number generator). More detail is in PRs [#28](https://github.com/lottosson-code/Team-17/pull/28) and [#31](https://github.com/lottosson-code/Team-17/pull/31).

### 5.6 Math engine and Enemy (`src/Math/`, `src/MainLevel/`)

| File | Responsibility |
| --- | --- |
| `Math/ProblemGenerator.ts` | Generates a `MathProblem`. The constructor takes a `ProblemType`: `"addition"`, `"subtraction"`, `"multiplication"` or `"division"`. Subtraction answers are never negative and division answers are whole numbers. |
| `Math/MathProblem.ts` | Interface for generated problems: `first_operand`, `second_operand`, `result` and `operator`. It makes clear what an Enemy holds, reduces coupling, and makes it easy to turn a problem into a string. |
| `MainLevel/Enemy.ts` | Stores the state of one enemy unit, with helper functions to check that state. Most importantly, it holds a `MathProblem` generated by `ProblemGenerator`. |

**Tests:**
- `src/Tests/ProblemGenerator.test.ts` tests the constructor for every `ProblemType`, that answers are unique, and the `remove` / `reset` functions.
- `src/Tests/Enemy.test.ts` checks that an Enemy's fields are initialized as expected (some random, some fixed) and that its functions behave correctly.
- Run them with `npm test`.

### 5.7 Blacksmith minigame (`src/minigames/blacksmith/`)

**Overview:** players solve systems of addition equations to upgrade their character's Defense and Max HP. Each item on the chalkboard ([Feather], [Potion], [Ingot]) stands for a hidden positive whole number. Players can switch between easy (2 variables), medium (3 variables) and hard (3 variables with larger sums), and play as many rounds as they like for stat upgrades.

| File | Responsibility |
| --- | --- |
| `BlacksmithModel.ts` | Minigame state, difficulty rules and player stats (`defense`, `maxHitpoints`). It picks whole-number values for each item first and builds the equations from them, so every puzzle has a whole-number solution. It also validates guesses and calculates rewards. |
| `BlacksmithView.ts` | Draws the UI with Konva (`Konva.Group`, `Konva.Rect`, `Konva.Text`): chalkboard equations, player stats, difficulty buttons, and clickable answer boxes the player types into. |
| `BlacksmithController.ts` | Connects the view and the model. It listens for user actions (switching difficulty, typing guesses, clicking Forge Armor, returning to the map), updates the model and refreshes the view. |

**Rule:** business logic stays inside `BlacksmithModel.ts`, and the view only draws and reports input.

**Tests:**
- `BlacksmithModel.test.ts` covers 2- and 3-variable puzzle generation, switching difficulty, how rewards scale, generating a new puzzle every round, and invalid or incomplete input.
- `BlacksmithController.test.ts` uses a mock view to check that typing numbers, non-numeric text, changing difficulty, and submitting right or wrong answers update the model and view correctly.
- Run them with `npx vitest run src/minigames/blacksmith`.

### 5.8 Make 24 minigame (`src/minigames/make24/`)

**Overview:** players combine four numbers with +, −, × and ÷ to make exactly 24 and earn coins. They tap a number card, an operation, then a second card; the two cards merge into one, and the player continues until one card is left. Every puzzle is guaranteed to be solvable.
- **Difficulties:** easy (numbers 1–9, always solvable with whole numbers), normal (1–10) and hard (1–13, may need fractions). Players can play as many rounds as they like.
- **Coins per solve:** 5 on easy, 10 on normal, 15 on hard.
- The game also tracks puzzles solved, a streak and a timer.

See the module's own [README](src/minigames/make24/README.md) for the embedding API.

| File | Responsibility |
| --- | --- |
| `src/logic.ts` | Game logic with no UI code. `Fraction` does exact arithmetic, so 8 ÷ 3 stays exactly 8/3. `findSolution` tries every pair of numbers with every operation until one value is left, preferring whole-number solutions. `generatePuzzle` keeps rolling four numbers in the difficulty's range until the solver finds an answer. |
| `src/make24.ts` | Draws the UI with HTML and connects it to the logic. `mountMake24` shows the cards, operation buttons, step log, coin and stat counters, difficulty buttons, Undo / Reset / New puzzle, and the win screen. It handles clicks and keyboard shortcuts, keeps an undo history, and reports results through callbacks: `onSolve` (coins earned), `onSkip`, and `onExit` (return to the map). |
| `src/make24.css` | Styles that match the main menu. Every class starts with `cse-make24`, so nothing clashes with other screens, and the 16:9 scene scales with the window. |
| `fonts/` | Lora and Poppins, bundled so the game works offline. |
| `make24-demo.html` | A self-contained demo you can open by double-clicking, without running the project. |

**Tests:**
- `src/Tests/make24/make24Logic.test.ts` covers exact fraction math and the solver, including puzzles that need fractions, unsolvable hands like 1 1 1 1, and the known count of 1362 solvable hands out of 1820. It also covers expression formatting and puzzle generation for all three difficulties, with a seeded random number generator.
- `src/Tests/make24/make24Component.test.ts` mounts the game in jsdom and clicks through it like a player. It covers combining cards, fractions and negative numbers, dividing by zero, undo and reset, wrong final answers, solving puzzles, coin rewards for each difficulty, skipping puzzles, and the Map button.
- Run them with `npx vitest run src/Tests/make24`.

---

## Testing

All tests use **Vitest** and run with `npm test`. CI ([`.github/workflows/test.yml`](.github/workflows/test.yml)) runs `npm ci`, `npm test` and `npm run build` on every push and pull request, so nothing merges with failing tests or type errors.

| Module | Test files | Tests on `main` |
| --- | --- | --- |
| Combat | `CombatModel`, `problems`, `laneLayout`, `hudLogic`, `theme` | 74 |
| Make 24 | `make24Logic`, `make24Component` | 62 |
| Blacksmith | `BlacksmithModel`, `BlacksmithController` | 14 |
| Math engine and Enemy | `ProblemGenerator`, `Enemy` | 14 |
| Menu, settings, audio, progress | `settingsStore`, `soundManager`, `mapProgressStore`, `MainMenuScene`, `settingsModal`, `quitModal` | in PR #26 |

**Testing conventions**
- Test the logic, not the drawing: rules live in models with no rendering code, and views stay thin.
- Inject randomness: pass a seeded random number generator so runs repeat exactly.
- Mock outside dependencies: e.g. a mock `AudioContext` for the sound manager, a mock view for the Blacksmith controller, and jsdom for DOM components.
- Cover the successful path, the failure path (wrong answers, invalid data) and edge cases (empty input, divide by zero, no unique answer left).

Rendering code (Phaser and Konva views) is checked by playtesting with `npm run dev`.

---

## Contributing

1. **Branch** from `main` with a descriptive name: `feature/<area>` (e.g. `feature/combat-core`, `feature/blacksmith-minigame`) or `docs/<topic>`.
2. **Commit** in small, focused steps. Messages say what changed and why, e.g. `Combat (Charles): Implemented level 1-2 … Added tests.`
3. **Open a pull request into `main`.** Keep each PR to about one user story. The description should cover what the feature does, how to try it and run its tests, and notable design decisions (a PR template is being added to make this consistent).
4. **Review:** at least one teammate tries the branch, reviews the code and approves before merging. CI must pass.
5. **Ask first:** talk to a module's owner (see below) before changing their code, and agree on interfaces between modules before building on them.
6. **Link** the PR to its user story in Issues, and close the issue once the PR merges.

**Code conventions:** TypeScript strict mode; keep game logic free of rendering code; prefix CSS classes by module (e.g. `cse-make24-`); keep art in `public/assets/` (WebP, made with the scripts in `scripts/`).

---

## Team and ownership

| Area | Owner |
| --- | --- |
| Combat / main level, battlefield art and HUD | Charles |
| Math engine, Enemy, CI workflow | Alex |
| Main menu, settings, audio, progress tracking | Ryan |
| Menu, map and pause-menu UI | Jincheng |
| Blacksmith minigame | Dominic |
| Make 24 minigame | Laressa |

---

## Known issues and next steps

- **Integration:** connect combat victories to `MapProgressStore`, the map to the minigames, and minigame rewards to a shared player-stats store that combat reads.
- **Math engine:** move combat's problem generation (`src/combat/problems.ts`) onto the shared math engine.
- **Rendering:** decide how the Konva (Blacksmith) and HTML (Make 24, menus) screens sit alongside the Phaser canvas.
- **Blacksmith:** decide the scope of unlimited play, and whether upgrades need a cost or cap.
- **Make 24:** make the difficulty setting change the puzzles noticeably, and add a tutorial.
- **Balance:** playtest difficulty and pacing with younger students.
