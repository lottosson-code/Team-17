import Phaser from 'phaser';
import type { CombatStats } from '../types';
import { heartFills, overlayLayout, POWER_UP_TEXTURE, statLines } from './hudLogic';
import { DEPTH } from './theme';
import { TEX } from './textures';
import type { PowerUpKind } from '../types';

// The combat HUD: player portrait and hearts, level banner with wave progress, pause button,
// and the bottom panel with skill slots (empty for now), the answer box and the Cast Spell button.
// It only draws what the scene passes to update(); clicks go back through HudCallbacks.

export interface HudCallbacks {
    onCast(): void;
    onPause(): void;
    onRestart(): void;
    onMenu(): void;
    /** Optional callback invoked when the player clicks the prominent Continue button on the victory screen. */
    onContinue?(): void;
}

export interface HudState {
    hp: number;
    maxHp: number;
    progress: number; // 0-1
    waveMarkers: number[];
    subtitle: string; // Under the level name, e.g. "WAVE 1 / 2"
    typed: string;
    inputEnabled: boolean;
    powerUps: readonly PowerUpKind[]; // The model's inventory; the first one is used by Q
}

const HEARTS = 5;
// Kept small: back-lane problem bubbles reach up to about y = 80 across the middle of the screen.
const BANNER = { x: 450, y: 6, w: 380, h: 66 };
const BAR = { x: 568, y: 49, w: 238, h: 10 };
const PANEL = { x: 28, y: 602, w: 1224, h: 110 };
/** Everything in the bottom panel is centred on this line. */
const PANEL_MID = PANEL.y + PANEL.h / 2;
/** The answer box with its "Solve to attack!" label above it, centred as a pair. */
const INPUT = { x: 474, y: PANEL_MID - 13, w: 332, h: 58 };
const INPUT_LABEL_Y = INPUT.y - 19;
const CAST = { x: 852, y: PANEL_MID - 35, w: 372, h: 70 };
/** Reserved for skills: the left part of the bottom panel. */
const SKILL_SLOTS = 3;
const SKILL = { x: 70, y: PANEL_MID - 38, size: 76, gap: 32 };
const CREAM = '#efe3c8';
const POWER_ICON_SCALE = 0.95;

export class Hud {
    private readonly hearts: { full: Phaser.GameObjects.Image }[] = [];
    private readonly hpText: Phaser.GameObjects.Text;
    private readonly subtitle: Phaser.GameObjects.Text;
    private readonly barFill: Phaser.GameObjects.Graphics;
    private readonly skulls: { marker: number; icon: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
    private readonly inputFrame: Phaser.GameObjects.Graphics;
    private readonly inputText: Phaser.GameObjects.Text;
    private readonly caret: Phaser.GameObjects.Rectangle;
    private readonly castButton: Phaser.GameObjects.Container;
    private readonly castShine: Phaser.GameObjects.Graphics;
    private readonly powerIcons: Phaser.GameObjects.Image[] = [];
    private readonly readyRing: Phaser.GameObjects.Graphics;
    private readonly useHint: Phaser.GameObjects.Text;
    private readonly banner: Phaser.GameObjects.Text;
    private overlay?: Phaser.GameObjects.Container;
    private shownProgress = 0;
    private inputMood: 'idle' | 'correct' | 'wrong' = 'idle';

    constructor(private readonly scene: Phaser.Scene, title: string, private readonly callbacks: HudCallbacks) {
        const add = scene.add;
        const hud = (object: Phaser.GameObjects.GameObject & { setDepth(d: number): unknown }) => object.setDepth(DEPTH.hud);

        // ---- Portrait, hearts and HP (top left).
        const plate = add.graphics();
        hud(plate);
        plate.fillStyle(0x000000, 0.35).fillRoundedRect(96, 26, 248, 74, 12);
        plate.fillStyle(0xeadcbc).fillRoundedRect(92, 22, 248, 74, 12);
        plate.lineStyle(3, 0x6b4a2b).strokeRoundedRect(92, 22, 248, 74, 12);
        plate.lineStyle(1.5, 0x9a7a52, 0.8).strokeRoundedRect(98, 28, 236, 62, 9);
        const portrait = add.graphics();
        hud(portrait);
        portrait.fillStyle(0x1b1430).fillCircle(66, 60, 48);
        const face = add.image(66, 116, 'wizard-body').setScale(0.82);
        hud(face);
        const faceMask = scene.make.graphics({}, false).fillStyle(0xffffff).fillCircle(66, 60, 44);
        face.setMask(faceMask.createGeometryMask());
        const ring = add.graphics();
        hud(ring);
        ring.lineStyle(6, 0xd8b45a).strokeCircle(66, 60, 46);
        ring.lineStyle(2, 0x5a3d1e).strokeCircle(66, 60, 50);

        for (let i = 0; i < HEARTS; i++) {
            const x = 140 + i * 38;
            hud(add.image(x, 45, TEX.heartEmpty).setScale(0.5));
            const full = add.image(x, 45, TEX.heart).setScale(0.5);
            hud(full);
            this.hearts.push({ full });
        }
        this.hpText = add.text(124, 76, '', { fontFamily: 'Lora', fontSize: '19px', fontStyle: 'bold', color: '#3b2416' })
            .setOrigin(0, 0.5);
        hud(this.hpText);

        // ---- Level banner with wave progress (top centre).
        const banner = add.graphics();
        hud(banner);
        bannerShape(banner, BANNER.x + BANNER.w / 2, BANNER.y, BANNER.w, BANNER.h);
        hud(add.text(640, BANNER.y + 21, title.toUpperCase(), {
            fontFamily: 'Lora', fontSize: '21px', fontStyle: 'bold', color: '#f3e6c4',
        }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true));
        // Subtitle and progress bar share the second row.
        this.subtitle = add.text(BANNER.x + 24, BAR.y + BAR.h / 2, '', {
            fontFamily: 'Lora', fontSize: '13px', fontStyle: 'bold', color: '#d7cdf5',
        }).setOrigin(0, 0.5);
        hud(this.subtitle);
        const track = add.graphics();
        hud(track);
        track.fillStyle(0x0d0a1c).fillRoundedRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4, 8);
        track.lineStyle(1.5, 0x6d5fa8).strokeRoundedRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4, 8);
        this.barFill = add.graphics();
        hud(this.barFill);

        // ---- Pause button (top right).
        const pause = add.container(1218, 52);
        hud(pause);
        const pauseBg = add.graphics();
        pauseBg.fillStyle(0x000000, 0.35).fillRoundedRect(-30, -27, 64, 64, 12);
        pauseBg.fillStyle(0x1c2850).fillRoundedRect(-32, -32, 64, 64, 12);
        pauseBg.lineStyle(3, 0xd8b45a).strokeRoundedRect(-32, -32, 64, 64, 12);
        pauseBg.fillStyle(0xffffff).fillRoundedRect(-13, -15, 9, 30, 3).fillRoundedRect(4, -15, 9, 30, 3);
        pause.add(pauseBg);
        pause.setSize(64, 64).setInteractive({ useHandCursor: true });
        pressable(pause, () => this.callbacks.onPause());

        // ---- Bottom panel.
        const panel = add.graphics();
        hud(panel);
        panel.fillStyle(0x000000, 0.4).fillRoundedRect(PANEL.x + 4, PANEL.y + 6, PANEL.w, PANEL.h, 16);
        panel.fillGradientStyle(0x1d1838, 0x1d1838, 0x0f0c20, 0x0f0c20, 1).fillRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
        panel.lineStyle(3, 0x9a8462).strokeRoundedRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 16);
        panel.lineStyle(1.5, 0x4b3f6e).strokeRoundedRect(PANEL.x + 7, PANEL.y + 7, PANEL.w - 14, PANEL.h - 14, 11);
        panel.lineStyle(2, 0x4b3f6e).lineBetween(436, PANEL.y + 18, 436, PANEL.y + PANEL.h - 18);
        panel.lineBetween(834, PANEL.y + 18, 834, PANEL.y + PANEL.h - 18);
        // Ornaments on the top edge.
        for (const x of [PANEL.x + 24, 640, PANEL.x + PANEL.w - 24]) {
            panel.fillStyle(0xd8b45a).fillPoints(diamond(x, PANEL.y, 7), true);
        }

        // Skill slots (left): empty sockets reserved for skills.
        const slots = add.graphics();
        hud(slots);
        for (let i = 0; i < SKILL_SLOTS; i++) {
            const x = SKILL.x + i * (SKILL.size + SKILL.gap);
            slots.fillStyle(0x0b0918).fillRoundedRect(x, SKILL.y, SKILL.size, SKILL.size, 12);
            slots.fillStyle(0xffffff, 0.04).fillRoundedRect(x + 4, SKILL.y + 4, SKILL.size - 8, SKILL.size / 2 - 4, 9);
            slots.lineStyle(2.5, 0x4b3f6e).strokeRoundedRect(x, SKILL.y, SKILL.size, SKILL.size, 12);
            slots.lineStyle(1.5, 0x9a8462, 0.5).strokeRoundedRect(x - 4, SKILL.y - 4, SKILL.size + 8, SKILL.size + 8, 14);
        }

        // Power-up icons sit in the sockets; the first one is the one Q uses.
        for (let i = 0; i < SKILL_SLOTS; i++) {
            const icon = add.image(
                SKILL.x + i * (SKILL.size + SKILL.gap) + SKILL.size / 2, SKILL.y + SKILL.size / 2, POWER_UP_TEXTURE.freeze,
            ).setScale(POWER_ICON_SCALE).setVisible(false);
            hud(icon);
            this.powerIcons.push(icon);
        }
        this.readyRing = add.graphics().setVisible(false);
        hud(this.readyRing);
        this.readyRing.lineStyle(3, 0xffd76a).strokeRoundedRect(SKILL.x - 6, SKILL.y - 6, SKILL.size + 12, SKILL.size + 12, 15);
        this.useHint = add.text(SKILL.x + SKILL.size / 2, SKILL.y + SKILL.size + 10, 'Q to use', {
            fontFamily: 'Lora', fontSize: '12px', fontStyle: 'bold', color: '#d7cdf5',
        }).setOrigin(0.5).setVisible(false);
        hud(this.useHint);


        // Answer box (centre).
        hud(add.text(640, INPUT_LABEL_Y, '✦   Solve to attack!   ✦', { fontFamily: 'Lora', fontSize: '19px', fontStyle: 'bold', color: CREAM })
            .setOrigin(0.5));
        this.inputFrame = add.graphics();
        hud(this.inputFrame);
        this.inputText = add.text(640, INPUT.y + INPUT.h / 2, '', {
            fontFamily: 'Poppins', fontSize: '40px', color: '#1b1022',
        }).setOrigin(0.5);
        hud(this.inputText);
        this.caret = add.rectangle(640, INPUT.y + INPUT.h / 2, 3, 36, 0x1b1022);
        hud(this.caret);
        this.drawInputFrame();

        // Cast Spell button (right).
        this.castButton = add.container(CAST.x + CAST.w / 2, CAST.y + CAST.h / 2);
        hud(this.castButton);
        const castBg = add.graphics();
        castBg.fillStyle(0x000000, 0.4).fillRoundedRect(-CAST.w / 2 + 3, -CAST.h / 2 + 5, CAST.w, CAST.h, 14);
        castBg.fillGradientStyle(0x8350f0, 0x8350f0, 0x4a22a6, 0x4a22a6, 1).fillRoundedRect(-CAST.w / 2, -CAST.h / 2, CAST.w, CAST.h, 14);
        castBg.lineStyle(3, 0xc8b4ff).strokeRoundedRect(-CAST.w / 2, -CAST.h / 2, CAST.w, CAST.h, 14);
        castBg.lineStyle(1.5, 0x2a1060).strokeRoundedRect(-CAST.w / 2 + 5, -CAST.h / 2 + 5, CAST.w - 10, CAST.h - 10, 10);
        // Wand icon.
        castBg.lineStyle(6, 0xf2e6ff).lineBetween(-140, 18, -108, -12);
        castBg.fillStyle(0xffd447).fillPoints(starPointsLocal(-104, -16, 13, 5), true);
        this.castShine = add.graphics().setAlpha(0);
        this.castShine.fillStyle(0xffffff, 0.18).fillRoundedRect(-CAST.w / 2, -CAST.h / 2, CAST.w, CAST.h, 14);
        const castLabel = add.text(16, 0, 'CAST SPELL', {
            fontFamily: 'Lora', fontSize: '32px', fontStyle: 'bold', color: '#ffffff',
        }).setOrigin(0.5).setShadow(0, 2, '#1d0b4a', 4, true, true);
        this.castButton.add([castBg, this.castShine, castLabel]);
        this.castButton.setSize(CAST.w, CAST.h).setInteractive({ useHandCursor: true });
        this.castButton.on('pointerover', () => this.castShine.setAlpha(1));
        this.castButton.on('pointerout', () => this.castShine.setAlpha(0));
        pressable(this.castButton, () => this.callbacks.onCast());

        // Announcements.
        this.banner = add.text(640, 168, '', {
            fontFamily: 'Lora', fontSize: '44px', fontStyle: 'bold', color: '#ffd76a', align: 'center',
            stroke: '#1a0b14', strokeThickness: 9,
        }).setOrigin(0.5).setDepth(DEPTH.banner).setAlpha(0);
        this.banner.setShadow(0, 0, '#ff9a3c', 18, true, false);
    }

    update(state: HudState, time: number): void {
        heartFills(state.hp, state.maxHp, HEARTS).forEach((fill, i) => {
            const heart = this.hearts[i].full;
            heart.setCrop(0, 0, heart.width * fill, heart.height);
        });
        this.hpText.setText(`HP ${state.hp}/${state.maxHp}`);
        this.subtitle.setText(state.subtitle);

        // Ease the bar toward the real progress so it fills smoothly.
        this.shownProgress += (state.progress - this.shownProgress) * 0.12;
        this.barFill.clear();
        const width = BAR.w * this.shownProgress;
        if (width > 1) {
            this.barFill.fillGradientStyle(0x6b4cff, 0xa98bff, 0x6b4cff, 0xa98bff, 1).fillRoundedRect(BAR.x, BAR.y, Math.max(width, 12), BAR.h, 6);
            this.barFill.fillStyle(0xffffff, 0.35).fillRoundedRect(BAR.x + 3, BAR.y + 2, Math.max(width - 6, 4), 3, 2);
        }
        if (this.skulls.length !== state.waveMarkers.length) this.createSkulls(state.waveMarkers);
        for (const skull of this.skulls) {
            const reached = state.progress >= skull.marker - 1e-9;
            skull.icon.setTint(reached ? 0xffffff : 0x6d6585);
            skull.glow.setAlpha(reached ? 0.55 + 0.2 * Math.sin(time * 0.006) : 0);
        }

        this.inputText.setText(state.typed);
        this.inputText.setAlpha(state.inputEnabled ? 1 : 0.4);
        this.caret.setX(640 + this.inputText.width / 2 + 6);
        this.caret.setVisible(state.inputEnabled && Math.floor(time / 500) % 2 === 0);
        this.powerIcons.forEach((icon, i) => {
            const kind = state.powerUps[i];
            icon.setVisible(kind !== undefined);
            if (kind) icon.setTexture(POWER_UP_TEXTURE[kind]);
        });
        const holdingOne = state.powerUps.length > 0;
        this.readyRing.setVisible(holdingOne).setAlpha(0.6 + 0.4 * Math.sin(time * 0.006));
        this.useHint.setVisible(holdingOne);
    }

    /** Green for a hit, red (with a shake) for a wrong answer. */
    flashInput(result: 'correct' | 'wrong'): void {
        this.inputMood = result;
        this.drawInputFrame();
        this.scene.time.delayedCall(320, () => { this.inputMood = 'idle'; this.drawInputFrame(); });
        if (result === 'wrong') {
            this.scene.tweens.add({
                targets: [this.inputFrame, this.inputText], x: '+=7', duration: 40, yoyo: true, repeat: 3,
                onComplete: () => { this.inputFrame.x = 0; this.inputText.x = 640; },
            });
        }
    }

    /** Bounces the icon in a slot in, e.g. when a power-up is earned. */
    popPowerUp(slot: number): void {
        const icon = this.powerIcons[slot];
        if (!icon) return;
        this.scene.tweens.killTweensOf(icon);
        icon.setScale(0.2);
        this.scene.tweens.add({ targets: icon, scale: POWER_ICON_SCALE, duration: 320, ease: 'Back.easeOut' });
    }

    showBanner(text: string, holdMs = 1600): void {
        this.scene.tweens.killTweensOf(this.banner);
        this.banner.setText(text).setAlpha(0).setScale(0.6);
        this.scene.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.scene.tweens.add({ targets: this.banner, alpha: 0, delay: holdMs, duration: 400 });
    }

    /**
     * Pause menu or end-of-level panel, with buttons. Pass undefined to close it.
     * With `stats`, the panel also shows the level's statistics between the title and the buttons.
     */
    showOverlay(kind: 'paused' | 'won' | 'lost' | undefined, stats?: CombatStats): void {
        this.overlay?.destroy();
        this.overlay = undefined;
        if (!kind) return;

        const add = this.scene.add;
        // The victory screen gets a prominent "Continue" button; the panel grows to fit it and the stats row.
        const hasContinue = kind === 'won' && Boolean(this.callbacks.onContinue);
        const layout = overlayLayout(Boolean(stats), hasContinue);

        // Full-screen translucent dark backdrop that blocks clicks to the battlefield below
        const dim = add.rectangle(640, 360, 1280, 720, 0x05020c, 0.6).setInteractive();
        const box = add.graphics();
        bannerShape(box, 640, layout.boxY, 560, layout.boxHeight);

        const titles = { paused: 'PAUSED', won: 'VICTORY!', lost: 'DEFEATED' };
        const colors = { paused: '#f3e6c4', won: '#ffd76a', lost: '#ff6b7a' };
        const title = add.text(640, layout.title, titles[kind], {
            fontFamily: 'Lora', fontSize: '54px', fontStyle: 'bold', color: colors[kind], stroke: '#140818', strokeThickness: 8,
        }).setOrigin(0.5);

        const items: Phaser.GameObjects.GameObject[] = [dim, box, title];
        if (stats && layout.stats !== undefined) items.push(...this.statColumns(stats, layout.stats));

        // On victory, place a prominent wide "Continue" button centered above the secondary row
        if (hasContinue && layout.continue !== undefined) {
            items.push(menuButton(this.scene, 640, layout.continue, 'Continue  ▶', () => this.callbacks.onContinue?.(), true));
        }

        // Secondary action row: Play Again & Back to Map (or Resume / Restart / Back to Map when paused)
        const buttons = kind === 'paused'
            ? [['Resume', () => this.callbacks.onPause()], ['Restart', () => this.callbacks.onRestart()], ['Back to Map', () => this.callbacks.onMenu()]] as const
            : [['Play Again', () => this.callbacks.onRestart()], ['Back to Map', () => this.callbacks.onMenu()]] as const;
        const spacing = 190;
        // Compute the horizontal X position of the first button so the row is centered at X = 640
        const first = 640 - ((buttons.length - 1) * spacing) / 2;
        buttons.forEach(([label, action], i) => items.push(menuButton(this.scene, first + i * spacing, layout.buttons, label, action)));

        const hint = kind === 'paused'
            ? 'Esc to resume'
            : hasContinue
                ? 'Enter / C to continue  ·  R to restart  ·  M for map'
                : 'R to restart  ·  M for map';
        items.push(add.text(640, layout.hint, hint, { fontFamily: 'Lora', fontSize: '16px', color: '#a99ccc' }).setOrigin(0.5));

        this.overlay = add.container(0, 0, items).setDepth(DEPTH.overlay).setAlpha(1);
    }

    /** The end screen's statistics: a row of columns, each a large value over a small label. */
    private statColumns(stats: CombatStats, y: number): Phaser.GameObjects.Text[] {
        const lines = statLines(stats);
        const spacing = 150;
        const first = 640 - ((lines.length - 1) * spacing) / 2;
        return lines.flatMap(({ label, value }, i) => [
            this.scene.add.text(first + i * spacing, y, value, {
                fontFamily: 'Poppins', fontSize: '30px', color: CREAM,
            }).setOrigin(0.5),
            this.scene.add.text(first + i * spacing, y + 32, label.toUpperCase(), {
                fontFamily: 'Lora', fontSize: '14px', fontStyle: 'bold', color: '#a99ccc',
            }).setOrigin(0.5),
        ]);
    }

    private drawInputFrame(): void {
        const border = { idle: 0x8a6b45, correct: 0x3ddc84, wrong: 0xff4d5e }[this.inputMood];
        const g = this.inputFrame;
        g.clear();
        if (this.inputMood !== 'idle') {
            g.fillStyle(border, 0.35).fillRoundedRect(INPUT.x - 7, INPUT.y - 7, INPUT.w + 14, INPUT.h + 14, 14);
        }
        g.fillStyle(0xf6ecd4).fillRoundedRect(INPUT.x, INPUT.y, INPUT.w, INPUT.h, 10);
        g.fillStyle(0x000000, 0.08).fillRoundedRect(INPUT.x + 4, INPUT.y + 4, INPUT.w - 8, 8, 4);
        g.lineStyle(this.inputMood === 'idle' ? 3 : 4, border).strokeRoundedRect(INPUT.x, INPUT.y, INPUT.w, INPUT.h, 10);
    }

    private createSkulls(markers: number[]): void {
        for (const skull of this.skulls) { skull.icon.destroy(); skull.glow.destroy(); }
        this.skulls.length = 0;
        for (const marker of markers) {
            const x = BAR.x + marker * BAR.w;
            const glow = this.scene.add.image(x, BAR.y + BAR.h / 2, TEX.glow).setTint(0xff4d6d).setScale(0.45)
                .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.hud).setAlpha(0);
            const icon = this.scene.add.image(x, BAR.y + BAR.h / 2 - 2, TEX.skull).setScale(0.5).setDepth(DEPTH.hud);
            this.skulls.push({ marker, icon, glow });
        }
    }
}

/** Dark panel with a light border and corner diamonds, centred on cx. */
export function bannerShape(g: Phaser.GameObjects.Graphics, cx: number, y: number, w: number, h: number): void {
    const x = cx - w / 2;
    g.fillStyle(0x000000, 0.4).fillRoundedRect(x + 4, y + 6, w, h, 14);
    g.fillGradientStyle(0x1f1a3d, 0x1f1a3d, 0x100c22, 0x100c22, 0.96).fillRoundedRect(x, y, w, h, 14);
    g.lineStyle(3, 0x9a8462).strokeRoundedRect(x, y, w, h, 14);
    g.lineStyle(1.5, 0x4b3f6e).strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, 10);
    for (const [dx, dy] of [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) {
        g.fillStyle(0xd8b45a).fillPoints(diamond(dx, dy, 5), true);
    }
}

function diamond(x: number, y: number, r: number): Phaser.Math.Vector2[] {
    return [new Phaser.Math.Vector2(x, y - r), new Phaser.Math.Vector2(x + r, y), new Phaser.Math.Vector2(x, y + r), new Phaser.Math.Vector2(x - r, y)];
}

function starPointsLocal(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
    return Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? outer : inner;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        return new Phaser.Math.Vector2(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    });
}

/** Shrinks slightly while pressed and calls `action` on release. */
function pressable(target: Phaser.GameObjects.Container, action: () => void): void {
    target.on('pointerdown', () => target.setScale(0.96));
    target.on('pointerout', () => target.setScale(1));
    target.on('pointerup', () => {
        target.setScale(1);
        action();
    });
}

/**
 * Creates an interactive Phaser overlay button.
 * When `prominent` is true, renders a wider, taller gold-bordered call-to-action button (used for "Continue").
 */
export function menuButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    action: () => void,
    prominent = false
): Phaser.GameObjects.Container {
    const fontSize = prominent ? '25px' : '21px';
    const text = scene.add.text(0, 0, label, { fontFamily: 'Lora', fontSize, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    // Make prominent buttons wider (350px minimum, spanning above the two secondary buttons) and slightly taller
    const w = prominent ? Math.max(350, text.width + 64) : Math.max(160, text.width + 36);
    const h = prominent ? 58 : 52;
    const bg = scene.add.graphics();

    // Prominent buttons get a richer gold-accented border and brighter gradient fill
    const topColor = prominent ? 0x9b66ff : 0x8350f0;
    const bottomColor = prominent ? 0x5c2cc9 : 0x4a22a6;
    const borderColor = prominent ? 0xffd76a : 0xc8b4ff;
    const borderWidth = prominent ? 3.5 : 2.5;

    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(borderWidth, borderColor).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    const button = scene.add.container(x, y, [bg, text]).setSize(w, h).setInteractive({ useHandCursor: true });
    pressable(button, action);
    return button;
}
