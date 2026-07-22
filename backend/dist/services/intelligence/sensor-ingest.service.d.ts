export declare const sensorIngestService: {
    ingest(input: {
        blockId: string;
        farmerId: string;
        sensorType: string;
        value: number;
        unit?: string;
        recordedAt?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    listForBlock(blockId: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=sensor-ingest.service.d.ts.map