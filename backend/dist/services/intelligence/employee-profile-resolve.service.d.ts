/**
 * Resolve staff actor to employee_profiles.id (Phase 0 convention).
 * Falls back to email match when only admin email is known (CRM assigned_to).
 */
export declare const employeeProfileResolveService: {
    byAdminUserId(adminUserId: string): Promise<string | null>;
    byEmail(email: string): Promise<string | null>;
    resolve(input: {
        employeeProfileId?: string | null;
        employeeEmail?: string | null;
        adminUserId?: string | null;
    }): Promise<string | null>;
};
//# sourceMappingURL=employee-profile-resolve.service.d.ts.map