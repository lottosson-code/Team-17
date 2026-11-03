// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { createGameUI } from './main menu/index';

it('opens the map, selects classroom 2 / level 4, and returns to the main menu', async () => {
  // Happy DOM supplies real HTML elements. Only browser animation is omitted.
  const originalAnimations = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: true, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: () => true,
  }));
  const host = document.createElement('div');
  document.body.append(host);
  const onLevelSelect = vi.fn();
  const ui = createGameUI(host, { onLevelSelect });
  const menu = host.querySelector<HTMLElement>('.cse-main-menu')!;
  const map = host.querySelector<HTMLElement>('.cse-map')!;
  const click = (selector: string): void => {
    const button = host.querySelector<HTMLButtonElement>(selector);
    expect(button, `Expected a button matching ${selector}`).not.toBeNull();
    button!.click();
  };

  try {
    // Checkpoint 1: startup really shows the menu, with the map hidden.
    expect(ui.getState().scene).toBe('menu');
    expect(menu.hidden).toBe(false);
    expect(map.parentElement!.hidden).toBe(true);

    // Checkpoint 2: click the actual Map button and inspect state AND visibility.
    click('[data-action="map"]');
    await Promise.resolve(); // Finish the menu's async action callback, without a timer.
    expect(ui.getState().scene).toBe('map');
    expect(ui.getState().map.view).toBe('rooms');
    expect(menu.hidden).toBe(true);
    expect(map.parentElement!.hidden).toBe(false);

    // Checkpoint 3: choose classroom 2, then the fourth main-route island.
    click('[data-room-id="classroom-02"]');
    expect(ui.getState().map).toMatchObject({ view: 'islands', roomId: 'classroom-02' });
    expect(map.dataset.view).toBe('islands');
    click('[data-level-id="classroom-02-level-04"]');
    expect(ui.getState().map.selectedLevelId).toBe('classroom-02-level-04');
    expect(onLevelSelect).toHaveBeenCalledTimes(1);
    expect(onLevelSelect).toHaveBeenCalledWith({
      roomId: 'classroom-02', levelId: 'classroom-02-level-04', levelNumber: 4, selectionCount: 1,
    });

    // Checkpoint 4: Back returns to classrooms, then to the existing main menu.
    click('.cse-map__back');
    expect(ui.getState().map).toMatchObject({ view: 'rooms', roomId: null });
    expect(map.dataset.view).toBe('rooms');
    click('.cse-map__back');
    expect(ui.getState().scene).toBe('menu');
    expect(menu.hidden).toBe(false);
    expect(map.parentElement!.hidden).toBe(true);
    expect(onLevelSelect).toHaveBeenCalledTimes(1);
  } finally {
    ui.destroy();
    host.remove();
    media.mockRestore();
    if (originalAnimations) Object.defineProperty(Element.prototype, 'getAnimations', originalAnimations);
    else Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});
