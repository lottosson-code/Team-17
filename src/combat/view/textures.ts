import Phaser from 'phaser';
import { POWER_UP_TEXTURE } from './hudLogic';

// Small textures drawn in code: glows, particles, HUD icons and screen-edge shading.
// Generated once per game; scenes share them through the texture manager.

export const TEX = {
    glow: 'fx-glow', // Soft white radial glow; tint it for candles, magic, moonlight
    spark: 'fx-spark',
    paper: 'fx-paper',
    vignette: 'fx-vignette',
    redEdge: 'fx-red-edge',
    heart: 'hud-heart',
    heartEmpty: 'hud-heart-empty',
    skull: 'hud-skull',
} as const;

type Stops = [number, string][];

export function createTextures(scene: Phaser.Scene): void {
    radial(scene, TEX.glow, 128, [[0, 'rgba(255,255,255,1)'], [0.22, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    radial(scene, TEX.spark, 16, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
    edge(scene, TEX.vignette, 'rgba(6,2,16,0.78)');
    edge(scene, TEX.redEdge, 'rgba(190,0,20,0.85)');

    canvas(scene, TEX.paper, 22, 28, ctx => {
        ctx.fillStyle = '#efe6d2';
        ctx.fillRect(1, 1, 20, 26);
        ctx.strokeStyle = '#8f8574';
        ctx.lineWidth = 1;
        ctx.strokeRect(1.5, 1.5, 19, 25);
        ctx.strokeStyle = '#7d8fb5';
        for (let y = 8; y < 26; y += 5) {
            ctx.beginPath();
            ctx.moveTo(4, y);
            ctx.lineTo(18, y);
            ctx.stroke();
        }
    });

    canvas(scene, TEX.heart, 64, 60, ctx => heart(ctx, true));
    canvas(scene, TEX.heartEmpty, 64, 60, ctx => heart(ctx, false));

    canvas(scene, TEX.skull, 48, 48, ctx => {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#1b1022';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(24, 21, 16, Math.PI * 0.85, Math.PI * 2.15);
        ctx.lineTo(33, 36);
        ctx.lineTo(33, 43);
        ctx.lineTo(15, 43);
        ctx.lineTo(15, 36);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1b1022';
        ctx.beginPath();
        ctx.ellipse(17.5, 23, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.ellipse(30.5, 23, 5, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(24, 28);
        ctx.lineTo(21, 33);
        ctx.lineTo(27, 33);
        ctx.fill();
        ctx.lineWidth = 2;
        for (const x of [20, 24, 28]) {
            ctx.beginPath();
            ctx.moveTo(x, 37);
            ctx.lineTo(x, 43);
            ctx.stroke();
        }
    });
    canvas(scene, POWER_UP_TEXTURE.freeze, 64, 64, snowflake);
    canvas(scene, POWER_UP_TEXTURE.heal, 64, 64, healCross);
    canvas(scene, POWER_UP_TEXTURE.zap, 64, 64, lightningBolt);
}

function canvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, w, h);
    if (!texture) return;
    draw(texture.getContext());
    texture.refresh();
}

function radial(scene: Phaser.Scene, key: string, size: number, stops: Stops): void {
    canvas(scene, key, size, size, ctx => {
        const r = size / 2;
        const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
        for (const [at, color] of stops) gradient.addColorStop(at, color);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
    });
}

/** Full-screen shading that is clear in the middle and `color` at the edges. */
function edge(scene: Phaser.Scene, key: string, color: string): void {
    const w = 1280;
    const h = 720;
    canvas(scene, key, w, h, ctx => {
        // Stretch a circle into an ellipse that matches the screen's shape.
        ctx.save();
        ctx.scale(1, h / w);
        const gradient = ctx.createRadialGradient(w / 2, w / 2, w * 0.28, w / 2, w / 2, w * 0.72);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, color);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, w);
        ctx.restore();
    });
}

function heart(ctx: CanvasRenderingContext2D, full: boolean): void {
    ctx.beginPath();
    ctx.moveTo(32, 55);
    ctx.bezierCurveTo(6, 37, 3, 16, 17, 8);
    ctx.bezierCurveTo(26, 3, 32, 11, 32, 17);
    ctx.bezierCurveTo(32, 11, 38, 3, 47, 8);
    ctx.bezierCurveTo(61, 16, 58, 37, 32, 55);
    ctx.closePath();
    if (full) {
        const gradient = ctx.createLinearGradient(0, 6, 0, 55);
        gradient.addColorStop(0, '#ff5a5f');
        gradient.addColorStop(1, '#b3101e');
        ctx.fillStyle = gradient;
    } else {
        ctx.fillStyle = '#2b2233';
    }
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3a0b12';
    ctx.stroke();
    if (full) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(21, 18, 6, 4, -0.6, 0, Math.PI * 2);
        ctx.fill();
    }
}

function snowflake(ctx: CanvasRenderingContext2D): void {
    ctx.translate(32, 32);
    ctx.lineCap = 'round';
    // Dark outline first, then the bright ice on top.
    for (const [width, color] of [[9, '#0b2a4a'], [5, '#bff3ff']] as const) {
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        for (let arm = 0; arm < 6; arm++) {
            ctx.save();
            ctx.rotate((arm * Math.PI) / 3);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -26);
            ctx.moveTo(0, -15);
            ctx.lineTo(-7, -22);
            ctx.moveTo(0, -15);
            ctx.lineTo(7, -22);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
}

function healCross(ctx: CanvasRenderingContext2D): void {
    const points: [number, number][] = [
        [22, 6], [42, 6], [42, 22], [58, 22], [58, 42], [42, 42],
        [42, 58], [22, 58], [22, 42], [6, 42], [6, 22], [22, 22],
    ];
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 6, 0, 58);
    gradient.addColorStop(0, '#8dff9f');
    gradient.addColorStop(1, '#1fa64a');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0b3a1a';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(28, 14, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
}

function lightningBolt(ctx: CanvasRenderingContext2D): void {
    const points: [number, number][] = [[36, 2], [12, 36], [28, 36], [20, 62], [52, 24], [35, 24], [46, 2]];
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 2, 0, 62);
    gradient.addColorStop(0, '#fff6a0');
    gradient.addColorStop(1, '#ff9a1f');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a2a00';
    ctx.stroke();
}
