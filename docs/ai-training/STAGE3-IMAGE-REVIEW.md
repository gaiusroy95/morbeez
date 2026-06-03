# Stage 3 — Image Review UI + Labeled Dataset

Migration: `20260649000000_crop_images.sql`

## Purpose

Build a **supervised visual disease dataset** by labeling every crop photo with agronomist-confirmed diagnosis, severity, and context.

## Table: `crop_images`

| Column | Spec mapping |
|--------|--------------|
| `storage_path` | advisory-images bucket path |
| `external_url` | Field visit photo URLs |
| `crop`, `dap` | Crop intelligence |
| `symptoms` | Symptom tags JSONB |
| `gps_region` | Regional context |
| `weather_snapshot_id` | Environmental correlation |
| `ai_prediction`, `ai_confidence` | AI baseline |
| `agronomist_label` | Gold label |
| `severity` | mild / moderate / severe |
| `review_status` | pending / reviewed / skipped / excluded |

## Auto-enqueue sources

| Source | Trigger |
|--------|---------|
| WhatsApp AI | `crop-doctor.service` after session with `imageStoragePath` |
| Field findings | `telecaller-admin.createFieldFinding` for each photo |
| Backfill | `listQueue` syncs existing sessions + findings without rows |

## API (`/morbeez-staff/api/v1/os/agronomist`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/crop-images` | Pending queue (+ auto-sync) |
| GET | `/crop-images/:id` | Detail + weather |
| POST | `/crop-images/:id/review` | Submit label |

## UI

**Agronomist Hub → Image review tab**

- Left: pending queue with AI prediction preview
- Center: full-size image viewer
- Right: AI prediction, diagnosis label picker, severity, Confirm / Correct / Skip / Exclude
- **Confirm AI & next** — batch review flow

Component: `console-ui/src/components/agronomist/ImageReviewPanel.tsx`

## Training loop

Reviewed images write to `ai_training_events` with `review_surface = image_review`.

## Next stage

Stage 4 adds confidence lifecycle columns (`auto_sent`, `human_reviewed`) on `ai_advisory_sessions`.
