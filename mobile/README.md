# Morbeez Staff — Expo mobile app

Native React Native (Expo) client that mirrors the **web console** in `../frontend`: same auth, routes, module permissions, sidebar navigation, and API calls.

## Coexistence with the web app

| App | Folder | Deploy |
|-----|--------|--------|
| **Web console** (production) | `frontend/` | Vercel — **unchanged** |
| **Mobile** | `mobile/` | EAS Build / app stores (later) |

Both call **`/morbeez-staff/api/v1`** on the Render API.

## Architecture (matches `frontend/`)

| Web (`frontend/src/`) | Mobile (`mobile/`) |
|-----------------------|-------------------|
| `lib/routes.ts`, `console-nav.ts`, `role-home.ts` | Same files under `lib/` |
| `context/AuthContext.tsx` | `context/AuthContext.tsx` (SecureStore token) |
| `router/index.tsx` + `ProtectedPage` | `app/(app)/*.tsx` + `ProtectedScreen` |
| `components/Layout.tsx` + `SidebarNav` | Drawer (`AppDrawerContent`) + `ConsoleScreenLayout` |
| `pages/*.tsx` | `pages/*.tsx` (native UI, same APIs) |

After login, users land on their **role home** (telecaller → CRM, operations → Operations, etc.) — same as web.

## Local development

```bash
# Terminal 1 — API
cd backend
npm run dev

# Terminal 2 — mobile
cd mobile
cp .env.example .env
npm install
npm start
```

Press `a` (Android), `i` (iOS), or scan with Expo Go.

### Environment

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000
```

On a physical phone, use your computer's LAN IP (not `localhost`).

## Modules

All console modules are wired with native screens:

- Dashboard, Telecaller CRM, Operations, Intelligence, Opportunity, Product Gaps
- Agronomist, Approvals, Analytics, Commerce, Employees, Settings

Complex web-only flows (full product wizard, escalation modals, charts) show core data on mobile; advanced editing can be expanded screen-by-screen.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run android` | Open on Android |
| `npm run ios` | Open on iOS (macOS) |

From repo root: `npm run dev:mobile`
