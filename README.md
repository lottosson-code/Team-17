# Team 17 — Math RPG and UI Modules

This repository contains the team's Phaser game and three reusable TypeScript UI design modules: **Main Menu**, **Map**, and an independent **Pause Menu**. This root README is the single documentation entry for their public interfaces, routes, layout settings and artwork.

## Repository layout

```text
Team-17/
├── README.md
├── package.json, package-lock.json
├── tsconfig.json, tsconfig.ui.json, vite.config.ts
├── src/                    Existing Phaser scenes, math logic and tests
├── main menu/              Main menu, menu/map navigation and assets
├── map/                    Classroom/island map, route graph and assets
└── pause menu/             Independent transparent CSS blackboard window
```

The three UI modules are source designs for the host game model to integrate through callbacks. The existing entry point in src/main.ts and the team's Phaser scenes remain unchanged; the new DOM-based modules are not automatically mounted by that entry point. Render them in a sized HTML overlay outside the Phaser canvas when integrating them.

## Install, run and validate

Use Node.js 22.12 or newer (the repository's .nvmrc selects Node 22). From the repository root:

```sh
npm ci
npm run dev
```

| Script | Purpose |
|---|---|
| `npm test` | Run the existing Vitest tests. |
| `npm run typecheck` | Type-check the application and all three UI modules. |
| `npm run typecheck:ui` | Type-check the three UI modules independently. |
| `npm run build` | Type-check everything and produce the existing Vite application in dist/. |
| `npm run build:ui` | Emit standalone UI ES modules, declarations and source maps beside the TypeScript sources. |
| `npm run preview` | Serve the built application. |
| `npm run test:watch` | Run the existing tests in watch mode. |

The UI modules add no runtime dependency. The repository retains its existing Phaser, Vite, TypeScript and Vitest packages and lockfile. UI-generated .js, .d.ts and .js.map files are ignored by Git and recreated with build:ui; CSS and artwork remain beside the sources. TypeScript source imports intentionally use .js suffixes for emitted browser modules. JavaScript imports do not load CSS automatically. This handoff supports serving the emitted UI modules as standalone static ES modules over HTTP with their sibling folders, CSS and artwork preserved; do not open them through file://.

### Standalone delivery and Vite integration

`npm run build:ui` emits the standalone UI files in place. Deploy the three module directories, including the emitted JavaScript, CSS and assets, together beside the host application's HTML/module entry. The relative imports and artwork URLs then resolve within those directories. The root `npm run build` builds the existing Phaser/Vite application; it does not automatically copy these unused standalone UI directories into dist/.

Before importing `createGameUI` or `createMap` directly into the Vite application bundle, adapt the map's asset handling. The current map helper uses `new URL('./assets/' + name, import.meta.url)`, which Vite cannot statically rewrite for the classroom, dream and bridge images. A bundler integration must use statically analyzable asset URLs/imports, or provide an explicit copy/URL strategy that preserves the module-relative layout. That adaptation is host integration work and is not applied by this source-design handoff. The static main-menu image URLs and island CSS atlas URL do not remove this requirement for the other map assets.

## Phaser integration boundary

The current Phaser scenes use numeric moduleId/levelId values. The UI map returns stable strings such as classroom-02-level-06 plus levelNumber. The game's adapter must map classroom-01/02/03 to the appropriate game modules. Nodes 1..5 are main levels; nodes 6..8 are Minigame 1..3 and require the game's minigame destination rather than blindly treating them as ordinary levels. The UI does not define the game's save, progression, loading or minigame model.

When adding the DOM overlay, suspend game-model input while pause/settings are open and destroy UI controllers when unloading their owner scene. The examples below show host-side contracts; implement or adapt those contracts in the real game's scene manager.

## Public entry points and CSS

The following paths assume a host file at this directory's root; adapt them relative to the host file in your game.

| Use | Import | Stylesheet |
|---|---|---|
| Main menu with built-in map navigation | `createGameUI` from `./main menu/index.js` | `./main%20menu/game-ui.css` |
| Main menu alone | `createMainMenu` from `./main menu/index.js` | `./main%20menu/main-menu.css` |
| Map alone | `createMap` from `./map/index.js` | `./map/map.css` |
| Gameplay pause window | `createPauseMenu` from `./pause menu/index.js` | `./pause%20menu/pause-menu.css` |
| Route graph | `MAP_CONNECTIONS` from `./map/index.js` | No additional stylesheet |

```html
<link rel="stylesheet" href="./main%20menu/game-ui.css">
<link rel="stylesheet" href="./pause%20menu/pause-menu.css">
```

`game-ui.css` imports both main-menu.css and map.css. JavaScript imports never load CSS automatically. The pause stylesheet is separate and is used during gameplay. No external font download is required.

## Navigation and ownership

```text
Main Menu
  New Game  -> host starts a session -> gameplay
  Continue  -> host restores a save  -> gameplay
  Settings  -> host settings screen  -> Main Menu
  Quit Game -> host exit/launcher action
  Map       -> three-classroom selection
                 Classroom Level 1/2/3 -> that classroom's islands
                 Main Menu            -> existing Main Menu
                    Islands: Level 1..5 and Minigame 1..3
                      Select -> host receives selection -> gameplay
                      Back   -> three-classroom selection

Gameplay
  Pause -> host pauses model -> independent Pause Menu
    Resume       -> host resumes model and hides pause window
    Restart      -> host resets current level, resumes and hides window
    Settings     -> host settings screen -> Pause Menu (model stays paused)
    Quit to Menu -> host ends gameplay and shows existing Main Menu
```

Only the Map / Main Menu / classroom / Back UI routes are implemented internally. Every gameplay destination is a host callback. Keep the reusable menu/map instance when entering gameplay by hiding `ui.element`; restore it and call `showMap()` or `showMainMenu()` on return. `showMap()` opens the classroom screen. It does not directly open a particular classroom or island. Use `destroy()` when a UI is permanently unloaded.

## Main menu interface

Source: [types.ts](./main%20menu/types.ts), [main-menu.ts](./main%20menu/main-menu.ts).

`createMainMenu(host: HTMLElement, options?: MainMenuOptions): MainMenuController`

The component appends to the host without clearing its other children. The host width determines a 16:9 menu scene. By default it displays New Game, Continue, Settings, Quit Game and a separate Map icon/button.

### Options and callbacks

| `MainMenuOptions` field | Type and behavior |
|---|---|
| `title` | Optional heading string. |
| `backgroundUrl` | Optional replacement for `main menu/assets/classroom.png`. |
| `mapIconUrl` | Optional replacement for `main menu/assets/map.svg`. |
| `labels` | `Partial<MenuLabels>`; override `newGame`, `continue`, `settings`, `quit`, `map`, `navigation`, `error`. |
| `layout` | `Partial<MenuLayout>`; percentage values from 0 to 100, listed below. |
| `theme` | `Partial<MenuTheme>`; colors/fonts listed below. |
| `callbacks` | `MenuCallbacks`; optional handlers keyed by `newGame`, `continue`, `settings`, `quit`, `map`. |
| `disabled` | `Partial<Record<MenuAction, boolean>>`; disable selected buttons. |
| `onError` | `(error: unknown, context: MenuActionContext) => void`; host error reporting. |

`MenuAction` is `'newGame' | 'continue' | 'settings' | 'quit' | 'map'`. `MENU_ACTIONS` exports that order. `MenuHandler` is `(context: MenuActionContext) => void | Promise<void>`. Each context contains:

| Field | Meaning |
|---|---|
| `action` | Stable action key, independent of the visible label. |
| `menu` | This `MainMenuController`. |
| `signal` | `AbortSignal`; aborted when the menu is destroyed. Honor it after awaited work. |

The host implements the action destinations shown in the navigation diagram. Without a callback, a main-menu button does not navigate. Asynchronous callbacks lock all menu actions until settled. Errors are reported through `onError`, an accessible status and the bubbling `mainmenu:error` event with `{ error, action }` detail. An error thrown by `onError` produces another error event.

`MenuLayout` fields and defaults are `titleTop: 21.5`, `panelTop: 42`, `panelLeft: 34`, `panelWidth: 32`, `mapTop: 31.5`, `mapLeft: 61.6`, `mapWidth: 8.1`. These are percentages of the full menu scene. Invalid values throw `RangeError` before applying the patch. Remaining geometry, including the panel's fixed height, is in [main-menu.css](./main%20menu/main-menu.css).

`MenuTheme` fields are `titleColor`, `titleOutline`, `titleFont`, `bodyFont`, `panelColor`, `frameColor`, `buttonColor`, `buttonHoverColor`, `buttonTextColor`, `focusColor`.

### Controller

| `MainMenuController` member | Behavior |
|---|---|
| `element` | Read-only reference to the root HTMLElement. |
| `update(options)` | Merge a configuration patch; preserve omitted labels/callbacks/disabled values. |
| `setCallbacks(callbacks)` | Replace every callback. Pass `{}` to disconnect them all. |
| `setDisabled(action, disabled)` | Enable/disable one action. |
| `setVisible(visible)` | Show/hide the UI; does not pause/resume a game model. |
| `focus(action?)` | Focus the requested enabled action, defaulting to `continue`; fall back to the first enabled action. |
| `destroy()` | Abort the pending action, remove listeners and this root; safe to repeat. |

## Combined main menu and map interface

Source: [game-ui-types.ts](./main%20menu/game-ui-types.ts), [game-ui.ts](./main%20menu/game-ui.ts).

`createGameUI(host: HTMLElement, options?: GameUIOptions): GameUIController`

`GameUIOptions` has `menu?: MainMenuOptions` and `onLevelSelect?: (selection: LevelSelection) => void`. The combined UI reserves `menu.callbacks.map` for its internal navigation; a supplied Map handler is replaced. New Game, Continue, Settings and Quit handlers are forwarded to the host.

| `GameUIController` member | Behavior |
|---|---|
| `element` | Root containing the retained main menu and map. Hide this when showing gameplay elsewhere. |
| `getState()` | Returns `GameUIState`: `{ scene: 'menu' | 'map', map: Readonly<MapState> }`. |
| `showMainMenu()` | Show the existing main menu and focus its Map action. |
| `showMap()` | Show the map's classroom screen and focus its first classroom. |
| `destroy()` | Destroy both owned modules and their wrapper; safe to repeat. |

The combined controller intentionally exposes neither its child controllers nor the pause window. Configure child menu callbacks at construction. Mount pause separately in the gameplay overlay.

## Map interface and route planning

Source: [types.ts](./map/types.ts), [layout.ts](./map/layout.ts), [map.ts](./map/map.ts).

`createMap(host: HTMLElement, options?: MapOptions): MapController`

`MapOptions` has two optional, synchronous callbacks:

| Callback | When called and what the host does |
|---|---|
| `onLevelSelect(selection)` | After an island bounces and selection state changes. Pass the stable IDs to the game's loader and show gameplay. |
| `onBackToMenu()` | When Main Menu is clicked on the classroom screen. Show the existing main menu. The combined controller wires this automatically. |

The map does not await/catch callback results or lock asynchronous level loading. If the host loads a level asynchronously, it owns loading state, duplicate-entry prevention and error handling. Without a return callback, the classroom Main Menu button is hidden.

`LevelSelection` contains these read-only fields:

```ts
interface LevelSelection {
  readonly roomId: string;
  readonly levelId: string;
  readonly levelNumber: number;
  readonly selectionCount: number;
}
```

Room IDs are `classroom-01`, `classroom-02`, `classroom-03`. Each room has node indices 1 through 8. `levelId` is `<roomId>-level-<two-digit index>`, for example `classroom-02-level-06`. `levelNumber` is the internal node index, so 6 means **Minigame 1**, not a displayed Level 6. `selectionCount` increases for every selection in this map instance.

Every classroom reuses this layout and these connections:

```text
Level 1 -> Level 2 -> Level 3 -> Level 4 -> Level 5
                        |
                        v
                   Minigame 1 -> Minigame 2 -> Minigame 3
```

The upper five islands occupy approximately the upper two-thirds of the scene; the lower three form the branch. `MAP_CONNECTIONS` is exported as `MapConnection[]`, where `MapConnection` has read-only `fromLevel: number` and `toLevel: number`. Its edges are `(1,2), (2,3), (3,4), (4,5), (3,6), (6,7), (7,8)`.

These edges define decorative bridge connections and data the host may later use for travel/unlock rules. The current UI allows **all eight islands** to be selected; it does not implement prerequisites, movement, progress persistence or unlock enforcement. Classroom labels and submap titles are placeholders. Every classroom resets the displayed Level and Minigame numbering.

`MapState` has read-only `view: 'rooms' | 'islands'`, `roomId: string | null`, `selectedLevelId: string | null`, and `selectionCount: number`.

| `MapController` member | Behavior |
|---|---|
| `element` | Root map HTMLElement. Host width determines the 16:9 scene. |
| `getState()` | Return a copy of current state. Mutating the copy does not update the map. |
| `showRooms()` | Return to classroom selection; does not clear the recorded selected level/count. |
| `focus()` | Focus the first current classroom/island button after the host makes the map visible. |
| `destroy()` | Cancel animations, detach handlers and remove this map; safe to repeat. |

The Back button and Escape in a submap return to classrooms. Map coordinates, sprite indices, island hit polygons and route data are in `map/layout.ts`; labels are in `map/labels.ts`. Main-route islands use sprite indices 0..4; Minigames reuse 0..2. Island presses also update the root's `data-selected-level-id` and each button's `data-selected`, `data-activation-count` and `aria-pressed` attributes. Empty sky above an island is not a hit target.

## Pause menu interface

Source: [types.ts](./pause%20menu/types.ts), [pause-menu.ts](./pause%20menu/pause-menu.ts), [pause-menu.css](./pause%20menu/pause-menu.css).

`createPauseMenu(host: HTMLElement, options?: PauseMenuOptions): PauseMenuController`

Mount this independently during gameplay. Give its host `position: relative`, `absolute` or `fixed`, plus a definite width and height. The transparent overlay fills that positioned area; it has no scene background or dimming layer. Mount once with `visible: false`; pause the model before calling `setVisible(true)`.

| `PauseMenuOptions` field | Type and behavior |
|---|---|
| `title` | Optional window heading. |
| `labels` | `Partial<PauseLabels>`; override `resume`, `restart`, `settings`, `quit`, `navigation`, `error`. |
| `theme` | `Partial<PauseTheme>`; menu colors/fonts, listed below. |
| `callbacks` | `PauseCallbacks`; optional handlers keyed by `resume`, `restart`, `settings`, `quit`. |
| `disabled` | `Partial<Record<PauseAction, boolean>>`. |
| `visible` | Initial/patched visibility; defaults to `true`. |
| `onError` | `(error: unknown, context: PauseActionContext) => void`. |

`PauseAction` is `'resume' | 'restart' | 'settings' | 'quit'`; `PAUSE_ACTIONS` exports that order. `PauseHandler` is `(context: PauseActionContext) => void | Promise<void>`. Context fields are `{ action, menu, signal }`, following the main-menu convention, but `menu` is a `PauseMenuController`. `destroy()` aborts the signal; hiding alone does not abort it.

`PauseCallbacks` responsibilities are: `resume` resumes the current model and hides the window; `restart` resets the current level before resuming/hiding; `settings` opens host settings while gameplay stays paused and returns to the pause window on close; `quit` ends gameplay and restores the host's existing main menu. The key remains `quit` even though its visible label is Quit to Menu. The host owns any confirmation prompts.

`PauseTheme` reuses these `MenuTheme` fields: `titleColor`, `titleFont`, `bodyFont`, `panelColor`, `frameColor`, `buttonColor`, `buttonHoverColor`, `buttonTextColor`, `focusColor`. Here `panelColor` colors the blackboard. Neither theme nor options contain geometry fields.

| `PauseMenuController` member | Behavior |
|---|---|
| `element` | Transparent overlay root. |
| `update(options)` | Merge configuration, optionally including visibility. |
| `setCallbacks(callbacks)` | Replace all handlers; `{}` disconnects them. |
| `setDisabled(action, disabled)` | Enable/disable one action. |
| `setVisible(visible)` | Show/hide UI only; opening focuses Resume and closing returns focus when still owned by the dialog. |
| `focus(action?)` | Default to `resume`; fall back to the first enabled action. |
| `getState()` | Copy of `PauseState`: `{ visible: boolean, busy: boolean, lastAction: PauseAction | null, activationCount: number }`. |
| `destroy()` | Abort work, cancel animation, restore focus and remove this window; safe to repeat. |

Unconnected pause buttons bounce and record their action without navigation. `lastAction` is also exposed as `element.dataset.lastAction`. A connected asynchronous handler locks all four actions until settled. Rejections unlock controls, update an accessible status and emit `pausemenu:error` with `{ error, action }`; use `onError` for visible host error handling. A throwing error reporter is contained. Do not resume or replace the gameplay model while a restart/quit action is pending; destroy the controller when leaving the scene.

The window supports Tab/Shift+Tab, arrow keys, Home/End, native Enter/Space activation, and Escape requesting Resume. Events are handled inside this root, not by a document listener. The host must suspend gameplay keyboard handlers while paused and stop the opening Escape event from also closing the window. Use one active pause dialog. Reduced-motion preferences disable its bounce animation.

### Pause size and position

| Responsibility | Where to configure it |
|---|---|
| Covered game area | Size/position of the HTMLElement passed as `host`. |
| Alignment, spacing and stacking | `.cse-pause-menu` in pause-menu.css: `inset: 0`, `place-items: center`, `padding: 44px 16px 20px`, `z-index: 10`. Centering is inside the padded area. |
| Visible board dimensions | `.cse-pause-menu__board`: `width: min(430px, 90cqw, calc(100cqh * .79))`, `aspect-ratio: 430 / 544`. Maximum framed rectangle is 430 by 544 pixels; straps/shadow extend outside it. |
| Internal title/buttons | Their own percentage positions and board-relative `cqw` values in the same stylesheet. |

For the board width calculation, `cqw`/`cqh` reference the overlay's content size. Changing the aspect ratio also requires updating the `.79` width/height limit. Load scoped overrides after the component CSS. Example: a maximum 360px board placed 80px below and 64px right of the host's top-left:

```css
#game-overlay > .cse-pause-menu {
  place-items: start;
  padding: 80px 0 0 64px;
}
#game-overlay > .cse-pause-menu .cse-pause-menu__board {
  width: min(360px, 90cqw, calc(100cqh * .79));
}
```

## Host integration examples

These examples are application-side adapters for your real game model. The names in the model interfaces are suggestions to implement or adapt; the UI does not provide those model methods. Render gameplay outside the menu/map UI root.

### Menu/map entry and gameplay return routes

```ts
import { createGameUI } from './main menu/index.js';
import type { LevelSelection } from './map/index.js';

interface GameReturnRoutes {
  onReturnToMap(): void;
  onReturnToMenu(): void;
}
interface MenuGameModel {
  startNewGame(routes: GameReturnRoutes): void | Promise<void>;
  resumeSavedGame(routes: GameReturnRoutes): void | Promise<void>;
  openSettings(): void | Promise<void>;
  quitGame(): void | Promise<void>;
  openLevel(selection: LevelSelection, routes: GameReturnRoutes): void;
}

export function mountMenuAndMap(host: HTMLElement, model: MenuGameModel) {
  const routes: GameReturnRoutes = {
    onReturnToMap() { ui.element.hidden = false; ui.showMap(); },
    onReturnToMenu() { ui.element.hidden = false; ui.showMainMenu(); },
  };
  const ui = createGameUI(host, {
    menu: {
      callbacks: {
        newGame: async () => {
          await model.startNewGame(routes);
          ui.element.hidden = true;
        },
        continue: async () => {
          await model.resumeSavedGame(routes);
          ui.element.hidden = true;
        },
        settings: () => model.openSettings(),
        quit: () => model.quitGame(),
      },
    },
    onLevelSelect(selection) {
      // openLevel owns loading state and errors, as MapOptions is synchronous.
      model.openLevel(selection, routes);
      ui.element.hidden = true;
    },
  });
  return ui;
}
```

Give destination gameplay its `routes`. Its Return to Map / Return to Menu controls call those functions. For a standalone menu/map, import the corresponding factory and supply its callbacks directly using the same contracts above.

### Independent gameplay pause adapter

```ts
import { createPauseMenu } from './pause menu/index.js';

interface PauseGameModel {
  pause(): void;
  resume(): void;
  restartCurrentLevel(signal: AbortSignal): void | Promise<void>;
  openSettings(signal: AbortSignal): Promise<void>;
  quitToMenu(signal: AbortSignal): void | Promise<void>;
}

export function mountPauseWindow(overlayHost: HTMLElement, model: PauseGameModel) {
  const pause = createPauseMenu(overlayHost, {
    visible: false,
    callbacks: {
      resume: ({ menu }) => {
        model.resume();
        menu.setVisible(false);
      },
      restart: async ({ menu, signal }) => {
        await model.restartCurrentLevel(signal);
        if (signal.aborted) return;
        model.resume();
        menu.setVisible(false);
      },
      settings: async ({ menu, signal }) => {
        menu.setVisible(false);
        try { await model.openSettings(signal); }
        finally { if (!signal.aborted) menu.setVisible(true); }
      },
      quit: async ({ menu, signal }) => {
        // Host implementation ends gameplay and restores the existing menu.
        await model.quitToMenu(signal);
        if (!signal.aborted) menu.setVisible(false);
      },
    },
  });
  return {
    menu: pause,
    open() { model.pause(); pause.setVisible(true); },
    destroy() { pause.destroy(); },
  };
}
```

Create a positioned overlay inside the sized gameplay area:

```html
<div id="game">
  <!-- The game's canvas or rendered gameplay belongs here. -->
  <div id="game-overlay"></div>
</div>
```

```css
#game { position: relative; width: 100%; aspect-ratio: 16 / 9; }
#game-overlay { position: absolute; inset: 0; pointer-events: none; }
#game-overlay > .cse-pause-menu { pointer-events: auto; }
```

Pass `#game-overlay` to `mountPauseWindow`, connect its `open()` to the game's Pause action, and call `destroy()` when gameplay unloads. The empty host uses `pointer-events: none` so it does not intercept canvas input while the pause window is hidden; the visible pause root explicitly re-enables pointer events. For pause Quit to Menu, the host can restore the retained combined UI with `ui.element.hidden = false; ui.showMainMenu()` after ending gameplay.

## Asset inventory and exact consumers

Keep these six runtime artwork files in their current module-relative locations. PNGs are the generated scene/sprite artwork; map.svg is the vector Map icon. The map classroom image is different from the main-menu classroom image despite the similar names.

| File | Dimensions | Content / where it appears | Runtime consumer |
|---|---|---|---|
| [main menu/assets/classroom.png](./main%20menu/assets/classroom.png) | 1672 x 941 | Night classroom and stationery monsters behind the main menu. | `main-menu.ts`: `defaultBackground` -> background image `src`; replace through `backgroundUrl`. |
| [main menu/assets/map.svg](./main%20menu/assets/map.svg) | SVG viewBox 100 x 72 | Folded-map icon on the main-menu Map button. | `main-menu.ts`: `defaultMap` -> map icon `src`; replace through `mapIconUrl`. |
| [map/assets/classrooms.png](./map/assets/classrooms.png) | 1672 x 941 | Three-classroom selection scene; all rooms are in this single image. | `map.ts`: `showRooms()` -> background `src`. Classroom hit areas are in map.css. |
| [map/assets/dream.png](./map/assets/dream.png) | 1672 x 941 | Background behind each classroom's floating islands. | `map.ts`: `showIslands()` -> background `src`. |
| [map/assets/islands.png](./map/assets/islands.png) | 1959 x 803 | Horizontal atlas containing five floating-island designs. The branch reuses the first three. | `map.css`: `.cse-map__sprite` background with `background-size: 500% auto`; `map.ts` selects positions using `spriteIndex * 25%` from layout.ts. |
| [map/assets/bridge.png](./map/assets/bridge.png) | 2172 x 724 | One transparent bridge sprite reused behind every route connection. | `map.ts`: `appendBridges()` creates SVG image elements, rotates and sizes the sprite for MAP_CONNECTIONS. |

The pause board, wood frame, straps, chalk and eraser are drawn entirely in [pause-menu.css](./pause%20menu/pause-menu.css); there is **no pause PNG or icon to load**. Game titles, buttons, room names and level labels are DOM text, not baked into the image files.

Main-menu image URLs use literal `new URL('./assets/...', import.meta.url)` calls; the map helper constructs its filename dynamically as described in the Vite integration section. The island atlas URL is relative to map.css. If replacing an atlas or rearranging room art, update sprite positions, classroom hit areas and island polygons with the artwork. Do not move the assets to a global folder without updating their consumers.

## Editing guide and design constraints

| Change | Edit |
|---|---|
| Main-menu title/button text | `defaultTitle` / `defaultLabels` in main-menu.ts, or options overrides. |
| Map titles, Level and Minigame labels | map/labels.ts. |
| Pause title/button labels | pause menu/labels.ts, or options overrides. |
| Main-menu position and colors | MainMenuOptions.layout/theme and main-menu.css. |
| Map coordinates, hit polygons, sprite choices, routes | map/layout.ts; classroom hit areas and visual styling in map.css. |
| Pause size, location, spacing and colors | Annotated pause-menu.css; theme overrides for colors/fonts. |
| Game destinations and gameplay loading | The host adapters and game model, not the artwork/UI components. |

Keep implementation comments and documentation in English. Retain `placeholder：` comments at temporary product text definitions. Use the existing restrained classroom/night palette, essential functional text and no extra small explanatory captions. Buttons have no default outline; keyboard focus remains visible. Preserve actual object hit areas and reduced-motion behavior.

The route graph is implemented as visual/data layout, while unlock/progression logic remains host work. Classroom candle brightening on hover is a future artwork/layering enhancement and is not implemented. These UI modules do not implement the game model; the existing application remains in src/.
