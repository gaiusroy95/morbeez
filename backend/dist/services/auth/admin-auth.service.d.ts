export interface AdminLoginInput {
    phone?: string;
    email?: string;
    password: string;
}
export declare const adminAuthService: {
    login(input: AdminLoginInput): Promise<{
        token: string;
        admin: {
            id: unknown;
            email: string | undefined;
            fullName: unknown;
            role: unknown;
            lastLoginAt: unknown;
            createdAt: unknown;
        };
    }>;
    me(adminId: string): Promise<{
        id: unknown;
        email: string | undefined;
        fullName: unknown;
        role: unknown;
        lastLoginAt: unknown;
        createdAt: unknown;
    }>;
};
//# sourceMappingURL=admin-auth.service.d.ts.map