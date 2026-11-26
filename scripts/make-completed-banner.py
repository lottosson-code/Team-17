"""Draw the "COMPLETED" banner shown after the last level of the last classroom.

Usage:
    python scripts/make-completed-banner.py public/assets/ui/completed.png [--text COMPLETED]

Matches the combat HUD: Lora Bold, warm gold letters with a dark plum outline and an orange
glow (same colours as Hud.showBanner), gold diamonds and flourish lines like the HUD panels.
Transparent background, so it sits on top of any classroom. Requires Pillow and numpy.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FONT = Path(__file__).resolve().parent.parent / 'public/assets/fonts/Lora-Variable.woff'
GOLD_TOP = (255, 241, 190)
GOLD_MID = (255, 215, 106)   # #ffd76a, the HUD banner colour
GOLD_BOTTOM = (214, 146, 52)
OUTLINE = (26, 11, 20)       # #1a0b14, the HUD banner stroke
GLOW = (255, 154, 60)        # #ff9a3c, the HUD banner glow
ORNAMENT = (216, 180, 90)    # #d8b45a, the HUD diamonds


# Vertical gold gradient (light top, warm bottom) the size of the canvas.
def gold_gradient(w, h, top, bottom):
    mid = 0.45
    a = np.array(GOLD_TOP, dtype=float)
    b = np.array(GOLD_MID, dtype=float)
    c = np.array(GOLD_BOTTOM, dtype=float)
    # Only the band covered by the letters gets the full ramp.
    out = np.zeros((h, w, 3))
    band = slice(top, bottom)
    tt = np.linspace(0, 1, bottom - top)[:, None]
    ramp = np.where(tt < mid, a + (b - a) * (tt / mid), b + (c - b) * ((tt - mid) / (1 - mid)))
    out[band] = np.repeat(ramp[:, None, :], w, axis=1)
    out[:top] = a
    out[bottom:] = c
    return Image.fromarray(out.astype(np.uint8), 'RGB')


# A filled diamond centred on (x, y).
def diamond(draw, x, y, r, fill):
    draw.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill=fill)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output')
    parser.add_argument('--text', default='COMPLETED')
    args = parser.parse_args()

    W, H = 1760, 360
    font = ImageFont.truetype(str(FONT), 170)
    font.set_variation_by_name('Bold')
    tracking = 10  # Extra space between letters

    # Measure the word with tracking.
    widths = [font.getlength(ch) for ch in args.text]
    text_w = sum(widths) + tracking * (len(args.text) - 1)
    x0 = (W - text_w) / 2
    ascent, descent = font.getmetrics()
    y0 = (H - (ascent + descent)) / 2 - 8

    # Letter mask.
    mask = Image.new('L', (W, H), 0)
    md = ImageDraw.Draw(mask)
    x = x0
    for ch, cw in zip(args.text, widths):
        md.text((x, y0), ch, font=font, fill=255)
        x += cw + tracking
    bbox = mask.getbbox()

    # Outline: the letters grown by a few pixels.
    outline = mask.filter(ImageFilter.MaxFilter(19))
    # Glow: a soft blur of the outline.
    glow = outline.filter(ImageFilter.GaussianBlur(22))

    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_layer = Image.new('RGBA', (W, H), GLOW + (0,))
    glow_layer.putalpha(glow.point(lambda v: int(v * 0.85)))
    canvas = Image.alpha_composite(canvas, glow_layer)

    # Flourishes: gold lines with diamonds either side of the word, under the glow's edge.
    deco = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    cy = (bbox[1] + bbox[3]) // 2
    left_end, right_start = bbox[0] - 40, bbox[2] + 40
    for side in (-1, 1):
        edge = left_end if side < 0 else right_start
        far = edge + side * 120
        dd.line([(edge, cy), (far, cy)], fill=OUTLINE + (255,), width=9)
        dd.line([(edge, cy), (far, cy)], fill=ORNAMENT + (255,), width=4)
        diamond(dd, edge, cy, 13, OUTLINE + (255,))
        diamond(dd, edge, cy, 9, ORNAMENT + (255,))
        diamond(dd, far, cy, 8, OUTLINE + (255,))
        diamond(dd, far, cy, 5, ORNAMENT + (255,))
    canvas = Image.alpha_composite(canvas, deco)

    # Dark outline, a drop shadow, then the gold letters.
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.putalpha(outline.filter(ImageFilter.GaussianBlur(4)).point(lambda v: int(v * 0.6)))
    canvas = Image.alpha_composite(canvas, shadow.transform((W, H), Image.AFFINE, (1, 0, 0, 0, 1, -6)))
    ol = Image.new('RGBA', (W, H), OUTLINE + (0,))
    ol.putalpha(outline)
    canvas = Image.alpha_composite(canvas, ol)

    gold = gold_gradient(W, H, bbox[1], bbox[3]).convert('RGBA')
    gold.putalpha(mask)
    canvas = Image.alpha_composite(canvas, gold)

    # A thin light highlight along the top of each letter.
    highlight = ImageChops_offset_diff(mask)
    hl = Image.new('RGBA', (W, H), (255, 252, 235, 0))
    hl.putalpha(highlight)
    canvas = Image.alpha_composite(canvas, hl)

    canvas = canvas.crop(canvas.getbbox())
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.output, optimize=True)
    print(f'wrote {args.output} {canvas.size}')


# Pixels on the top edge of the letters: the mask minus itself shifted down a little.
def ImageChops_offset_diff(mask):
    a = np.asarray(mask, dtype=np.int16)
    shifted = np.zeros_like(a)
    shifted[5:] = a[:-5]
    edge = np.clip(a - shifted, 0, 255) * 0.55
    return Image.fromarray(edge.astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(1))


if __name__ == '__main__':
    main()
