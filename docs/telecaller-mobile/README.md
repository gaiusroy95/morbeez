# Telecaller mobile smoke checklist

Production telecaller app: `apps/telecaller` (`telecaller_crm` module).

## Bottom tabs

Dashboard · Farmers · Follow-ups · Notifications · Profile

## End-to-end smoke path

1. Login as telecaller staff (email + password or OTP)
2. Dashboard: Today's work, Revenue, Action queue, Today's tasks sections load
3. Farmers: search + filter chips → FarmerCard actions (Call / WhatsApp / Nav / Workspace)
4. Open farmer workspace → header with click-to-call
5. Workspace tabs: Overview · Interactions · Blocks · Recommendations · Orders · Notes
6. Interactions: unified timeline → tap call → read-only AI summary / transcript / QC
7. Create follow-up from call action items or Recommendations tab
8. Follow-ups: complete or snooze a task from grouped sections
9. Notifications: tap item → workspace or follow-ups
10. Profile: monthly revenue/target/orders/conversion (no hidden super-admin performance scores)

## Key API routes

Base: `/morbeez-staff/api/v1/os/telecaller`

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /mobile/dashboard` |
| Farmers | `GET /mobile/leads/operational`, `GET /leads/queue-summary` |
| Workspace | `GET /mobile/leads/:id/workspace-summary`, `GET /leads/:id/*` |
| Follow-ups | `GET /mobile/follow-ups?grouped=true`, `PATCH /tasks/:id/complete` |
| Notifications | `GET /mobile/notifications` |
| Call intelligence | `GET /calls/:callId`, `GET /leads/:id/timeline` |

## EAS

```bash
cd apps/telecaller
cp .env.example .env
npx eas build --platform android --profile preview
```

Offline call upload queue: `telecallerClient.flushOfflineQueue()` from dashboard.
