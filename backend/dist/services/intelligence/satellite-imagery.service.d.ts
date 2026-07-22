export declare const satelliteImageryService: {
    recordOverlay(input: {
        blockId: string;
        farmerId: string;
        overlayType: string;
        captureDate: string;
        ndviMean?: number;
        storageUrl?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    listForBlock(blockId: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=satellite-imagery.service.d.ts.map