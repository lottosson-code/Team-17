"""Shrink source art into game-ready WebP files.

Usage:
    python scripts/optimize-art.py SOURCE_DIR OUTPUT_DIR [--height 320] [--quality 85] [--no-trim]

For every PNG/JPG/WebP in SOURCE_DIR (not recursive):
  * trims fully transparent edges, so a character's feet sit on the bottom edge
    (the game anchors enemies at their feet),
  * scales it so it is at most --height pixels tall (never enlarges),
  * saves OUTPUT_DIR/<name>.webp, keeping transparency.

Requires Pillow:  pip install pillow
"""
import argparse
import sys
from pathlib import Path

from PIL import Image

EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}


def optimize(source: Path, output: Path, height: int, quality: int, trim: bool) -> None:
    image = Image.open(source)
    image = image.convert('RGBA') if image.mode in ('RGBA', 'LA', 'P') else image.convert('RGB')
    if trim and image.mode == 'RGBA':
        box = image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
        if box:
            image = image.crop(box)
    if image.height > height:
        width = round(image.width * height / image.height)
        image = image.resize((width, height), Image.LANCZOS)
    image.save(output, 'WEBP', quality=quality, method=6)
    before = source.stat().st_size / 1024
    after = output.stat().st_size / 1024
    print(f'{source.name:28} {before:8.0f} KB -> {after:5.0f} KB  {image.width}x{image.height}')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--height', type=int, default=320, help='maximum height in pixels (default 320)')
    parser.add_argument('--quality', type=int, default=85, help='WebP quality 0-100 (default 85)')
    parser.add_argument('--no-trim', action='store_true', help='keep transparent edges (e.g. for backgrounds)')
    args = parser.parse_args()

    files = sorted(p for p in args.source.iterdir() if p.suffix.lower() in EXTENSIONS)
    if not files:
        print(f'No images found in {args.source}', file=sys.stderr)
        return 1
    args.output.mkdir(parents=True, exist_ok=True)
    for path in files:
        optimize(path, args.output / f'{path.stem}.webp', args.height, args.quality, not args.no_trim)
    return 0


if __name__ == '__main__':
    sys.exit(main())
