import type { MaiosBuildInput, MaiosCase } from '../../domain/case/types.js';
export declare const caseBuilderService: {
    resolveIdentity(farmerId: string, blockId?: string | null, cropType?: string): Promise<{
        farmerId: string;
        blockId: string | null;
        cropType: string;
        cropPackId: string;
        variety: string | null;
        acreage: number | null;
        plantingDate: string | null;
        dap: number | null;
        stage: string | null;
        complete: boolean;
        missingFields: string[];
    }>;
    buildCase(input: MaiosBuildInput): Promise<MaiosCase | null>;
    formatTelecallerNotes(maiosCase: MaiosCase): string;
};
//# sourceMappingURL=case-builder.service.d.ts.map