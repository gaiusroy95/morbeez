export declare const retrainingOpsService: {
    listGoldQueue(limit?: number): Promise<{
        id: any;
        case_id: any;
        status: any;
        created_at: any;
        exported_at: any;
        metadata: any;
    }[]>;
    getEvalSummary(): Promise<{
        accuracy: number;
        falsePositiveRate: number;
        recoveryRate: number;
    } | {
        accuracy: null;
        falsePositiveRate: null;
        recoveryRate: null;
    }>;
    triggerWeeklyExport(): Promise<{
        exported: number;
        status: string;
    }>;
};
export declare const protocolDefinitionService: {
    list(cropType?: string): Promise<any[]>;
    create(input: {
        cropType: string;
        issueLabel: string;
        label: string;
        stages: unknown[];
        products: unknown[];
        createdBy?: string;
    }): Promise<any>;
    publish(id: string): Promise<any>;
    updateDraft(id: string, input: {
        label?: string;
        issueLabel?: string;
        stages?: unknown[];
        products?: unknown[];
    }): Promise<any>;
};
export declare const applicationHistoryService: {
    listForFarmer(farmerId: string, blockId?: string): Promise<any[]>;
    record(input: {
        farmerId: string;
        blockId?: string;
        productName: string;
        dose?: string;
        method: "spray" | "drench" | "fertigation" | "soil";
        source?: string;
        sourceId?: string;
    }): Promise<any>;
};
export declare const experimentDefinitionService: {
    list(status?: string): Promise<any[]>;
    get(id: string): Promise<any>;
    create(input: {
        experimentKey: string;
        label: string;
        hypothesis?: string;
        variants?: unknown[];
        createdBy?: string;
    }): Promise<any>;
    update(id: string, patch: {
        label?: string;
        hypothesis?: string;
        variants?: unknown[];
        status?: "draft" | "running" | "completed" | "archived";
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    remove(id: string): Promise<void>;
    assignOnVisitClose(fieldFindingId: string): Promise<{
        experimentId: string;
        variantKey: string;
    } | null>;
};
//# sourceMappingURL=enterprise-ops.service.d.ts.map