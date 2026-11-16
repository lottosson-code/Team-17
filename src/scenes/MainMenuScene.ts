import Phaser from 'phaser';
import { createGameUI, GameUIController } from '../../main menu/index.js';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { toGameplaySelection } from '../ui/levelSelection';
import { createSettingsModal, SettingsModalController } from '../ui/settingsModal';
import { createQuitModal, QuitModalController } from '../ui/quitModal';
import { soundManager } from '../audio/soundManager';
import { mapProgressStore } from '../state/mapProgressStore';
import '../ui/modal.css';

export interface MainMenuSceneData {
  showMap?: boolean;
  roomIndex?: number;
}

/**
 * Main menu progress, from the same store the map uses.
 * classroom/level: first main level not completed yet (minigames ignored).
 * completedRatio: completed share of all main levels.
 */
export function currentProgress(): { classroom: number; level: number; completedRatio: number } {
  // Completed main levels across all classrooms.
  const { completedCount, totalCount } = mapProgressStore.getTotalProgress();
  const completedRatio = completedCount / totalCount;
  // Scan in play order; return the first level not completed.
  for (let classroom = 1; classroom <= 3; classroom++) {
    for (let level = 1; level <= 5; level++) {
      if (!mapProgressStore.isLevelCompleted(classroom, level)) return { classroom, level, completedRatio };
    }
  }
  return { classroom: 3, level: 5, completedRatio }; // everything done
}

export class MainMenuScene extends Phaser.Scene {
  public ui: GameUIController | null = null;
  public settingsModal: SettingsModalController | null = null;
  public quitModal: QuitModalController | null = null;
  private initialData?: MainMenuSceneData;

  constructor() {
    super('MainMenu');
  }

  init(data?: MainMenuSceneData): void {
    this.initialData = data;
  }

  create(): void {
    const host = createSceneOverlay(this);

    soundManager.startMenuMusic();

    const ui = createGameUI(host.element, {
      map: {
        isRoomUnlocked: (roomIndex) => mapProgressStore.isModuleUnlocked(roomIndex + 1),
        isLevelUnlocked: (roomIndex, levelNum) =>
          mapProgressStore.isLevelUnlocked(roomIndex + 1, levelNum),
        isLevelCompleted: (roomIndex, levelNum) =>
          mapProgressStore.isLevelCompleted(roomIndex + 1, levelNum),
      },
      menu: {
        // Read fresh progress whenever this scene starts.
        progress: currentProgress(),
        callbacks: {
          newGame: ({ menu }) => {
            soundManager.playSfx('click');
            mapProgressStore.resetProgress();
            // Redraw after the reset (`?.`: tests call this without a menu).
            menu?.update({ progress: currentProgress() });
            ui.showMap();
          },
          continue: () => {
            soundManager.playSfx('click');
            ui.showMap();
          },
          settings: ({ signal }) => {
            soundManager.playSfx('modalOpen');
            return new Promise<void>((resolve) => {
              const modal = createSettingsModal(host.element, {
                onClose: () => {
                  this.settingsModal = null;
                  soundManager.playSfx('modalClose');
                  resolve();
                },
              });
              this.settingsModal = modal;
              signal.addEventListener(
                'abort',
                () => {
                  modal.destroy();
                  this.settingsModal = null;
                },
                { once: true }
              );
            });
          },
          quit: ({ signal }) => {
            soundManager.playSfx('modalOpen');
            return new Promise<void>((resolve) => {
              const modal = createQuitModal(host.element, {
                onCancel: () => {
                  this.quitModal = null;
                  soundManager.playSfx('modalClose');
                  resolve();
                },
                onConfirm: () => {
                  soundManager.playSfx('click');
                },
              });
              this.quitModal = modal;
              signal.addEventListener(
                'abort',
                () => {
                  modal.destroy();
                  this.quitModal = null;
                },
                { once: true }
              );
            });
          },
        },
      },
      onLevelSelect: (selection) => {
        soundManager.playSfx('start');
        soundManager.stopMenuMusic();
        const gameplay = toGameplaySelection(selection);
        if (gameplay.activity === 'minigame') {
          if (gameplay.levelId === 1) {
            this.scene.start('Make24', { moduleId: gameplay.moduleId, levelId: 6 });
            return;
          }
          if (gameplay.levelId === 2) {
            this.scene.start('Blacksmith', { moduleId: gameplay.moduleId, levelId: 7 });
            return;
          }
        }
        this.scene.start('Combat', gameplay);
      },
    });

    this.ui = ui;

    if (this.initialData?.showMap) {
      ui.showMap(this.initialData.roomIndex);
    }

    const onButtonHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button')) {
        soundManager.playSfx('hover');
      }
    };
    host.element.addEventListener('pointerenter', onButtonHover, true);

    this.events.once('shutdown', () => {
      host.element.removeEventListener('pointerenter', onButtonHover, true);
      this.settingsModal?.destroy();
      this.settingsModal = null;
      this.quitModal?.destroy();
      this.quitModal = null;
      ui.destroy();
      this.ui = null;
      host.destroy();
      soundManager.stopMenuMusic();
    });
  }
}
