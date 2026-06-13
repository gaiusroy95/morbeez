# Morbeez brand assets

Source-of-truth files for icons and logos. Generated copies live in app and web folders; do not edit those by hand.

## App launcher icons (Expo / EAS)

| Role | Location |
|------|----------|
| **Source masters** | `brand/app-icons/{farmer,warehouse,agronomist,telecaller}.jpeg` (or `.png`) |
| **Build output** | `apps/<app>/assets/app-icon.png` (1024×1024 PNG, generated) |

Regenerate after changing a master:

```bash
npm run sync:app-icons
```

EAS cloud builds run this automatically via `eas-build-pre-install`.

Requirements for masters: square, at least 1024×1024, sRGB. Expo needs real PNG output (the sync script converts JPEG → PNG).

## Logos (wordmark / header)

| Role | Location |
|------|----------|
| **Recommended source masters** | `brand/logos/` (add `logo.png`, `logo1.png`, etc.) |
| **Shopify theme** | `theme/assets/` via `npm run prepare:logos` |
| **Staff web console** | `frontend/public/` |
| **Mobile in-app header** | `packages/ui-native/assets/` |
| **Warehouse print** | `apps/warehouse/assets/logo.png` |

When you update a logo master, copy or extend `scripts/prepare-logos.py` to fan out to the targets above.

## Do not commit

- JPEG/PNG renamed with wrong extension (e.g. JPEG bytes in a `.png` file)
- One-off exports scattered at repo root — keep masters under `brand/`
