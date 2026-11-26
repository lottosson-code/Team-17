"""Turn a generated animation sheet into a clean, game-ready Phaser spritesheet.

Usage:
    python scripts/make-spritesheet.py SOURCE.png OUTPUT.webp --cols 4 --rows 3 [--height 300]
        [--out-cols N] [--solid]

SOURCE is a grid of equally sized frames (left to right, top to bottom). The script:
  * removes leftover background baked into AI-generated art: the white "sticker" fringe,
    white patches and the opaque grey floor shadow. Only light, colourless pixels that are
    connected to the transparent outside are removed, so eyes, teeth and highlights enclosed
    by the dark outline are kept. Use --keep-background to skip this.
  * crops every frame with the same box (the union of all frames), so the character stays
    registered and doesn't jitter between frames; the bottom of the box is the lowest foot,
  * scales frames to --height pixels tall and packs them in one row (or --out-cols per row, to keep
    a long animation inside the 4096 px texture limit of some GPUs),
  * with --solid, drops nearly invisible pixels (stray colours left by background removal) and
    makes nearly opaque ones fully opaque,
  * prints the frame size to use with this.load.spritesheet().

Requires Pillow and numpy:  pip install pillow numpy
"""
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def remove_background(frame: np.ndarray) -> np.ndarray:
    """Clears light, colourless pixels reachable from the transparent outside (RGBA uint8 array)."""
    rgb = frame[..., :3].astype(np.int16)
    alpha = frame[..., 3]
    high = rgb.max(axis=2)
    low = rgb.min(axis=2)
    # "Background-like": light enough (shadow grey up to white) and nearly colourless.
    neutral = (high >= 95) & ((high - low) <= 0.14 * high + 6)
    passable = (alpha <= 8) | neutral
    # Grow the region from the transparent border inward, through passable pixels only.
    reached = np.zeros_like(passable)
    reached[0, :] = passable[0, :]
    reached[-1, :] = passable[-1, :]
    reached[:, 0] = passable[:, 0]
    reached[:, -1] = passable[:, -1]
    while True:
        grown = reached.copy()
        grown[1:, :] |= reached[:-1, :]
        grown[:-1, :] |= reached[1:, :]
        grown[:, 1:] |= reached[:, :-1]
        grown[:, :-1] |= reached[:, 1:]
        grown &= passable
        if np.array_equal(grown, reached):
            break
        reached = grown
    cleaned = frame.copy()
    cleaned[reached, 3] = 0
    # Soften the new edge: pixels touching removed ones become half transparent.
    edge = np.zeros_like(reached)
    edge[1:, :] |= reached[:-1, :]
    edge[:-1, :] |= reached[1:, :]
    edge[:, 1:] |= reached[:, :-1]
    edge[:, :-1] |= reached[:, 1:]
    edge &= ~reached
    cleaned[edge, 3] = (cleaned[edge, 3].astype(np.uint16) * 2 // 3).astype(np.uint8)
    return cleaned


def solidify(frame: np.ndarray) -> np.ndarray:
    """Clears pixels that are almost invisible and makes almost opaque ones opaque (RGBA uint8 array)."""
    cleaned = frame.copy()
    alpha = cleaned[..., 3]
    cleaned[alpha <= 10] = 0
    alpha[alpha >= 240] = 255
    return cleaned


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--cols', type=int, required=True)
    parser.add_argument('--rows', type=int, required=True)
    parser.add_argument('--height', type=int, default=300, help='frame height in pixels (default 300)')
    parser.add_argument('--quality', type=int, default=88)
    parser.add_argument('--keep-background', action='store_true')
    parser.add_argument('--out-cols', type=int, default=0, help='frames per row in the output (default: all in one row)')
    parser.add_argument('--solid', action='store_true', help='clean up almost-transparent and almost-opaque alpha')
    args = parser.parse_args()

    sheet = Image.open(args.source).convert('RGBA')
    cell_w, cell_h = sheet.width // args.cols, sheet.height // args.rows
    frames = []
    for r in range(args.rows):
        for c in range(args.cols):
            frame = np.array(sheet.crop((c * cell_w, r * cell_h, (c + 1) * cell_w, (r + 1) * cell_h)))
            frame = frame if args.keep_background else remove_background(frame)
            frames.append(solidify(frame) if args.solid else frame)

    # One crop box for every frame, so they stay aligned.
    boxes = [Image.fromarray(f).getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    left = min(b[0] for b in boxes)
    top = min(b[1] for b in boxes)
    right = max(b[2] for b in boxes)
    bottom = max(b[3] for b in boxes)
    scale = min(1.0, args.height / (bottom - top))
    frame_w = round((right - left) * scale)
    frame_h = round((bottom - top) * scale)

    out_cols = args.out_cols or len(frames)
    out_rows = -(-len(frames) // out_cols)
    out = Image.new('RGBA', (frame_w * out_cols, frame_h * out_rows), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        img = Image.fromarray(f).crop((left, top, right, bottom)).resize((frame_w, frame_h), Image.LANCZOS)
        out.alpha_composite(img, ((i % out_cols) * frame_w, (i // out_cols) * frame_h))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    out.save(args.output, 'WEBP', quality=args.quality, method=6)

    kb = args.output.stat().st_size / 1024
    print(f'{len(frames)} frames ({out_cols} per row), frameWidth {frame_w}, frameHeight {frame_h}, {kb:.0f} KB -> {args.output}')
    print(f'source crop box: left {left}, top {top}, scale {scale:.4f} (frame px = (cell px - left/top) * scale)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
