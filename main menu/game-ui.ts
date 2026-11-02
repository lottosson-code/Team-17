import { createMainMenu } from './main-menu.js';
import { createMap } from '../map/index.js';
import type { GameUIController, GameUIOptions } from './game-ui-types.js';

/** Connect reusable modules. This file has no browser-demo or game logic. */
export function createGameUI(host: HTMLElement, options: GameUIOptions = {}): GameUIController {
  const root = document.createElement('div');
  root.className = 'cse-game-ui';
  const menuHost = document.createElement('div');
  const mapHost = document.createElement('div');
  menuHost.className = 'cse-game-ui__scene';
  mapHost.className = 'cse-game-ui__scene';
  mapHost.hidden = true;
  root.append(menuHost, mapHost);
  host.append(root);

  let destroyed = false;
  let scene: 'menu' | 'map' = 'menu';
  root.dataset.scene = scene;
  const menuOptions = options.menu || {};
  const menu = createMainMenu(menuHost, {
    ...menuOptions,
    callbacks: { ...menuOptions.callbacks, map: showMap },
  });
  const map = createMap(mapHost, {
    onBackToMenu: showMainMenu,
    onLevelSelect: options.onLevelSelect,
  });

  function showMap(): void {
    if (destroyed) return;
    menu.setVisible(false);
    menuHost.hidden = true;
    mapHost.hidden = false;
    map.showRooms();
    map.focus();
    scene = 'map';
    root.dataset.scene = scene;
  }

  function showMainMenu(): void {
    if (destroyed) return;
    mapHost.hidden = true;
    menuHost.hidden = false;
    menu.setVisible(true);
    menu.focus('map');
    scene = 'menu';
    root.dataset.scene = scene;
  }

  return {
    element: root,
    getState: () => ({ scene, map: map.getState() }),
    showMainMenu,
    showMap,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      menu.destroy();
      map.destroy();
      root.remove();
    },
  };
}

