# Operations messaging — Language templates vs broadcasts

## Operations Hub navigation

Staff console **Operations hub** (`/operations`) is organized in four sections:

| Section | Sub-areas | Purpose |
|---------|-----------|---------|
| **Communications** | Broadcasts, WhatsApp templates, Quick replies | Everything farmers receive on WhatsApp |
| **Knowledge Base** | Terminology, Concepts | Regional language + agricultural concepts |
| **Automation** | Campaign rules, Weather & advisory, Job monitor | Scheduled actions and background jobs |
| **Market Prices** | Daily prices | Mandi prices and farmer market preferences |

Deep links preserved:
- `/broadcasts/*` — full broadcast module (also linked from Communications)
- `/operations/language-templates/:templateKey` — multilingual template editor

**WhatsApp system config** (env flags) moved to **Settings** (admin write only).

Weather rule **editing** lives in **Intelligence hub → Weather rules**. Operations → Automation → Weather & advisory links there.

## Language templates (Operations → Communications → WhatsApp templates)

- One **logical template** per `template_key` (e.g. `welcome_farmer`) with five language versions (EN, HI, KN, TA, ML).
- Used for WhatsApp session messages, Meta template names, welcome flow, and operational copy.
- Edit all translations on a single editor screen with variables: `{{FarmerName}}`, `{{CropName}}`, `{{Village}}`, `{{DAP}}`, `{{AdvisorName}}`, `{{MobileNumber}}`.
- Approved templates are loaded at runtime for welcome and outbound sends (fallback to env vars when not configured).

## Broadcast campaigns (`/broadcasts/templates`)

- Separate **campaign copy library** for ad-hoc farmer broadcasts (crop × DAP reminders, custom campaigns).
- Clone into the 7-step broadcast wizard; not the same table as language templates.
- Label in UI: **Campaign templates** (vs **WhatsApp templates** for system messages).

## Terminology Learning Center (Operations → Knowledge Base → Terminology)

- **Concepts** (`agronomy_concepts`): standardized labels with codes (e.g. DIS001 Root Rot).
- **Regional terms** (`agronomy_terms`): district/language-specific farmer words linked to concepts; status, usage count, reply preference.
- **AI learning queue** (`terminology_review_tasks`): unknown terms with sample messages, AI-suggested concept, confidence score.
- **Aliases** (`terminology_term_aliases`): synonyms for lookup and localized replies.
- **Localization profiles** (`terminology_localization_profiles`): preferred regional terms per language × district for response style.

Workflow: WhatsApp messages → detection → known terms map to concepts; unknown terms enter queue → agronomist **Approve / Edit / Reject** → terms become active in dictionary and AI replies use farmer-preferred wording by district.

## Role visibility (default landing)

| Role | Default section | Hidden sub-tabs |
|------|-----------------|-----------------|
| Telecaller / manager | Communications → Quick replies | Job monitor |
| Operations staff | Market prices | Job monitor (optional) |
| Agronomist | Knowledge → Terminology | Job monitor |
| Admin / super admin | Communications → Broadcasts | — |

## Roles

| Role | WhatsApp templates | Terminology | Broadcasts |
|------|-------------------|-------------|------------|
| Office staff | Create, translate, approve | Approve queue | Create campaigns |
| Agronomist | Draft advisory copy | Map concepts | Automation rules |
| Super Admin | Full approval + Meta names | Concept library | Broadcast admin |
