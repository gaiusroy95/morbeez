# M3 — Multilingual Advisory

## MVP languages

- **English** — `farmerSummaryEn`
- **Malayalam** — `farmerSummaryMl` (Malayalam script in JSON output)

## API

```json
{ "language": "en" | "ml" }
```

WhatsApp replies use farmer `preferred_language`.

## Prepared locales

Schema supports `ta`, `kn`, `hi` in `ai_advisory_sessions.language` — prompts can be extended per locale file in M3.1.

## Tone

Prompts require **casual, spoken** farmer-friendly language (WhatsApp style) — no academic jargon, no literary or textbook prose.

**Malayalam (`ml`):** Kerala farmers on WhatsApp — simple, friendly, short sentences; avoid formal Malayalam and literal English translation. See `MALAYALAM_KERALA_WHATSAPP_RULES` in `farmer-language-style.ts`.
