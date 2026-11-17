"""Make the eraser enemy art from one prototype drawing.

Usage:
    python scripts/make-eraser-variants.py SOURCE.png OUTPUT_DIR [--preview PREVIEW.png]

SOURCE.png is the 1254x1254 prototype (Sprites/erasers/eraser-source.png); every
coordinate below is in its pixels. Writes full-size PNGs to OUTPUT_DIR:

    eraser.png         the prototype as drawn
    eraser-baby.png    pale, chipped and cracked, with a plaster and a tear; squat and cute
    eraser-big.png     blue ink eraser with a red headband
    eraser-giant.png   violet, with an eye patch and a stitched scar
    eraser-boss.png    crimson and charcoal, horns, glowing eyes, fiery mouth, burning cracks, spiked fists

The mini-boss is drawn much larger in game, so it goes in OUTPUT_DIR/large and gets a taller texture.
Then make the game files with:
    python scripts/optimize-art.py OUTPUT_DIR public/assets/combat/enemies --height 320
    python scripts/optimize-art.py OUTPUT_DIR/large public/assets/combat/enemies --height 360

Requires Pillow and numpy.
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PAD = 300  # Room around the drawing for horns and headband tails; trimmed away afterwards.
OUTLINE = (34, 18, 22, 255)

# Landmarks on the prototype (before PAD is added).
BODY = [(464, 119), (997, 245), (878, 966), (350, 840)]  # The eraser block, clockwise from top-left
TOP_LEFT, TOP_RIGHT = BODY[0], BODY[1]
EYES = [(514, 527, 62), (686, 572, 70)]  # x, y, radius: viewer's left eye, right eye
MOUTH = (455, 600, 715, 810)  # Box around the open mouth
FISTS = [(175, 433, 332, 614), (928, 727, 1104, 903)]  # Raised fist, lower fist


def at(*points):
    """Prototype coordinates -> padded canvas coordinates."""
    return [(x + PAD, y + PAD) for x, y in points]


def along(a, b, t, push=0.0):
    """The point t of the way from a to b, moved `push` pixels into the body (perpendicular to a-b)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = (dx * dx + dy * dy) ** 0.5
    nx, ny = -dy / length, dx / length
    return (a[0] + dx * t + nx * push, a[1] + dy * t + ny * push)


def bezier(p0, p1, p2, steps=24):
    out = []
    for i in range(steps + 1):
        t = i / steps
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


# ---------------------------------------------------------------- colour

def to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    safe = np.where(d > 1e-6, d, 1)
    h = np.where(mx == r, ((g - b) / safe) % 6, np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4))
    h = np.where(d > 1e-6, h / 6, 0)
    s = np.where(mx > 0, d / np.where(mx > 0, mx, 1), 0)
    return np.stack([h % 1, s, mx], -1)


def to_rgb(hsv):
    h, s, v = hsv[..., 0] * 6, hsv[..., 1], hsv[..., 2]
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    options = [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    out = np.zeros(hsv.shape)
    for k, (r, g, b) in enumerate(options):
        out = np.where((i == k)[..., None], np.stack([r, g, b], -1), out)
    return out


class Pixels:
    """The image as HSV arrays, plus masks for the parts of the drawing."""

    def __init__(self, image):
        self.rgba = np.asarray(image).astype(float) / 255
        self.hsv = to_hsv(self.rgba[..., :3])
        h, s, v = self.hsv[..., 0], self.hsv[..., 1], self.hsv[..., 2]
        opaque = self.rgba[..., 3] > 0
        mouth_box = shape_mask(image.size, lambda d: d.rectangle(at(MOUTH[:2], MOUTH[2:]), fill=255))
        # Inside the mouth is a deeper, stronger red (hue 350-10, saturation > 0.6) than the
        # rubber around it (hue ~346, saturation ~0.55), so colour separates the two.
        self.mouth = mouth_box & ((h > 350 / 360) | (h < 0.03)) & (s > 0.6)
        self.teeth = mouth_box
        self.eyes = shape_mask(image.size, lambda d: [d.ellipse(at((x - r, y - r), (x + r, y + r)), fill=255) for x, y, r in EYES])
        # Pink rubber (and its shading), but not the outline or the inside of the mouth.
        self.pink = opaque & ((h > 0.83) | (h < 0.02)) & (s > 0.22) & (v > 0.25) & ~self.mouth
        # Off-white: the top of the eraser, gloves, eyes and teeth.
        self.white = opaque & (s < 0.32) & (v > 0.55)

    def image(self):
        rgb = to_rgb(self.hsv)
        return Image.fromarray((np.concatenate([rgb, self.rgba[..., 3:]], -1) * 255).round().astype(np.uint8))


def shape_mask(size, draw):
    mask = Image.new('L', size, 0)
    draw(ImageDraw.Draw(mask))
    return np.asarray(mask) > 127


def recolour_pink(px, hue_degrees, saturation=1.0, value=1.0, lift=0.0):
    """Moves the pink rubber to another hue, keeping its shading."""
    hsv = px.hsv[px.pink]
    hsv[:, 0] = (hsv[:, 0] - 346 / 360 + hue_degrees / 360) % 1
    hsv[:, 1] = np.clip(hsv[:, 1] * saturation, 0, 1)
    hsv[:, 2] = np.clip(hsv[:, 2] * value + lift, 0, 1)
    px.hsv[px.pink] = hsv


# ---------------------------------------------------------------- drawing helpers

def body_mask(image):
    """The eraser block only (not arms, fists or legs), as an 'L' image for clipping."""
    block = Image.new('L', image.size, 0)
    ImageDraw.Draw(block).polygon(at(*BODY), fill=255)
    return Image.fromarray(np.minimum(np.asarray(block), np.asarray(image.getchannel('A'))))


def clipped(overlay, mask):
    pixels = np.asarray(overlay).copy()
    pixels[..., 3] = (pixels[..., 3].astype(float) * np.asarray(mask) / 255).astype(np.uint8)
    return Image.fromarray(pixels)


def outlined_polygon(draw, points, fill, width=12):
    draw.polygon(points, fill=fill)
    draw.line(points + [points[0]], fill=OUTLINE, width=width, joint='curve')


def glow(size, draw_shapes, colour, blur, strength):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    draw_shapes(ImageDraw.Draw(layer), colour)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    pixels = np.asarray(layer).copy()
    pixels[..., 3] = np.clip(pixels[..., 3].astype(float) * strength, 0, 255).astype(np.uint8)
    return Image.fromarray(pixels)


def chip(image, edge, outside):
    """Bites a jagged piece out of the eraser block: `edge` is the jagged cut, `outside` closes it.
    The cut reaches a little past the block so the drawing's own outline goes with the piece;
    only use it where no arm or leg is that close to the block."""
    block = body_mask(image)
    reach = Image.new('L', image.size, 0)
    draw = ImageDraw.Draw(reach)
    draw.polygon(at(*BODY), fill=255)
    draw.line(at(*BODY, BODY[0]), fill=255, width=70, joint='curve')
    cut = Image.new('L', image.size, 0)
    ImageDraw.Draw(cut).polygon(at(*edge, *outside), fill=255)
    cut = Image.fromarray(np.minimum(np.asarray(cut), np.asarray(reach)))
    # Outline the new edge first; cutting then removes the half of the line outside the eraser.
    rim = Image.new('RGBA', image.size, (0, 0, 0, 0))
    ImageDraw.Draw(rim).line(at(*edge), fill=OUTLINE, width=14, joint='curve')
    image.alpha_composite(clipped(rim, block))
    pixels = np.asarray(image).copy()
    pixels[..., 3][np.asarray(cut) > 0] = 0
    return Image.fromarray(pixels)


def cracks(image, lines, colour=OUTLINE, width=6):
    layer = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for line in lines:
        draw.line(at(*line), fill=colour, width=width, joint='curve')
    image.alpha_composite(clipped(layer, body_mask(image)))


def strip(centre, angle_degrees, length, width):
    """Corners of a rectangle centred on `centre`, rotated by `angle_degrees`."""
    a = np.radians(angle_degrees)
    u = np.array([np.cos(a), np.sin(a)]) * length / 2
    n = np.array([-np.sin(a), np.cos(a)]) * width / 2
    c = np.array(centre, dtype=float)
    return [tuple(p) for p in (c - u - n, c + u - n, c + u + n, c - u + n)]


# ---------------------------------------------------------------- variants

def make_baby(source):
    px = Pixels(source)
    recolour_pink(px, 350, saturation=0.62, value=1.02, lift=0.05)  # Pale pastel pink
    image = px.image()
    # Pieces missing from the top-right corner and the left side (away from the arms and legs).
    image = chip(image,
                 edge=[(830, 196), (866, 250), (902, 266), (888, 306), (930, 328), (942, 368), (984, 386), (1010, 392)],
                 outside=[(1070, 400), (1070, 150), (820, 150)])
    image = chip(image,
                 edge=[(400, 250), (436, 276), (424, 306), (456, 330), (440, 362), (464, 388), (420, 410), (392, 420)],
                 outside=[(330, 430), (330, 240)])
    cracks(image, [
        [(902, 266), (850, 310), (832, 300), (790, 354)],
        [(942, 368), (918, 414), (936, 458)],
        [(456, 330), (500, 318), (520, 338)],
        [(464, 388), (494, 420)],
    ])
    # A crossed plaster on its head.
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    centre = at((640, 240))[0]
    for angle in (13 + 38, 13 - 38):
        corners = strip(centre, angle, 230, 62)
        outlined_polygon(draw, corners, (240, 206, 160, 255), width=10)
    outlined_polygon(draw, strip(centre, 13, 74, 74), (214, 170, 124, 255), width=8)
    for dx, dy in ((-14, -14), (14, -14), (-14, 14), (14, 14), (0, 0)):
        draw.ellipse([centre[0] + dx - 4, centre[1] + dy - 4, centre[0] + dx + 4, centre[1] + dy + 4], fill=(168, 128, 92, 255))
    image.alpha_composite(clipped(overlay, body_mask(image)))
    # A tear under the left eye.
    tear = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(tear)
    tx, ty = at((462, 612))[0]
    drop = [(tx, ty - 34)] + [(tx + 20 * np.cos(t), ty + 8 + 20 * np.sin(t)) for t in np.linspace(-np.pi * 0.2, np.pi * 1.2, 24)]
    outlined_polygon(draw, drop, (128, 196, 255, 255), width=7)
    draw.ellipse([tx - 9, ty - 2, tx - 1, ty + 8], fill=(235, 248, 255, 255))
    image.alpha_composite(tear)
    # Squat proportions read as younger and cuter.
    image = image.crop(image.getbbox())
    return image.resize((image.width, round(image.height * 0.86)), Image.LANCZOS)


def make_big(source):
    px = Pixels(source)
    recolour_pink(px, 212, saturation=1.0, value=0.92)  # Blue ink eraser; the white top stays
    image = px.image()
    # A red headband across the white top, tied at the back (the eraser faces left).
    band_top = (along(TOP_LEFT, TOP_RIGHT, -0.15, 80), along(TOP_LEFT, TOP_RIGHT, 1.15, 80))
    band_bottom = (along(TOP_LEFT, TOP_RIGHT, -0.15, 150), along(TOP_LEFT, TOP_RIGHT, 1.15, 150))
    band = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(band)
    draw.polygon(at(band_top[0], band_top[1], band_bottom[1], band_bottom[0]), fill=(206, 38, 46, 255))
    mid = (along(TOP_LEFT, TOP_RIGHT, -0.15, 128), along(TOP_LEFT, TOP_RIGHT, 1.15, 128))
    draw.polygon(at(mid[0], mid[1], band_bottom[1], band_bottom[0]), fill=(160, 22, 34, 255))
    for edge in (band_top, band_bottom):
        draw.line(at(*edge), fill=OUTLINE, width=11)
    image.alpha_composite(clipped(band, body_mask(image)))
    # Knot and tails behind the right edge.
    knot = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(knot)
    tails = [
        [(978, 330), (1060, 300), (1120, 268), (1150, 292), (1092, 330), (1040, 362), (984, 372)],
        [(980, 360), (1050, 392), (1110, 430), (1092, 458), (1032, 420), (972, 392)],
    ]
    for tail in tails:
        outlined_polygon(draw, at(*tail), (190, 30, 40, 255), width=10)
    kx, ky = at((980, 352))[0]
    draw.ellipse([kx - 30, ky - 30, kx + 30, ky + 30], fill=(206, 38, 46, 255), outline=OUTLINE, width=10)
    image.alpha_composite(knot)
    return image


def make_giant(source):
    px = Pixels(source)
    recolour_pink(px, 278, saturation=1.05, value=0.82)  # Bruised violet
    image = px.image()
    # A stitched scar down the left cheek.
    scar = [(382, 588), (408, 640), (424, 690), (450, 742)]
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw.line(at(*scar), fill=(70, 30, 70, 255), width=11, joint='curve')
    for (x0, y0), (x1, y1) in zip(scar, scar[1:]):
        for t in (0.3, 0.75):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            draw.line(at((x - 18, y + 6), (x + 18, y - 6)), fill=OUTLINE, width=6)
    # The strap of an eye patch, round the head.
    draw.line(at((430, 300), (686, 572), (950, 700)), fill=(28, 22, 30, 255), width=18, joint='curve')
    image.alpha_composite(clipped(overlay, body_mask(image)))
    # The patch over the right eye.
    patch = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(patch)
    x, y, r = EYES[1]
    (px0, py0), (px1, py1) = at((x - r - 14, y - r - 6), (x + r + 14, y + r + 8))
    draw.ellipse([px0, py0, px1, py1], fill=(30, 24, 34, 255), outline=OUTLINE, width=10)
    draw.arc([px0 + 18, py0 + 14, px1 - 30, py1 - 40], 200, 290, fill=(90, 80, 100, 255), width=7)
    image.alpha_composite(patch)
    return image


def make_boss(source):
    px = Pixels(source)
    recolour_pink(px, 356, saturation=1.5, value=0.62)  # Deep crimson
    # Charcoal top and fists; the eyes and teeth stay light for now.
    charcoal = px.white & ~px.eyes & ~px.teeth
    hsv = px.hsv[charcoal]
    hsv[:, 0], hsv[:, 1], hsv[:, 2] = 350 / 360, 0.18, 0.16 + hsv[:, 2] * 0.2
    px.hsv[charcoal] = hsv
    # Glowing eyes: the whites burn yellow-orange.
    burning = px.white & px.eyes
    hsv = px.hsv[burning]
    hsv[:, 0], hsv[:, 1], hsv[:, 2] = 0.08 - (hsv[:, 2] - 0.55) * 0.12, 0.85, 1.0
    px.hsv[burning] = hsv
    # Fire inside the mouth.
    fire = px.mouth & (px.hsv[..., 2] > 0.12)
    hsv = px.hsv[fire]
    hsv[:, 0], hsv[:, 1], hsv[:, 2] = 0.04 + hsv[:, 2] * 0.07, 0.95, np.clip(hsv[:, 2] * 1.7, 0, 1)
    px.hsv[fire] = hsv
    drawing = px.image()

    # Horns, drawn behind the body so their roots disappear into the top edge.
    horns = Image.new('RGBA', drawing.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(horns)
    for start, end, outer, inner, tip in (
        (0.12, 0.40, (400, 40), (580, 10), (330, -150)),
        (0.60, 0.88, (920, 40), (1090, 130), (1150, -120)),
    ):
        root_a, root_b = along(TOP_LEFT, TOP_RIGHT, start, 40), along(TOP_LEFT, TOP_RIGHT, end, 40)
        left_side, right_side = bezier(root_a, outer, tip), bezier(tip, inner, root_b)
        outlined_polygon(draw, at(*left_side, *right_side[1:]), (226, 206, 176, 255), width=13)
        for t in (0.35, 0.55, 0.72):  # Ridges round the horn
            i = round(t * 24)
            draw.line(at(left_side[i], right_side[24 - i]), fill=(150, 122, 100, 255), width=5)
        tip_end = at(*left_side[19:], *right_side[1:6])
        draw.polygon(tip_end, fill=(120, 24, 30, 255))
        draw.line(tip_end, fill=OUTLINE, width=13, joint='curve')
    image = horns
    image.alpha_composite(drawing)

    # Spiked knuckles.
    spikes = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(spikes)
    for x, y, dx, dy in ((205, 470, -40, -40), (245, 448, -26, -52), (290, 446, -6, -56),
                         (955, 760, -10, -54), (1000, 740, 6, -58), (1048, 742, 22, -54), (1088, 768, 44, -40)):
        base = 18
        outlined_polygon(draw, at((x - base, y), (x + base, y), (x + dx, y + dy)), (168, 168, 182, 255), width=8)
    image.alpha_composite(spikes)

    # Burning cracks through the rubber.
    lines = [
        [(372, 676), (414, 716), (402, 768), (446, 806), (436, 842)],
        [(836, 742), (800, 790), (818, 840), (782, 892)],
        [(700, 182), (730, 226), (708, 268), (742, 306)],
        [(560, 860), (598, 880), (590, 920)],
    ]
    shapes = lambda d, colour: [d.line(at(*line), fill=colour, width=26, joint='curve') for line in lines]
    image.alpha_composite(clipped(glow(image.size, shapes, (255, 90, 20, 255), 14, 0.9), body_mask(image)))
    cracks(image, lines, colour=(255, 196, 80, 255), width=8)

    # A red glow round the eyes.
    eyes = lambda d, colour: [d.ellipse(at((x - r * 1.3, y - r * 1.2), (x + r * 1.3, y + r * 1.2)), fill=colour) for x, y, r in EYES]
    image.alpha_composite(glow(image.size, eyes, (255, 40, 20, 255), 30, 0.55))
    return image


VARIANTS = {
    'eraser': lambda source: source,
    'eraser-baby': make_baby,
    'eraser-big': make_big,
    'eraser-giant': make_giant,
    'eraser-boss': make_boss,
}
LARGE = {'eraser-boss'}  # Saved to OUTPUT_DIR/large (see the usage above)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--preview', type=Path, help='Also save all variants side by side here')
    args = parser.parse_args()

    original = Image.open(args.source).convert('RGBA')
    source = Image.new('RGBA', (original.width + 2 * PAD, original.height + 2 * PAD), (0, 0, 0, 0))
    source.paste(original, (PAD, PAD))
    args.output.mkdir(parents=True, exist_ok=True)
    made = {}
    for name, make in VARIANTS.items():
        image = make(source.copy())
        alpha = image.getchannel('A').point(lambda a: 255 if a > 8 else 0)
        image = image.crop(alpha.getbbox())
        folder = args.output / 'large' if name in LARGE else args.output
        folder.mkdir(parents=True, exist_ok=True)
        image.save(folder / f'{name}.png')
        made[name] = image
        print(f'{name:14} {image.width}x{image.height}')

    if args.preview:
        height = 420
        tiles = [image.resize((round(image.width * height / image.height), height), Image.LANCZOS) for image in made.values()]
        sheet = Image.new('RGBA', (sum(t.width for t in tiles) + 30 * (len(tiles) + 1), height + 60), (36, 34, 44, 255))
        x = 30
        for tile in tiles:
            sheet.alpha_composite(tile, (x, 30))
            x += tile.width + 30
        sheet.convert('RGB').save(args.preview)
    return 0


if __name__ == '__main__':
    sys.exit(main())
