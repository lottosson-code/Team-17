import Phaser from 'phaser';
import { CombatModel } from '../combat/CombatModel';
import { LANE_PATHS, project } from '../combat/laneLayout';
import { getLevel } from '../combat/levels';
import { problemText } from '../combat/problems';
import type { CombatEvent, Enemy } from '../combat/types';

// GREYBOX: plain shapes standing in for art. Positions come from laneLayout.ts,
// rules from CombatModel; this scene only draws state and reacts to events.

const WIZARD_X = 210;
const WIZARD_Y = 400;
const WIZARD_COLOR = 0x3b5bdb;
const PROGRESS_X = 480;
const PROGRESS_Y = 34;
const PROGRESS_WIDTH = 320;
const MAX_INPUT_LENGTH = 4;
/** Cap per-frame time so switching tabs doesn't teleport enemies. */
const MAX_FRAME_MS = 100;

const KIND_COLORS: Record<string, number> = {
  pencil: 0xf2c14e,
  textbook: 0xc0392b,
};

interface EnemyView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Rectangle;
  problem: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  kindId: string;
}

const kindColor = (kindId: string) => KIND_COLORS[kindId] ?? 0x8888aa;
const enemyColor = (view: EnemyView) => kindColor(view.kindId);

export class CombatScene extends Phaser.Scene {
  private moduleId = 1;
  private levelId = 1;

  private model!: CombatModel;
  private enemyViews = new Map<number, EnemyView>();
  private typed = '';

  private wizard!: Phaser.GameObjects.Container;
  private wizardBody!: Phaser.GameObjects.Rectangle;
  private playerHpFill!: Phaser.GameObjects.Rectangle;
  private playerHpText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private skulls: { marker: number; icon: Phaser.GameObjects.Text }[] = [];
  private inputText!: Phaser.GameObjects.Text;
  private inputBox!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super('Combat');
  }

  init(data: { moduleId: number; levelId: number }): void {
    this.moduleId = data.moduleId;
    this.levelId = data.levelId;
    this.enemyViews = new Map();
    this.typed = '';
  }

  create(): void {
    this.model = new CombatModel(getLevel(this.moduleId, this.levelId));

    this.drawLanes();
    this.createWizard();
    this.createHud();
    this.createInputBar();

    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  update(_time: number, delta: number): void {
    this.handleEvents(this.model.tick(Math.min(delta, MAX_FRAME_MS)));
    this.syncEnemies();
    this.syncHud();
  }

  // ---------------------------------------------------------------- setup

  private drawLanes(): void {
    const g = this.add.graphics().setDepth(-1000);
    const left = LANE_PATHS[0].end.x - 40;
    const right = 1280;
    // Lane borders sit halfway between neighbouring lane centres.
    const centres = LANE_PATHS.map(path => path.spawn.y);
    const borders = [
      centres[0] - (centres[1] - centres[0]) / 2,
      ...centres.slice(1).map((y, i) => (y + centres[i]) / 2),
      centres[3] + (centres[3] - centres[2]) / 2,
    ];

    g.fillStyle(0x2a2440).fillRect(left, borders[0], right - left, borders[4] - borders[0]);
    g.lineStyle(2, 0x4fd1c5, 0.6);
    for (const y of borders) g.lineBetween(left, y, right, y);

    LANE_PATHS.forEach((path, lane) => {
      this.add.text(right - 12, path.spawn.y, `Lane ${lane + 1}`, {
        fontFamily: 'Arial', fontSize: '14px', color: '#6c6a8a',
      }).setOrigin(1, 0.5).setDepth(-999);
    });
  }

  private createWizard(): void {
    this.wizardBody = this.add.rectangle(0, 0, 70, 120, WIZARD_COLOR).setStrokeStyle(3, 0xffffff);
    const label = this.add.text(0, 0, 'Wizard', {
      fontFamily: 'Arial', fontSize: '16px', color: '#ffffff',
    }).setOrigin(0.5);
    this.wizard = this.add.container(WIZARD_X, WIZARD_Y, [this.wizardBody, label]).setDepth(WIZARD_Y);
  }

  private createHud(): void {
    this.add.text(24, 20, `Module ${this.moduleId} — Level ${this.levelId}`, {
      fontFamily: 'Arial', fontSize: '18px', color: '#bfcdf0',
    });
    this.add.rectangle(24, 58, 240, 18, 0x000000).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff);
    this.playerHpFill = this.add.rectangle(24, 58, 240, 18, 0xe03131).setOrigin(0, 0.5);
    this.playerHpText = this.add.text(276, 58, '', {
      fontFamily: 'Arial', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Level progress bar: fills as enemies are defeated; a skull marks where each wave starts.
    this.add.rectangle(PROGRESS_X, PROGRESS_Y, PROGRESS_WIDTH, 16, 0x000000)
      .setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff);
    this.progressFill = this.add.rectangle(PROGRESS_X, PROGRESS_Y, PROGRESS_WIDTH, 16, 0x51cf66)
      .setOrigin(0, 0.5);
    this.progressFill.scaleX = 0;
    this.skulls = this.model.getWaveMarkers().map(marker => ({
      marker,
      icon: this.add.text(PROGRESS_X + marker * PROGRESS_WIDTH, PROGRESS_Y, '☠', {
        fontFamily: 'Arial', fontSize: '28px', color: '#868e96', stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5),
    }));

    this.banner = this.add.text(640, 130, '', {
      fontFamily: 'Arial', fontSize: '40px', color: '#ffe066', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10000);
  }

  private createInputBar(): void {
    this.add.rectangle(640, 655, 1280, 130, 0x111122).setStrokeStyle(2, 0x4a4a7a);
    this.add.text(640, 612, 'Type the answer, press Enter to cast', {
      fontFamily: 'Arial', fontSize: '18px', color: '#bfcdf0',
    }).setOrigin(0.5);
    this.inputBox = this.add.rectangle(640, 665, 320, 64, 0xf8f0dc).setStrokeStyle(3, 0x8a7a5a);
    this.inputText = this.add.text(640, 665, '', {
      fontFamily: 'Arial', fontSize: '40px', color: '#111111',
    }).setOrigin(0.5);
  }

  // ---------------------------------------------------------------- input

  private onKey(event: KeyboardEvent): void {
    const status = this.model.getStatus();
    if (status === 'won' || status === 'lost') {
      if (event.key === 'r' || event.key === 'R') this.scene.restart({ moduleId: this.moduleId, levelId: this.levelId });
      if (event.key === 'm' || event.key === 'M') this.scene.start('MainMenu');
      return;
    }
    // No typing while a cutscene plays.
    if (status === 'cutscene') return;

    if (/^[0-9]$/.test(event.key) && this.typed.length < MAX_INPUT_LENGTH) {
      this.typed += event.key;
    } else if (event.key === 'Backspace') {
      this.typed = this.typed.slice(0, -1);
    } else if (event.key === 'Enter' && this.typed !== '') {
      const answer = Number(this.typed);
      this.typed = '';
      this.handleEvents(this.model.submit(answer));
    }
    this.inputText.setText(this.typed);
  }

  // ---------------------------------------------------------------- events

  private handleEvents(events: CombatEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'waveStarted':
          this.showBanner(event.isFinalWave ? 'Final wave!' : 'A huge wave of enemies is approaching!');
          break;
        case 'hit':
          this.castBolt(event.enemyId, event.damage);
          break;
        case 'enemyDefeated':
          this.defeatEnemy(event.enemyId);
          break;
        case 'wrongAnswer':
          this.wrongAnswer();
          break;
        case 'playerDamaged':
          this.enemyAttacks(event.enemyId);
          break;
        case 'cutsceneStarted':
          this.playCutscene(event.id);
          break;
        case 'problemTwisted':
          this.popProblem(event.enemyId);
          break;
        case 'won':
          this.showBanner('Victory!\nR = restart   M = menu', false);
          break;
        case 'lost':
          this.wizardBody.setFillStyle(0x555555);
          this.showBanner('Defeated\nR = restart   M = menu', false);
          break;
        // enemySpawned / newProblem / enemyReachedPlayer / cutsceneEnded: syncEnemies and syncHud pick these up.
      }
    }
  }

  private castBolt(enemyId: number, damage: number): void {
    const view = this.enemyViews.get(enemyId);
    if (!view) return;
    const { x, y } = view.container;

    const bolt = this.add.graphics().setDepth(9000);
    bolt.lineStyle(6, 0x74c0fc).lineBetween(WIZARD_X + 40, WIZARD_Y - 30, x, y - 30);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 250, onComplete: () => bolt.destroy() });

    this.floatText(x + 40, y - 70, `-${damage}`, '#ff6b6b');
    this.floatText(x - 60, y - 20, 'CORRECT!', '#74c0fc');
    this.flash(view.body, 0xffffff, enemyColor(view));
    this.flashInput(0x51cf66);
  }

  private defeatEnemy(enemyId: number): void {
    const view = this.enemyViews.get(enemyId);
    if (!view) return;
    // Stop syncing it so the fade-out isn't overwritten, then remove it.
    this.enemyViews.delete(enemyId);
    this.tweens.add({
      targets: view.container, alpha: 0, scale: view.container.scale * 1.3, duration: 300,
      onComplete: () => view.container.destroy(),
    });
  }

  /** Placeholder for the wizard's scared/frustrated animation. */
  private wrongAnswer(): void {
    this.flashInput(0xff6b6b);
    this.flash(this.wizardBody, 0xff6b6b, WIZARD_COLOR);
    this.floatText(WIZARD_X, WIZARD_Y - 90, '✗ Wrong!', '#ff6b6b');
    this.tweens.killTweensOf(this.wizard);
    this.wizard.x = WIZARD_X;
    this.tweens.add({ targets: this.wizard, x: WIZARD_X - 8, duration: 50, yoyo: true, repeat: 3 });
  }

  /** Placeholder for the enemy attack animation. */
  private enemyAttacks(enemyId: number): void {
    const view = this.enemyViews.get(enemyId);
    if (view) this.tweens.add({ targets: view.body, x: -25, duration: 90, yoyo: true });
    this.flash(this.wizardBody, 0xe03131, WIZARD_COLOR);
    this.cameras.main.shake(120, 0.004);
  }

  // ---------------------------------------------------------------- per-frame drawing

  private syncEnemies(): void {
    for (const enemy of this.model.getEnemies()) {
      const view = this.enemyViews.get(enemy.id) ?? this.createEnemyView(enemy);
      const { x, y, scale } = project(enemy.lane, enemy.progress);
      view.container.setPosition(x, y).setScale(scale).setDepth(y);
      view.problem.setText(problemText(enemy.problem));
      view.hpFill.scaleX = enemy.hp / enemy.kind.maxHp;
      view.body.setStrokeStyle(3, enemy.state === 'attacking' ? 0xff0000 : 0x000000);
    }
  }

  private createEnemyView(enemy: Readonly<Enemy>): EnemyView {
    const color = kindColor(enemy.kind.id);
    // Origin at the feet, so (x, y) is where the enemy stands on the lane.
    const body = this.add.rectangle(0, 0, 70, 90, color).setOrigin(0.5, 1);
    const name = this.add.text(0, -45, enemy.kind.id, {
      fontFamily: 'Arial', fontSize: '14px', color: '#000000',
    }).setOrigin(0.5);
    const bubble = this.add.rectangle(0, -125, 150, 44, 0x1c1c2e).setStrokeStyle(2, 0xdddddd);
    const problem = this.add.text(0, -125, '', {
      fontFamily: 'Arial', fontSize: '24px', color: '#ffffff',
    }).setOrigin(0.5);
    const hpBack = this.add.rectangle(-50, -97, 100, 8, 0x000000).setOrigin(0, 0.5);
    const hpFill = this.add.rectangle(-50, -97, 100, 8, 0xe03131).setOrigin(0, 0.5);

    const container = this.add.container(0, 0, [body, name, hpBack, hpFill, bubble, problem]);
    const view = { container, body, problem, hpFill, kindId: enemy.kind.id };
    this.enemyViews.set(enemy.id, view);
    return view;
  }

  private syncHud(): void {
    const hp = this.model.getPlayerHp();
    const max = this.model.getPlayerMaxHp();
    this.playerHpFill.scaleX = hp / max;
    this.playerHpText.setText(`HP ${hp}/${max}`);
    const progress = this.model.getProgress();
    this.progressFill.scaleX = progress;
    // A skull lights up once its wave has started.
    for (const skull of this.skulls) skull.icon.setColor(progress >= skull.marker ? '#ff6b6b' : '#868e96');
    const inCutscene = this.model.getStatus() === 'cutscene';
    this.inputBox.setAlpha(inCutscene ? 0.4 : 1);
    this.inputText.setAlpha(inCutscene ? 0.4 : 1);
  }

  // ---------------------------------------------------------------- cutscenes

  private playCutscene(id: string): void {
    if (id === 'bossTwist') {
      void this.playBossTwist(this.model);
    } else {
      // Unknown cutscene id: resume instead of leaving the game frozen.
      console.warn(`No animation for cutscene "${id}"`);
      this.handleEvents(this.model.endCutscene());
    }
  }

  /** The module boss flies in, turns + into ×, then flies out. GREYBOX: a rectangle stands in for the boss art. */
  private async playBossTwist(model: CombatModel): Promise<void> {
    const boss = this.add.container(1420, 40, [
      this.add.rectangle(0, 0, 150, 100, 0x7048e8).setStrokeStyle(4, 0xffffff),
      this.add.text(0, 0, 'BOSS', { fontFamily: 'Arial', fontSize: '28px', color: '#ffffff' }).setOrigin(0.5),
    ]).setDepth(9800);

    // Let the player read the addition problems first.
    await this.wait(1500);
    await this.tweenTo({ targets: boss, x: 820, y: 130, duration: 1200, ease: 'Sine.easeOut' });
    this.say(boss, 'Adding? How boring...');
    await this.wait(1500);

    for (const view of this.enemyViews.values()) this.zap(boss, view);
    await this.wait(300);
    // Stop if the scene restarted while waiting; this model is no longer shown.
    if (this.model !== model) return;
    this.handleEvents(model.twistOperators());
    this.say(boss, 'Now MULTIPLY!');
    await this.wait(1800);

    // The laugh starts before the boss leaves and stays attached to it on the way out.
    this.say(boss, 'Hehehehehe!!!');
    await this.wait(600);
    await this.tweenTo({ targets: boss, x: 1420, y: -120, duration: 1000, ease: 'Sine.easeIn' });
    boss.destroy();
    if (this.model !== model) return;
    this.showBanner('+ became ×!');
    this.handleEvents(model.endCutscene());
  }

  /** Speech bubble under the boss that follows it and fades out. */
  private say(boss: Phaser.GameObjects.Container, text: string): void {
    const speech = this.add.text(0, 80, text, {
      fontFamily: 'Arial', fontSize: '24px', color: '#111111', backgroundColor: '#ffffff', padding: { x: 12, y: 6 },
    }).setOrigin(0.5);
    boss.add(speech);
    this.tweens.add({ targets: speech, alpha: 0, delay: 1400, duration: 300, onComplete: () => speech.destroy() });
  }

  private zap(boss: Phaser.GameObjects.Container, view: EnemyView): void {
    const { x, y, scale } = view.container;
    const bolt = this.add.graphics().setDepth(9700);
    bolt.lineStyle(5, 0xb197fc).lineBetween(boss.x, boss.y + 50, x, y - 125 * scale);
    this.tweens.add({ targets: bolt, alpha: 0, duration: 500, onComplete: () => bolt.destroy() });
  }

  /** Highlights a problem the boss just rewrote. */
  private popProblem(enemyId: number): void {
    const view = this.enemyViews.get(enemyId);
    if (!view) return;
    view.problem.setColor('#d0bfff');
    this.tweens.add({ targets: view.problem, scale: 1.5, duration: 200, yoyo: true });
    this.time.delayedCall(1500, () => {
      if (view.problem.active) view.problem.setColor('#ffffff');
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }

  private tweenTo(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve => this.tweens.add({ ...config, onComplete: () => resolve() }));
  }

  // ---------------------------------------------------------------- effects

  private showBanner(text: string, fade = true): void {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1);
    if (fade) this.tweens.add({ targets: this.banner, alpha: 0, delay: 1200, duration: 400 });
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial', fontSize: '28px', color, stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({
      targets: label, y: y - 40, alpha: 0, duration: 700, onComplete: () => label.destroy(),
    });
  }

  /** Briefly recolours a shape, then restores its base colour (not its current one, which may be mid-flash). */
  private flash(shape: Phaser.GameObjects.Rectangle, color: number, baseColor: number): void {
    shape.setFillStyle(color);
    this.time.delayedCall(120, () => {
      if (shape.active && this.model.getStatus() !== 'lost') shape.setFillStyle(baseColor);
    });
  }

  private flashInput(color: number): void {
    this.inputBox.setStrokeStyle(5, color);
    this.time.delayedCall(250, () => this.inputBox.setStrokeStyle(3, 0x8a7a5a));
  }
}
