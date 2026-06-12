export interface SignupInput {
    email?: string;
    firstName: string;
    lastName: string;
    phone: string;
    password: string;
    acceptTerms: boolean;
    newsletter: boolean;
    /** website (default) or mobile app */
    channel?: 'website' | 'mobile';
    utmCampaign?: string;
    utmSource?: string;
    utmMedium?: string;
}
export interface LoginInput {
    email: string;
    password: string;
}
export declare const farmerAuthService: {
    signup(input: SignupInput): Promise<{
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
            preferredLanguage: string;
            createdAt: unknown;
        };
    }>;
    login(input: LoginInput): Promise<{
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
            preferredLanguage: string;
            createdAt: unknown;
        };
    }>;
    me(farmerId: string): Promise<{
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
        preferredLanguage: string;
        createdAt: unknown;
    }>;
};
//# sourceMappingURL=farmer-auth.service.d.ts.map