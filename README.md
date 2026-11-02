# Team 17 — Math RPG and UI Modules

The actual game entry now uses the latest **Main Menu**, **Map** and independent **Pause Menu** modules. This is the single English README for their interfaces, shared artwork, layout settings and host-model wiring.

## Repository layout

```text
Team-17/
├── README.md
├── assets/
│   ├── index.ts                  Static URL registry used by Vite and the modules
│   ├── main-menu/classroom.png    Empty night-classroom background
│   ├── characters/*.png          Seven independent transparent monsters
│   ├── icons/map.svg
│   └── map/*.png                 Classrooms, dream, island atlas and bridge
├── main menu/                    Current menu, character layout and map navigation
├── map/                          Current classrooms/islands and route graph
├── pause menu/                   Independent transparent CSS blackboard window
├── src/
│   ├── main.ts                   Actual application entry and stylesheet imports
│   ├── scenes/MainMenuScene.ts   Mounts the latest menu/map modules
│   ├── scenes/CombatScene.ts     Existing gameplay stage plus pause integration
│   ├── ui/sceneOverlay.ts        Canvas-aligned DOM host and lifecycle cleanup
│   └── ui/levelSelection.ts      Stable UI IDs -> gameplay selection metadata
├── scripts/build-ui.mjs          Standalone build with styles and shared artwork
└── package.json, package-lock.json, tsconfig.json, tsconfig.ui.json, vite.config.ts
```

The previous WorldMapScene/LevelSelectScene and unused placeholder button helper have been removed. No browser demo, alternate art versions or process records are included in the game module directories. Dependencies and generated builds remain Git-ignored.

## Install, run and validate

Use Node.js 22.12 or newer (the repository's .nvmrc selects Node 22). Run the real game from this repository root:

```sh
npm ci
npm run dev
```

The startup screen displays Math Nightmare over the current empty classroom plus seven independent character layers. New Game, Continue and Map open the latest classroom selection. This current host adapter does not implement persistent saves; Continue reopens the map. Main-menu Settings/Quit Game remain host callback extension points. Selecting an island starts the project's gameplay scene with classroom/main-level/minigame metadata. During gameplay, Pause or Escape opens the independent pause window; Resume, Restart and Quit to Menu are wired. Pause Settings is disabled until the game supplies a settings screen.

| Script | Purpose |
|---|---|
| `npm test` | Run existing math tests and UI/gameplay selection-mapping tests. |
| `npm run typecheck` | Type-check the application, UI modules and asset registry. |
| `npm run typecheck:ui` | Type-check the standalone UI modules and shared asset registry. |
| `npm run build` | Build the real Vite game, including the current UI and root artwork. |
| `npm run build:ui` | Build standalone UI modules, declarations, source maps, styles and artwork in dist/ui/. |
| `npm run preview` | Serve the production game build. |
| `npm run test:watch` | Run tests in watch mode. |

The UI adds no third-party runtime dependency. Existing Phaser/Vite/TypeScript/Vitest dependencies and lockfile are retained. Standalone generated .js/.d.ts/.js.map files are isolated in dist/ui/ and ignored by Git. Source folders stay TypeScript-only so old generated JavaScript cannot shadow edited source. TypeScript imports keep .js suffixes for emitted browser modules. JavaScript imports do not load CSS automatically. The application imports all required CSS in src/main.ts.

For standalone delivery, serve the contents of dist/ui/: the three emitted module directories plus their sibling assets/ directory together over HTTP. Do not open browser modules with file://. All root artwork URLs are statically analyzable and work in the Vite application build without the old dynamic-map-URL workaround.

## Game model and lifecycle wiring

MainMenuScene mounts createGameUI in a DOM host aligned with the actual FIT-scaled Phaser canvas. The host observes canvas/container resizing and disposes when its owning scene shuts down. Empty overlay areas let pointer events reach the canvas; actual UI roots/buttons opt into pointer events.

The tested toGameplaySelection adapter maps classroom-01/02/03 to module IDs 1/2/3. Nodes 1..5 become activity: 'level' with levelId 1..5. Nodes 6..8 become activity: 'minigame' with levelId 1..3. selectionId retains the stable string ID. Unsupported rooms, node numbers and inconsistent IDs are rejected. This routes correct metadata; the team's current CombatScene remains the gameplay implementation and a dedicated minigame model can be attached later.

Pause operates independently of main-menu/map navigation. Its host pauses/resumes the Phaser scene, restarts the current selection, or returns to MainMenu. Window/resize/key listeners and DOM hosts are cleaned up on scene shutdown. The generic examples below remain available for replacing these adapters with the final game model.

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
| `backgroundUrl` | Optional replacement for `assets/main-menu/classroom.png`. |
| `mapIconUrl` | Optional replacement for `assets/icons/map.svg`. |
| `characters` | `readonly MenuCharacter[]`; independent transparent foreground sprites. Defaults to the seven current characters; `[]` renders only the clean background. |
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

## Independent foreground characters

Source: [characters.ts](./main%20menu/characters.ts). The empty background and seven figures are different PNG files. No creature is painted into the classroom plate.

`DEFAULT_MENU_CHARACTERS` is exported from the main-menu entry. Each `MenuCharacter` contains `id: string`, `imageUrl: string`, `x: number`, `y: number`, `width: number` and optional `idle: boolean`. Coordinates are percentages of the full 16:9 menu scene: x is horizontal center, y is the sprite's bottom/foot anchor, and width is image width. Change the default composition in characters.ts, or supply MainMenuOptions.characters. With createGameUI, supply the same data through options.menu.characters.

For a standalone main-menu controller, update({ characters: nextList }) replaces the character composition without changing buttons or callbacks. Pass characters: [] for the empty classroom alone. Character elements expose data-character-id; the host can target the image within that element for animation. Set idle: false when the model owns motion. The default small CSS idle motion honors prefers-reduced-motion. The decorative layer never intercepts clicks.

All seven images use real transparent alpha. They are still sprites rather than frame-by-frame animation sheets, so a game can animate their position, scale or rotation independently.

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

The window supports Tab/Shift+Tab, arrow keys, Home/End, native Enter/Space activation, and Escape requesting Resume. Repeated Escape keydown events are consumed without requesting Resume again; the host's Escape opener must also ignore event.repeat, as CombatScene does. Events are handled inside this root, not by a document listener. The host must suspend gameplay keyboard handlers while paused and stop the opening Escape event from also closing the window. Use one active pause dialog. Reduced-motion preferences disable its bounce animation.

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

The repository has one shared root assets/ directory. It contains only the current selected artwork and its static URL registry; superseded module-local image copies and the old composite monster background have been removed from this project.

| File | Dimensions | Content | Runtime consumer |
|---|---|---|---|
| [assets/main-menu/classroom.png](./assets/main-menu/classroom.png) | 1672 x 941 | Empty night classroom, with no monsters. | assets/index.ts -> main-menu.ts background |
| [assets/icons/map.svg](./assets/icons/map.svg) | SVG viewBox 100 x 72 | Folded-map icon. | assets/index.ts -> main-menu.ts Map button |
| [assets/map/classrooms.png](./assets/map/classrooms.png) | 1672 x 941 | Three-classroom selection scene. | assets/index.ts -> map.ts showRooms() |
| [assets/map/dream.png](./assets/map/dream.png) | 1672 x 941 | Floating-island background. | assets/index.ts -> map.ts showIslands() |
| [assets/map/islands.png](./assets/map/islands.png) | 1959 x 803 | Five-island horizontal atlas; branch reuses sprites 0..2. | map.css background URL; layout.ts sprite selection |
| [assets/map/bridge.png](./assets/map/bridge.png) | 2172 x 724 | Transparent bridge reused by all seven graph edges. | assets/index.ts -> map.ts appendBridges() |
| [assets/characters/charcoal-book.png](./assets/characters/charcoal-book.png) | 1247 x 1261 | Charcoal book with worn gold trim and suspicious eyes. | characters.ts -> character id charcoal-book |
| [assets/characters/small-eraser.png](./assets/characters/small-eraser.png) | 1212 x 1297 | Small nervous dirty-ivory eraser. | characters.ts -> character id small-eraser |
| [assets/characters/pencil.png](./assets/characters/pencil.png) | 1174 x 1339 | Worn ochre pencil with red eraser and sly grin. | characters.ts -> character id pencil |
| [assets/characters/triangle-ruler.png](./assets/characters/triangle-ruler.png) | 1225 x 1284 | Grumpy triangular set-square ruler. | characters.ts -> character id triangle-ruler |
| [assets/characters/red-book.png](./assets/characters/red-book.png) | 1287 x 1222 | Red book with skeptical eyes and worn gold trim. | characters.ts -> character id red-book |
| [assets/characters/pencil-sharpener.png](./assets/characters/pencil-sharpener.png) | 1351 x 1164 | Dark steel sharpener with blade channel and screw. | characters.ts -> character id pencil-sharpener |
| [assets/characters/large-eraser.png](./assets/characters/large-eraser.png) | 1320 x 1192 | Larger anxious seated dirty-ivory eraser. | characters.ts -> character id large-eraser |

The seven character PNGs have transparent backgrounds and can be loaded independently of the classroom. The background plate is opaque and has no monsters. The pause blackboard/frame/straps/chalk/eraser are drawn in pause-menu.css and need no image file.

All TypeScript artwork URLs are explicit static new URL literals in assets/index.ts, allowing Vite to emit them. The island atlas CSS URL is relative to map.css and points to ../assets/map/islands.png. The actual startup imports the UI styles and mounts the modules, so the application build now includes these assets. For standalone deployment, run build:ui and serve dist/ui/, which already contains assets/ beside main menu/, map/ and pause menu/.

If replacing an atlas or rearranging room art, update sprite positions, classroom hit areas and island polygons with it. Do not introduce another module-local assets copy.

## Editing guide and design constraints

| Change | Edit |
|---|---|
| Main-menu title/button text | `defaultTitle` / `defaultLabels` in main-menu.ts, or options overrides. |
| Map titles, Level and Minigame labels | map/labels.ts. |
| Pause title/button labels | pause menu/labels.ts, or options overrides. |
| Main-menu position and colors | MainMenuOptions.layout/theme and main-menu.css. |
| Character images, positions and motion | Root assets/characters/, assets/index.ts and main menu/characters.ts; MainMenuOptions.characters overrides. |
| Map coordinates, hit polygons, sprite choices, routes | map/layout.ts; classroom hit areas and visual styling in map.css. |
| Pause size, location, spacing and colors | Annotated pause-menu.css; theme overrides for colors/fonts. |
| Game destinations and gameplay loading | The host adapters and game model, not the artwork/UI components. |

Keep implementation comments and documentation in English. Retain `placeholder：` comments at temporary product text definitions. Use the existing restrained classroom/night palette, essential functional text and no extra small explanatory captions. Buttons have no default outline; keyboard focus remains visible. Preserve actual object hit areas and reduced-motion behavior.

The route graph is implemented as visual/data layout, while unlock/progression logic remains host work. Classroom candle brightening on hover is a future artwork/layering enhancement and is not implemented. These UI modules do not implement the game model; the existing application remains in src/.
