-- Regional terminology engine: farmer messages, dictionary extensions, learning history

-- ─── Stage 1: raw farmer messages (WhatsApp + future channels) ───
CREATE TABLE IF NOT EXISTS farmer_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  raw_message TEXT NOT NULL,
  detected_language TEXT NOT NULL DEFAULT 'en',
  message_type TEXT,
  external_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_messages_farmer_created
  ON farmer_messages (farmer_id, created_at DESC);

-- ─── Extend agronomy_terms → RegionalTerminologyDictionary ───────
ALTER TABLE agronomy_terms
  ADD COLUMN IF NOT EXISTS local_script TEXT,
  ADD COLUMN IF NOT EXISTS standard_term TEXT,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN agronomy_terms.standard_term IS 'Scientific / internal label e.g. shoot emergence';
COMMENT ON COLUMN agronomy_terms.local_script IS 'Malayalam/Tamil script form when different from romanized term';

-- ─── Extend terminology_review_tasks → escalation queue ───────────
ALTER TABLE terminology_review_tasks
  ADD COLUMN IF NOT EXISTS unknown_word TEXT,
  ADD COLUMN IF NOT EXISTS raw_message TEXT,
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS standard_term TEXT,
  ADD COLUMN IF NOT EXISTS occurrence_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority_score INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ai_confidence_reduced BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_terminology_review_term_open
  ON terminology_review_tasks (term, status)
  WHERE status IN ('open', 'in_review');

-- ─── Learning audit trail ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminology_learning_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  crop_type TEXT,
  district TEXT,
  meaning TEXT NOT NULL,
  standard_term TEXT,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'updated', 'auto_learned')),
  task_id UUID REFERENCES terminology_review_tasks(id) ON DELETE SET NULL,
  farmer_id UUID REFERENCES farmers(id) ON DELETE SET NULL,
  approved_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_terminology_learning_term
  ON terminology_learning_history (term, created_at DESC);

-- ─── Aggregated farmer language patterns (continuous learning) ───
CREATE TABLE IF NOT EXISTS farmer_language_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  usage_count INT NOT NULL DEFAULT 1,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (farmer_id, term, language)
);

CREATE INDEX IF NOT EXISTS idx_farmer_language_patterns_farmer
  ON farmer_language_patterns (farmer_id, usage_count DESC);

ALTER TABLE farmer_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminology_learning_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_language_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY farmer_messages_service ON farmer_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY terminology_learning_history_service ON terminology_learning_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY farmer_language_patterns_service ON farmer_language_patterns FOR ALL USING (true) WITH CHECK (true);
