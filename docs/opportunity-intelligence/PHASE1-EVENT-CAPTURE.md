# Phase 1 — Event capture

Records normalized rows in `farmer_events` (and recommendation milestones in `recommendation_history`) from live product flows. All capture is **fire-and-forget** via `farmerEventCaptureService.recordSafe()` so WhatsApp/CRM paths never fail on intelligence DB issues.

## Deploy prerequisite

Apply migration `supabase/migrations/20260637000000_opportunity_intelligence_phase0.sql` before enabling in production.

## Instrumentation map

| Source | Trigger | Event type(s) |
|--------|---------|-----------------|
| WhatsApp inbound | `whatsapp-inbound.pipeline` after `interaction_logs` insert | `MESSAGE_REPLY`, `IMAGE_UPLOAD`, `VOICE_NOTE`, `FARMER_REACTIVATED` |
| WhatsApp outbound | `farmerService.logInteraction` (channel `whatsapp`) | `MESSAGE_SENT` |
| Recommendations | create / submit / approve / reject / outcome | `recommendation_history` + approved/outcome farmer events |
| WhatsApp send | `sendApprovedRecommendation` | `RECOMMENDATION_COMMUNICATED` |
| Follow-up | farmer confirms `yes_applied` | `RECOMMENDATION_APPLIED` |
| ROI ledger | `roi-flow.recordEntry` | `ROI_ENTRY` |
| Shopify | `shopify.order.paid` event bus | `ORDER_CONVERTED` |
| Crop Doctor | `advisory.completed`, `callback.requested` | `ADVISORY_SESSION_COMPLETED`, `CROP_ASSESSMENT_REQUESTED`, `CALLBACK_REQUESTED` |
| Agronomist case review | `submitReview` | `CROP_ASSESSMENT_REQUESTED` |
| CRM telecaller | lead create/assign, task complete | `FARMER_ONBOARDED`, `FOLLOWUP_COMPLETED` |
| CRM soil / visit | soil report, schedule visit | `SOIL_TEST_UPLOADED`, `SITE_VISIT_ACCEPTED` |
| Field PWA | `createFieldFinding` | `FIELD_FINDING_LOGGED` |
| Web / API lead | `leadService.ensureLeadForFarmer` (created) | `FARMER_ONBOARDED` via `lead.created` event |

Idempotency: WhatsApp uses `wa:{direction}:{messageId}`; orders use `order:paid:{shopifyOrderId}`; recommendations use `rec:{milestone}:{id}`.

## Debug API

`GET /morbeez-staff/api/v1/farmers/:id/events?limit=50&since=ISO&types=MESSAGE_REPLY,ROI_ENTRY`  
Requires `intelligence` module read access.

## Backfill

From `backend/`:

```bash
npx tsx scripts/backfill-farmer-events.ts --dry-run
npx tsx scripts/backfill-farmer-events.ts --limit=10000
```

Replays WhatsApp rows from `interaction_logs` (idempotent keys).

## Phase 2

See [PHASE2-ATTRIBUTION.md](./PHASE2-ATTRIBUTION.md).

## Next (Phase 3)

Farmer opportunity score engine → `farmer_scores`.
