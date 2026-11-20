"""產生 App 圖示 PNG（和 icon.svg 同樣的圖案）。執行：python scripts/make_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
GREEN, CREAM, SAND, CLAY = "#334c3d", "#f4f2eb", "#dfc7a7", "#bf694b"


def draw_icon(size: int, rounded: bool) -> Image.Image:
    ss = 4  # 先畫 4 倍大再縮小，邊緣比較平滑
    big = size * ss
    k = big / 512
    s = lambda v: round(v * k)  # noqa: E731
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=s(112), fill=GREEN)
    else:
        d.rectangle((0, 0, big, big), fill=GREEN)
    d.rounded_rectangle((s(116), s(140), s(396), s(388)), radius=s(36), fill=CREAM)
    d.rounded_rectangle((s(116), s(140), s(396), s(246)), radius=s(36), fill=SAND)
    d.rectangle((s(116), s(210), s(396), s(246)), fill=CREAM)
    for x in (172, 310):
        d.rounded_rectangle((s(x - 5), s(99), s(x + 35), s(181)), radius=s(20), fill=GREEN)
        d.rounded_rectangle((s(x), s(104), s(x + 30), s(176)), radius=s(15), fill=CREAM)
    pts = [(s(192), s(296)), (s(236), s(340)), (s(322), s(248))]
    w = s(34)
    d.line(pts, fill=CLAY, width=w, joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=CLAY)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    draw_icon(192, True).save(ROOT / "icon-192.png")
    draw_icon(512, True).save(ROOT / "icon-512.png")
    # maskable 與 iPhone 圖示要滿版底色，系統會自己裁圓角。
    draw_icon(512, False).save(ROOT / "icon-maskable-512.png")
    draw_icon(180, False).convert("RGB").save(ROOT / "apple-touch-icon.png")
    print("icons written to", ROOT)


if __name__ == "__main__":
    main()
