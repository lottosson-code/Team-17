import Phaser from 'phaser';
import Konva from 'konva';
import { BlacksmithModel } from '../minigames/blacksmith/BlacksmithModel';
import { BlacksmithView } from '../minigames/blacksmith/BlacksmithView';
import { BlacksmithController } from '../minigames/blacksmith/BlacksmithController';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { mapProgressStore } from '../state/mapProgressStore';
import { soundManager } from '../audio/soundManager';

export interface BlacksmithSceneData {
  moduleId?: number;
  levelId?: number;
}

export class BlacksmithScene extends Phaser.Scene {
  private moduleId = 1;
  private overlayHost: { element: HTMLElement; destroy: () => void } | null = null;
  private stage: Konva.Stage | null = null;
  private controller: BlacksmithController | null = null;

  constructor() {
    super('Blacksmith');
  }

  init(data?: BlacksmithSceneData): void {
    this.moduleId = data?.moduleId ?? 1;
  }

  create(): void {
    const host = createSceneOverlay(this);
    this.overlayHost = host;

    const doc = host.element.ownerDocument || document;
    const container = doc.createElement('div');
    container.id = 'blacksmith-stage-host';
    Object.assign(container.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: '#111116',
      pointerEvents: 'auto',
    });
    host.element.append(container);

    const stage = new Konva.Stage({
      container,
      width: 960,
      height: 600,
    });
    this.stage = stage;

    const layer = new Konva.Layer();
    stage.add(layer);

    const view = new BlacksmithView(layer, 960, 600);
    const model = new BlacksmithModel('easy');
    this.controller = new BlacksmithController(model, view, {
      onStatsUpgraded: () => {
        soundManager.playSfx('start');
        mapProgressStore.completeLevel(this.moduleId, 7);
      },
      onExitToMap: () => {
        soundManager.playSfx('click');
        this.scene.start('MainMenu', { showMap: true, roomIndex: this.moduleId - 1 });
      },
    });

    this.events.once('shutdown', () => {
      this.stage?.destroy();
      this.stage = null;
      this.controller = null;
      this.overlayHost?.destroy();
      this.overlayHost = null;
    });
  }
}
