# Morbeez API (`@morbeez/api`)

Production operational backend for M2: Shopify · Razorpay · Shiprocket · WhatsApp · Supabase.

The **staff console UI** lives in [`../frontend`](../frontend) and deploys separately (e.g. Vercel). This service exposes APIs at `/morbeez-staff/api/v1` and still serves the **field PWA** at `/field/` when built.

## Quick start

```bash
cd backend
cp .env.example .env
# Fill all required vars
npm install
npm run dev
```

For the console UI, see [`../frontend/README.md`](../frontend/README.md).

## Deploy on Render

| Setting | Value |
|---------|--------|
| **Root directory** | `backend` |
| **Build command** | `npm install && npm run build` |
| **Start command** | `npm start` |

Set **`NPM_CONFIG_PRODUCTION=false`** (or use `backend/render.yaml`) so field-pwa devDependencies install during build.

**Environment (staff console on Vercel):**

```env
CONSOLE_PUBLIC_URL=https://your-staff-app.vercel.app
ADMIN_UI_ORIGIN=https://your-staff-app.vercel.app
```

Health: `GET http://localhost:10000/health`

## API folder structure

```
backend/src/
├── index.ts                 # Entry
├── app.ts                   # Fastify bootstrap
├── config/env.ts            # Zod-validated env
├── lib/                     # Logger, Supabase, errors
├── middleware/              # Webhook verify, idempotency
├── events/                  # Event bus + outbox
├── routes/
│   ├── health.ts
│   ├── webhooks/            # Shopify, Razorpay, Shiprocket, WhatsApp
│   └── api/                 # Farmers, leads, payments (x-api-key)
└── services/
    ├── shopify/
    ├── razorpay/
    ├── shiprocket/
    ├── whatsapp/providers/  # cloud | wati adapters
    ├── farmer/
    └── crm/
```

## Authenticated API routes

Header: `x-api-key: <INTERNAL_API_KEY>`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/farmers` | Upsert farmer profile |
| GET | `/api/v1/farmers/:id` | Get farmer + crops |
| POST | `/api/v1/farmers/:id/crops` | Add crop |
| POST | `/api/v1/leads` | Create lead / quotation / callback |
| GET | `/api/v1/leads?status=new` | List leads (telecaller) |
| POST | `/api/v1/payments/link` | Razorpay payment link |

## Webhook endpoints

| Path | Provider |
|------|----------|
| `POST /webhooks/shopify` | Shopify (HMAC) |
| `POST /webhooks/razorpay` | Razorpay (signature) |
| `POST /webhooks/tracking` | Shiprocket tracking (use this in Shiprocket dashboard) |
| `GET/POST /webhooks/whatsapp` | Meta Cloud API |

## Deploy (Railway)

See [`../docs/m2/08-railway-deployment.md`](../docs/m2/08-railway-deployment.md).

## Database

Apply migration:

```bash
supabase db push
# or run supabase/migrations/20260523000000_m2_foundation.sql in SQL editor
```
