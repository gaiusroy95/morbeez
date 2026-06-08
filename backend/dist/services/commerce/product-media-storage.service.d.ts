export declare const productMediaStorageService: {
    upload(input: {
        fileName: string;
        mimeType: string;
        dataBase64: string;
        productId?: string | null;
        folder?: string;
    }): Promise<{
        url: string;
        path: string;
    }>;
};
//# sourceMappingURL=product-media-storage.service.d.ts.map