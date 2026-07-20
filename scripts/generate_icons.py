from pathlib import Path
from PIL import Image, ImageDraw


def make(size: int, path: Path) -> None:
    scale = size / 512
    image = Image.new("RGB", (size, size), "#030914")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(114 * scale), fill="#07111f")
    draw.rounded_rectangle(tuple(int(v * scale) for v in (42, 42, 470, 470)), radius=int(88 * scale), outline="#554a35", width=max(2, int(4 * scale)))
    width = max(12, int(36 * scale))
    for x, top, bottom in ((148, 144, 368), (256, 110, 402), (364, 162, 350)):
        x, top, bottom = int(x * scale), int(top * scale), int(bottom * scale)
        draw.line((x, top, x, bottom), fill="#e2c375", width=width)
        r = width // 2
        draw.ellipse((x-r, top-r, x+r, top+r), fill="#e2c375")
        draw.ellipse((x-r, bottom-r, x+r, bottom+r), fill="#e2c375")
    draw.line(tuple(int(v * scale) for v in (118, 256, 394, 256)), fill="#344154", width=max(2, int(4 * scale)))
    image.save(path, "PNG", optimize=True)


if __name__ == "__main__":
    public = Path(__file__).resolve().parent.parent / "public"
    make(192, public / "icon-192.png")
    make(512, public / "icon-512.png")
