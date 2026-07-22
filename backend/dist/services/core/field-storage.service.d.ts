export declare const fieldStorageService: {
    uploadPhotos(farmerId: string, files: Array<{
        filename: string;
        mimeType: string;
        dataBase64: string;
    }>, commandId?: string): Promise<string[]>;
    cleanupStagedCommand(farmerId: string, commandId: string): Promise<void>;
};
//# sourceMappingURL=field-storage.service.d.ts.map