import { z } from 'zod';
import 'dotenv/config';

/** Parse integer env vars; empty string / invalid → default (avoids NaN on Render). */
function coerceEnvInt(defaultValue: number) {
  return z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return defaultValue;
    const n = Number(val);
    return Number.isFinite(n) ? n : defaultValue;
  }, z.number().int().min(0));
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().optional(),

  SHOPIFY_STORE_DOMAIN: z.string().min(1),
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: z.string().min(1),
  SHOPIFY_API_VERSION: z.string().default('2024-10'),
  /** Optional — primary location for inventory_levels/set (defaults to first active location). */
  SHOPIFY_LOCATION_ID: z.string().optional(),
  SHOPIFY_WEBHOOK_SECRET: z.string().min(1),
  SHOPIFY_APP_CLIENT_ID: z.string().optional(),
  SHOPIFY_APP_CLIENT_SECRET: z.string().optional(),
  SHOPIFY_APP_SCOPES: z.string().default('write_app_proxy'),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  SHIPROCKET_EMAIL: z.string().optional(),
  SHIPROCKET_PASSWORD: z.string().optional(),
  SHIPROCKET_WEBHOOK_TOKEN: z.string().optional(),
  /** Must match pickup location nickname in Shiprocket → Settings → Pickup addresses */
  SHIPROCKET_PICKUP_LOCATION: z.string().default('Primary'),
  SHIPROCKET_PICKUP_PINCODE: z.string().default('560001'),

  WHATSAPP_PROVIDER: z.enum(['cloud', 'wati', 'interakt', 'adsgyani']).default('adsgyani'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WATI_API_ENDPOINT: z.string().url().optional(),
  WATI_ACCESS_TOKEN: z.string().optional(),
  INTERAKT_API_KEY: z.string().optional(),
  ADS_GYANI_API_BASE: z.string().url().optional(),
  ADS_GYANI_TENANT: z.string().optional(),
  ADS_GYANI_API_TOKEN: z.string().optional(),
  ADS_GYANI_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  ADS_GYANI_WEBHOOK_SECRET: z.string().optional(),
  ADS_GYANI_SEND_TEXT_PATH: z.string().optional(),
  ADS_GYANI_SEND_TEMPLATE_PATH: z.string().optional(),
  ADS_GYANI_TEMPLATE_LANGUAGE: z.string().optional(),
  WHATSAPP_WELCOME_TEMPLATE: z.string().optional(),
  WHATSAPP_OUTBOUND_TEMPLATE: z.string().optional(),
  /** Approved Meta/Ads Gyani template for login OTP (single body param = code). */
  WHATSAPP_OTP_TEMPLATE: z.string().optional(),
  WHATSAPP_OTP_TEMPLATE_LANGUAGE: z.string().optional(),
  /** When true, send login OTP via WhatsApp even if NODE_ENV is development/staging. */
  OTP_SEND_VIA_WHATSAPP: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  WHATSAPP_SESSION_HOURS: z.coerce.number().default(24),
  WHATSAPP_TYPING_SIMULATION: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  WHATSAPP_TYPING_MIN_MS: z.coerce.number().default(700),
  WHATSAPP_TYPING_MAX_MS: z.coerce.number().default(2200),
  /** Debounce window (ms) to batch simultaneous WhatsApp photo uploads into one diagnosis. */
  WHATSAPP_IMAGE_BATCH_MS: z.coerce.number().default(2500),
  SHOPIFY_STOREFRONT_URL: z.string().url().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_VISION_MODEL: z.string().default('gpt-4o'),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4o'),
  OPENAI_WHISPER_MODEL: z.string().default('whisper-1'),
  PLANT_ID_API_KEY: z.string().optional(),

  INTERNAL_API_KEY: z.string().min(16),
  FARMER_JWT_SECRET: z.string().min(32),
  ADMIN_JWT_SECRET: z.string().min(32),
  /** Comma-separated browser origins allowed for CORS (Vercel staff console) */
  ADMIN_UI_ORIGIN: z.string().optional(),
  /** Public URL of the staff console SPA (no trailing slash), e.g. https://staff.example.com */
  CONSOLE_PUBLIC_URL: z.string().url().optional(),
  /** @deprecated No longer used — staff set individual passwords */
  CONSOLE_SHARED_PASSWORD: z.string().min(8).max(128).optional(),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),
  FARMER_SCAN_DAILY_QUOTA: z.coerce.number().default(20),
  UPLOAD_BODY_LIMIT_BYTES: z.coerce.number().default(10_485_760),

  ENABLE_SHIPROCKET_AUTO_SHIP: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Create Shiprocket order + AWB when warehouse confirms (recommended). */
  ENABLE_SHIPROCKET_ON_CONFIRM: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Legacy: ship only after pack if AWB was not created on confirm. */
  ENABLE_SHIPROCKET_AFTER_PACK: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Auto-confirm orders and reserve stock on create/paid. */
  ENABLE_OMS_AUTO_CONFIRM: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  COMPANY_GSTIN: z.string().optional(),
  COMPANY_STATE: z.string().default('Karnataka'),
  COMPANY_LEGAL_NAME: z.string().optional(),
  COMPANY_BANK_ACCOUNT: z.string().optional(),
  COMPANY_BANK_IFSC: z.string().optional(),
  COMPANY_BANK_BRANCH: z.string().optional(),
  ENABLE_RAZORPAY_PAYMENT_LINKS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_RAZORPAY_CHECKOUT: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  CHECKOUT_SUCCESS_PATH: z.string().default('/pages/checkout-success'),
  ENABLE_WHATSAPP_AUTO_REPLY: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** OpenAI text replies for WhatsApp (greetings, general chat). Default on unless false. */
  ENABLE_WHATSAPP_OPENAI_REPLY: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Natural-language polish for verified DB/diagnosis replies (facts locked). Default on. */
  ENABLE_WHATSAPP_REPLY_POLISH: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Rich sectioned WhatsApp diagnosis (renderer + extended prompt). Default on. */
  ENABLE_WHATSAPP_RICH_DIAGNOSIS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** OpenAI polish pass on diagnosis body — default off (preserves structure). */
  ENABLE_WHATSAPP_DIAGNOSIS_POLISH: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Ginger Crop Doctor SOP v3 — evidence scoring, fused confidence, D3/D7/D14 recovery loop. */
  ENABLE_GINGER_SOP_V3: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** MAIOS v12 — universal crop intelligence case engine + crop packs. */
  ENABLE_MAIOS_V12: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  MAIOS_RECOVERY_DAYS: z.string().optional(),
  MAIOS_DISABLE_GENERIC_OUTCOME: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_MAIOS_SUPPLY_INTEL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_MAIOS_PREDICTIVE_RISK: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** MAIOS v17 reasoning layer (Bayesian + EVSI) — composes v12 case builder output. */
  ENABLE_MAIOS_REASONING: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** When true, reasoning runs in parallel but does not replace fused hypotheses. */
  MAIOS_REASONING_SHADOW: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Structured vision features (spindle, grey center) for v17 evidence repository. */
  ENABLE_STRUCTURED_VISION: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_OUTBOX_WORKER: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_RETENTION_CLEANUP: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_AI_CROP_DOCTOR: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_ADVISORY_FOLLOW_UPS: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_ADVISORY_AUTOMATION: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_STRUCTURED_FIELD_VISITS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Append Day-1 application check prompt to initial approved recommendation WhatsApp */
  REC_SEND_COMPLIANCE_IN_INITIAL: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_WHATSAPP_BROADCASTS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_MARKET_INSIGHT_IMAGE_BROADCAST: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  /** Fetch mandi prices + copy via OpenAI per pincode/day (cached). */
  ENABLE_MARKET_INSIGHT_OPENAI: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  MARKET_INSIGHT_BUILD_HOUR_IST: z.coerce.number().min(0).max(23).default(11),
  MARKET_INSIGHT_SEND_HOUR_IST: z.coerce.number().min(0).max(23).default(12),
  WHATSAPP_BROADCAST_MAX_PER_DAY: z.coerce.number().default(2),
  WHATSAPP_BROADCAST_KIND_COOLDOWN_HOURS: z.coerce.number().default(72),
  ENABLE_WHATSAPP_ORDER_ALERTS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_CULTIVATION_FOLLOW_UPS: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  CULTIVATION_APPLICATION_DAYS: z.coerce.number().default(5),
  CULTIVATION_RESULT_DAYS: z.coerce.number().default(10),
  ENABLE_AI_REUSE_CACHE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Ask 1–2 follow-ups from similar verified cases before Crop Doctor (requires reuse cache). */
  ENABLE_DIAGNOSIS_FOLLOW_UP: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Regional terminology detection, escalation, and response localization. */
  ENABLE_REGIONAL_TERMINOLOGY_ENGINE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_WHATSAPP_ROI: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Evening (6 PM IST) proactive ROI entry buttons for opted-in farmers. */
  ENABLE_ROI_DAILY_PROMPT: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Nightly farmer opportunity score engine (IST 02:00–04:59). */
  ENABLE_OPPORTUNITY_SCORE_WORKER: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Send educational WhatsApp nudge during low-opportunity nurture batch (default on). */
  ENABLE_OPPORTUNITY_NURTURE_WHATSAPP: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_PARTNER_PROGRAM: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_PARTNER_LEAD_ALLOCATION: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_SALES_OPPORTUNITIES: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_PARTNER_COMMISSION: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  ENABLE_UNIFIED_TEAM_TIMELINE: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),
  /** Below this → escalate to agronomist (legacy; defaults to review threshold). */
  AI_ESCALATION_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  /** ≥ this → auto-send advisory without human review. */
  AI_AUTO_SEND_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95),
  /** ≥ this → employee review; below → escalate. */
  AI_REVIEW_THRESHOLD: z.coerce.number().min(0).max(1).default(0.8),
  AI_MAX_VOICE_DURATION_SEC: z.coerce.number().default(60),
  AI_MIN_REQUEST_INTERVAL_SEC: z.coerce.number().default(30),
  /** When false, per-farmer WhatsApp text/image/voice daily caps are not enforced. */
  ENABLE_AI_DAILY_LIMITS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  AI_DAILY_TEXT_LIMIT_FREE: coerceEnvInt(10),
  AI_DAILY_TEXT_LIMIT_PREMIUM: coerceEnvInt(100),
  AI_DAILY_IMAGE_LIMIT_FREE: coerceEnvInt(3),
  AI_DAILY_IMAGE_LIMIT_PREMIUM: coerceEnvInt(50),
  AI_DAILY_VOICE_LIMIT_FREE: coerceEnvInt(5),
  AI_DAILY_VOICE_LIMIT_PREMIUM: coerceEnvInt(30),

  /** Expert Copilot Domain 3 — canonical cases (shadow dual-write by default). */
  ENABLE_EXPERT_CASES: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_CASE_DEDUPE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_CASE_OWNERSHIP: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_CASE_VERSION_LOCK: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_CASE_RECURRENCE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_COPILOT_QUEUE: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_COPILOT_AUTO_ASSIGN: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_COPILOT_LEASE_REAPER: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_COPILOT_CHAT: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENFORCE_SERVER_RECOMMENDATION_SAFETY: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_EXPERT_COMMIT_RPCS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_RECOMMENDATION_COMMUNICATION_OUTBOX: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_LEARNING_CANDIDATE_SHADOW: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  DISABLE_LEGACY_AUTO_PROMOTION: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_APPROVED_REUSE_MEMORY_READ: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENFORCE_GOVERNANCE_AUDIT: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  ENABLE_REVIEWER_RISK_MONITORING: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  EXPERT_CASE_LEASE_SECONDS: coerceEnvInt(900),
  EXPERT_CASE_RECURRENCE_DAYS: coerceEnvInt(14),
  EXPERT_CASE_INTERRUPTION_LIMIT: coerceEnvInt(2),

  GSC_SITE_URL: z.string().url().optional(),
  GSC_CLIENT_ID: z.string().optional(),
  GSC_CLIENT_SECRET: z.string().optional(),
  GSC_REFRESH_TOKEN: z.string().optional(),

  /** Exotel click-to-call + recording webhooks (Phase 7). */
  EXOTEL_SID: z.string().optional(),
  EXOTEL_TOKEN: z.string().optional(),
  EXOTEL_CALLER_ID: z.string().optional(),
  EXOTEL_SUBDOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration');
  }
  return parsed.data;
}

export const env = loadEnv();
