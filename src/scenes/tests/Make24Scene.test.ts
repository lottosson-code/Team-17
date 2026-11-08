import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  class MockScene {
    sys = {
      settings: { key: 'Make24' },
    };
    events = {
      once: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    scene = {
      start: vi.fn(),
      restart: vi.fn(),
    };
  }
  return { default: { Scene: MockScene } };
});

let mockHostDestroy: ReturnType<typeof vi.fn>;
vi.mock('../../ui/sceneOverlay', () => ({
  createSceneOverlay: vi.fn(() => {
    mockHostDestroy = vi.fn();
    return {
      element: { append: vi.fn() } as unknown as HTMLElement,
      destroy: mockHostDestroy,
    };
  }),
}));

let capturedMake24Options: {
  onSolve?: (result: unknown) => void;
  onExit?: () => void;
} = {};
let mockMake24Destroy: ReturnType<typeof vi.fn>;

vi.mock('../../minigames/make24/src/make24', () => ({
  mountMake24: vi.fn((_host, options) => {
    capturedMake24Options = options;
    mockMake24Destroy = vi.fn();
    return {
      element: {} as HTMLElement,
      destroy: mockMake24Destroy,
    };
  }),
}));

import { Make24Scene } from '../Make24Scene';
import { mapProgressStore } from '../../state/mapProgressStore';
import { soundManager } from '../../audio/soundManager';

describe('Make24Scene', () => {
  let scene: Make24Scene;
  let playSfxSpy: ReturnType<typeof vi.spyOn>;
  let completeLevelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    playSfxSpy = vi.spyOn(soundManager, 'playSfx').mockImplementation(() => {});
    completeLevelSpy = vi.spyOn(mapProgressStore, 'completeLevel').mockReturnValue({ unlockedLevels: [], completedLevels: [] });
    scene = new Make24Scene();
    scene.init({ moduleId: 1, levelId: 6 });
  });

  it('mounts Make 24 into scene overlay on create()', () => {
    scene.create();
    expect(capturedMake24Options.onSolve).toBeDefined();
    expect(capturedMake24Options.onExit).toBeDefined();
  });

  it('marks level 6 as completed and plays sound when solved', () => {
    scene.create();
    capturedMake24Options.onSolve?.({});

    expect(playSfxSpy).toHaveBeenCalledWith('start');
    expect(completeLevelSpy).toHaveBeenCalledWith(1, 6);
  });

  it('navigates back to map on exit', () => {
    scene.create();
    capturedMake24Options.onExit?.();

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(scene.scene.start).toHaveBeenCalledWith('MainMenu', {
      showMap: true,
      roomIndex: 0,
    });
  });

  it('destroys game controller and host overlay on shutdown', () => {
    scene.create();

    const onceCalls = vi.mocked(scene.events.once).mock.calls;
    const shutdownCall = onceCalls.find((call) => call[0] === 'shutdown');
    expect(shutdownCall).toBeDefined();

    shutdownCall![1]();

    expect(mockMake24Destroy).toHaveBeenCalledTimes(1);
    expect(mockHostDestroy).toHaveBeenCalledTimes(1);
  });
});
