"""Make the per-classroom versions of the map art, so classrooms 2 and 3 don't reuse classroom 1's.

Usage:
    python scripts/make-classroom-variants.py

Reads assets/map/islands.png and assets/map/dream.png (classroom 1 keeps these) and writes
    assets/map/islands-2.webp, assets/map/dream-2.webp   classroom 2 ("olive"): fresher green moss, greener mist
    assets/map/islands-3.webp, assets/map/dream-3.webp   classroom 3 ("blue"): frosty teal moss, cooler night
The changes are deliberately small: same drawings, only the moss and the overall colour grade differ.
Tune the numbers in VARIANTS and run again. Requires Pillow and numpy.
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / 'assets/map'

# moss_hue: degrees added to the hue of moss/grass pixels (yellow-green hues only).
# moss_sat: multiplies their saturation. grade: per-channel multiply for the whole image.
VARIANTS = {
    2: {'moss_hue': 35, 'moss_sat': 1.2, 'grade': (0.97, 1.04, 0.93), 'bg_grade': (1.04, 1.02, 0.88)},
    3: {'moss_hue': 110, 'moss_sat': 0.75, 'grade': (0.88, 0.96, 1.14), 'bg_grade': (0.88, 0.96, 1.1)},
}
MOSS_HUE_RANGE = (38, 130)  # Degrees: the olive moss (bare wood and rock sit below this)
MOSS_MIN_SAT = 0.25
MOSS_MAX_VALUE = 0.62  # Moss is fairly dark; brighter yellows (pencil, candle, door light) stay as drawn


# RGB (0-1 floats, HxWx3) -> HSV with hue in degrees.
def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    safe = d > 1e-6
    rm = safe & (mx == r)
    gm = safe & (mx == g) & ~rm
    bm = safe & ~rm & ~gm
    h[rm] = ((g - b)[rm] / d[rm]) % 6
    h[gm] = (b - r)[gm] / d[gm] + 2
    h[bm] = (r - g)[bm] / d[bm] + 4
    h *= 60
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h, s, mx], -1)


# HSV (hue in degrees) -> RGB floats.
def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] % 360, hsv[..., 1], hsv[..., 2]
    c = v * s
    x = c * (1 - np.abs((h / 60) % 2 - 1))
    m = v - c
    zeros = np.zeros_like(h)
    sector = (h // 60).astype(int)
    r = np.choose(sector, [c, x, zeros, zeros, x, c])
    g = np.choose(sector, [x, c, c, x, zeros, zeros])
    b = np.choose(sector, [zeros, zeros, x, c, c, x])
    return np.stack([r + m, g + m, b + m], -1)


# Recolours the moss and applies a colour grade; keeps the alpha channel.
def recolour(image, moss_hue, moss_sat, grade):
    arr = np.asarray(image.convert('RGBA'), dtype=np.float64) / 255
    rgb, alpha = arr[..., :3], arr[..., 3:]
    hsv = rgb_to_hsv(rgb)
    lo, hi = MOSS_HUE_RANGE
    moss = (hsv[..., 0] >= lo) & (hsv[..., 0] <= hi) & (hsv[..., 1] >= MOSS_MIN_SAT) & (hsv[..., 2] <= MOSS_MAX_VALUE)
    # Feather the edges of the hue range so there's no hard seam.
    centre, half = (lo + hi) / 2, (hi - lo) / 2
    weight = np.clip(1.4 - np.abs(hsv[..., 0] - centre) / half, 0, 1) * moss
    hsv[..., 0] += moss_hue * weight
    hsv[..., 1] *= 1 + (moss_sat - 1) * weight
    out = hsv_to_rgb(hsv) * np.array(grade)
    out = np.clip(np.concatenate([out, alpha], -1), 0, 1)
    return Image.fromarray((out * 255).round().astype(np.uint8), 'RGBA')


def main():
    islands = Image.open(MAP / 'islands.png')
    dream = Image.open(MAP / 'dream.png')
    for room, v in VARIANTS.items():
        recolour(islands, v['moss_hue'], v['moss_sat'], v['grade']).save(MAP / f'islands-{room}.webp', quality=90, method=6)
        # The background has some moss and trees too; same hue shift, gentler grade.
        recolour(dream, v['moss_hue'] * 0.6, 1, v['bg_grade']).convert('RGB').save(MAP / f'dream-{room}.webp', quality=88, method=6)
        print(f'classroom {room}: islands-{room}.webp, dream-{room}.webp')


if __name__ == '__main__':
    main()
