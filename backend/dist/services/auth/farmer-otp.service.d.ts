export declare const farmerOtpService: {
    sendOtp(phoneRaw: string, ipAddress?: string): Promise<{
        devOtp?: string | undefined;
        sent: boolean;
        expiresInSeconds: number;
    }>;
    verifyOtp(phoneRaw: string, codeRaw: string): Promise<{
        token: string;
        farmer: {
            id: unknown;
            email: unknown;
            firstName: unknown;
            lastName: unknown;
            name: unknown;
            phone: unknown;
            village: unknown;
            district: {} | null;
            state: {} | null;
            pincode: {} | null;
            shippingAddress: {} | null;
            deliveryPincode: {} | null;
            newsletterSubscribed: unknown;
            hasPassword: boolean;
            createdAt: unknown;
        };
    }>;
};
//# sourceMappingURL=farmer-otp.service.d.ts.map