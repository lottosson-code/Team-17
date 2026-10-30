import Phaser from 'phaser';
import { createTextButton, TextButtonContainer } from '../ui/components/createTextButton';
import { settingsStore, GameDifficulty } from '../state/settingsStore';
import { soundManager } from '../audio/soundManager';

export class MainMenuScene extends Phaser.Scene {
  public startButton!: TextButtonContainer;
  public settingsButton!: TextButtonContainer;
  public quitButton!: TextButtonContainer;
  public mapBadgeButton?: Phaser.GameObjects.Container;

  public settingsModal: Phaser.GameObjects.Container | null = null;
  public quitModal: Phaser.GameObjects.Container | null = null;
  public farewellContainer: Phaser.GameObjects.Container | null = null;

  public isTransitioning = false;
  private escKey: Phaser.Input.Keyboard.Key | null = null;

  constructor() {
    super('MainMenu');
  }

  preload(): void {
    // Load official high-resolution Figma classroom monster prototype background
    this.load.image('menu_bg', '/assets/main_menu_bg.png');
  }

  create(): void {
    this.isTransitioning = false;
    this.settingsModal = null;
    this.quitModal = null;
    this.farewellContainer = null;

    soundManager.startMenuMusic();

    this.createBackground();
    this.createMenuCardAndButtons();
    this.setupKeyboardInput();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      soundManager.stopMenuMusic();
    });
  }

  private createBackground(): void {
    // 1. Try loading Figma prototype artwork image
    if (this.textures && this.textures.exists('menu_bg')) {
      const bgImage = this.add.image(640, 360, 'menu_bg');
      bgImage.setDisplaySize(1280, 720);
      return;
    }

    // 2. Procedural Fallback (for headless tests or when image asset is offline)
    const bgGraphics = this.add.graphics();
    bgGraphics.fillStyle(0xd9a868, 1);
    bgGraphics.fillRect(0, 0, 1280, 720);

    // Warm classroom wooden floor
    bgGraphics.fillStyle(0xb57c43, 1);
    bgGraphics.fillRect(0, 320, 1280, 400);

    // Classroom chalkboard
    bgGraphics.fillStyle(0x355e4b, 1);
    bgGraphics.fillRect(340, 20, 600, 220);
    bgGraphics.lineStyle(6, 0x7a4d27);
    bgGraphics.strokeRect(340, 20, 600, 220);

    // Subtle ambient dust/math runes
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(40, 1240);
      const y = Phaser.Math.Between(30, 680);
      this.add.text(x, y, ['+', '−', '×', '÷', 'π', '∑'][i % 6], {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      }).setOrigin(0.5).setAlpha(0.25);
    }
  }

  private createMenuCardAndButtons(): void {
    const cardX = 640;
    const cardY = 425;
    const cardWidth = 380;
    const cardHeight = 250;

    // Outer Parchment Card (Warm cream with double gold/bronze border)
    const cardBg = this.add.rectangle(cardX, cardY, cardWidth, cardHeight, 0xfaf6ea, 0.96)
      .setStrokeStyle(3, 0x8d7037);

    const innerCardBorder = this.add.rectangle(cardX, cardY, cardWidth - 10, cardHeight - 10, 0x000000, 0)
      .setStrokeStyle(1.5, 0xd4bc80);

    // Pinned "Map" Shortcut Badge on top-right corner of card (matches Figma prototype)
    const mapBadgeX = 837;
    const mapBadgeY = 285;
    const mapBadgeW = 90;
    const mapBadgeH = 78;

    const mapBadgeContainer = this.add.container(mapBadgeX, mapBadgeY);
    this.mapBadgeButton = mapBadgeContainer;

    const mapBg = this.add.rectangle(0, 0, mapBadgeW, mapBadgeH, 0xffffff, 0.98)
      .setStrokeStyle(2.5, 0x8d7037)
      .setInteractive({ useHandCursor: true });

    const mapInner = this.add.rectangle(0, 0, mapBadgeW - 6, mapBadgeH - 6, 0x000000, 0)
      .setStrokeStyle(1, 0xd4bc80);

    // Mini map graphic (path line & marker)
    const mapGraphics = this.add.graphics();
    mapGraphics.lineStyle(2, 0x4f8896, 0.85);
    mapGraphics.beginPath();
    mapGraphics.moveTo(-24, -12);
    mapGraphics.lineTo(-8, -20);
    mapGraphics.lineTo(6, -8);
    mapGraphics.lineTo(24, -18);
    mapGraphics.strokePath();

    // Map landmark dots & cross
    mapGraphics.fillStyle(0xb84343, 1);
    mapGraphics.fillCircle(-24, -12, 3);
    mapGraphics.fillStyle(0x3e7a52, 1);
    mapGraphics.fillCircle(24, -18, 3);

    const mapLabel = this.add.text(0, 16, 'Map', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#523c20',
    }).setOrigin(0.5);

    mapBadgeContainer.add([mapBg, mapInner, mapGraphics, mapLabel]);

    mapBg.on('pointerover', () => {
      soundManager.playSfx('hover');
      mapBg.setFillStyle(0xf2f7f9);
      if (this.tweens) {
        this.tweens.add({ targets: mapBadgeContainer, scale: 1.06, duration: 100, ease: 'Sine.easeOut' });
      }
    });

    mapBg.on('pointerout', () => {
      mapBg.setFillStyle(0xffffff);
      if (this.tweens) {
        this.tweens.add({ targets: mapBadgeContainer, scale: 1.0, duration: 100, ease: 'Sine.easeOut' });
      }
    });

    mapBg.on('pointerdown', () => {
      soundManager.playSfx('click');
      this.startGame();
    });

    // --- Main Menu Buttons (Matches Figma Pastel Cyan Style) ---
    const btnWidth = 345;
    const btnHeight = 52;

    // 1. Continue / Start Game Button
    this.startButton = createTextButton(
      this,
      'Continue',
      cardX,
      355,
      () => this.startGame(),
      btnWidth,
      { variant: 'figmaTeal', height: btnHeight },
    ) as TextButtonContainer;

    // 2. Settings Button
    this.settingsButton = createTextButton(
      this,
      'Settings',
      cardX,
      425,
      () => this.openSettingsModal(),
      btnWidth,
      { variant: 'figmaTeal', height: btnHeight },
    ) as TextButtonContainer;

    // 3. Quit Game Button
    this.quitButton = createTextButton(
      this,
      'Quit Game',
      cardX,
      495,
      () => this.openQuitModal(),
      btnWidth,
      { variant: 'figmaTeal', height: btnHeight },
    ) as TextButtonContainer;
  }

  private setupKeyboardInput(): void {
    if (this.input?.keyboard) {
      this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.escKey.on('down', () => {
        if (this.settingsModal) {
          this.closeSettingsModal();
        } else if (this.quitModal) {
          this.closeQuitModal();
        }
      });
    }
  }

  // --- Start Game Action ---
  public startGame(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    soundManager.playSfx('start');
    soundManager.stopMenuMusic();

    let hasSwitched = false;
    const switchScene = () => {
      if (!hasSwitched) {
        hasSwitched = true;
        this.scene.start('WorldMap');
      }
    };

    if (this.cameras?.main) {
      this.cameras.main.fadeOut(350, 15, 16, 38);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, switchScene);
    } else {
      switchScene();
    }

    if (this.time?.delayedCall) {
      this.time.delayedCall(450, switchScene);
    }
  }

  // --- Settings Modal ---
  public openSettingsModal(): void {
    if (this.settingsModal || this.quitModal) return;
    soundManager.playSfx('modalOpen');

    const modal = this.add.container(640, 360);
    this.settingsModal = modal;
    modal.setDepth(100);

    // Full screen click blocker backdrop
    const backdrop = this.add.rectangle(0, 0, 1280, 720, 0x070914, 0.85)
      .setInteractive();
    modal.add(backdrop);

    // Modal frame panel
    const panelWidth = 700;
    const panelHeight = 460;
    const panelBg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x181c33)
      .setStrokeStyle(3, 0x8d7037);
    modal.add(panelBg);

    // Header bar
    const headerBar = this.add.rectangle(0, -panelHeight / 2 + 32, panelWidth - 6, 50, 0x242a4a);
    const titleText = this.add.text(0, -panelHeight / 2 + 32, 'GAME SETTINGS', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5);
    modal.add([headerBar, titleText]);

    // Close [X] button
    const closeBtn = this.add.text(panelWidth / 2 - 28, -panelHeight / 2 + 32, '✕', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '22px',
      color: '#a0aadb',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeSettingsModal());
    modal.add(closeBtn);

    let musicText: Phaser.GameObjects.Text;
    let sfxText: Phaser.GameObjects.Text;
    let musicBar: Phaser.GameObjects.Graphics;
    let sfxBar: Phaser.GameObjects.Graphics;
    let muteBtnText: Phaser.GameObjects.Text;
    let muteBtnBg: Phaser.GameObjects.Rectangle;
    const diffButtons: Map<GameDifficulty, { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = new Map();

    const drawBar = (graphics: Phaser.GameObjects.Graphics, percent: number, barY: number) => {
      graphics.clear();
      const w = 140;
      const h = 12;
      const x = 30;
      graphics.fillStyle(0x101324, 1);
      graphics.fillRect(x, barY - h / 2, w, h);
      graphics.lineStyle(1, 0x39436e);
      graphics.strokeRect(x, barY - h / 2, w, h);

      const fillW = Math.max(0, Math.min(w, (percent / 100) * w));
      if (fillW > 0) {
        graphics.fillStyle(settingsStore.getSettings().muted ? 0x595d73 : 0x56b8cc, 1);
        graphics.fillRect(x, barY - h / 2, fillW, h);
      }
    };

    const refreshValues = () => {
      const s = settingsStore.getSettings();
      musicText.setText(`${s.musicVolume}%`);
      sfxText.setText(`${s.sfxVolume}%`);
      drawBar(musicBar, s.musicVolume, -110);
      drawBar(sfxBar, s.sfxVolume, -55);

      if (s.muted) {
        muteBtnBg.setFillStyle(0x54262b);
        muteBtnBg.setStrokeStyle(2, 0xbd5a67);
        muteBtnText.setText('Muted: YES').setColor('#ff9b9b');
      } else {
        muteBtnBg.setFillStyle(0x234433);
        muteBtnBg.setStrokeStyle(2, 0x4fa675);
        muteBtnText.setText('Sound: ON').setColor('#9affbf');
      }

      diffButtons.forEach((item, diff) => {
        if (s.difficulty === diff) {
          item.bg.setFillStyle(0xcaedf5);
          item.bg.setStrokeStyle(2, 0x5ba3b8);
          item.text.setColor('#203f4c').setFontStyle('bold');
        } else {
          item.bg.setFillStyle(0x1d2238);
          item.bg.setStrokeStyle(2, 0x3d4773);
          item.text.setColor('#7c87ad').setFontStyle('normal');
        }
      });
    };

    // 1. Music Volume Row
    const musicLabel = this.add.text(-280, -110, 'Music Volume', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '19px',
      color: '#cdd5f8',
    }).setOrigin(0, 0.5);

    const musicMinus = this.add.rectangle(-20, -110, 32, 32, 0x2b3459).setStrokeStyle(1, 0x5a69ab).setInteractive({ useHandCursor: true });
    const musicMinusTxt = this.add.text(-20, -110, '−', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    musicMinus.on('pointerdown', () => {
      soundManager.playSfx('click');
      settingsStore.setMusicVolume(settingsStore.getSettings().musicVolume - 10);
      refreshValues();
    });

    musicBar = this.add.graphics();

    const musicPlus = this.add.rectangle(190, -110, 32, 32, 0x2b3459).setStrokeStyle(1, 0x5a69ab).setInteractive({ useHandCursor: true });
    const musicPlusTxt = this.add.text(190, -110, '+', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    musicPlus.on('pointerdown', () => {
      soundManager.playSfx('click');
      settingsStore.setMusicVolume(settingsStore.getSettings().musicVolume + 10);
      refreshValues();
    });

    musicText = this.add.text(230, -110, '70%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#9db4f3',
    }).setOrigin(0, 0.5);

    modal.add([musicLabel, musicMinus, musicMinusTxt, musicBar, musicPlus, musicPlusTxt, musicText]);

    // 2. SFX Volume Row
    const sfxLabel = this.add.text(-280, -55, 'SFX Volume', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '19px',
      color: '#cdd5f8',
    }).setOrigin(0, 0.5);

    const sfxMinus = this.add.rectangle(-20, -55, 32, 32, 0x2b3459).setStrokeStyle(1, 0x5a69ab).setInteractive({ useHandCursor: true });
    const sfxMinusTxt = this.add.text(-20, -55, '−', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    sfxMinus.on('pointerdown', () => {
      soundManager.playSfx('click');
      settingsStore.setSfxVolume(settingsStore.getSettings().sfxVolume - 10);
      refreshValues();
    });

    sfxBar = this.add.graphics();

    const sfxPlus = this.add.rectangle(190, -55, 32, 32, 0x2b3459).setStrokeStyle(1, 0x5a69ab).setInteractive({ useHandCursor: true });
    const sfxPlusTxt = this.add.text(190, -55, '+', { fontFamily: 'Arial', fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    sfxPlus.on('pointerdown', () => {
      soundManager.playSfx('click');
      settingsStore.setSfxVolume(settingsStore.getSettings().sfxVolume + 10);
      refreshValues();
    });

    sfxText = this.add.text(230, -55, '80%', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#9db4f3',
    }).setOrigin(0, 0.5);

    modal.add([sfxLabel, sfxMinus, sfxMinusTxt, sfxBar, sfxPlus, sfxPlusTxt, sfxText]);

    // 3. Audio Mute Row
    const muteLabel = this.add.text(-280, 0, 'Audio Mute', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '19px',
      color: '#cdd5f8',
    }).setOrigin(0, 0.5);

    muteBtnBg = this.add.rectangle(105, 0, 205, 36, 0x234433)
      .setStrokeStyle(2, 0x4fa675)
      .setInteractive({ useHandCursor: true });
    muteBtnText = this.add.text(105, 0, 'Sound: ON', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#9affbf',
    }).setOrigin(0.5);

    muteBtnBg.on('pointerdown', () => {
      soundManager.playSfx('click');
      settingsStore.toggleMute();
      refreshValues();
    });
    modal.add([muteLabel, muteBtnBg, muteBtnText]);

    // 4. Math Difficulty Row
    const diffLabel = this.add.text(-280, 55, 'Math Difficulty', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '19px',
      color: '#cdd5f8',
    }).setOrigin(0, 0.5);
    modal.add(diffLabel);

    const difficulties: GameDifficulty[] = ['Easy', 'Normal', 'Hard'];
    difficulties.forEach((diff, idx) => {
      const btnX = 5 + idx * 100;
      const bg = this.add.rectangle(btnX, 55, 90, 36, 0x1d2238)
        .setStrokeStyle(2, 0x3d4773)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(btnX, 55, diff, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        color: '#7c87ad',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        soundManager.playSfx('click');
        settingsStore.setDifficulty(diff);
        refreshValues();
      });

      diffButtons.set(diff, { bg, text: txt });
      modal.add([bg, txt]);
    });

    // 5. Reset & Close Buttons
    const resetBtn = createTextButton(this, 'Reset Defaults', -130, 155, () => {
      soundManager.playSfx('click');
      settingsStore.resetSettings();
      refreshValues();
    }, 200, { variant: 'secondary', height: 44 });
    modal.add(resetBtn);

    const doneBtn = createTextButton(this, 'Close (ESC)', 130, 155, () => {
      this.closeSettingsModal();
    }, 200, { variant: 'figmaTeal', height: 44 });
    modal.add(doneBtn);

    refreshValues();

    if (this.tweens) {
      modal.setScale(0.9);
      modal.setAlpha(0);
      this.tweens.add({
        targets: modal,
        scale: 1,
        alpha: 1,
        duration: 160,
        ease: 'Back.easeOut',
      });
    }
  }

  public closeSettingsModal(): void {
    if (!this.settingsModal) return;
    soundManager.playSfx('modalClose');

    const modal = this.settingsModal;
    this.settingsModal = null;

    if (this.tweens) {
      this.tweens.add({
        targets: modal,
        scale: 0.9,
        alpha: 0,
        duration: 120,
        ease: 'Sine.easeIn',
        onComplete: () => {
          modal.destroy();
        },
      });
    } else {
      modal.destroy();
    }
  }

  // --- Quit Modal ---
  public openQuitModal(): void {
    if (this.quitModal || this.settingsModal) return;
    soundManager.playSfx('modalOpen');

    const modal = this.add.container(640, 360);
    this.quitModal = modal;
    modal.setDepth(110);

    const backdrop = this.add.rectangle(0, 0, 1280, 720, 0x070914, 0.88)
      .setInteractive();
    modal.add(backdrop);

    const panelW = 560;
    const panelH = 320;
    const panelBg = this.add.rectangle(0, 0, panelW, panelH, 0x181c33)
      .setStrokeStyle(3, 0xd45f6f);
    modal.add(panelBg);

    const headerBar = this.add.rectangle(0, -panelH / 2 + 30, panelW - 6, 48, 0x3d1d24);
    const titleText = this.add.text(0, -panelH / 2 + 30, 'Quit Game?', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ff9da7',
    }).setOrigin(0.5);
    modal.add([headerBar, titleText]);

    const msgText = this.add.text(0, -20, 'Are you sure you want to leave the realm?\nYour current session progress will end.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '19px',
      color: '#d6dcf5',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
    modal.add(msgText);

    const cancelBtn = createTextButton(this, 'Cancel', -120, 80, () => {
      this.closeQuitModal();
    }, 180, { variant: 'figmaTeal', height: 48 });
    modal.add(cancelBtn);

    const confirmBtn = createTextButton(this, 'Confirm Quit', 120, 80, () => {
      this.confirmQuit();
    }, 180, { variant: 'danger', height: 48 });
    modal.add(confirmBtn);

    if (this.tweens) {
      modal.setScale(0.9);
      modal.setAlpha(0);
      this.tweens.add({
        targets: modal,
        scale: 1,
        alpha: 1,
        duration: 150,
        ease: 'Back.easeOut',
      });
    }
  }

  public closeQuitModal(): void {
    if (!this.quitModal) return;
    soundManager.playSfx('modalClose');

    const modal = this.quitModal;
    this.quitModal = null;

    if (this.tweens) {
      this.tweens.add({
        targets: modal,
        scale: 0.9,
        alpha: 0,
        duration: 120,
        ease: 'Sine.easeIn',
        onComplete: () => {
          modal.destroy();
        },
      });
    } else {
      modal.destroy();
    }
  }

  public confirmQuit(): void {
    soundManager.stopMenuMusic();
    soundManager.playSfx('click');

    if (this.quitModal) {
      this.quitModal.destroy();
      this.quitModal = null;
    }

    try {
      if (typeof window !== 'undefined') {
        window.close();
      }
    } catch {
      // Ignored if blocked by browser policy
    }

    const farewell = this.add.container(640, 360);
    this.farewellContainer = farewell;
    farewell.setDepth(200);

    const backdrop = this.add.rectangle(0, 0, 1280, 720, 0x090b17, 0.96)
      .setInteractive();
    farewell.add(backdrop);

    const title = this.add.text(0, -90, 'Thanks for Playing Team 17 — Math RPG!', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '32px',
      color: '#ffffff',
    }).setOrigin(0.5);

    const sub1 = this.add.text(0, -35, 'Your heroic deeds have been recorded in the annals of Numeria.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#a5b5e8',
    }).setOrigin(0.5);

    const sub2 = this.add.text(0, 15, 'You may safely close this browser window, or return to the title screen.', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#7684b5',
    }).setOrigin(0.5);

    const returnBtn = createTextButton(this, 'Return to Title Screen', 0, 95, () => {
      farewell.destroy();
      this.farewellContainer = null;
      soundManager.startMenuMusic();
    }, 280, { variant: 'figmaTeal', height: 50 });

    farewell.add([title, sub1, sub2, returnBtn]);
  }
}
