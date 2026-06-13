#!/usr/bin/env python3
"""Convert brand/app-icons/{app} masters into apps/{app}/assets/app-icon.png (1024×1024 PNG)."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install Pillow")

ROOT = Path(__file__).resolve().parents[1]
ICONS_DIR = ROOT / "brand" / "app-icons"
APPS = ("farmer", "warehouse", "agronomist", "telecaller")
EXTENSIONS = (".jpeg", ".jpg", ".png", ".webp")
SIZE = 1024


def resolve_source(app: str) -> Path:
    for ext in EXTENSIONS:
        candidate = ICONS_DIR / f"{app}{ext}"
        if candidate.is_file():
            return candidate
    raise SystemExit(f"Missing source for {app} in {ICONS_DIR}")


def main() -> None:
    if not ICONS_DIR.is_dir():
        raise SystemExit(f"Missing icon directory: {ICONS_DIR}")

    for app in APPS:
        source = resolve_source(app)
        img = Image.open(source).convert("RGBA")
        if img.size != (SIZE, SIZE):
            img = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

        dest_dir = ROOT / "apps" / app / "assets"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "app-icon.png"
        img.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest.relative_to(ROOT)} ← {source.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
