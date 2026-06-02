# Regional terminology engine (WhatsApp)

Farmer messages pass through detection → dictionary mapping → AI reasoning (standard terms) → localized replies (farmer language). Unknown words are escalated to agronomists; approved meanings update `agronomy_terms` and feed AI prompts.

## Flow

1. **Record** — `farmer_messages` stores raw inbound text.
2. **Detect** — `terminologyDetectionEngine` tokenizes and checks `agronomy_terms` + builtins (kana, chimb).
3. **Known** — expand message for AI; inject glossary into farmer memory / OpenAI context.
4. **Unknown** — `terminologyEscalationService` creates/bumps `terminology_review_tasks`; short unknown-only phrases get pending farmer copy (no guess).
5. **Approve** — Operations → Terminology tab: meaning + standard term → `learningLoopService.onTerminologyResolved` → dictionary + `terminology_learning_history`.
6. **Reply** — `responseLocalizationService` swaps standard phrases back to regional words in outbound text.

## Tables

| Table | Role |
|-------|------|
| `farmer_messages` | Raw inbound audit |
| `agronomy_terms` | Regional dictionary (`standard_term`, `local_script`, `approved_by`) |
| `terminology_review_tasks` | Escalation queue |
| `terminology_learning_history` | Approval audit |
| `farmer_language_patterns` | Per-farmer term usage |

## Config

`ENABLE_REGIONAL_TERMINOLOGY_ENGINE=true` (default on)

## Migration

Apply `supabase/migrations/20260640000000_regional_terminology_engine.sql`.

## Future

Stage 10 (pgvector RAG for terminology) is not implemented in this repo yet.
