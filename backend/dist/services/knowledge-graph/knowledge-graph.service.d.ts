export type KgNodeRow = {
    id: string;
    node_type: string;
    label: string;
    crop_type?: string | null;
    metadata?: Record<string, unknown>;
};
export declare const knowledgeGraphService: {
    queryCandidates(params: {
        cropType: string;
        symptoms: string[];
        limit?: number;
    }): Promise<Array<{
        label: string;
        relation: string;
        weight: number;
    }>>;
    listNodes(crop?: string, q?: string): Promise<KgNodeRow[]>;
    upsertNode(nodeType: string, label: string, metadata?: Record<string, unknown>): Promise<any>;
    updateNode(id: string, patch: {
        label?: string;
        nodeType?: string;
        cropType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    deleteNode(id: string): Promise<void>;
};
//# sourceMappingURL=knowledge-graph.service.d.ts.map