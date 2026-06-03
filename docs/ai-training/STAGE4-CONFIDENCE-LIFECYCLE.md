# Stage 4 — Confidence Lifecycle Engine

Migration: `20260650000000_ai_confidence_lifecycle.sql`

## Purpose

Centralized confidence routing with auditable lifecycle on every `ai_advisory_sessions` row.

## Routing model

| Confidence | Band | Action |
|------------|------|--------|
| ≥ 95% | `auto_send` | Deliver to farmer without agronomist gate |
| 80–94% | `employee_review` | Employee / telecaller validation |
| < 80% | `escalate` | Agronomist case review |

Env vars: `AI_AUTO_SEND_THRESHOLD` (0.95), `AI_REVIEW_THRESHOLD` (0.80)

## New columns on `ai_advisory_sessions`

| Column | Purpose |
|--------|---------|
| `confidence_band` | auto_send / employee_review / escalate |
| `auto_sent` | AI response delivered without human gate |
| `auto_sent_at` | Timestamp |
| `human_reviewed` | Staff/agronomist reviewed session |
| `human_reviewed_by` | Reviewer email |
| `corrected` | Human changed AI diagnosis |
| `corrected_at` | Timestamp |
| `routing_decided_at` | When band was assigned |

## Service

`backend/src/services/core/confidence-lifecycle.service.ts`

| Method | When called |
|--------|-------------|
| `applyRouting` | After every Crop Doctor diagnosis (`escalation.service`) |
| `markAutoSent` | WhatsApp pipeline when ≥95% and advisory delivered |
| `markHumanReviewed` | Agronomist case review submit |
| `getRoutingStats` | Dashboard API |

## API

`GET /morbeez-staff/api/v1/os/agronomist/confidence-stats?days=30`

## UI

- **Case review header** — band badge + Auto-sent / Human reviewed / Corrected flags
- **Agronomist intelligence bar** — auto-send band %, avg confidence, correction rate

## Next stage

Stage 5 adds Outcome Review workspace for recommendation effectiveness learning.
