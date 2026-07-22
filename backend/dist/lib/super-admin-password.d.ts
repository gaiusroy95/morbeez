import { z } from 'zod';
export declare const confirmPasswordSchema: z.ZodString;
export declare function assertSuperAdminPasswordConfirm(actor: {
    id: string;
    role: string;
}, confirmPassword: string | undefined): Promise<void>;
/** Verify the signed-in staff user's password (any active admin role). */
export declare function assertAdminPasswordConfirm(actor: {
    id: string;
}, confirmPassword: string | undefined): Promise<void>;
export declare function extractConfirmPassword(body: Record<string, unknown>): string;
//# sourceMappingURL=super-admin-password.d.ts.map