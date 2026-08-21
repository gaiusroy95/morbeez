# CropAdvisor call intelligence

Unified conversation intelligence for staff crop advisor CRM: voice-note / audio upload → Whisper STT → terminology detection → AI summary → operational interaction → QC scorecard.

## Recording paths

| Phase | Method | API |
|-------|--------|-----|
| MVP (now) | Upload audio or record voice note in web/app | `POST /os/crop-advisor/leads/:id/calls/upload` |
| Production | Exotel click-to-call + webhook | `POST /os/crop-advisor/exotel/click-to-call`, `POST /webhooks/exotel/status` |

## Environment

Backend (`Render` / `.env`):

- `API_BASE_URL` — public API URL for Exotel status callback
- `EXOTEL_SID`, `EXOTEL_TOKEN`, `EXOTEL_CALLER_ID`, `EXOTEL_SUBDOMAIN` (optional, default `api`)

Supabase:

- Run migration `20260693000000_call_intelligence.sql`
- Create storage bucket **`call-recordings`** (public or signed URL policy per your security model)

## Call outcomes

Standard funnel outcomes: `answered`, `connected`, `callback`, `no_answer`, `busy`.

## Processing flow

1. Upload creates `crm_call_logs` with `processing_status=processing`
2. Async processor: STT → `conversation-intelligence.service` (terminology) → LLM summary → QC → operational `interaction_logs` row
3. CropAdvisor confirms summary (`POST .../calls/:id/confirm`) to apply suggested stage
4. Soil test interest in summary JSON auto-creates follow-up task and bumps lead stage

## QC

- Rubric in `call_qc_rubric` (5 × 20 pts default)
- Manager dashboard: staff web **CropAdvisor → Call QC** tab or `/cropAdvisor?view=qc`
- Mobile: QC strip on cropAdvisor app dashboard (`GET /os/crop-advisor/mobile/dashboard`)

## Consent & retention

Before Exotel production rollout:

- Show pre-call recording consent banner in CRM
- Define retention policy on `call-recordings` bucket (e.g. 90 days)
- Audit log consent acceptance on lead/farmer record (future enhancement)

## Mobile app

Expo app: `apps/cropAdvisor` (`crop_advisor_crm` module). Offline upload queue stored in `localStorage` key `crop_advisor_offline_uploads`; flush via `cropAdvisorClient.flushOfflineQueue()`.

EAS: `eas build --profile preview` from `apps/cropAdvisor`.
