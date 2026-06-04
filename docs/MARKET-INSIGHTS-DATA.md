# Market Insights — data flow (pincode + OpenAI)

Daily WhatsApp **image** uses a fixed layout. Values are filled per **farmer PIN code** region.

## Region = pincode (required)

| Source | Field |
|--------|--------|
| Primary | `farmers.pincode_id` → `pincode_master` (village, taluk, district, state, lat/lon) |
| Fallback | `farmers.delivery_pincode` looked up in `pincode_master` |

Farmers **without** a valid 6-digit PIN in `pincode_master` are skipped at build time.

Plot GPS is **not** used for market insights (only PIN coordinates for weather).

## Automatic data (default)

When `OPENAI_API_KEY` is set and `ENABLE_MARKET_INSIGHT_OPENAI=true` (default):

1. **One OpenAI call per pincode per day** (cached in `market_insight_pincode_cache`).
2. OpenAI returns JSON: 4 crop ₹/kg cards, ginger monthly chart, mandi label, insight bullets.
3. **Weather numbers** on the card are grounded with **Open-Meteo** at the PIN’s lat/lon (injected into the prompt as `verified_weather` so °C / humidity / rain label stay accurate).

All farmers sharing the same PIN receive the **same** cached card for that day.

### Env

```env
ENABLE_MARKET_INSIGHT_IMAGE_BROADCAST=true
ENABLE_MARKET_INSIGHT_OPENAI=true
OPENAI_API_KEY=sk-...
WHATSAPP_PROVIDER=cloud
```

## Legacy fallback (optional)

If OpenAI fails or is disabled, the system falls back to **manual** `crop_daily_prices` (Operations Center). Not required when OpenAI path works.

## Schedule (IST)

| Hour | Action |
|------|--------|
| 11 | Build PNGs |
| 12 | Send via WhatsApp Cloud |

## Accuracy notes

- **Weather:** Open-Meteo at PIN coordinates (not invented by the model).
- **Prices:** Model-estimated wholesale/mandi levels for the district — suitable for automated daily updates; not a substitute for official AGMARKNET/APMC feeds. For regulatory-grade prices, add a mandi API later and pass results into the same JSON schema.

## Code

- `market-insight-region.service.ts` — PIN resolution
- `market-insight-ai.service.ts` — OpenAI + cache
- `market-insight-data.service.ts` — orchestration
