import Phaser from 'phaser';
import { createGameUI, GameUIController } from '../../main menu/index.js';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { toGameplaySelection } from '../ui/levelSelection';
import { createSettingsModal, SettingsModalController } from '../ui/settingsModal';
import { createQuitModal, QuitModalController } from '../ui/quitModal';
import { soundManager } from '../audio/soundManager';
import { mapProgressStore } from '../state/mapProgressStore';
import { seenEnemiesStore } from '../state/seenEnemiesStore';
// Remembers the last level played, for the Continue button.
import { clearLastPlayed, loadLastPlayed, saveLastPlayed } from '../ui/lastPlayed';
import type { LevelSelection } from '../../map/types.js';
// [Added] Shared fade-to-black transition for menu -> map and map -> level.
import { isFadeTransitionRunning, fadeTransition } from '../ui/fadeTransition';
import { startSceneWithTransition } from '../ui/sceneTransition';
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
        // Checked each time the menu opens: no saved level (first time playing) hides Continue.
        hidden: { continue: loadLastPlayed() === null },
        callbacks: {
          newGame: ({ menu }) => {
            soundManager.playSfx('click');
            mapProgressStore.resetProgress();
            // Every enemy is new again, so their "New enemy" tags show up again.
            seenEnemiesStore.reset();
            // A new game has no level to continue: forget it and hide Continue.
            clearLastPlayed();
            menu?.update({ hidden: { continue: true } });
            // Redraw after the reset (`?.`: tests call this without a menu).
            menu?.update({ progress: currentProgress() });
            // [Changed] Was ui.showMap(); now behind the shared fade-to-black transition.
            void fadeTransition(() => ui.showMap());
          },
          continue: () => {
            // Continue: reopen the level the player started most recently, from its beginning.
            const lastPlayed = loadLastPlayed();
            if (lastPlayed) {
              // Same path as clicking that level on the map.
              this.startLevel(lastPlayed);
              return;
            }
            // No saved level (the button is normally hidden then): just open the map.
            soundManager.playSfx('click');
            // [Changed] Was ui.showMap(); now behind the shared fade-to-black transition.
            void fadeTransition(() => ui.showMap());
          },
          settings: ({ signal }) => {
            soundManager.playSfx('modalOpen');
            // Returning a Promise keeps the main menu controller in a busy state (disabling
            // duplicate activations) until the modal is closed and the promise resolves.
            return new Promise<void>((resolve) => {
              const modal = createSettingsModal(host.element, {
                signal,
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
                  resolve();
                },
                { once: true }
              );
            });
          },
          quit: ({ signal }) => {
            soundManager.playSfx('modalOpen');
            // Returning a Promise keeps the main menu controller in a busy state (disabling
            // duplicate activations) until the modal is closed and the promise resolves.
            return new Promise<void>((resolve) => {
              const modal = createQuitModal(host.element, {
                signal,
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
                  resolve();
                },
                { once: true }
              );
            });
          },
        },
      },
      // Map click: open the level (shared with Continue, see startLevel below).
      onLevelSelect: (selection) => this.startLevel(selection),
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

  /**
   * Opens a level's gameplay scene and remembers it as the last level played.
   * Used by both the map (clicking a level) and the Continue button.
   */
  private startLevel(selection: LevelSelection): void {
    // [Added] Ignore extra clicks while the fade to a level is already playing.
    if (isFadeTransitionRunning()) return;
    // Save first, so the level is already stored however the player later leaves
    // (pause menu, closing the browser, ...), and Continue can reopen it.
    saveLastPlayed(selection);
    soundManager.playSfx('start');
    soundManager.stopMenuMusic();
    const gameplay = toGameplaySelection(selection);
    if (gameplay.activity === 'minigame') {
      if (gameplay.levelId === 1) {
        // [Changed] scene.start -> startSceneWithTransition (shared fade-to-black transition), here and below.
        void startSceneWithTransition(this, 'Make24', { moduleId: gameplay.moduleId, levelId: 6 });
        return;
      }
      if (gameplay.levelId === 2) {
        void startSceneWithTransition(this, 'Blacksmith', { moduleId: gameplay.moduleId, levelId: 7 });
        return;
      }
    }
    void startSceneWithTransition(this, 'Combat', gameplay);
  }
}
