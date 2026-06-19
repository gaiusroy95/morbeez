import type { GingerSopBuildInput, GingerSopCase } from '../../domain/ginger-sop/types.js';
declare function isGingerCrop(cropType: string): boolean;
export declare const gingerSopCaseService: {
    isGingerCrop: typeof isGingerCrop;
    resolveIdentity(farmerId: string, blockId?: string | null): Promise<{
        farmerId: string;
        blockId: string | null;
        cropType: string;
        variety: string | null;
        acreage: number | null;
        plantingDate: string | null;
        dap: number | null;
        complete: boolean;
        missingFields: string[];
    }>;
    buildCase(input: GingerSopBuildInput): Promise<GingerSopCase | null>;
    persistToSession(sessionId: string, gingerCase: GingerSopCase): Promise<void>;
    formatTelecallerNotes(gingerCase: GingerSopCase): string;
};
export {};
//# sourceMappingURL=ginger-sop-case.service.d.ts.map