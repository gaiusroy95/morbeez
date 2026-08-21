-- Rename legacy staff role + module key telecaller → crop_advisor
-- Safe to re-run: only updates rows that still use the old values.

UPDATE admin_users
SET role = 'crop_advisor'
WHERE role = 'telecaller';

UPDATE employee_profiles
SET role = 'crop_advisor'
WHERE role = 'telecaller';

-- Permission / module catalogs if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'role_permissions'
  ) THEN
    UPDATE role_permissions SET module = 'crop_advisor_crm' WHERE module = 'telecaller_crm';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'module_permissions'
  ) THEN
    UPDATE module_permissions SET module = 'crop_advisor_crm' WHERE module = 'telecaller_crm';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_profiles' AND column_name = 'primary_module'
  ) THEN
    UPDATE employee_profiles SET primary_module = 'crop_advisor_crm' WHERE primary_module = 'telecaller_crm';
  END IF;
END $$;
