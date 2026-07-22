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
    termsAndConditions: string;
    quotationLogoUrl: string;
    bankAccountName: string;
    bankAccountNumber: string;
    bankName: string;
    bankBranch: string;
    bankIfsc: string;
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
        termsAndConditions: string;
        quotationLogoUrl: string | null;
        bankAccountName: string;
        bankAccountNumber: string;
        bankName: string;
        bankBranch: string;
        bankIfsc: string;
    }>, adminId?: string): Promise<CompanySettings>;
    /** Snapshot stored on invoices and exposed to storefront */
    snapshot(): Promise<CompanySettings & {
        companySnapshot: Record<string, string>;
    }>;
};
//# sourceMappingURL=company-settings.service.d.ts.map