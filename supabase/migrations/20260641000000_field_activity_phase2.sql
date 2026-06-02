-- Phase 2 — Operations Field Activity foundation for Labour Contractor integration.
-- Extends existing cultivation_activities instead of creating a parallel table.

ALTER TABLE cultivation_activities
  ADD COLUMN IF NOT EXISTS activity_label TEXT,
  ADD COLUMN IF NOT EXISTS cost_inr NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS activity_status TEXT NOT NULL DEFAULT 'completed'
    CHECK (activity_status IN ('completed', 'pending', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_block_date
  ON cultivation_activities (farm_block_id, applied_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cultivation_activities_follow_up
  ON cultivation_activities (follow_up_required, follow_up_date)
  WHERE follow_up_required = true;
