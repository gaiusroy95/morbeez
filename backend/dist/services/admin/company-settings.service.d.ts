export type CompanySettings = {
    companyName: string;
    addressLine: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
    cin: string;
    gstin: string;
    licenceNumber: string;
    customerCareNumber: string;
    whatsappNumber: string;
    formattedAddress: string;
    updatedAt: string | null;
};
export declare const companySettingsService: {
    get(): Promise<CompanySettings>;
    update(input: Partial<{
        companyName: string;
        addressLine: string;
        district: string;
        state: string;
        country: string;
        pincode: string;
        cin: string;
        gstin: string;
        licenceNumber: string;
        customerCareNumber: string;
        whatsappNumber: string;
    }>, adminId?: string): Promise<CompanySettings>;
    /** Snapshot stored on invoices and exposed to storefront */
    snapshot(): Promise<CompanySettings & {
        companySnapshot: Record<string, string>;
    }>;
};
//# sourceMappingURL=company-settings.service.d.ts.map