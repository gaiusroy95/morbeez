# Stage 6 — Interaction + Field Finding UI Perfection

## Purpose

Replace free-text field findings in telecaller flows with **structured operational data**, and surface the **interaction → finding → recommendation → escalation** chain in CRM.

## UI changes

### Structured field finding form

Shared component: `frontend/src/components/telecaller/StructuredFieldFindingFields.tsx`

| Field | Required | Source |
|-------|----------|--------|
| Finding type | Yes | `FINDING_TYPES` enum |
| Severity | Yes | `REVIEW_SEVERITIES` |
| Confirmed issue | Yes | `DiagnosisLabelPicker` |
| Affected area % | No | 0–100 |
| Field notes | No | Free text (context only) |

Used in:
- **Add interaction** modal (when “Add field finding” checked)
- **Add field finding** modal
- **Field finding detail** edit mode

### Operational chain panel

`OperationalChainPanel.tsx` — shown in interaction detail when linked records exist:

1. **Field finding** — type, severity, issue, link to finding modal
2. **Recommendation** — summary + status
3. **Escalation** — agronomist case review status

### Field findings tab

Table columns now include **Type**, **Issue** (confirmed diagnosis), and severity chips.

## API changes

### Telecaller diagnosis labels

Telecallers can search/create diagnosis labels without agronomist module access:

| Method | Path |
|--------|------|
| GET | `/telecaller/diagnosis-labels` |
| POST | `/telecaller/diagnosis-labels` |

### Validation

`POST /leads/:id/interactions` and `POST /leads/:id/field-findings` require when adding a finding:

- `findingType`
- `severity`
- `finalConfirmedIssue`

Merged with `structuredFieldFindingSchema` from Stage 0.

### Interaction detail

`GET /leads/:leadId/interactions/:id` returns `operationalChain` for operational session logs:

```typescript
operationalChain?: {
  fieldFinding?: { id, issue, findingType, severity, affectedAreaPct }
  recommendation?: { id, summary, problem, status }
  escalation?: { id, status, workflowStatus }
}
```

## Backend service

`crm-farmer.service.ts`:

- `createInteraction()` creates structured `crm_field_findings` rows (not free-text-only)
- `loadOperationalChain()` resolves linked entities from `field_finding_id`, `recommendation_id`, `escalation_id`
- List rows expose `fieldFindingId`, `recommendationId`, `escalationId` for UI chips

## Training impact

Every telecaller-recorded finding now carries:

- Canonical `finding_type` and `severity`
- Master-backed `final_confirmed_issue` (via diagnosis labels)
- Weather snapshot (Stage 1) + image enqueue (Stage 3) on create

This feeds `ai_training_events` and future export (Stage 7).

## Next stage

See `STAGE7-TRAINING-EXPORT.md`. Next: Stage 8 — Weather correlation intelligence.
