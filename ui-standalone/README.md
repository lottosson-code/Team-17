# Standalone UI preview and test

This directory is a self-contained snapshot of Jincheng's existing Team 17 UI modules, plus a small browser preview and the navigation test. It has its own dependencies, assets, configuration and entry point. It does not import code from the parent project or change the game's entry point.

## Source and purpose

The menu, map, pause menu and assets are copied without modification from the `UI` branch at commit `f3911536a7f553258775f6f07d03b27cc6cdc763`. The UI implementation originated in commits `f5a1908` and `27129fa` and was already integrated into the game through Ryan's PR #26. The test originated in `f391153`.

This addition provides a separately runnable preview/test environment. It does not implement the UI feature a second time or replace the integrated game modules. Changes to the integrated modules do not automatically update this snapshot. A passing snapshot test does not prove the latest integrated game behaves identically. The copied implementation should not be described as newly written code for this PR.

## Run

Use Node 22.12 or later. Open a terminal in **this directory**, then run:

```sh
npm ci
npm test
npm run build
npm run dev
```

Open the address printed by Vite. `npm test` should report **1 passed test**. The root game does not need to be running.

## Preview behavior

- New Game and Continue both open the map for this preview. They do not create or restore saved progress.
- Map opens the classroom list. Choose a classroom and level; the selected IDs appear above the preview. Back returns to the classroom list and then the menu.
- Preview pause menu opens the existing pause component. Resume closes it; Quit returns to the menu.
- Settings, game quit and pause restart/settings are disabled because this standalone preview has no corresponding game services.
- No Phaser game, combat, audio or persisted progress is loaded. No new character animation is added.

## Automated test

`navigation.check.ts` mounts the local menu/map modules in Happy DOM, clicks Map, Classroom 2 and Level 4, checks state and visibility, verifies the selection callback exactly once, then checks both return steps. The callback is a recording spy; the test does not launch gameplay or check visual quality or the pause preview.

The filename and explicit Vitest configuration keep this check separate from the root game's default test discovery.

## Validation of this addition

- The standalone automated test passed: 1 test in 1 file.
- TypeScript checking and the Vite production build passed.
- A browser keyboard smoke check verified New Game/Continue opening the map, Classroom 2 / Level 4 reporting the selected IDs, returning to the main menu, and opening/resuming/quitting the pause preview.
- The 33 copied module/asset files were checked byte-for-byte against the source snapshot; the copied navigation check matches the existing test.
