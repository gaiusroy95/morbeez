/** Persist farmer WhatsApp / API crop photos for agronomist case review. */
export declare const advisoryImageStorageService: {
    uploadFromBase64(farmerId: string, dataBase64: string, mimeType?: string): Promise<string | null>;
};
export declare function downloadAdvisoryImageBase64(path: string | null | undefined): Promise<{
    base64: string;
    mimeType: string;
} | null>;
export declare function resolveAdvisoryImageUrl(path: string | null | undefined): Promise<string | null>;
export declare function urlFromWhatsAppPayload(payload: Record<string, unknown> | null | undefined): string | null;
//# sourceMappingURL=advisory-image-storage.service.d.ts.map