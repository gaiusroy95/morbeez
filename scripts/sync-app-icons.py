#!/usr/bin/env python3
"""Copy repo-root AppIcon.jpeg into each Expo app as assets/app-icon.png (1024×1024)."""
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow: pip install Pillow")

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "AppIcon.jpeg"
APPS = ("farmer", "warehouse", "agronomist", "telecaller")
SIZE = 1024


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source icon: {SOURCE}")

    img = Image.open(SOURCE).convert("RGBA")
    if img.size != (SIZE, SIZE):
        img = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)

    for app in APPS:
        dest_dir = ROOT / "apps" / app / "assets"
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / "app-icon.png"
        img.save(dest, format="PNG", optimize=True)
        print(f"Wrote {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
