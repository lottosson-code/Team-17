import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Phaser
vi.mock('phaser', () => {
  class MockScene {
    sys = {
      settings: { key: 'Blacksmith' },
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

const { mockStageDestroy, mockHostDestroy } = vi.hoisted(() => ({
  mockStageDestroy: vi.fn(),
  mockHostDestroy: vi.fn(),
}));

vi.mock('konva', () => {
  class MockStage {
    add = vi.fn();
    destroy = mockStageDestroy;
  }
  class MockLayer {
    add = vi.fn();
  }
  return {
    default: {
      Stage: MockStage,
      Layer: MockLayer,
    },
  };
});

vi.mock('../../ui/sceneOverlay', () => ({
  createSceneOverlay: vi.fn(() => {
    const el = {
      append: vi.fn(),
      ownerDocument: {
        createElement: vi.fn(() => ({
          id: '',
          style: {},
        })),
      },
    };
    return {
      element: el as unknown as HTMLElement,
      destroy: mockHostDestroy,
    };
  }),
}));

let capturedBlacksmithCallbacks: {
  onStatsUpgraded?: () => void;
  onExitToMap?: () => void;
} = {};

vi.mock('../../minigames/blacksmith/BlacksmithModel', () => {
  class MockModel {}
  return { BlacksmithModel: MockModel };
});

vi.mock('../../minigames/blacksmith/BlacksmithView', () => {
  class MockView {}
  return { BlacksmithView: MockView };
});

vi.mock('../../minigames/blacksmith/BlacksmithController', () => {
  class MockController {
    constructor(_model: unknown, _view: unknown, callbacks: typeof capturedBlacksmithCallbacks) {
      capturedBlacksmithCallbacks = callbacks;
    }
  }
  return { BlacksmithController: MockController };
});

import { BlacksmithScene } from '../BlacksmithScene';
import { mapProgressStore } from '../../state/mapProgressStore';
import { soundManager } from '../../audio/soundManager';

describe('BlacksmithScene', () => {
  let scene: BlacksmithScene;
  let playSfxSpy: ReturnType<typeof vi.spyOn>;
  let completeLevelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedBlacksmithCallbacks = {};
    playSfxSpy = vi.spyOn(soundManager, 'playSfx').mockImplementation(() => {});
    completeLevelSpy = vi.spyOn(mapProgressStore, 'completeLevel').mockImplementation(() => {});
    scene = new BlacksmithScene();
    scene.init({ moduleId: 1, levelId: 7 });
  });

  it('mounts Blacksmith stage and view into scene overlay on create()', () => {
    scene.create();
    expect(capturedBlacksmithCallbacks.onStatsUpgraded).toBeDefined();
    expect(capturedBlacksmithCallbacks.onExitToMap).toBeDefined();
  });

  it('marks level 7 as completed and plays start sound when armor is forged', () => {
    scene.create();
    capturedBlacksmithCallbacks.onStatsUpgraded?.();

    expect(playSfxSpy).toHaveBeenCalledWith('start');
    expect(completeLevelSpy).toHaveBeenCalledWith(1, 7);
  });

  it('navigates back to map on exit', () => {
    scene.create();
    capturedBlacksmithCallbacks.onExitToMap?.();

    expect(playSfxSpy).toHaveBeenCalledWith('click');
    expect(scene.scene.start).toHaveBeenCalledWith('MainMenu', {
      showMap: true,
      roomIndex: 0,
    });
  });

  it('destroys stage and overlay on shutdown', () => {
    scene.create();

    const onceCalls = vi.mocked(scene.events.once).mock.calls;
    const shutdownCall = onceCalls.find((call) => call[0] === 'shutdown');
    expect(shutdownCall).toBeDefined();

    shutdownCall![1]();

    expect(mockStageDestroy).toHaveBeenCalledTimes(1);
    expect(mockHostDestroy).toHaveBeenCalledTimes(1);
  });
});
