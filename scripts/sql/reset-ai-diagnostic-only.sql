-- Morbeez: reset ONLY AI diagnostic / reuse cache data (keeps farmers, CRM, orders).
-- Use when re-testing WhatsApp Crop Doctor without wiping farmer accounts.
--
-- Run in Supabase SQL Editor or: npm run db:reset-ai -- --confirm

BEGIN;

DELETE FROM ml_gold_queue;
DELETE FROM ai_request_logs;
DELETE FROM ai_advisory_outputs;
DELETE FROM ai_product_recommendations;
DELETE FROM ai_training_events;
DELETE FROM ai_accuracy_events;
DELETE FROM ai_case_outcomes;
DELETE FROM ai_learning_samples;
DELETE FROM advisory_automation_jobs;
DELETE FROM advisory_reuse_cases;
DELETE FROM learned_follow_up_questions;
DELETE FROM disease_history;
DELETE FROM crop_images;
DELETE FROM farmer_ai_usage_daily;
DELETE FROM farmer_image_hashes;
DELETE FROM farmer_advisory_feedback;
DELETE FROM agronomist_escalations WHERE session_id IS NOT NULL OR farmer_id IS NOT NULL;
DELETE FROM ai_advisory_sessions;

DELETE FROM advisory_faq_cache;
DELETE FROM whatsapp_reply_attributions WHERE module IN (
  'crop_doctor_openai', 'crop_doctor_reuse', 'verified_case', 'knowledge_fallback',
  'follow_up_memory', 'regional_learning'
);

-- Visit AI tied to advisory sessions
DELETE FROM visit_ai_evidence_requests;
DELETE FROM visit_ai_recommendations;
DELETE FROM visit_ai_questions;
DELETE FROM visit_ai_hypotheses;
DELETE FROM visit_ai_cases;

-- Clear WhatsApp diagnosis session state (keeps language/onboarding prefs if needed)
UPDATE conversation_sessions
SET
  state = 'main_menu',
  context = context - 'pendingDiagnosisImagePath'
                    - 'pendingDiagnosisImageMime'
                    - 'pendingDiagnosisImageBatch'
                    - 'pendingSymptomsText'
                    - 'pendingDiagnosisDelivery'
                    - 'postDiagnosisIntake'
                    - 'diagnosisIntake'
                    - 'diagnosis'
                    - 'maiosCase',
  updated_at = NOW()
WHERE channel = 'whatsapp';

COMMIT;
