# Marketing attribution & performance

## Funnel definitions

| Metric | Rule |
|--------|------|
| **Leads** | `leads.created_at` in period, filtered by `lead_channel`, `campaign_source`, marketer |
| **Connected** | Outbound `crm_call_logs` outcome in `answered`, `connected`, `callback` **or** `last_interaction_at` set **or** stage beyond `new_lead` |
| **Interested** | Stage in `interested`, `follow_up`, `recommendation`, `order_placed`, `repeat_customer` |
| **Booked** | `commerce_quotes.lead_id` **or** `crm_soil_reports` for farmer **or** stage ≥ `recommendation` |
| **Paid** | `employee_sales_ledger.status = paid` for lead **or** stage `order_placed` / `repeat_customer` |
| **Revenue** | Sum `employee_sales_ledger.gross_profit` within **90 days** of lead `created_at` |
| **ROI** | Attributed gross profit ÷ Meta spend (`marketing_spend_entries`, channel `meta`, matching `campaign_name`) |

## UTM naming convention

Use consistent values on Shopify landing pages and signup forms:

- `utm_source`: `facebook`, `instagram`, `google`, `whatsapp`
- `utm_medium`: `cpc`, `video`, `organic`, `referral`
- `utm_campaign`: snake_case campaign slug, e.g. `wayanad_ginger_june_2026`

Website/mobile signup passes UTMs to `/api/v1/auth/signup`; leads get `lead_channel` derived from source/medium and `campaign_source` from `utm_campaign`.

## Operating rules

1. **No source = no score** — leads without both `lead_channel` and `campaign_source` are Unattributed and excluded from marketer KPIs.
2. **Telecaller SLA** — Meta leads in `new_lead` should be called within 24h (shown on Marketing tab queue strip).
3. **Single revenue definition** — ledger gross profit, 90-day window from lead creation.
4. **First-touch only** — no multi-touch attribution in v1.

## Staff UI

- **Commerce → Marketing** — performance dashboard, spend logging, Meta CSV import
- **Telecaller → New lead / lead profile** — channel, campaign, marketer fields
- **Queue row** — badge `Meta · Campaign name` when attributed

## Deploy

```bash
supabase db push
# redeploy backend + staff frontend
```
