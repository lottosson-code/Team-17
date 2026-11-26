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
vi.mock('../../../main menu/index.js', () => ({
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

vi.mock('../../ui/sceneOverlay', () => ({
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
vi.mock('../../ui/settingsModal', () => ({
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
vi.mock('../../ui/quitModal', () => ({
  createQuitModal: vi.fn((_host, options) => {
    capturedQuitOptions = options;
    mockQuitModalDestroy = vi.fn();
    return {
      element: {} as HTMLElement,
      destroy: mockQuitModalDestroy,
    };
  }),
}));

import { MainMenuScene } from '../MainMenuScene';
import { soundManager } from '../../audio/soundManager';
import { mapProgressStore } from '../../state/mapProgressStore';
import { seenEnemiesStore } from '../../state/seenEnemiesStore';
// Last-played save used by Continue.
import { clearLastPlayed, loadLastPlayed, saveLastPlayed } from '../../ui/lastPlayed';

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
    // Every test starts like a first-time player, with no saved level.
    clearLastPlayed();

    scene = new MainMenuScene();
  });

  it('starts menu background music and creates game UI on create()', () => {
    scene.create();

    expect(startMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.ui).not.toBeNull();
  });

  it('navigates directly to map when initialized with showMap: true', () => {
    scene.init({ showMap: true, roomIndex: 0 });
    scene.create();

    expect(mockGameUIController.showMap).toHaveBeenCalledWith(0);
  });

  it('navigates to map, resets progress, and plays click sound when newGame is clicked', () => {
    scene.create();

    const resetProgressSpy = vi.spyOn(mapProgressStore, 'resetProgress');
    const newGameCb = capturedGameUIOptions.menu?.callbacks?.newGame;
    expect(newGameCb).toBeDefined();

    newGameCb!({ action: 'newGame' });

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(resetProgressSpy).toHaveBeenCalledTimes(1);
    expect(mockGameUIController.showMap).toHaveBeenCalledTimes(1);
  });

  it('forgets which enemies the player has met when newGame is clicked', () => {
    scene.create();
    seenEnemiesStore.markSeen('pencil');

    capturedGameUIOptions.menu!.callbacks!.newGame({ action: 'newGame' });

    expect(seenEnemiesStore.hasSeen('pencil')).toBe(false);
  });

  it('navigates to map and plays click sound without resetting progress when continue is clicked', () => {
    scene.create();

    const resetProgressSpy = vi.spyOn(mapProgressStore, 'resetProgress');
    const continueCb = capturedGameUIOptions.menu?.callbacks?.continue;
    expect(continueCb).toBeDefined();

    continueCb!({ action: 'continue' });

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(resetProgressSpy).not.toHaveBeenCalled();
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

  it('routes to Make24 minigame when level 6 is selected', () => {
    scene.create();

    const onLevelSelect = capturedGameUIOptions.onLevelSelect;
    expect(onLevelSelect).toBeDefined();

    onLevelSelect!({
      roomId: 'classroom-01',
      levelId: 'classroom-01-level-06',
      levelNumber: 6,
      selectionCount: 1,
    });

    expect(playSfxSpy).toHaveBeenCalledWith('start');
    expect(stopMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.scene.start).toHaveBeenCalledWith('Make24', {
      moduleId: 1,
      levelId: 6,
    });
  });

  it('routes to Blacksmith minigame when level 7 is selected', () => {
    scene.create();

    const onLevelSelect = capturedGameUIOptions.onLevelSelect;
    expect(onLevelSelect).toBeDefined();

    onLevelSelect!({
      roomId: 'classroom-01',
      levelId: 'classroom-01-level-07',
      levelNumber: 7,
      selectionCount: 1,
    });

    expect(playSfxSpy).toHaveBeenCalledWith('start');
    expect(stopMusicSpy).toHaveBeenCalledTimes(1);
    expect(scene.scene.start).toHaveBeenCalledWith('Blacksmith', {
      moduleId: 1,
      levelId: 7,
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

  // A sample map selection: classroom 2, level 4.
  const classroom2Level4 = {
    roomId: 'classroom-02',
    levelId: 'classroom-02-level-04',
    levelNumber: 4,
    selectionCount: 1,
  };

  /** Reads the `hidden` menu option the scene passed to createGameUI. */
  const hiddenOption = () =>
    (capturedGameUIOptions.menu as { hidden?: Record<string, boolean> } | undefined)?.hidden;

  it('hides Continue for a first-time player and shows it once a level was played', () => {
    scene.create();
    expect(hiddenOption()).toEqual({ continue: true });

    saveLastPlayed(classroom2Level4);
    scene.create();
    expect(hiddenOption()).toEqual({ continue: false });
  });

  it('Continue reopens the level that was played last', () => {
    scene.create();
    // Playing a level from the map saves it.
    capturedGameUIOptions.onLevelSelect!(classroom2Level4);
    vi.mocked(scene.scene.start).mockClear();

    capturedGameUIOptions.menu!.callbacks!.continue({ action: 'continue' });

    expect(scene.scene.start).toHaveBeenCalledWith('Combat', {
      moduleId: 2,
      levelId: 4,
      activity: 'level',
      selectionId: 'classroom-02-level-04',
    });
    expect(mockGameUIController.showMap).not.toHaveBeenCalled();
  });

  it('New Game forgets the last played level and hides Continue', () => {
    saveLastPlayed(classroom2Level4);
    scene.create();
    const menu = { update: vi.fn() };

    capturedGameUIOptions.menu!.callbacks!.newGame({ action: 'newGame', menu });

    expect(loadLastPlayed()).toBeNull();
    expect(menu.update).toHaveBeenCalledWith({ hidden: { continue: true } });
  });
});
