import type { AdvisoryLanguage, StructuredAdvisory } from '../../ai/types.js';
import { type CompatibilityLookupResult } from './compatibility-lookup.service.js';
import type { FarmerMemorySnapshot } from './farmer-memory.service.js';
export type PolishTask = 'compatibility' | 'diagnosis' | 'agronomy';
export declare function buildDiagnosisLockedFacts(advisory: StructuredAdvisory): string;
export declare const farmerReplyPolishService: {
    isEnabled(): boolean;
    polish(params: {
        factualDraft: string;
        language: AdvisoryLanguage;
        task: PolishTask;
        memory?: FarmerMemorySnapshot;
        lockedFacts: string;
        footer?: string | null;
    }): Promise<string>;
    polishCompatibilityReply(params: {
        lookup: CompatibilityLookupResult;
        pair: {
            productA: string;
            productB: string;
        };
        language: AdvisoryLanguage;
        memory?: FarmerMemorySnapshot;
    }): Promise<string>;
    polishDiagnosisSummary(params: {
        advisory: StructuredAdvisory;
        language: AdvisoryLanguage;
        memory: FarmerMemorySnapshot;
        extraLines?: string[];
    }): Promise<string>;
};
//# sourceMappingURL=farmer-reply-polish.service.d.ts.map