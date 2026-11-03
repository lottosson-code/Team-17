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
        callbacks: {
          newGame: () => {
            soundManager.playSfx('click');
            mapProgressStore.resetProgress();
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
        this.scene.start('Combat', toGameplaySelection(selection));
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
