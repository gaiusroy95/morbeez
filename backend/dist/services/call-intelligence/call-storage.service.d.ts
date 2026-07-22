export declare const callStorageService: {
    uploadAudio(input: {
        farmerId: string;
        leadId: string;
        filename: string;
        mimeType: string;
        dataBase64: string;
    }): Promise<{
        storagePath: string;
        publicUrl: string;
    }>;
    download(storagePath: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
    downloadFromUrl(url: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
};
//# sourceMappingURL=call-storage.service.d.ts.map