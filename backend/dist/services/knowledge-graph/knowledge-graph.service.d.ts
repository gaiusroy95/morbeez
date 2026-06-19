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
    upsertNode(nodeType: string, label: string, metadata?: Record<string, unknown>): Promise<void>;
};
//# sourceMappingURL=knowledge-graph.service.d.ts.map