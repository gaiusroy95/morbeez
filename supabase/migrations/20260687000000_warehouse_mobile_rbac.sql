-- Mobile Pick & Pack: dedicated warehouse staff roles

ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (
    role IN (
      'super_admin',
      'admin',
      'operations',
      'telecaller',
      'agronomist',
      'manager',
      'viewer',
      'warehouse',
      'picker_packer'
    )
  );

INSERT INTO role_module_permissions (role, module_key, can_read, can_write) VALUES
  ('warehouse', 'dashboard', true, false),
  ('warehouse', 'warehouse', true, true),
  ('picker_packer', 'dashboard', true, false),
  ('picker_packer', 'warehouse', true, true)
ON CONFLICT (role, module_key) DO UPDATE SET
  can_read = EXCLUDED.can_read,
  can_write = EXCLUDED.can_write;
