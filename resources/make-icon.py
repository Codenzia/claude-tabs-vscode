"""Generate a 128x128 marketplace icon for Claude Tabs.
Run: python resources/make-icon.py
"""
from PIL import Image, ImageDraw
from pathlib import Path

SIZE = 128
BG = (24, 28, 36, 255)           # dark slate (sits well in marketplace listings)
ACCENT = (255, 137, 76, 255)     # warm Codenzia orange
LINE = (236, 240, 245, 255)      # light tab-title strokes


def main() -> None:
    img = Image.new("RGBA", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(img)

    # Rounded background square (we just use the full square; marketplace masks it as needed)
    # Bookmark outline: trapezoid-ish ribbon with a notched bottom (classic bookmark glyph)
    bx, by = 28, 16
    bw, bh = 72, 96
    notch_h = 18

    bookmark = [
        (bx, by),
        (bx + bw, by),
        (bx + bw, by + bh),
        (bx + bw // 2, by + bh - notch_h),
        (bx, by + bh),
    ]
    draw.polygon(bookmark, fill=ACCENT)

    # "Tab title" lines inside the bookmark — represent saved conversations
    line_x1 = bx + 12
    line_x2 = bx + bw - 12
    for i, y in enumerate(range(by + 22, by + bh - notch_h - 10, 14)):
        x2 = line_x2 - (0 if i % 2 == 0 else 14)
        draw.rounded_rectangle((line_x1, y, x2, y + 5), radius=2, fill=LINE)

    out = Path(__file__).parent / "icon-marketplace.png"
    img.save(out, "PNG")
    print(f"wrote {out} ({SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
