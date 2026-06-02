-- Per-user table layouts (column visibility, order, widths, saved views)

CREATE TABLE IF NOT EXISTS user_table_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  table_name TEXT NOT NULL,
  view_name TEXT NOT NULL DEFAULT 'active',
  visible_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  column_widths JSONB NOT NULL DEFAULT '{}'::jsonb,
  filter_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, table_name, view_name)
);

CREATE INDEX IF NOT EXISTS idx_user_table_preferences_user_table
  ON user_table_preferences (user_email, table_name);

ALTER TABLE user_table_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_user_table_preferences ON user_table_preferences
  FOR ALL
  USING (true)
  WITH CHECK (true);
