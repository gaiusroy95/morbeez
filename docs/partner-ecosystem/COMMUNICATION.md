# Partner Ecosystem — Communication Architecture

Cross-role communication for Morbeez Partner Program: unified farmer timeline, task handoffs, and role-scoped notifications.

## Unified team timeline

**Service:** `backend/src/services/crm/farmer-team-timeline.service.ts`

Aggregates:

- `farmer_timeline_entries` (internal team discussion)
- CRM tasks (created/completed, partner-assigned)
- Field visits (partner + expert submissions)
- Escalations
- Sales opportunity status changes

**APIs (RBAC-scoped):**

| Role | Endpoint |
|------|----------|
| Partner | `GET/POST /morbeez-partner/api/v1/farmers/:id/team-timeline` |
| CropAdvisor | `GET/POST /os/crop-advisor/leads/:id/team-timeline` |
| Expert | `GET/POST /os/agronomist/farmers/:id/team-timeline` |

**Feature flag:** `ENABLE_UNIFIED_TEAM_TIMELINE` (default `true`)

## Task handoffs

When cropAdvisor creates a `visit_request` task for a `partner_assisted` farmer, the task routes to `assigned_partner_id` with `assigned_to_role = partner`.

Partner mobile supports **Accept / Reject / Reschedule / Complete** via partner API.

## Support requests (Partner → Expert)

Partner POST ` /farmers/:id/support-request` with types:

- `expert_opinion`
- `soil_interpretation`
- `joint_visit`
- `disease_confirmation`

Creates timeline entry + expert CRM task when `assigned_expert_email` is set.

## Notifications

| App | Endpoint | Categories |
|-----|----------|------------|
| CropAdvisor | `GET /os/crop-advisor/mobile/notifications` | tasks, escalations, orders, sales opportunities, partner task completions |
| Partner | `GET /morbeez-partner/api/v1/notifications` | tasks, lead offers, visit approvals |
| Expert | `GET /os/agronomist/mobile/notifications` | pending reviews, escalations, support requests |

## Sales opportunities

Partner creates interest handoff (no order fields). CropAdvisor converts via mobile dashboard + `PATCH /os/crop-advisor/sales-opportunities/:id`.

**Feature flag:** `ENABLE_SALES_OPPORTUNITIES`

## End-to-end smoke checklist

1. Partner check-in visit (GPS) → submit findings
2. Expert sees pending review notification → approves recommendation
3. CropAdvisor sees partner visit + sales opp on dashboard action queue
4. CropAdvisor posts team comment → visible on partner farmer workspace Team tab
5. D2C order paid → commission ledger row (when `ENABLE_PARTNER_COMMISSION`)

## Escalation path

Partner escalation/support → Expert task → CropAdvisor follow-up → Resolved entries on shared timeline.
