# Morbeez

**Agriculture commerce, advisory, and operations — one platform.**

Morbeez connects Indian farmers to bio-inputs and expert guidance through a Shopify storefront, a Node.js operations API, five mobile field apps, a staff web console, and an AI crop advisory pipeline. From catalog browse and Razorpay checkout to warehouse pick/pack, agronomist field visits, WhatsApp follow-up, and training-data export — the stack is built for real farm operations, not a demo storefront.

---

## Platform overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Surfaces                                                               │
│  Shopify theme · Farmer app · Staff console · 4 field/staff mobile apps │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│  Backend API (Fastify)                                                  │
│  Commerce · CRM · WMS/OMS · WhatsApp · AI Crop Doctor · Automation    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────┐
│  Supabase (PostgreSQL) + external services                              │
│  Shopify · Razorpay · Shiprocket · Meta WhatsApp · OpenAI · Plant.id    │
└─────────────────────────────────────────────────────────────────────────┘
```

| Layer | What it does |
|-------|----------------|
| **Storefront** | Online Store 2.0 theme — crop taxonomy, dealer enquiry, Crop Doctor form, multilingual foundation |
| **Commerce ops** | Razorpay checkout, order webhooks, Shiprocket logistics, GST invoicing, COD reconciliation |
| **Warehouse (WMS/OMS)** | Batch stock, FEFO pick lists, barcode pack verify, dispatch, label batches |
| **Farmer CRM** | Profiles, blocks, soil reports, ROI cycles, call log, WhatsApp history, opportunity scores |
| **AI advisory** | GPT-4o Vision + Plant.id, confidence scoring, visit wizard, Q&A, rec groups, training export |
| **Field workforce** | Agronomist visits, partner program, telecaller CRM, route planning, callbacks |
| **Automation** | Event outbox, follow-up jobs, monitoring plans, escalation, nightly intelligence recalc |

---

## Mobile & web apps

Five Expo apps and one React staff console share `packages/shared` and `packages/ui-native`.

| App | Path | Command | Role |
|-----|------|---------|------|
| **Farmer** | `apps/farmer` | `npm run dev:farmer` | Shop, AI scan, fields, ROI, recommendations |
| **Pick & Pack** | `apps/warehouse` | `npm run dev:warehouse` | Picking, packing, dispatch, barcode workflows |
| **Agronomist** | `apps/agronomist` | `npm run dev:agronomist` | Field visits, AI advisory wizard, farmer workspace |
| **Telecaller** | `apps/telecaller` | `npm run dev:telecaller` | CRM calls, leads, farmer intelligence panel |
| **Partner** | `apps/partner` | `npm run dev:partner` | Farmer enrollment, assisted field visits |
| **Staff console** | `frontend/` | `npm run dev:console` | Products, orders, CRM, partners, logistics |

Full app specs, API maps, and smoke checklists: [`docs/MOBILE-APPS.md`](docs/MOBILE-APPS.md)

---

## Feature highlights

### Commerce & catalog
- **307-SKU agriculture catalog** with SEO, crop tags, and AI recommendation metadata — [`docs/MORBEEZ-PRODUCT-CATALOG.md`](docs/MORBEEZ-PRODUCT-CATALOG.md)
- Shopify theme with homepage sections, collection architecture, metafields, multilingual hooks
- Razorpay checkout sessions, offers/combos registry, dealer enquiry via App Proxy

### Warehouse & fulfillment
- End-to-end **WMS + OMS**: reserve → pick → pack → invoice → AWB → NDR/RTO — [`docs/WMS-OMS.md`](docs/WMS-OMS.md)
- Role-based warehouse mobile app (picker, packer, dispatcher, manager)
- Shiprocket integration, manual courier (LR), in-app document print viewer

### AI Crop Doctor & visit advisory
- WhatsApp + theme + mobile **AI diagnosis** (GPT-4o Vision, Plant.id, Whisper voice)
- **12-step visit advisory wizard** — photos QC, soil/weather, AI analysis, Q&A, editable diagnosis, rec planning, compatibility check, expert review, monitoring plan — [`docs/ai-training/VISIT-ADVISORY-WORKFLOW.md`](docs/ai-training/VISIT-ADVISORY-WORKFLOW.md)
- Confidence lifecycle, agronomist correction spine, training export bundle
- Ginger advisory QA samples on farmer `+916282873542` — [`docs/ai-training/GINGER-ADVISORY-SAMPLES.md`](docs/ai-training/GINGER-ADVISORY-SAMPLES.md)

### Farmer intelligence
- Block & crop cycle management, expense/income **ROI v1** — [`docs/FARMER-ROI.md`](docs/FARMER-ROI.md)
- Market analytics, weather alerts, recommendation history
- **Opportunity scoring** — engagement, trust, retention, acre potential — [`docs/opportunity-intelligence/COMPLETE-PROCESS-FLOW.md`](docs/opportunity-intelligence/COMPLETE-PROCESS-FLOW.md)

### CRM & workforce
- Telecaller CRM with call intelligence, lead allocation, callbacks
- Agronomist dashboard, route planner, farmer workspace (9 tabs)
- **Partner program** — enrollment, ownership model, draft visits pending expert review — [`docs/partner-program/README.md`](docs/partner-program/README.md)
- Staff RBAC console — [`docs/RBAC-CONSOLE.md`](docs/RBAC-CONSOLE.md) · [`docs/ADMIN-PORTAL.md`](docs/ADMIN-PORTAL.md)

### Messaging & automation
- WhatsApp Cloud API + Interakt + WATI providers, OTP login, regional terminology
- Event outbox, recommendation follow-up, visit escalation callbacks
- Broadcast module, operations messaging roles

---

## Repository layout

| Path | Purpose |
|------|---------|
| [`theme/`](theme/) | Shopify Online Store 2.0 theme (Liquid + Tailwind) |
| [`backend/`](backend/) | Fastify API — commerce, CRM, warehouse, AI, WhatsApp, automation |
| [`frontend/`](frontend/) | Staff operations console (Vite + React) |
| [`apps/`](apps/) | Expo mobile apps (farmer, warehouse, agronomist, telecaller, partner) |
| [`packages/shared/`](packages/shared/) | Shared types, API clients, visit wizard logic |
| [`packages/ui-native/`](packages/ui-native/) | Shared React Native UI components |
| [`supabase/migrations/`](supabase/migrations/) | PostgreSQL schema (100+ migrations) |
| [`config/`](config/) | Product master catalog CSV, Shopify import exports |
| [`docs/`](docs/) | Architecture, setup guides, AI training, milestone specs |
| [`scripts/`](scripts/) | Catalog generation, admin user creation, CRM seed, theme setup |

---

## Getting started

### Prerequisites

- Node.js 20+
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (for theme work)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for database migrations)
- Expo Go or dev build (for mobile apps)

### Install

```bash
git clone <repo-url>
cd morbeez-shopify
npm install
npm run install:apps
```

### Database

```bash
supabase db push
```

### Backend API

```bash
cd backend
cp .env.example .env   # fill Shopify, Supabase, Razorpay, WhatsApp, OpenAI keys
npm install
npm run dev            # http://localhost:3000
```

### Staff console

```bash
npm run dev:console    # http://localhost:5173
npm run admin:create-user -- --email admin@morbeez.in --password "..." --name "Admin" --role admin
```

### Mobile app (example: agronomist)

```bash
cp apps/agronomist/.env.example apps/agronomist/.env
# set EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000
npm run dev:agronomist
```

### Shopify theme

```bash
npm run build:css
npm run theme:dev        # local preview
npm run theme:push       # upload to dev theme
```

Store setup checklist: [`docs/CLIENT-SETUP-CHECKLIST.md`](docs/CLIENT-SETUP-CHECKLIST.md)

---

## Milestones

| Phase | Scope | Status | Docs |
|-------|-------|--------|------|
| **M1** | Shopify theme, taxonomy, SEO, multilingual foundation | Complete | [`docs/M1-COMPLETION.md`](docs/M1-COMPLETION.md) |
| **M2** | Backend API, Razorpay, WhatsApp, CRM, webhooks | Code complete | [`docs/m2/M2-COMPLETION.md`](docs/m2/M2-COMPLETION.md) |
| **M3** | AI Crop Doctor, vision pipeline, confidence scoring | Code complete | [`docs/m3/M3-COMPLETION.md`](docs/m3/M3-COMPLETION.md) |
| **Post-M3** | Mobile apps, WMS, visit advisory, partner program, opportunity intelligence | Active | [`docs/MOBILE-APPS.md`](docs/MOBILE-APPS.md) |

---

## Documentation

### Start here
- [Client setup checklist](docs/CLIENT-SETUP-CHECKLIST.md) — products, menus, pages, theme deploy
- [Mobile apps guide](docs/MOBILE-APPS.md) — all five apps, APIs, EAS builds
- [Admin / staff console](docs/ADMIN-PORTAL.md) — modules, env, deployment
- [AI training test guide](docs/ai-training/CLIENT-AI-TRAINING-TEST-GUIDE.md) — client-facing QA handout

### Commerce & ops
- [M2 master plan](docs/m2/PHASE1-M2-MASTER-PLAN.md) · [Backend architecture](docs/m2/01-backend-architecture.md)
- [Razorpay](docs/m2/03-razorpay.md) · [Shipping](docs/m2/04-shipping.md) · [WhatsApp](docs/m2/05-whatsapp.md)
- [WMS + OMS](docs/WMS-OMS.md) · [Product catalog](docs/MORBEEZ-PRODUCT-CATALOG.md)

### AI & advisory
- [Visit advisory workflow](docs/ai-training/VISIT-ADVISORY-WORKFLOW.md)
- [M3 AI architecture](docs/m3/01-ai-backend-architecture.md) · [Prompt engineering](docs/m3/11-prompt-engineering.md)
- [AI training stages](docs/ai-training/README.md) (internal engineering docs)

### CRM & intelligence
- [Farmer ROI](docs/FARMER-ROI.md) · [Opportunity intelligence](docs/opportunity-intelligence/COMPLETE-PROCESS-FLOW.md)
- [Partner program](docs/partner-program/README.md) · [Telecaller mobile](docs/telecaller-mobile/README.md)
- [RBAC console](docs/RBAC-CONSOLE.md) · [Marketing attribution](docs/marketing-attribution.md)

### Theme (M1)
- [M1 store setup](docs/M1-STORE-SETUP.md) · [Theme architecture](docs/01-theme-architecture.md)
- [Homepage sections](docs/02-homepage-sections.md) · [Collection taxonomy](docs/03-collection-architecture.md)
- [Metafields](docs/04-metafields.md) · [Multilingual](docs/05-multilingual.md) · [SEO](docs/06-seo-performance.md)

---

## Common commands

```bash
# Theme
npm run build:css && npm run theme:push

# Catalog
npm run catalog:generate
npm run catalog:export-shopify

# Mobile (pick one)
npm run dev:farmer
npm run dev:warehouse
npm run dev:agronomist
npm run dev:telecaller
npm run dev:partner

# Backend
cd backend && npm run dev && npm run typecheck && npm test

# CRM seed (dev)
npm run crm:seed
npm run crm:masters
```

---

## Tech stack

| Area | Stack |
|------|-------|
| Storefront | Shopify Liquid, Tailwind CSS, Online Store 2.0 |
| API | Node 20, Fastify, TypeScript, Zod, Pino |
| Database | Supabase (PostgreSQL), 100+ migrations |
| Staff UI | React, Vite, deployed to Vercel |
| Mobile | Expo SDK 56, React Native, shared monorepo packages |
| AI | OpenAI GPT-4o, Plant.id, Whisper |
| Payments | Razorpay |
| Logistics | Shiprocket |
| Messaging | Meta WhatsApp Cloud API, Interakt, WATI |

---

Built for Morbeez — bio-inputs, field intelligence, and farmer outcomes at scale.
