# Mobile app development (parallel to web console)

The **production staff console** stays in `frontend/` and deploys to Vercel. The **Expo app** in `mobile/` is developed independently and shares only the backend API.

## Repository layout

```
india(kata)/
├── backend/          # Fastify API (Render) — shared by web + mobile
├── frontend/         # Web SPA (Vercel) — keep deploying as today
└── mobile/           # Expo React Native — new, optional dev workflow
```

No changes to `frontend/` are required for mobile work. Avoid breaking shared API contracts without coordinating both clients.

## Daily workflow

| Task | Command |
|------|---------|
| Web console (local) | `npm run dev:console` or `cd frontend && npm run dev` |
| Mobile (local) | `npm run dev:mobile` or `cd mobile && npm start` |
| API | `cd backend && npm run dev` |

You can run **web + mobile + API** at the same time on different ports (5173 web, Expo Metro ~8081, API 3000).

## Deployment

- **Web:** Unchanged — Vercel project root `frontend`, `VITE_API_BASE_URL` → Render API.
- **Mobile:** Not deployed from this repo yet. Use [EAS Build](https://docs.expo.dev/build/introduction/) when ready; set `EXPO_PUBLIC_API_BASE_URL` in EAS secrets.

## Sharing code (future)

When modules are ported, extract shared logic into `packages/shared/` (API types, formatters, validators). The web app can adopt that package later without blocking mobile.

## Backend notes for mobile

- Native apps are **not subject to browser CORS** — no backend change needed for API calls.
- JWT auth is identical: `Authorization: Bearer` from SecureStore (mobile) vs `localStorage` (web).
- Optional: add mobile deep-link URLs to invite/reset-password flows when those screens are built.
