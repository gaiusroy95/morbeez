export declare const staffOtpService: {
    sendOtp(phoneRaw: string, ipAddress?: string): Promise<{
        devOtp?: string | undefined;
        sent: boolean;
        expiresInSeconds: number;
    }>;
    verifyOtp(phoneRaw: string, codeRaw: string): Promise<{
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
};
//# sourceMappingURL=staff-otp.service.d.ts.map