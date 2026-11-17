// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { createGameUI, createMainMenu } from '../index';

it('opens the map, selects classroom 2 / level 4, and returns to the main menu', async () => {
  // jsdom supplies real HTML elements, but not getAnimations or matchMedia; both are stubbed here.
  const originalAnimations = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
  vi.stubGlobal('matchMedia', (query: string) => ({
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
    vi.unstubAllGlobals();
    if (originalAnimations) Object.defineProperty(Element.prototype, 'getAnimations', originalAnimations);
    else Reflect.deleteProperty(Element.prototype, 'getAnimations');
  }
});

// Main-menu progress bar: the chalk equation "classroom x 10 + level = code" and the pencil.
// Three sample positions: the very start, mid-game, and the last level.
// completedRatio = main levels finished / 15 (3 classrooms x 5 levels).
// equation = the chalk images in order, each named "<colour>-<character>".
it.each([
  { classroom: 1, level: 1, completedRatio: 0 / 15, equation: 'yellow-1 white-times white-1 white-0 white-plus orange-1 white-equals white-1 white-1' },
  { classroom: 2, level: 3, completedRatio: 7 / 15, equation: 'yellow-2 white-times white-1 white-0 white-plus orange-3 white-equals white-2 white-3' },
  { classroom: 3, level: 5, completedRatio: 14 / 15, equation: 'yellow-3 white-times white-1 white-0 white-plus orange-5 white-equals white-3 white-5' },
])('shows the progress bar for classroom $classroom / level $level', ({ equation, ...progress }) => {
  const host = document.createElement('div');
  document.body.append(host);
  const menu = createMainMenu(host, { progress });

  try {
    const chalk = host.querySelector<HTMLElement>('.cse-main-menu__chalk')!;
    const pencil = host.querySelector<HTMLElement>('.cse-main-menu__pencil')!;

    // Chalk: shown, labelled, and one image per character in the right colour and order.
    expect(chalk.hidden).toBe(false);
    expect(chalk.getAttribute('aria-label')).toBe(`Classroom ${progress.classroom}, Level ${progress.level}`);
    const images = [...chalk.querySelectorAll('img')].map(image => image.src.match(/([a-z]+-\w+)\.png/)![1]);
    expect(images.join(' ')).toBe(equation);

    // Pencil: shown, and the ratio the CSS turns into its length equals the progress.
    expect(pencil.hidden).toBe(false);
    expect(Number(pencil.style.getPropertyValue('--pencil-progress'))).toBeCloseTo(progress.completedRatio);
  } finally {
    menu.destroy();
    host.remove();
  }
});

// The Continue button can be hidden (no saved level) and shown again.
it('hides and shows a menu button with the hidden option', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const menu = createMainMenu(host, { hidden: { continue: true } });

  try {
    const button = host.querySelector<HTMLButtonElement>('[data-action="continue"]')!;
    // Hidden buttons are also disabled, so keyboard focus skips them.
    expect(button.hidden).toBe(true);
    expect(button.disabled).toBe(true);

    menu.update({ hidden: { continue: false } });
    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);
  } finally {
    menu.destroy();
    host.remove();
  }
});
