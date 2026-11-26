"""Make a 24-frame walk cycle for an enemy from its still drawing.

Two rubber-hose legs with boots replace the drawn legs. The gait uses low foot clearance
and a small body bob, and every cycle faces left, towards the wizard.

Usage:
    python scripts/make-walk-frames.py OUTPUT_DIR [NAME ...] [--preview] [--game]

NAME is a key of CONFIG (default: all). Writes OUTPUT_DIR/<name>-walk-sheet.png, or with
--game writes <name>-walk.webp for Phaser using the registered frame size in theme.ts.
It also prints the full-cycle distance in frame pixels for the matching stride in theme.ts.
Add --preview to also write a looping GIF on the floor colour.

All coordinates in CONFIG are pixels of public/assets/combat/enemies/<file>.webp (the still art).
Requires Pillow and numpy.
"""
import argparse
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ENEMIES = Path(__file__).resolve().parent.parent / 'public/assets/combat/enemies'
FRAMES = 24
GAME_COLUMNS = 12
GAME_FRAME_HEIGHT = 300
PREVIEW_FPS = 30
SS = 4  # Supersampling for smooth outlines

OUTLINE = (22, 11, 6, 255)
LEG = (58, 34, 21, 255)
LEG_FAR = (40, 24, 16, 255)
RIM = (176, 98, 42, 255)
BOOT = (62, 40, 28, 255)
BOOT_FAR = (44, 29, 21, 255)
BOOT_SHINE = (150, 96, 58, 255)

CONFIG = {
    'red-book': dict(
        file='red-book', source='red-book-walk-source.png', facing=-1,
        erase=[(0, 213), (60, 201), (94, 209), (118, 214), (148, 225), (184, 237),
               (203, 235), (229, 227), (266, 216), (266, 306), (0, 306)],
        hips=[(118, 210), (164, 225)],
        ground=296, stride=86, lift=9,
        width=15, boot=(66, 34), bob=3, canvas=(266, 306), offset=(0, 0),
        game_box=(0, 0, 266, 300),
    ),
    'pencil': dict(
        file='pencil',
        # Keep everything except this polygon (the old leg and boot).
        erase=[(127, 226), (232, 226), (232, 330), (64, 330), (100, 268)],
        hips=[(110, 246), (64, 250)],  # near (front) hip, far hip
        ground=350, stride=55, lift=8,
        width=13, boot=(56, 34), bob=2, canvas=(270, 374), offset=(14, 6),
        game_box=(26, 1, 256, 365),
    ),
    'eraser': dict(
        file='eraser', facing=-1,
        erase=[(0, 225), (62, 226), (100, 249), (150, 266), (172, 272), (192, 261), (206, 249), (214, 246), (287, 246), (287, 320), (0, 320)],
        hips=[(176, 258), (90, 250)],
        ground=316, stride=39, lift=5,
        width=12, boot=(58, 27), bob=1.5, canvas=(300, 330), offset=(6, 4),
        game_box=(7, 0, 294, 325),
    ),
    'eraser-baby': dict(
        file='eraser-baby', facing=-1,
        erase=[(0, 236), (72, 236), (120, 253), (160, 262), (196, 270), (222, 256), (245, 238), (262, 244), (334, 244), (334, 320), (0, 320)],
        hips=[(198, 260), (136, 252)], ankle_shift=-4,
        ground=315, stride=37, lift=4,
        width=12, boot=(62, 28), bob=1.5, canvas=(346, 330), offset=(6, 4),
        game_box=(6, 0, 340, 325),
    ),
    'eraser-boss': dict(
        file='eraser-boss', facing=-1,
        erase=[(0, 288), (62, 286), (100, 300), (150, 315), (176, 304), (190, 293), (270, 293), (270, 360), (0, 360)],
        hips=[(166, 306), (80, 292)],
        ground=355, stride=36, lift=5,
        width=12, boot=(62, 28), bob=1.5, canvas=(282, 370), offset=(6, 4),
        game_box=(6, 0, 276, 365),
    ),
    'pencil-sharpener': dict(
        file='pencil-sharpener',
        erase=[(0, 258), (60, 258), (70, 252), (220, 251), (230, 246), (290, 246), (290, 320), (0, 320)],
        hips=[(205, 250), (100, 250)],
        ground=314, stride=40, lift=5,
        width=15, boot=(70, 32), bob=1.5, canvas=(302, 330), offset=(6, 4),
        game_box=(6, 1, 296, 325),
    ),
}


# The three erasers made from one drawing (scripts/make-eraser-variants.py) share the same legs.
for _variant in ('eraser-big', 'eraser-giant'):
    CONFIG[_variant] = {**CONFIG['eraser'], 'file': _variant}
# The large eraser's headband tail makes its canvas and game frame wider.
CONFIG['eraser-big'].update(canvas=(313, 330), game_box=(7, 0, 307, 325))
# Centre the pink eraser's gait under the lower face of its tilted body.
CONFIG['eraser'].update(hips=[(172, 260), (132, 252)], ankle_shift=-4)


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
    at cycle time t in [0, 1). The planted sole stays flat and travels back linearly by one step.
    The swinging foot returns in a low arc and meets the ground flat at both ends."""
    step = cfg['stride']
    if t < 0.5:
        return base_x + step * (0.5 - 2 * t), 0.0, 0.0, True
    u = (t - 0.5) / 0.5
    x = base_x - (step / 2) * math.cos(math.pi * u)
    lift = cfg['lift'] * math.sin(math.pi * u)
    angle = 5 * math.sin(2 * math.pi * u)
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
    source = Path(__file__).resolve().parent / 'art' / cfg['source'] if 'source' in cfg else ENEMIES / f"{cfg['file']}.webp"
    with Image.open(source) as image:
        src = image.convert('RGBA')
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
    # Keep the leg only slightly longer than hip-to-ankle for a shallow knee bend.
    bw, bh = cfg['boot']
    rest = max(y for part in boot_parts(bw, bh) for _, y in part)
    hip_y = sum(y for _, y in hips) / len(hips) + cfg['offset'][1]
    cfg = {**cfg, 'thigh': (cfg['ground'] - rest - hip_y) * 1.045 / 2}
    cfg['shin'] = cfg['thigh']
    W, H = cfg['canvas']
    ox, oy = cfg['offset']
    (nhx, nhy), (fhx, fhy) = hips
    centre_x = (nhx + fhx) / 2 + ox
    direction = math.copysign(1, nhx - fhx)
    # Keep both ankles close to a shared centreline so the contact foot can alternate.
    # Bring wide hip anchors in too, so short legs don't have to bend sharply inward.
    hip_spacing = direction * min(abs(nhx - fhx), cfg['stride'] * 0.95)
    ankle_spacing = direction * cfg['stride'] * 0.12
    ankle_centre = centre_x + cfg.get('ankle_shift', 4)
    near_base = ankle_centre + ankle_spacing / 2
    far_base = ankle_centre - ankle_spacing / 2

    frames = []
    for i in range(n):
        t = i / n
        # Body is lowest when the feet are apart (t = 0, 0.5), highest as they pass (0.25, 0.75).
        bob = -cfg['bob'] * abs(math.sin(2 * math.pi * t))
        layer_back = Image.new('RGBA', (W * SS, H * SS))
        layer_front = Image.new('RGBA', (W * SS, H * SS))
        near_hip = (centre_x + hip_spacing / 2, nhy + oy + bob)
        far_hip = (centre_x - hip_spacing / 2, fhy + oy + bob)
        legs = ((far_hip, far_base, 0.5, layer_back, True), (near_hip, near_base, 0.0, layer_front, False))
        for hip, base, phase, layer, far in legs:
            ax, lift, angle, stance = foot_pose((t + phase) % 1, cfg, base)
            ankle, boot = boot_at(ax, lift, angle, stance, cfg)
            draw_leg(layer, hip, ankle, boot, cfg, far)
        frame = layer_back.resize((W, H), Image.LANCZOS)
        frame.alpha_composite(body, (ox, int(round(oy + bob))))
        frame.alpha_composite(layer_front.resize((W, H), Image.LANCZOS))
        # The rig walks right; in the game every enemy walks left, so mirror the frame.
        frames.append(frame.transpose(Image.FLIP_LEFT_RIGHT))
    return frames


def save(name, out_dir, preview, game):
    """Write a raw or registered game sheet, and optionally a preview GIF."""
    out_dir.mkdir(parents=True, exist_ok=True)
    frames = make_frames(name, FRAMES)
    W, H = frames[0].size
    w, h = W, H
    columns = FRAMES
    cycle_distance = 2 * CONFIG[name]['stride']
    sheet_frames = frames
    if game:
        # Keep the original frame size and horizontal registration. Align all poses to a
        # shared sole baseline so shorter legs don't shift the lane position or float.
        left, top, right, bottom = CONFIG[name]['game_box']
        registered_height = bottom - top
        sole = max(frame.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()[3]
                   for frame in frames)
        box = (left, sole - registered_height, right, sole)
        h = GAME_FRAME_HEIGHT
        w = round((right - left) * h / registered_height)
        cycle_distance *= w / (right - left)
        columns = GAME_COLUMNS
        sheet_frames = [frame.crop(box).resize((w, h), Image.Resampling.LANCZOS) for frame in frames]
    sheet = Image.new('RGBA', (w * columns, h * math.ceil(FRAMES / columns)))
    for i, frame in enumerate(sheet_frames):
        row, column = divmod(i, columns)
        sheet.alpha_composite(frame, (column * w, row * h))
    if game:
        sheet.save(out_dir / f'{name}-walk.webp', quality=88, method=6)
    else:
        sheet.save(out_dir / f'{name}-walk-sheet.png')
    if preview:
        ground = CONFIG[name]['ground'] + 2
        gif = []
        for f in frames:
            b = Image.new('RGBA', f.size, (58, 50, 74, 255))
            ImageDraw.Draw(b).line([(0, ground), (W, ground)], fill=(90, 80, 110, 255), width=2)
            b.alpha_composite(f)
            gif.append(b.convert('RGB'))
        gif[0].save(out_dir / f'{name}-walk.gif', save_all=True, append_images=gif[1:],
                    duration=int(1000 / PREVIEW_FPS), loop=0)
    print(f'{name}: {FRAMES} frames of {w}x{h}, {cycle_distance:.4f} frame px per cycle')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('names', nargs='*')
    parser.add_argument('--preview', action='store_true')
    parser.add_argument('--game', action='store_true', help='write registered WebP sheets for Phaser')
    args = parser.parse_args()
    for name in args.names or CONFIG:
        if name not in CONFIG:
            raise SystemExit(f'Unknown enemy "{name}"; choose from {", ".join(CONFIG)}')
        save(name, args.output_dir, args.preview, args.game)


if __name__ == '__main__':
    main()
