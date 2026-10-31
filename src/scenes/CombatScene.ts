import Phaser from 'phaser';
import { createPauseMenu } from '../../pause menu/index.js';
import { createSceneOverlay } from '../ui/sceneOverlay';
import type { GameplaySelection } from '../ui/levelSelection';

export class CombatScene extends Phaser.Scene {
  private moduleId = 1;
  private levelId = 1;
  private activity: GameplaySelection['activity'] = 'level';

  constructor() {
    super('Combat');
  }

  init(data: GameplaySelection): void {
    this.moduleId = data.moduleId;
    this.levelId = data.levelId;
    this.activity = data.activity ?? 'level';
  }

  create(): void {
    this.add.text(640, 285, 'Combat Scene', {
      fontFamily: 'Arial',
      fontSize: '56px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const activity = this.activity === 'minigame' ? 'Minigame' : 'Level';
    this.add.text(640, 380, `Module ${this.moduleId} — ${activity} ${this.levelId}`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#bfcdf0',
    }).setOrigin(0.5);

    const host = createSceneOverlay(this);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'game-pause-trigger';
    // placeholder：Gameplay control opening the independent pause window.
    trigger.textContent = 'Pause';
    host.element.append(trigger);
    const pause = createPauseMenu(host.element, {
      visible: false,
      disabled: { settings: true },
      callbacks: {
        resume: ({ menu }) => { trigger.hidden = false; menu.setVisible(false); this.scene.resume(); },
        restart: () => { this.scene.resume(); this.scene.restart({ moduleId: this.moduleId, levelId: this.levelId, activity: this.activity }); },
        quit: () => { this.scene.resume(); this.scene.start('MainMenu'); },
      },
    });
    const open = (): void => {
      if (pause.getState().visible) return;
      this.scene.pause();
      pause.setVisible(true);
      trigger.hidden = true;
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.repeat && !event.defaultPrevented && !pause.getState().visible) {
        event.preventDefault(); open();
      }
    };
    trigger.onclick = open;
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => {
      window.removeEventListener('keydown', onKey);
      trigger.onclick = null;
      pause.destroy();
      host.destroy();
    });
  }
}
