import Phaser from 'phaser';
import { mountMake24, type Make24Controller } from '../minigames/make24/src/make24';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { mapProgressStore } from '../state/mapProgressStore';
import { soundManager } from '../audio/soundManager';
// [Added] Shared fade-to-black transition back to the map.
import { startSceneWithTransition } from '../ui/sceneTransition';

export interface Make24SceneData {
  moduleId?: number;
  levelId?: number;
}

export class Make24Scene extends Phaser.Scene {
  private moduleId = 1;
  private gameController: Make24Controller | null = null;
  private overlayHost: { element: HTMLElement; destroy: () => void } | null = null;

  constructor() {
    super('Make24');
  }

  init(data?: Make24SceneData): void {
    this.moduleId = data?.moduleId ?? 1;
  }

  create(): void {
    const host = createSceneOverlay(this);
    this.overlayHost = host;

    this.gameController = mountMake24(host.element, {
      difficulty: 'normal',
      onSolve: () => {
        soundManager.playSfx('start');
        mapProgressStore.completeLevel(this.moduleId, 6);
      },
      onExit: () => {
        soundManager.playSfx('click');
        // [Changed] Was this.scene.start(...); now behind the shared fade-to-black transition.
        void startSceneWithTransition(this, 'MainMenu', { showMap: true, roomIndex: this.moduleId - 1 });
      },
    });

    this.events.once('shutdown', () => {
      this.gameController?.destroy();
      this.gameController = null;
      this.overlayHost?.destroy();
      this.overlayHost = null;
    });
  }
}
