"""Make the desk attack spritesheets from registered walking frames.

Usage: python scripts/make-attack-frames.py WALK_DIR OUTPUT_DIR [NAME ...]

Each sheet has a straight jab and a rising hook, one row of eight poses each.
The character's feet stay registered to the walking frame while its lead arm punches.
Requires Pillow, numpy, and opencv-python.
"""
import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

FRAME_HEIGHT = 300
WALK_COLUMNS = 12
LEFT_PADDING = 96
ARM_OUTLINE = (23, 16, 19, 255)

# (horizontal reach, lift, elbow bend, fist rotation) relative to the guard pose.
PUNCHES = (
    ((0, 0, 0, 0), (-0.14, -3, 18, -4), (0.20, 1, 12, 0), (1, 2, 5, 4),
     (0.91, 3, 6, 3), (0.52, 5, 12, 0), (0.15, 3, 15, -3), (0, 0, 0, 0)),
    ((0, 0, 0, 0), (-0.13, 10, 21, -6), (-0.20, 20, 23, -12), (0.37, 13, 20, -5),
     (0.94, -28, 17, 13), (0.78, -26, 17, 11), (0.26, -12, 14, 3), (0, 0, 0, 0)),
)

ERASER_ARM = dict(
    fist=[(0, 95), (40, 96), (48, 111), (45, 135), (34, 149), (14, 151), (0, 145)],
    erase=[(0, 92), (43, 93), (49, 112), (43, 140), (51, 143), (56, 151), (52, 163),
           (36, 170), (22, 170), (10, 157), (0, 151)],
    shoulder=(53, 151), width=13, colour=(58, 46, 48),
)

ARMS = {
    'red-book': dict(
        fist=[(0, 127), (36, 126), (47, 138), (45, 154), (34, 169), (16, 178), (0, 173)],
        erase=[(0, 125), (38, 124), (50, 138), (47, 163), (57, 161), (60, 168), (55, 183),
               (35, 187), (18, 182), (0, 177)],
        shoulder=(59, 168), width=14, colour=(83, 53, 43),
    ),
    'pencil': dict(
        fist=[(0, 135), (35, 134), (46, 145), (46, 161), (37, 176), (12, 181), (0, 178)],
        erase=[(0, 132), (36, 133), (47, 144), (49, 168), (58, 174), (66, 163), (73, 170),
               (75, 185), (65, 198), (43, 199), (25, 184), (0, 183)],
        shoulder=(69, 171), width=12, colour=(63, 44, 32),
    ),
    'pencil-sharpener': dict(
        fist=[(42, 174), (58, 164), (72, 165), (85, 173), (85, 185), (77, 207),
              (66, 216), (47, 211), (37, 201), (37, 184)],
        erase=[(0, 150), (14, 139), (42, 126), (66, 118), (73, 124), (73, 150), (55, 162),
               (79, 161), (89, 174), (89, 204), (77, 218), (51, 220), (33, 210),
               (29, 186), (6, 177), (0, 166)],
        torso=[(45, 119), (92, 119), (92, 221), (33, 221), (28, 207), (34, 167)],
        shoulder=(60, 139), width=16, colour=(66, 45, 32),
    ),
    'eraser': ERASER_ARM,
    'eraser-baby': dict(
        fist=[(0, 95), (44, 96), (57, 107), (56, 132), (41, 151), (16, 155), (0, 146)],
        erase=[(0, 92), (47, 93), (58, 109), (54, 140), (65, 143), (68, 152), (64, 163),
               (46, 173), (24, 173), (12, 157), (0, 151)],
        shoulder=(66, 150), width=14, colour=(58, 47, 47),
    ),
    'eraser-big': ERASER_ARM,
    'eraser-giant': ERASER_ARM,
    'eraser-boss': dict(
        fist=[(0, 132), (7, 123), (15, 128), (20, 129), (30, 126), (40, 149), (38, 168),
              (27, 182), (10, 186), (0, 179)],
        erase=[(0, 125), (29, 125), (42, 145), (40, 169), (43, 169), (49, 180), (46, 191),
               (31, 198), (18, 198), (12, 185), (0, 182)],
        shoulder=(46, 181), width=13, colour=(58, 42, 48),
    ),
}


def polygon_mask(size, polygon):
    mask = Image.new('L', size)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    return mask


def separate_arm(frame, spec):
    """Lift the illustrated glove and erase its old arm from the guard pose."""
    glove = frame.copy()
    original_alpha = np.asarray(frame.getchannel('A'))
    glove_mask = np.asarray(polygon_mask(frame.size, spec['fist']))
    glove.putalpha(Image.fromarray(np.minimum(original_alpha, glove_mask)))
    bounds = glove.getbbox()
    if not bounds:
        raise ValueError('The selected glove is empty')
    glove = glove.crop(bounds)
    centre = ((bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2)

    pixels = np.array(frame)
    removed = np.array(polygon_mask(frame.size, spec['erase']))
    if 'torso' in spec:
        # Recover the metal casing under the sharpener's overlapping glove.
        torso = np.asarray(polygon_mask(frame.size, spec['torso']))
        refill = (removed & torso) & pixels[:, :, 3]
        pixels[:, :, :3] = cv2.inpaint(pixels[:, :, :3].copy(), refill, 4, cv2.INPAINT_TELEA)
        removed &= ~torso
    pixels[:, :, 3][removed != 0] = 0
    return Image.fromarray(pixels), glove, centre


def stroke_arm(size, shoulder, wrist, bend, spec):
    scale = 3
    arm = Image.new('RGBA', (size[0] * scale, size[1] * scale))
    draw = ImageDraw.Draw(arm)
    elbow = ((shoulder[0] + wrist[0]) / 2 + bend * 0.12,
             (shoulder[1] + wrist[1]) / 2 + bend)
    arc = []
    for i in range(17):
        t = i / 16
        weights = ((1 - t) ** 2, 2 * (1 - t) * t, t ** 2)
        arc.append(tuple(scale * sum(weight * point[axis] for weight, point in zip(weights, (shoulder, elbow, wrist)))
                         for axis in (0, 1)))

    for width, colour in ((spec['width'] + 4, ARM_OUTLINE), (spec['width'], spec['colour'] + (255,))):
        width *= scale
        draw.line(arc, fill=colour, width=width, joint='curve')
        for x, y in (arc[0], arc[-1]):
            r = width / 2
            draw.ellipse((x - r, y - r, x + r, y + r), fill=colour)
    return arm.resize(size, Image.Resampling.LANCZOS)


def make_sheet(frame, spec):
    base, glove, centre = separate_arm(frame, spec)
    size = (frame.width + LEFT_PADDING, frame.height)
    shoulder = (spec['shoulder'][0] + LEFT_PADDING, spec['shoulder'][1])
    reach = min(74, round(frame.width * 0.34))
    frames = len(PUNCHES[0])
    sheet = Image.new('RGBA', (size[0] * frames, size[1] * len(PUNCHES)))
    for row, punch in enumerate(PUNCHES):
        for column, (extension, lift, bend, angle) in enumerate(punch):
            composed = Image.new('RGBA', size)
            if column in (0, frames - 1):
                composed.alpha_composite(frame, (LEFT_PADDING, 0))
            else:
                composed.alpha_composite(base, (LEFT_PADDING, 0))
                fist_x = centre[0] + LEFT_PADDING - extension * reach
                fist_y = centre[1] + lift
                wrist = (fist_x + glove.width * 0.25, fist_y + glove.height * 0.1)
                composed.alpha_composite(stroke_arm(size, shoulder, wrist, bend, spec))
                fist = glove.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
                composed.alpha_composite(fist, (round(fist_x - fist.width / 2), round(fist_y - fist.height / 2)))
            sheet.alpha_composite(composed, (column * size[0], row * size[1]))
    return sheet


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('walk_dir', type=Path)
    parser.add_argument('output_dir', type=Path)
    parser.add_argument('names', nargs='*', metavar='NAME')
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for name in args.names or ARMS:
        if name not in ARMS:
            parser.error(f"Unknown enemy {name!r}")
        with Image.open(args.walk_dir / f'{name}-walk.webp') as source:
            if source.height != 2 * FRAME_HEIGHT or source.width % WALK_COLUMNS:
                raise ValueError(f'Unexpected registered walk sheet for {name}: {source.size}')
            width = source.width // WALK_COLUMNS
            frame = source.crop((0, 0, width, FRAME_HEIGHT)).convert('RGBA')
        sheet = make_sheet(frame, ARMS[name])
        sheet.save(args.output_dir / f'{name}-attack.webp', quality=85, method=4)
        print(f'{name}: 2 punches, 8 poses each, {width + LEFT_PADDING}x{FRAME_HEIGHT}')


if __name__ == '__main__':
    main()
