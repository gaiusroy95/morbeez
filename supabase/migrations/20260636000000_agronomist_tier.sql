-- New vs experienced agronomist: experienced may self-approve recommendations (no super admin).

ALTER TABLE employee_profiles
  ADD COLUMN IF NOT EXISTS agronomist_tier TEXT NOT NULL DEFAULT 'new';

ALTER TABLE employee_profiles
  DROP CONSTRAINT IF EXISTS employee_profiles_agronomist_tier_check;

ALTER TABLE employee_profiles
  ADD CONSTRAINT employee_profiles_agronomist_tier_check
  CHECK (agronomist_tier IN ('new', 'experienced'));

COMMENT ON COLUMN employee_profiles.agronomist_tier IS
  'For role=agronomist: new requires super admin approval; experienced may approve own submissions.';
