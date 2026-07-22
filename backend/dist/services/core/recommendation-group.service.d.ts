export type RecommendationGroupMaterialInput = {
    issueId?: string | null;
    category: string;
    technicalName: string;
    dose?: string | null;
    method?: string | null;
    relatedIssueId?: string | null;
    sortOrder?: number;
};
export type RecommendationGroupInput = {
    applicationType: string;
    applicationDay?: number;
    sortOrder?: number;
    materials: RecommendationGroupMaterialInput[];
};
export type RecommendationGroupMaterialRow = {
    id: string;
    groupId: string;
    issueId: string | null;
    category: string;
    technicalName: string;
    dose: string | null;
    method: string | null;
    relatedIssueId: string | null;
    sortOrder: number;
};
export type RecommendationGroupRow = {
    id: string;
    fieldFindingId: string;
    applicationType: string;
    applicationDay: number;
    sortOrder: number;
    createdAt: string;
    materials: RecommendationGroupMaterialRow[];
};
declare function productsJsonForIssue(groups: RecommendationGroupRow[], visitIssueId: string): Array<Record<string, unknown>>;
export declare const recommendationGroupService: {
    productsJsonForIssue: typeof productsJsonForIssue;
    listByFieldFinding(fieldFindingId: string): Promise<RecommendationGroupRow[]>;
    getById(groupId: string): Promise<RecommendationGroupRow>;
    create(fieldFindingId: string, input: RecommendationGroupInput): Promise<RecommendationGroupRow>;
    update(groupId: string, input: Partial<RecommendationGroupInput>): Promise<RecommendationGroupRow>;
    delete(groupId: string): Promise<void>;
    replaceForFieldFinding(fieldFindingId: string, groups: RecommendationGroupInput[]): Promise<RecommendationGroupRow[]>;
    insertMaterials(groupId: string, materials: RecommendationGroupMaterialInput[]): Promise<RecommendationGroupMaterialRow[]>;
    primaryApplicationTypeForIssue(groups: RecommendationGroupRow[], visitIssueId: string): string | null;
};
export {};
//# sourceMappingURL=recommendation-group.service.d.ts.map