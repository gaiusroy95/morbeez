export declare const bannerMediaStorageService: {
    upload(input: {
        fileName: string;
        mimeType: string;
        dataBase64: string;
        bannerId?: string | null;
    }): Promise<{
        url: string;
        path: string;
    }>;
};
//# sourceMappingURL=banner-media-storage.service.d.ts.map