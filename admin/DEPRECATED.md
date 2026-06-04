# Legacy admin UI — deprecated

The vanilla JS console under `admin/js/` is **deprecated** as of Phase 8.

## Use instead

| Old | New |
|-----|-----|
| `/console/` (legacy HTML/JS) | Staff console React app (`frontend/`) |
| Field visits (manual CRM only) | `/field/` — Field PWA (`backend/field-pwa/`) |

## Build & run

**API** (Render):

```bash
cd backend
npm run build    # API + field-pwa only
npm start
```

**Staff console** (Vercel or local):

```bash
cd frontend
npm run dev      # http://localhost:5173
```

The API **does not** serve the React console build. Set `CONSOLE_PUBLIC_URL` and `ADMIN_UI_ORIGIN` to your frontend deployment.

## APIs unchanged

Staff REST routes remain at `/morbeez-staff/api/v1/*`.

## This folder

Kept for reference and git history. Do not extend `admin/js` for new features.
