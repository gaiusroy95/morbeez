import type { AdvisoryLanguage } from '../../ai/types.js';
import type { TerminologyDetectionResult } from '../../regional-terminology/types.js';
export type FarmerMemorySnapshot = {
    farmerId: string;
    cropType: string;
    cropStage?: string;
    activePlotId: string | null;
    activePlotLabel?: string;
    dap?: number;
    district?: string;
    pincode?: string;
    recentIssues: string;
    lastSpray?: string;
    lastAdvisorySummary?: string;
    /** Chronological WhatsApp turns (Farmer / Assistant). */
    recentTurns: string[];
    /** Crop is known from plot, session, onboarding, or recent chat — do not re-ask. */
    knownCropLocked: boolean;
    onboardingComplete: boolean;
    /** Agronomist-approved regional cases + local practices for this crop */
    verifiedRegionalHints?: string;
    /** Approved regional word glossary for AI prompts */
    regionalTerminologyBlock?: string;
};
export declare const farmerMemoryService: {
    hasRecentThread(farmerId: string): Promise<boolean>;
    build(farmerId: string, options?: {
        symptomsText?: string;
        activePlotId?: string | null;
        terminologyDetection?: TerminologyDetectionResult | null;
        language?: AdvisoryLanguage;
    }): Promise<FarmerMemorySnapshot>;
    formatCompactHistory(memory: FarmerMemorySnapshot): string;
    formatConversationBlock(memory: FarmerMemorySnapshot, maxTurns?: number): string;
    knowsCrop(memory: FarmerMemorySnapshot): boolean;
    memoryAwareFallback(memory: FarmerMemorySnapshot, language: AdvisoryLanguage): string;
};
//# sourceMappingURL=farmer-memory.service.d.ts.map