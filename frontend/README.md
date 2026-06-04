# Morbeez staff console (`@morbeez/console`)

React SPA for operations, telecaller CRM, agronomist review, and commerce admin.

## Architecture

| Layer | Location |
|-------|----------|
| **UI** | This folder — deploy to [Vercel](https://vercel.com) (or any static host) |
| **API** | `../backend` — Fastify on Render; routes stay at `/morbeez-staff/api/v1` |

The browser talks to the API using `VITE_API_BASE_URL` in production. Local dev uses a Vite proxy so you can leave `VITE_API_BASE_URL` empty.

## Local development

```bash
# Terminal 1 — API
cd backend
cp .env.example .env   # if needed
npm install
npm run dev            # default http://localhost:3000 (backend PORT)

# Terminal 2 — console
cd frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:5173
```

Open **http://localhost:5173/** (dashboard, login, etc. at `/`, not `/morbeez-staff`).

Set in `backend/.env`:

```env
CONSOLE_PUBLIC_URL=http://localhost:5173
ADMIN_UI_ORIGIN=http://localhost:5173
```

## Deploy on Vercel

1. **Root directory:** `frontend`
2. **Build command:** `npm run build`
3. **Output directory:** `dist`
4. **Environment variables:**
   - `VITE_API_BASE_URL` = your Render API URL (e.g. `https://morbeez-api.onrender.com`)
5. On Render, set:
   - `CONSOLE_PUBLIC_URL` = your Vercel URL (e.g. `https://staff.morbeez.in`)
   - `ADMIN_UI_ORIGIN` = same origin (comma-separated if you have preview URLs)

`vercel.json` rewrites all routes to `index.html` for client-side routing.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server + API proxy |
| `npm run build` | Production bundle in `dist/` |
| `npm run preview` | Preview production build locally |
