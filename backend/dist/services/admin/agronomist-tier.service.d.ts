export type AgronomistTier = 'new' | 'experienced';
export declare const agronomistTierService: {
    getTierForAdmin(adminUserId: string, email: string): Promise<AgronomistTier | null>;
    canSelfApproveRecommendations(adminUserId: string, email: string, role: string): Promise<boolean>;
    assertOwnRecommendation(recommendationId: string, editorEmail: string): Promise<void>;
};
//# sourceMappingURL=agronomist-tier.service.d.ts.map