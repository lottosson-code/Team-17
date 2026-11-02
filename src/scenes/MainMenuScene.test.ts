import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  class MockScene {
    sys = {
      settings: { key: 'MainMenu' },
    };
    events = {
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    scene = {
      start: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    };
    game = {
      canvas: {
        parentElement: {
          ownerDocument: {
            createElement: vi.fn(),
          },
          append: vi.fn(),
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
        },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
      },
    };
    scale = {
      on: vi.fn(),
      off: vi.fn(),
    };
  }

  return {
    default: {
      Scene: MockScene,
    },
  };
});

let mockGameUIController: {
  showMap: ReturnType<typeof vi.fn>;
  showMainMenu: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

let capturedGameUIOptions: {
  menu?: {
    callbacks?: Record<string, (ctx: unknown) => unknown>;
  };
  onLevelSelect?: (selection: unknown) => void;
} = {};

// Mock createGameUI
vi.mock('../../main menu/index.js', () => ({
  createGameUI: vi.fn((_element, options) => {
    capturedGameUIOptions = options;
    mockGameUIController = {
      showMap: vi.fn(),
      showMainMenu: vi.fn(),
      destroy: vi.fn(),
    };
    return mockGameUIController;
  }),
}));

// Mock createSceneOverlay
let mockHostElement: {
  append: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  ownerDocument: unknown;
};

let mockHostDestroy: ReturnType<typeof vi.fn>;

vi.mock('../ui/sceneOverlay', () => ({
  createSceneOverlay: vi.fn(() => {
    mockHostDestroy = vi.fn();
    mockHostElement = {
      append: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      ownerDocument: {},
    };
    return {
      element: mockHostElement as unknown as HTMLElement,
      destroy: mockHostDestroy,
    };
  }),
}));

// Mock settingsModal & quitModal
let mockSettingsModalDestroy: ReturnType<typeof vi.fn>;
let capturedSettingsOptions: { onClose?: () => void } = {};
vi.mock('../ui/settingsModal', () => ({
  createSettingsModal: vi.fn((_host, options) => {
    capturedSettingsOptions = options;
    mockSettingsModalDestroy = vi.fn();
    return {
      element: {} as HTMLElement,
      destroy: mockSettingsModalDestroy,
    };
  }),
}));

let mockQuitModalDestroy: ReturnType<typeof vi.fn>;
let capturedQuitOptions: { onCancel?: () => void; onConfirm?: () => void } = {};
vi.mock('../ui/quitModal', () => ({
  createQuitModal: vi.fn((_host, options) => {
    capturedQuitOptions = options;
    mockQuitModalDestroy = vi.fn();
    return {
      element: {} as HTMLElement,
      destroy: mockQuitModalDestroy,
    };
  }),
}));

import { MainMenuScene } from './MainMenuScene';
import { soundManager } from '../audio/soundManager';

describe('MainMenuScene', () => {
  let scene: MainMenuScene;
  let startMusicSpy: ReturnType<typeof vi.spyOn>;
  let stopMusicSpy: ReturnType<typeof vi.spyOn>;
  let playSfxSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    startMusicSpy = vi.spyOn(soundManager, 'startMenuMusic').mockImplementation(() => {});
    stopMusicSpy = vi.spyOn(soundManager, 'stopMenuMusic').mockImplementation(() => {});
    playSfxSpy = vi.spyOn(soundManager, 'playSfx').mockImplementation(() => {});

    scene = new MainMenuScene();
  });

  it('starts menu background music and creates game UI on create()', () => {
    scene.create();

    expect(startMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.ui).not.toBeNull();
  });

  it('navigates to map and plays click sound when newGame is clicked', () => {
    scene.create();

    const newGameCb = capturedGameUIOptions.menu?.callbacks?.newGame;
    expect(newGameCb).toBeDefined();

    newGameCb!({ action: 'newGame' });

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(mockGameUIController.showMap).toHaveBeenCalledTimes(1);
  });

  it('navigates to map and plays click sound when continue is clicked', () => {
    scene.create();

    const continueCb = capturedGameUIOptions.menu?.callbacks?.continue;
    expect(continueCb).toBeDefined();

    continueCb!({ action: 'continue' });

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(mockGameUIController.showMap).toHaveBeenCalledTimes(1);
  });

  it('opens settings modal and plays modalOpen sound when settings is clicked', async () => {
    scene.create();

    const settingsCb = capturedGameUIOptions.menu?.callbacks?.settings;
    expect(settingsCb).toBeDefined();

    const signal = new AbortController().signal;
    const settingsPromise = settingsCb!({ action: 'settings', signal });

    expect(playSfxSpy).toHaveBeenCalledWith('modalOpen');
    expect(scene.settingsModal).not.toBeNull();

    // Closing the modal resolves the promise and plays modalClose sound
    capturedSettingsOptions.onClose?.();
    await settingsPromise;

    expect(playSfxSpy).toHaveBeenCalledWith('modalClose');
    expect(scene.settingsModal).toBeNull();
  });

  it('opens quit modal and plays modalOpen sound when quit is clicked', async () => {
    scene.create();

    const quitCb = capturedGameUIOptions.menu?.callbacks?.quit;
    expect(quitCb).toBeDefined();

    const signal = new AbortController().signal;
    const quitPromise = quitCb!({ action: 'quit', signal });

    expect(playSfxSpy).toHaveBeenCalledWith('modalOpen');
    expect(scene.quitModal).not.toBeNull();

    // Canceling quit resolves promise and plays modalClose sound
    capturedQuitOptions.onCancel?.();
    await quitPromise;

    expect(playSfxSpy).toHaveBeenCalledWith('modalClose');
    expect(scene.quitModal).toBeNull();
  });

  it('stops music, plays start sound, and starts Combat scene on level selection', () => {
    scene.create();

    const onLevelSelect = capturedGameUIOptions.onLevelSelect;
    expect(onLevelSelect).toBeDefined();

    onLevelSelect!({
      roomId: 'classroom-01',
      levelId: 'classroom-01-level-01',
      levelNumber: 1,
      selectionCount: 1,
    });

    expect(playSfxSpy).toHaveBeenCalledWith('start');
    expect(stopMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.scene.start).toHaveBeenCalledWith('Combat', {
      moduleId: 1,
      levelId: 1,
      activity: 'level',
      selectionId: 'classroom-01-level-01',
    });
  });

  it('stops music and destroys UI and modals on scene shutdown', () => {
    scene.create();

    // Retrieve shutdown handler registered with scene.events.once
    const onceCalls = vi.mocked(scene.events.once).mock.calls;
    const shutdownCall = onceCalls.find((call) => call[0] === 'shutdown');
    expect(shutdownCall).toBeDefined();

    const shutdownHandler = shutdownCall![1];
    shutdownHandler();

    expect(mockGameUIController.destroy).toHaveBeenCalledTimes(1);
    expect(mockHostDestroy).toHaveBeenCalledTimes(1);
    expect(stopMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.ui).toBeNull();
  });
});
