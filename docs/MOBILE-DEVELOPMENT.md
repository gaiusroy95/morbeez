# Mobile app development

Three focused Expo apps under `apps/` replace the legacy single `mobile/` console mirror.

**See [MOBILE-APPS.md](./MOBILE-APPS.md) for full setup.**

## Quick start

```bash
npm install
cd backend && npm run dev

# In another terminal — pick an app
npm run dev:farmer
npm run dev:warehouse
npm run dev:agronomist
```

Set `EXPO_PUBLIC_API_BASE_URL` in each app's `.env` (use LAN IP on physical devices).

## Layout

```
apps/farmer/       — client: shop + farmer workspace
apps/warehouse/    — pick & pack
apps/agronomist/   — agronomist visits + farmer intelligence
packages/shared/   — API clients, auth, theme tokens
packages/ui-native/ — shared RN UI components
```

The web staff console remains in `frontend/` (Vercel).
