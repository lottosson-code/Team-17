"""Make a 4-frame walk cycle for an enemy from its still drawing.

The drawn legs are erased and two new rubber-hose legs with boots are drawn and animated
(heel strike, flat foot, heel lift, swing), and the body bobs. Each leg goes straight down into
the heel of its shoe; every cycle faces left, towards the wizard.

Usage:
    python scripts/make-walk-frames.py OUTPUT_DIR [NAME ...] [--preview]

NAME is a key of CONFIG (default: all). Writes OUTPUT_DIR/<name>-walk-sheet.png (4 frames in a
row, transparent), and with --preview also <name>-walk.gif on the floor colour. Then make the
game file with the usual spritesheet script, e.g.:
    python scripts/make-spritesheet.py OUT/pencil-walk-sheet.png public/assets/combat/enemies/pencil-walk.webp --cols 4 --rows 1 --keep-background
and use the printed frame size in theme.ts (EnemyArt.walk).

All coordinates in CONFIG are pixels of public/assets/combat/enemies/<file>.webp (the still art).
Requires Pillow and numpy.
"""
import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ENEMIES = Path(__file__).resolve().parent.parent / 'public/assets/combat/enemies'
FRAMES = 4  # Contact, passing, contact, passing
PREVIEW_FPS = 6
SS = 4  # Supersampling for smooth outlines

OUTLINE = (22, 11, 6, 255)
LEG = (58, 34, 21, 255)
LEG_FAR = (40, 24, 16, 255)
RIM = (176, 98, 42, 255)
BOOT = (62, 40, 28, 255)
BOOT_FAR = (44, 29, 21, 255)
BOOT_SHINE = (150, 96, 58, 255)

CONFIG = {
    'pencil': dict(
        file='pencil',
        # Keep everything except this polygon (the old leg and boot).
        erase=[(127, 226), (232, 226), (232, 330), (64, 330), (100, 268)],
        hips=[(110, 246), (64, 250)],  # near (front) hip, far hip
        ground=362, stride=46, lift=22,
        width=13, boot=(56, 34), bob=5, canvas=(270, 374), offset=(14, 6),
    ),
    'eraser': dict(
        file='eraser', facing=-1,
        erase=[(0, 225), (62, 226), (100, 249), (150, 266), (172, 272), (192, 261), (206, 249), (214, 246), (287, 246), (287, 320), (0, 320)],
        hips=[(176, 258), (90, 250)],
        ground=322, stride=34, lift=11,
        width=12, boot=(58, 27), bob=4, canvas=(300, 330), offset=(6, 4),
    ),
    'eraser-baby': dict(
        file='eraser-baby', facing=-1,
        erase=[(0, 236), (72, 236), (120, 253), (160, 262), (196, 270), (222, 256), (245, 238), (262, 244), (334, 244), (334, 320), (0, 320)],
        hips=[(212, 262), (98, 248)],
        ground=322, stride=32, lift=10,
        width=12, boot=(62, 28), bob=4, canvas=(346, 330), offset=(6, 4),
    ),
    'eraser-boss': dict(
        file='eraser-boss', facing=-1,
        erase=[(0, 288), (62, 286), (100, 300), (150, 315), (176, 304), (190, 293), (270, 293), (270, 360), (0, 360)],
        hips=[(166, 306), (80, 292)],
        ground=362, stride=32, lift=10,
        width=12, boot=(62, 28), bob=4, canvas=(282, 370), offset=(6, 4),
    ),
    'pencil-sharpener': dict(
        file='pencil-sharpener',
        erase=[(0, 258), (60, 258), (70, 252), (220, 251), (230, 246), (290, 246), (290, 320), (0, 320)],
        hips=[(205, 250), (100, 250)],
        ground=322, stride=34, lift=11,
        width=15, boot=(70, 32), bob=3, canvas=(302, 330), offset=(6, 4),
    ),
}


# The three erasers made from one drawing (scripts/make-eraser-variants.py) share the same legs.
for _variant in ('eraser-big', 'eraser-giant'):
    CONFIG[_variant] = {**CONFIG['eraser'], 'file': _variant}
CONFIG['eraser-big']['canvas'] = (313, 330)  # This one's headband tail makes the art wider


def ik_knee(hip, foot, thigh, shin, bend):
    """Knee position for a two-bone leg; bend=+1 puts the knee forward (towards +x)."""
    hx, hy = hip
    fx, fy = foot
    dx, dy = fx - hx, fy - hy
    d = max(1e-3, min(math.hypot(dx, dy), thigh + shin - 1e-3))
    a = (thigh ** 2 - shin ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(max(0.0, thigh ** 2 - a ** 2))
    mx, my = hx + a * dx / d, hy + a * dy / d
    # Perpendicular, choose the side towards +x (forward).
    px, py = -dy / d, dx / d
    if px * bend < 0:
        px, py = -px, -py
    return mx + h * px, my + h * py


def bezier(p0, p1, p2, n=24):
    """Points on a quadratic curve through p0 and p2, pulled towards p1."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def cubic(p0, p1, p2, p3, n=28):
    """Points on a cubic Bezier curve."""
    pts = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
        pts.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return pts


def thick_path(draw, pts, width, fill):
    """A round-capped stroke along pts."""
    w = int(round(width))
    draw.line(pts, fill=fill, width=w, joint='curve')
    r = width / 2
    for x, y in (pts[0], pts[-1]):
        draw.ellipse([x - r, y - r, x + r, y + r], fill=fill)


def boot_parts(w, h, grow=0.0):
    """Cartoon boot around the ankle at (0, 0), toe pointing +x (walking direction), as a few
    overlapping blobs: a heel cup right under the ankle (where the leg goes in), a big round toe
    in front, and a flat sole. grow widens every blob (for the dark outline)."""
    sole = h * 0.62  # The sole is this far below the ankle

    def blob(cx, cy, rx, ry):
        pts = []
        for i in range(40):
            t = 2 * math.pi * i / 40
            x, y = cx + (rx + grow) * math.cos(t), cy + (ry + grow) * math.sin(t)
            pts.append((x, min(y, sole + grow)))  # Flat sole
        return pts

    pts = (blob(w * 0.02, h * 0.10, w * 0.22, h * 0.50)    # Heel cup, the tallest part
           + blob(w * 0.46, h * 0.28, w * 0.36, h * 0.36)  # Round toe, lower
           + blob(w * 0.22, h * 0.42, w * 0.42, h * 0.22))  # Sole
    return [convex_hull(pts)]  # One smooth shoe, no dents between the blobs


def convex_hull(points):
    """Convex hull (monotone chain), counter-clockwise."""
    pts = sorted(set(points))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def place(points, ax, ay, angle, scale=1.0):
    """Rotate points (around the ankle) by angle degrees and move them to (ax, ay)."""
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    return [(ax + (x * ca - y * sa) * scale, ay + (x * sa + y * ca) * scale) for x, y in points]


def draw_leg(img, hip, ankle, boot, cfg, far):
    """Boot first, then the leg on top of it going straight into the heel, then the shoe's
    collar around the leg, so the leg clearly stands in the back of the shoe."""
    d = ImageDraw.Draw(img)
    s = SS
    outline, shape, shine = boot
    for part in outline:
        d.polygon([(x * s, y * s) for x, y in part], fill=OUTLINE)
    for part in shape:
        d.polygon([(x * s, y * s) for x, y in part], fill=BOOT_FAR if far else BOOT)
    if not far:
        for part in shine:
            d.polygon([(x * s, y * s) for x, y in part], fill=BOOT_SHINE)

    knee = ik_knee(hip, ankle, cfg['thigh'], cfg['shin'], +1)
    # Rubber hose: leaves the hip towards the knee, then comes straight down into the heel
    # (the last control point is right above the ankle), so the leg never hooks the shoe.
    c1 = (hip[0] + (knee[0] - hip[0]) * 1.1, hip[1] + (knee[1] - hip[1]) * 1.1)
    c2 = (ankle[0], ankle[1] - cfg['shin'] * 0.55)
    pts = [(x * s, y * s) for x, y in cubic(hip, c1, c2, ankle)]
    w = cfg['width'] * s
    thick_path(d, pts, w + 2.6 * s, OUTLINE)
    thick_path(d, pts, w, LEG_FAR if far else LEG)
    if not far:
        rim = [(x - w * 0.22, y - w * 0.05) for x, y in pts[2:-6]]
        d.line(rim, fill=RIM, width=max(1, int(w * 0.18)), joint='curve')

    # Collar: the top opening of the shoe around the ankle.
    ax, ay = ankle[0] * s, ankle[1] * s
    cw, ch = w * 0.85, w * 0.38
    d.ellipse([ax - cw - 1.3 * s, ay - ch - 1.3 * s, ax + cw + 1.3 * s, ay + ch + 1.3 * s], fill=OUTLINE)
    d.ellipse([ax - cw, ay - ch, ax + cw, ay + ch], fill=BOOT_FAR if far else BOOT)


def foot_pose(t, cfg, base_x):
    """Ankle x, height of the ankle above the ground, and foot angle (deg, + = toe down)
    at cycle time t in [0, 1). Stance (first half): heel strikes, foot flat, heel lifts at the end.
    Swing (second half): toe pushes off, the foot travels forward in an arc, toe up to land."""
    A = cfg['stride'] / 2
    if t < 0.5:
        u = t / 0.5
        x = base_x + A - 2 * A * u
        if u < 0.15:
            angle = -14 * (1 - u / 0.15)  # Heel strike: toe still up
        elif u > 0.75:
            angle = 16 * (u - 0.75) / 0.25  # Heel lifts, rolling onto the toe
        else:
            angle = 0.0
        return x, 0.0, angle, True
    u = (t - 0.5) / 0.5
    x = base_x - A + 2 * A * (0.5 - 0.5 * math.cos(math.pi * u))
    lift = cfg['lift'] * math.sin(math.pi * u)
    angle = 16 * (1 - u) - 14 * u  # Toe down after push-off -> toe up before landing
    return x, lift, angle, False


def boot_at(ankle_x, lift, angle, stance, cfg):
    """Boot polygons and the ankle point; in stance the lowest point of the boot rests on the ground."""
    bw, bh = cfg['boot']
    parts = boot_parts(bw, bh)
    lowest = max(y for part in parts for _, y in place(part, 0, 0, angle))
    rest = max(y for part in parts for _, y in part)  # Ankle height above ground when flat
    # Stance: the lowest point rests on the ground. Swing: lifted, but never through the floor.
    ay = cfg['ground'] - lowest if stance else min(cfg['ground'] - rest - lift, cfg['ground'] - lowest)
    outline = [place(part, ankle_x, ay, angle) for part in boot_parts(bw, bh, 1.8)]
    shape = [place(part, ankle_x, ay, angle) for part in parts]
    shine = [place([(bw * 0.42 + bw * 0.16 * math.cos(2 * math.pi * i / 24), bh * 0.05 + bh * 0.07 * math.sin(2 * math.pi * i / 24)) for i in range(24)], ankle_x, ay, angle)]
    return (ankle_x, ay), (outline, shape, shine)


def make_frames(name, n):
    cfg = CONFIG[name]
    src = Image.open(ENEMIES / f"{cfg['file']}.webp").convert('RGBA')
    # Left-facing art is mirrored so the rig always walks right, then mirrored back at the end.
    flip = cfg.get('facing', 1) < 0
    sw = src.width
    fx_ = (lambda x: sw - 1 - x) if flip else (lambda x: x)
    if flip:
        src = src.transpose(Image.FLIP_LEFT_RIGHT)
    erase = [(fx_(x), y) for x, y in cfg['erase']]
    hips = [(fx_(x), y) for x, y in cfg['hips']]
    # Erase the drawn legs.
    mask = Image.new('L', src.size, 255)
    ImageDraw.Draw(mask).polygon(erase, fill=0)
    body = src.copy()
    body.putalpha(Image.fromarray(np.minimum(np.asarray(src.getchannel('A')), np.asarray(mask))))
    # Leg bones: together 15 % longer than hip-to-ankle, so the knees bend a little but never zigzag.
    bw, bh = cfg['boot']
    rest = max(y for part in boot_parts(bw, bh) for _, y in part)
    hip_y = sum(y for _, y in hips) / len(hips) + cfg['offset'][1]
    cfg = {**cfg, 'thigh': (cfg['ground'] - rest - hip_y) * cfg.get('bend', 1.15) / 2}
    cfg['shin'] = cfg['thigh']
    W, H = cfg['canvas']
    ox, oy = cfg['offset']
    frames = []
    for i in range(n):
        t = i / n
        # Body is lowest when the feet are apart (t = 0, 0.5), highest as they pass (0.25, 0.75).
        bob = -cfg['bob'] * abs(math.sin(2 * math.pi * t))
        layer_back = Image.new('RGBA', (W * SS, H * SS))
        layer_front = Image.new('RGBA', (W * SS, H * SS))
        (nhx, nhy), (fhx, fhy) = hips
        near_hip = (nhx + ox, nhy + oy + bob)
        far_hip = (fhx + ox, fhy + oy + bob)
        for hip, phase, layer, far in ((far_hip, 0.5, layer_back, True), (near_hip, 0.0, layer_front, False)):
            ax, lift, angle, stance = foot_pose((t + phase) % 1, cfg, hip[0] + cfg.get('foot_dx', 4))
            ankle, boot = boot_at(ax, lift, angle, stance, cfg)
            draw_leg(layer, hip, ankle, boot, cfg, far)
        frame = layer_back.resize((W, H), Image.LANCZOS)
        frame.alpha_composite(body, (ox, int(round(oy + bob))))
        frame.alpha_composite(layer_front.resize((W, H), Image.LANCZOS))
        # The rig walks right; in the game every enemy walks left, so mirror the frame.
        frames.append(frame.transpose(Image.FLIP_LEFT_RIGHT))
    return frames


def save(name, out_dir, preview):
    """Writes the frame sheet (and optionally a preview GIF) for one enemy."""
    out_dir.mkdir(parents=True, exist_ok=True)
    frames = make_frames(name, FRAMES)
    W, H = frames[0].size
    sheet = Image.new('RGBA', (W * FRAMES, H))
    for i, f in enumerate(frames):
        sheet.alpha_composite(f, (i * W, 0))
    sheet.save(out_dir / f'{name}-walk-sheet.png')
    if preview:
        ground = CONFIG[name]['ground'] + CONFIG[name]['offset'][1] + 1
        gif = []
        for f in frames:
            b = Image.new('RGBA', f.size, (58, 50, 74, 255))
            ImageDraw.Draw(b).line([(0, ground), (W, ground)], fill=(90, 80, 110, 255), width=2)
            b.alpha_composite(f)
            gif.append(b.convert('RGB'))
        gif[0].save(out_dir / f'{name}-walk.gif', save_all=True, append_images=gif[1:],
                    duration=int(1000 / PREVIEW_FPS), loop=0)
    print(f'{name}: {FRAMES} frames of {W}x{H}, stride {CONFIG[name]["stride"]} px per step (art pixels)')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('names', nargs='*')
    parser.add_argument('--preview', action='store_true')
    args = parser.parse_args()
    for name in args.names or CONFIG:
        if name not in CONFIG:
            raise SystemExit(f'Unknown enemy "{name}"; choose from {", ".join(CONFIG)}')
        save(name, args.output_dir, args.preview)


if __name__ == '__main__':
    main()
