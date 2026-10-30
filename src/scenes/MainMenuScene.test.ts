import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    constructor(public sceneKey: string) {}
  }

  return {
    default: {
      Scene: MockScene,
      Math: {
        Between: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
        FloatBetween: (min: number, max: number) => Math.random() * (max - min) + min,
      },
      Cameras: {
        Scene2D: {
          Events: {
            FADE_OUT_COMPLETE: 'camerafadeoutcomplete',
          },
        },
      },
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
        },
      },
      Input: {
        Keyboard: {
          KeyCodes: {
            ESC: 27,
          },
        },
      },
      GameObjects: {
        Container: class {},
        Text: class {},
        Rectangle: class {},
        Graphics: class {},
      },
    },
  };
});

import { MainMenuScene } from './MainMenuScene';
import { settingsStore } from '../state/settingsStore';
import { soundManager } from '../audio/soundManager';

interface MockGameObject {
  x: number;
  y: number;
  alpha: number;
  scaleX?: number;
  scaleY?: number;
  depth?: number;
  list?: unknown[];
  text?: string;
  setOrigin: (...args: unknown[]) => MockGameObject;
  setAlpha: (a: number) => MockGameObject;
  setScale: (s: number) => MockGameObject;
  setDepth: (d: number) => MockGameObject;
  setStrokeStyle: (...args: unknown[]) => MockGameObject;
  setFillStyle: (...args: unknown[]) => MockGameObject;
  setInteractive: (...args: unknown[]) => MockGameObject;
  disableInteractive: () => MockGameObject;
  setText: (t: string) => MockGameObject;
  setColor: (c: string) => MockGameObject;
  setFontSize: (s: string | number) => MockGameObject;
  setFontStyle: (s: string) => MockGameObject;
  on: (event: string, fn: (...args: unknown[]) => void) => MockGameObject;
  emit: (event: string, ...args: unknown[]) => void;
  destroy: () => void;
  add?: (items: unknown) => MockGameObject;
}

function createMockGameObject(initial: Partial<MockGameObject> = {}): MockGameObject {
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  const obj: MockGameObject = {
    x: initial.x ?? 0,
    y: initial.y ?? 0,
    alpha: initial.alpha ?? 1,
    scaleX: 1,
    scaleY: 1,
    depth: 0,
    list: [],
    text: initial.text ?? '',
    setOrigin() {
      return obj;
    },
    setAlpha(a: number) {
      obj.alpha = a;
      return obj;
    },
    setScale(s: number) {
      obj.scaleX = s;
      obj.scaleY = s;
      return obj;
    },
    setDepth(d: number) {
      obj.depth = d;
      return obj;
    },
    setStrokeStyle() {
      return obj;
    },
    setFillStyle() {
      return obj;
    },
    setInteractive() {
      return obj;
    },
    disableInteractive() {
      return obj;
    },
    setText(t: string) {
      obj.text = t;
      return obj;
    },
    setColor() {
      return obj;
    },
    setFontSize() {
      return obj;
    },
    setFontStyle() {
      return obj;
    },
    on(event: string, fn: (...args: unknown[]) => void) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
      return obj;
    },
    emit(event: string, ...args: unknown[]) {
      handlers[event]?.forEach((fn) => fn(...args));
    },
    destroy() {
      obj.list = [];
    },
    add(items: unknown) {
      if (Array.isArray(items)) {
        obj.list?.push(...items);
      } else {
        obj.list?.push(items);
      }
      return obj;
    },
    ...initial,
  };

  return obj;
}

function createMockGraphics() {
  const g = createMockGameObject();
  return Object.assign(g, {
    clear: vi.fn(),
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillPath: vi.fn(),
    strokePath: vi.fn(),
    lineStyle: vi.fn(),
    strokeCircle: vi.fn(),
    fillCircle: vi.fn(),
    strokeRect: vi.fn(),
    fillTriangle: vi.fn(),
  });
}

function setupMockScene(scene: MainMenuScene): {
  startMock: ReturnType<typeof vi.fn>;
  fadeOutMock: ReturnType<typeof vi.fn>;
  soundPlaySfxMock: ReturnType<typeof vi.fn>;
  soundStopMusicMock: ReturnType<typeof vi.fn>;
} {
  const startMock = vi.fn();
  const fadeOutMock = vi.fn();
  const soundPlaySfxMock = vi.spyOn(soundManager, 'playSfx');
  const soundStopMusicMock = vi.spyOn(soundManager, 'stopMenuMusic');

  (scene as unknown as { load: unknown }).load = {
    image: vi.fn(),
  };

  (scene as unknown as { textures: unknown }).textures = {
    exists: vi.fn(() => false),
  };

  (scene as unknown as { add: unknown }).add = {
    graphics: () => createMockGraphics(),
    circle: (x: number, y: number, r: number, fill?: number, alpha?: number) =>
      createMockGameObject({ x, y, alpha }),
    text: (x: number, y: number, text: string) =>
      createMockGameObject({ x, y, text }),
    rectangle: (x: number, y: number) =>
      createMockGameObject({ x, y }),
    container: (x: number, y: number) =>
      createMockGameObject({ x, y }),
  };

  (scene as unknown as { tweens: unknown }).tweens = {
    add: vi.fn((config) => {
      if (config.onComplete) {
        config.onComplete();
      }
      return config;
    }),
  };

  (scene as unknown as { cameras: unknown }).cameras = {
    main: {
      fadeOut: fadeOutMock,
      once: vi.fn((event, cb) => cb()),
    },
  };

  (scene as unknown as { scene: unknown }).scene = {
    start: startMock,
  };

  (scene as unknown as { events: unknown }).events = {
    once: vi.fn(),
  };

  (scene as unknown as { time: unknown }).time = {
    delayedCall: vi.fn((ms, cb) => cb()),
  };

  (scene as unknown as { input: unknown }).input = {
    keyboard: {
      addKey: vi.fn(() => createMockGameObject()),
    },
  };

  return {
    startMock,
    fadeOutMock,
    soundPlaySfxMock,
    soundStopMusicMock,
  };
}

describe('MainMenuScene', () => {
  let scene: MainMenuScene;
  let mocks: ReturnType<typeof setupMockScene>;

  beforeEach(() => {
    vi.clearAllMocks();
    settingsStore.resetSettings();
    scene = new MainMenuScene();
    mocks = setupMockScene(scene);
    scene.create();
  });

  it('creates all main menu buttons and map badge', () => {
    expect(scene.startButton).toBeDefined();
    expect(scene.settingsButton).toBeDefined();
    expect(scene.quitButton).toBeDefined();
    expect(scene.mapBadgeButton).toBeDefined();

    expect(scene.startButton.buttonLabel?.text).toBe('Continue');
    expect(scene.settingsButton.buttonLabel?.text).toBe('Settings');
    expect(scene.quitButton.buttonLabel?.text).toBe('Quit Game');
  });

  it('clicking Start Game transitions to WorldMap and stops menu music', () => {
    scene.startButton.triggerClick?.();

    expect(mocks.soundPlaySfxMock).toHaveBeenCalledWith('start');
    expect(mocks.soundStopMusicMock).toHaveBeenCalled();
    expect(mocks.startMock).toHaveBeenCalledWith('WorldMap');
  });

  it('clicking Settings opens the settings modal and allows adjusting settings', () => {
    expect(scene.settingsModal).toBeNull();

    scene.settingsButton.triggerClick?.();

    expect(scene.settingsModal).not.toBeNull();
    expect(mocks.soundPlaySfxMock).toHaveBeenCalledWith('modalOpen');

    // Adjust setting while modal is open
    settingsStore.setDifficulty('Hard');
    expect(settingsStore.getSettings().difficulty).toBe('Hard');

    // Close settings modal
    scene.closeSettingsModal();
    expect(scene.settingsModal).toBeNull();
    expect(mocks.soundPlaySfxMock).toHaveBeenCalledWith('modalClose');
  });

  it('clicking Quit Game opens confirmation dialog, and Cancel dismisses it', () => {
    expect(scene.quitModal).toBeNull();

    scene.quitButton.triggerClick?.();

    expect(scene.quitModal).not.toBeNull();
    expect(mocks.soundPlaySfxMock).toHaveBeenCalledWith('modalOpen');

    // Cancel quit
    scene.closeQuitModal();
    expect(scene.quitModal).toBeNull();
    expect(mocks.soundPlaySfxMock).toHaveBeenCalledWith('modalClose');
  });

  it('confirming Quit stops music and enters farewell state overlay', () => {
    scene.openQuitModal();
    expect(scene.quitModal).not.toBeNull();

    scene.confirmQuit();

    expect(mocks.soundStopMusicMock).toHaveBeenCalled();
    expect(scene.quitModal).toBeNull();
    expect(scene.farewellContainer).not.toBeNull();
  });
});
