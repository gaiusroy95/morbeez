# Morbeez Operations Console

Enterprise-style **agriculture commerce control center** — products, farmers, orders, and extended product intelligence (agri + AI + SEO). The React app lives in **`frontend/`** and deploys separately (e.g. Vercel at `/`). The API remains on Render at **`/morbeez-staff/api/v1`**.

> **Do not use `/admin` in the storefront URL.** Shopify redirects paths containing “admin” to Shopify Admin.

## URLs

| Environment | Console UI | API |
|-------------|------------|-----|
| Production | Vercel (`CONSOLE_PUBLIC_URL`) | `https://morbeez-api.onrender.com/morbeez-staff/api/v1` |
| Local | `http://localhost:5173/` | `http://localhost:3000` (Vite proxies `/morbeez-staff/api`) |

## Modules

| Module | Status | Description |
|--------|--------|-------------|
| **Dashboard** | Live | KPIs, recent orders/farmers, low stock, roadmap |
| **Products** | Live | Full Shopify catalog, pagination, images |
| **Product intelligence** | Live | Tabs: Basic, Agriculture, AI mapping, SEO, Cross-sell (Supabase) |
| **Low stock** | Live | Products with ≤10 units |
| **Orders** | Live | Razorpay checkout sessions + Shopify `commerce_orders` |
| **Farmer CRM** | Live | Search, edit profiles |
| **Staff** | Live | List admin users (admin role only) |
| **Settings** | Live | Integrations overview |
| Offers, Combos, Flash sales | Live | Registry in Supabase (not auto-applied on Shopify yet) |
| Orders (dispatch detail) | Live | List + detail drawer with timeline & tracking |
| Logistics (Shiprocket) | Live | Pending queue, retry shipment, tracking events |
| Banners | Live | Scheduled storefront banner registry (theme sync follow-up) |
| AI advisory rules | Planned | Symptom/crop logic panel |
| WhatsApp campaigns | Planned | Uses existing backend webhooks |
| Content CMS, Analytics | Planned | |

## Setup

### 1. Migrations

```powershell
supabase db push
```

Includes: `admin_users`, `checkout_sessions`, `product_intelligence`.

### 2. Environment

```env
ADMIN_JWT_SECRET=<openssl rand -hex 32>
SHOPIFY_ADMIN_API_ACCESS_TOKEN=<write_products, read_products, write_orders>
```

### 3. Staff account

```powershell
npm run admin:create-user -- --email admin@morbeez.in --password "YourSecurePass123" --name "Store Admin" --role admin
```

### 4. Run locally

```powershell
cd backend && npm run dev
cd frontend && npm run dev
```

Open **http://localhost:5173/** (see `frontend/README.md`).

## Product import / intelligence columns

Extended fields from your master import sheet are stored in **`product_intelligence`** (JSONB per section), edited under **Edit product** tabs:

- **Basic** — HSN, GST, barcode, manufacturer, short description  
- **Agriculture** — active ingredient, pests, crops, dose, PHI, compatibility  
- **AI mapping** — symptoms, keywords, severity, SPAD, weather, priority  
- **SEO & content** — meta, benefits, usage/safety copy  
- **Cross-sell** — tank mix, combos, rotation, adjuvants  

Shopify fields (title, price, SKU, tags, HTML description, images) remain on the **Shopify & pricing** tab.

Future: CSV import script → `product_intelligence` + Shopify Admin API.

## API (staff JWT)

| Method | Path |
|--------|------|
| POST | `/morbeez-staff/api/v1/auth/login` |
| GET | `/morbeez-staff/api/v1/auth/me` |
| GET | `/morbeez-staff/api/v1/dashboard` |
| GET | `/morbeez-staff/api/v1/stats` |
| GET/POST/PUT | `/morbeez-staff/api/v1/products` … |
| GET/PUT | `/morbeez-staff/api/v1/products/:id/intelligence` |
| GET | `/morbeez-staff/api/v1/orders` |
| GET/PATCH | `/morbeez-staff/api/v1/farmers` … |
| GET | `/morbeez-staff/api/v1/staff` (admin only) |

## Roles

| Role | Access |
|------|--------|
| `admin` | Full + staff list |
| `manager` | Products, farmers, orders, intelligence |
| `viewer` | Read-only (enforce in API — coming soon) |

## Frontend stack (unchanged)

- Static HTML + **ES modules** (`admin/js/app.js`)
- CSS (`admin/css/admin.css`)
- No Next.js — same deployment as API static files

## Deploy

Redeploy Render after backend + migration updates. Console assets live in repo `admin/` folder.
