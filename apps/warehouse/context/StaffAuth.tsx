import { createStaffAuth } from '@morbeez/shared/auth/staff';

export const { StaffAuthProvider, useStaffAuth } = createStaffAuth('warehouse', true);
