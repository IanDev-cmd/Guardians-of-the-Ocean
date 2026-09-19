"""Generate WebP (+ small WebP) siblings beside each JPEG under assets/images."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "assets" / "images"
PREVIEW = ROOT / "assets" / "3d" / "earth-preview.webp"


def export_webp(src: Path, dest: Path, max_w=None, quality=78):
    im = Image.open(src).convert("RGB")
    if max_w and im.width > max_w:
        h = int(im.height * (max_w / im.width))
        im = im.resize((max_w, h), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=quality, method=6)


def earth_preview(path: Path, size=256):
    im = Image.new("RGB", (size, size), (6, 40, 78))
    d = ImageDraw.Draw(im)
    d.ellipse((8, 8, size - 8, size - 8), fill=(18, 92, 150))
    d.ellipse((40, 28, 110, 88), fill=(34, 122, 72))
    d.ellipse((120, 90, 200, 150), fill=(46, 140, 82))
    d.ellipse((70, 150, 130, 210), fill=(28, 108, 64))
    d.ellipse((20, 30, 90, 70), fill=(210, 230, 240))
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=72, method=6)


def main():
    n = 0
    for jpg in IMG.rglob("*.jpg"):
        export_webp(jpg, jpg.with_suffix(".webp"), max_w=960, quality=76)
        export_webp(jpg, jpg.with_name(jpg.stem + "-sm.webp"), max_w=480, quality=70)
        n += 1
        print(jpg.relative_to(ROOT))
    earth_preview(PREVIEW)
    print("converted", n, "jpegs + preview")


if __name__ == "__main__":
    main()
