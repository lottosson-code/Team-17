import Phaser from 'phaser';
import { CombatModel } from '../combat/CombatModel';
import { getLevel } from '../combat/levels';
import type { CombatEvent, Enemy } from '../combat/types';
import { Battlefield } from '../combat/view/Battlefield';
import { Effects } from '../combat/view/Effects';
import { EnemySprite, createWalkAnimations } from '../combat/view/EnemySprite';
import { Hud } from '../combat/view/Hud';
import { laneDanger, lowHealthLevel } from '../combat/view/hudLogic';
import { createTextures } from '../combat/view/textures';
import { CURSED_CLASSROOM, DEPTH, enemyArt, themeTextures, wizardFeet } from '../combat/view/theme';
import { WizardSprite } from '../combat/view/WizardSprite';
import { mapProgressStore } from '../state/mapProgressStore';
import { createPauseMenu, type PauseMenuController } from '../../pause menu/index.js';
import { createSceneOverlay } from '../ui/sceneOverlay';
import { createSettingsModal, type SettingsModalController } from '../ui/settingsModal';
import { soundManager } from '../audio/soundManager';
import '../ui/modal.css';
import '../ui/game-ui.css';

// This scene only draws state and reacts to events.

const MAX_INPUT_LENGTH = 4;
/** Cap per-frame time so switching tabs doesn't teleport enemies. */
const MAX_FRAME_MS = 100;
const THEME = CURSED_CLASSROOM;

export class CombatScene extends Phaser.Scene {
  private moduleId = 1;
  private levelId = 1;

  private model!: CombatModel;
  private battlefield!: Battlefield;
  private wizard!: WizardSprite;
  private effects!: Effects;
  private hud!: Hud;
  private enemySprites = new Map<number, EnemySprite>();

  private typed = '';
  private wavesStarted = 0;
  private paused = false;
  /** Resolves the running cutscene's wait for its enemies to finish walking in. */
  private walkInReady: (() => void) | undefined;
  /** Animation clock that stops while paused. */
  private animTime = 0;

  private pauseMenu: PauseMenuController | null = null;
  private settingsModal: SettingsModalController | null = null;
  private overlayHost: { element: HTMLElement; destroy: () => void } | null = null;

  constructor() {
    super('Combat');
  }

  init(data: { moduleId?: number; levelId?: number }): void {
    this.moduleId = data?.moduleId ?? 1;
    this.levelId = data?.levelId ?? 1;
    this.enemySprites = new Map();
    this.typed = '';
    this.wavesStarted = 0;
    this.paused = false;
    this.walkInReady = undefined;
  }

  preload(): void {
    this.load.font('Lora', 'assets/fonts/Lora-Variable.woff', 'woff');
    this.load.font('Poppins', 'assets/fonts/Poppins-Bold.woff', 'woff');
    for (const art of themeTextures(THEME)) {
      if (!this.textures.exists(art.texture)) this.load.image(art.texture, `assets/combat/enemies/${art.file}.webp`);
      const walk = art.walk;
      if (walk && !this.textures.exists(walk.texture)) {
        this.load.spritesheet(walk.texture, `assets/combat/enemies/${walk.file}.webp`, {
          frameWidth: walk.frameWidth, frameHeight: walk.frameHeight,
        });
      }
    }
  }

  create(): void {
    this.time.paused = false;
    createTextures(this);
    createWalkAnimations(this, themeTextures(THEME));
    this.model = new CombatModel(getLevel(this.moduleId, this.levelId));

    this.battlefield = new Battlefield(this, THEME);
    this.wizard = new WizardSprite(this, wizardFeet(THEME));
    this.effects = new Effects(this);
    this.hud = new Hud(this, THEME.name, {
      onCast: () => this.cast(),
      onPause: () => this.togglePause(),
      onRestart: () => this.restart(),
      onMenu: () => this.toMenu(),
    });

    const host = createSceneOverlay(this);
    this.overlayHost = host;

    // Dev victory button (allows testing level unlocks/progression immediately)
    const winTrigger = document.createElement('button');
    winTrigger.type = 'button';
    winTrigger.className = 'game-victory-trigger';
    winTrigger.textContent = 'Complete Level (Dev)';
    winTrigger.title = 'Dev shortcut: simulate beating this level (or press Shift+W)';
    winTrigger.onclick = () => this.triggerVictory();
    host.element.append(winTrigger);

    this.pauseMenu = createPauseMenu(host.element, {
      visible: false,
      callbacks: {
        resume: ({ menu }) => {
          soundManager.playSfx('click');
          menu.setVisible(false);
          this.unpauseGame();
        },
        restart: () => {
          soundManager.playSfx('click');
          this.restart();
        },
        settings: async ({ menu, signal }) => {
          soundManager.playSfx('modalOpen');
          menu.setVisible(false);
          await new Promise<void>((resolve) => {
            const modal = createSettingsModal(host.element, {
              signal,
              onClose: () => {
                this.settingsModal = null;
                soundManager.playSfx('modalClose');
                resolve();
              },
            });
            this.settingsModal = modal;
          });
          if (!signal.aborted) menu.setVisible(true);
        },
        quit: () => {
          soundManager.playSfx('click');
          this.toMenu();
        },
      },
    });

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    this.cameras.main.fadeIn(400, 5, 2, 12);

    this.events.once('shutdown', () => {
      this.settingsModal?.destroy();
      this.settingsModal = null;
      this.pauseMenu?.destroy();
      this.pauseMenu = null;
      this.overlayHost?.destroy();
      this.overlayHost = null;
    });
  }

  update(time: number, delta: number): void {
    if (!this.paused) {
      this.animTime += delta;
      this.handleEvents(this.model.tick(Math.min(delta, MAX_FRAME_MS)));
    }

    const enemies = this.model.getEnemies();
    for (const enemy of enemies) {
      const sprite = this.enemySprites.get(enemy.id) ?? this.createEnemySprite(enemy);
      sprite.sync(enemy, this.animTime);
      sprite.setProblemHidden(this.paused);
    }

    this.battlefield.setLaneDanger(laneDanger(enemies));
    this.battlefield.setLowHealth(lowHealthLevel(this.model.getPlayerHp(), this.model.getPlayerMaxHp()));
    this.battlefield.update(time);
    this.syncHud(time);
  }

  // ---------------------------------------------------------------- input

  private onKey(event: KeyboardEvent): void {
    const status = this.model.getStatus();
    if (event.key === 'Escape') {
      this.togglePause();
      return;
    }
    // Dev shortcut: Shift + W triggers instant level completion for testing
    if (event.shiftKey && (event.key === 'W' || event.key === 'w')) {
      this.triggerVictory();
      return;
    }
    if (status === 'won' || status === 'lost' || this.paused) {
      if (event.key === 'r' || event.key === 'R') this.restart();
      if (event.key === 'm' || event.key === 'M') this.toMenu();
      return;
    }
    // No typing while a cutscene plays.
    if (status === 'cutscene') return;

    if (/^[0-9]$/.test(event.key) && this.typed.length < MAX_INPUT_LENGTH) {
      this.typed += event.key;
    } else if (event.key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
    } else if (event.key === 'Enter') {
      this.cast();
    }
  }

  private cast(): void {
    if (this.typed === '' || this.paused || this.model.getStatus() !== 'playing') return;
    const answer = Number(this.typed);
    this.typed = '';
    this.handleEvents(this.model.submit(answer));
  }

  private togglePause(): void {
    const status = this.model.getStatus();
    if (status === 'won' || status === 'lost') return;
    if (this.paused) {
      this.unpauseGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    if (this.paused) return;
    this.paused = true;
    this.tweens.pauseAll();
    this.time.paused = true;
    soundManager.playSfx('modalOpen');
    this.pauseMenu?.setVisible(true);
  }

  private unpauseGame(): void {
    if (!this.paused) return;
    this.paused = false;
    this.pauseMenu?.setVisible(false);
    this.tweens.resumeAll();
    this.time.paused = false;
  }

  private triggerVictory(): void {
    if (this.paused) {
      this.unpauseGame();
    }
    soundManager.playSfx('start');
    mapProgressStore.completeLevel(this.moduleId, this.levelId);
    this.hud.showOverlay('won');
  }

  private restart(): void {
    this.time.paused = false;
    this.scene.restart({ moduleId: this.moduleId, levelId: this.levelId });
  }

  private toMenu(): void {
    this.time.paused = false;
    this.scene.start('MainMenu', { showMap: true, roomIndex: this.moduleId - 1 });
  }

  // ---------------------------------------------------------------- events

  private handleEvents(events: CombatEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'waveStarted':
          this.wavesStarted = event.wave + 1;
          this.hud.showBanner(event.isFinalWave ? 'FINAL WAVE!' : 'A huge wave is approaching!');
          this.battlefield.gust();
          this.battlefield.writeOnBoard([`Wave ${event.wave + 1}`, 'Stay sharp!']);
          break;
        case 'hit':
          this.castAt(event.enemyId, event.damage);
          break;
        case 'enemyDefeated':
          this.defeatEnemy(event.enemyId);
          break;
        case 'wrongAnswer':
          this.hud.flashInput('wrong');
          this.wizard.scared();
          break;
        case 'playerDamaged':
          this.enemySprites.get(event.enemyId)?.attack();
          this.wizard.hurt();
          this.effects.shake(0.007, 160);
          this.effects.callout(this.wizard.tip().add(new Phaser.Math.Vector2(-60, -110)), `-${event.damage}`, '#ff5c7a');
          break;
        case 'announcement':
          this.hud.showBanner(event.text);
          break;
        case 'cutsceneStarted':
          this.playCutscene(event.id);
          break;
        case 'cutsceneEnemiesReady':
          this.walkInReady?.();
          this.walkInReady = undefined;
          break;
        case 'problemTwisted':
          this.enemySprites.get(event.enemyId)?.popProblem();
          break;
        case 'won':
          mapProgressStore.completeLevel(this.moduleId, this.levelId);
          this.hud.showOverlay('won');
          break;
        case 'lost':
          this.wizard.defeat();
          this.hud.showOverlay('lost');
          break;
        // enemySpawned / newProblem / enemyReachedPlayer / cutsceneEnded: update() picks these up.
      }
    }
  }

  private castAt(enemyId: number, damage: number): void {
    const sprite = this.enemySprites.get(enemyId);
    this.hud.flashInput('correct');
    if (!sprite) return;
    const target = sprite.centre();
    this.wizard.cast(target);
    this.effects.bolt(this.wizard.tip(), target);
    this.effects.impact(target);
    this.effects.correct(target);
    this.effects.damage(target, damage);
  }

  private defeatEnemy(enemyId: number): void {
    const sprite = this.enemySprites.get(enemyId);
    if (!sprite) return;
    // Stop syncing it so the death animation isn't overwritten.
    this.enemySprites.delete(enemyId);
    this.effects.paperBurst(sprite.centre());
    sprite.die();
  }

  private createEnemySprite(enemy: Readonly<Enemy>): EnemySprite {
    const sprite = new EnemySprite(this, enemy, enemyArt(THEME, enemy.kind.id));
    this.enemySprites.set(enemy.id, sprite);
    return sprite;
  }

  private syncHud(time: number): void {
    const total = this.model.getWaveMarkers().length;
    this.hud.update({
      hp: this.model.getPlayerHp(),
      maxHp: this.model.getPlayerMaxHp(),
      progress: this.model.getProgress(),
      waveMarkers: this.model.getWaveMarkers(),
      subtitle: this.wavesStarted === 0 ? `LEVEL ${this.moduleId}-${this.levelId}` : `WAVE ${this.wavesStarted} / ${total}`,
      typed: this.typed,
      inputEnabled: this.model.getStatus() === 'playing' && !this.paused,
    }, time);
  }

  // ---------------------------------------------------------------- cutscenes

  private playCutscene(id: string): void {
    if (id === 'bossTwist') {
      void this.playBossTwist(this.model);
    } else if (id === 'bossTaunt') {
      void this.playBossTaunt(this.model);
    } else {
      // Unknown cutscene id: resume instead of leaving the game frozen.
      console.warn(`No animation for cutscene "${id}"`);
      this.handleEvents(this.model.endCutscene());
    }
  }

  /** The module boss flies in, turns + into ×, then flies out. */
  private async playBossTwist(model: CombatModel): Promise<void> {
    // The three enemies walk in from off screen first (the model moves them; they can't be hit).
    // Set up the wait now, before the model's 'cutsceneEnemiesReady' can arrive on a later frame.
    const walkedIn = model.getCutscene()?.walkInTo === undefined
      ? Promise.resolve()
      : new Promise<void>(resolve => { this.walkInReady = resolve; });
    await walkedIn;
    if (this.model !== model) return;
    const boss = this.createBoss();

    // Let the player read the addition problems first.
    await this.wait(700);
    this.battlefield.setBossMood(true);
    await this.flyIn(boss);
    this.say(boss, 'Adding? How boring...');
    await this.wait(1500);

    for (const sprite of this.enemySprites.values()) this.effects.curse(this.bossHand(boss), sprite.bubblePoint());
    this.effects.shake(0.005, 200);
    await this.wait(300);
    // Stop if the scene restarted while waiting; this model is no longer shown.
    if (this.model !== model) return;
    this.handleEvents(model.twistOperators());
    this.say(boss, 'Now MULTIPLY!');
    await this.wait(1800);

    // The laugh starts before the boss leaves and stays attached to it on the way out.
    this.say(boss, 'Hehehehehe!!!');
    await this.wait(600);
    await this.flyOut(boss);
    if (this.model !== model) return;
    this.battlefield.setBossMood(false);
    this.hud.showBanner('+ became ×!');
    this.handleEvents(model.endCutscene());
  }

  /** The module boss taunts the player and sends in the mini-boss, which spawns on the last line. */
  private async playBossTaunt(model: CombatModel): Promise<void> {
    const boss = this.createBoss();
    this.battlefield.setBossMood(true);
    await this.flyIn(boss);
    this.say(boss, "Boy you think you're clever don't you...", 2200);
    await this.wait(2600);
    this.say(boss, 'See if you can handle this!', 1800);
    await this.wait(2200);
    if (this.model !== model) return;

    this.say(boss, 'Go get him, big guy! Hehehehehe!!!!!', 2000);
    // Play resumes now, so the mini-boss appears while the boss is still laughing.
    this.handleEvents(model.endCutscene());
    this.effects.shake(0.006, 260);
    await this.wait(1000);
    await this.flyOut(boss);
    if (this.model === model) this.battlefield.setBossMood(false);
  }

  /** The module boss: its art with a pulsing curse aura, floating. Starts off-screen, top right. */
  private createBoss(): Phaser.GameObjects.Container {
    const art = THEME.boss;
    const aura = this.add.image(0, -art.height / 2, 'fx-glow').setTint(0x9b4dff).setScale(3.4).setAlpha(0.5)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.add.image(0, 0, art.texture).setOrigin(0.5, 1).setFlipX(!art.faceLeft);
    body.setScale(art.height / body.height);
    const boss = this.add.container(1460, 20, [aura, body]).setDepth(DEPTH.boss);
    this.tweens.add({ targets: aura, scale: 3.9, alpha: 0.75, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: body, y: -12, angle: 3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return boss;
  }

  private bossHand(boss: Phaser.GameObjects.Container): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(boss.x - 40, boss.y - THEME.boss.height * 0.45);
  }

  private flyIn(boss: Phaser.GameObjects.Container): Promise<void> {
    return this.tweenTo({ targets: boss, x: 880, y: 330, duration: 1200, ease: 'Sine.easeOut' });
  }

  private async flyOut(boss: Phaser.GameObjects.Container): Promise<void> {
    await this.tweenTo({ targets: boss, x: 1460, y: -60, duration: 1000, ease: 'Sine.easeIn' });
    boss.destroy();
  }

  /** Speech bubble above the boss that follows it, then fades out after holdMs. */
  private say(boss: Phaser.GameObjects.Container, text: string, holdMs = 1400): void {
    const label = this.add.text(0, 0, text, {
      fontFamily: 'Lora', fontSize: '23px', fontStyle: 'bold', color: '#2a1630', align: 'center',
      wordWrap: { width: 360 },
    }).setOrigin(0.5);
    const w = label.width + 36;
    const h = label.height + 24;
    const bubble = this.add.graphics();
    bubble.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 14);
    bubble.fillStyle(0xf6ecd4).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bubble.lineStyle(3, 0x6b2f8f).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    // Tail pointing right, toward the boss.
    bubble.fillStyle(0xf6ecd4).fillTriangle(w / 2 - 1, -12, w / 2 - 1, 12, w / 2 + 20, 4);
    const speech = this.add.container(-w / 2 - 110, -THEME.boss.height * 0.7, [bubble, label]).setScale(0.4);
    boss.add(speech);
    this.tweens.add({ targets: speech, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: speech, alpha: 0, delay: holdMs, duration: 300, onComplete: () => speech.destroy() });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  private tweenTo(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }
}
