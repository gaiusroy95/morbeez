# Enterprise migrations (M0)

Apply all enterprise-layer migrations before judging runtime features or running integration tests that touch `visit_priority`, `protocol_definitions`, `product_gap_queue`, etc.

## Local

```bash
supabase db push
```

Migrations in scope (20260724–20260802):

- `20260724000000_ai_os_intelligence_layers.sql`
- `20260725000000_enterprise_phase1_priority.sql`
- `20260726000000_enterprise_phases_2_6.sql`
- `20260727000000_phase3_6.sql`
- `20260802*` (if present)

## CI

[`.github/workflows/enterprise-ci.yml`](../.github/workflows/enterprise-ci.yml) runs `npm run build:api`, enterprise integration tests, and frontend `npm run build` on changes to backend, frontend, shared package, and enterprise migration paths.

## Verify

```bash
cd backend && npm run build:api
cd ../frontend && npm run build
cd ../backend && node --import tsx --test tests/visit-command-center.test.ts tests/phase1-write-paths.test.ts
```

If tests fail with schema-cache errors for `visit_priority`, migrations are not applied locally.
