import type { IssueCategory } from '../../domain/ai-training/enums.js';
export declare const fieldFindingsMastersService: {
    listIssueMaster(opts?: {
        category?: IssueCategory;
        cropType?: string;
        q?: string;
        limit?: number;
    }): Promise<{
        id: string;
        category: string;
        issueName: string;
        conceptCode: string | null;
        cropType: string | null;
    }[]>;
    createIssueMaster(input: {
        category: IssueCategory;
        issueName: string;
        conceptCode?: string;
        cropType?: string;
        sortOrder?: number;
    }): Promise<any>;
    deactivateIssueMaster(id: string): Promise<{
        ok: boolean;
    }>;
    listMeasurementTemplates(cropType: string): Promise<{
        id: string;
        cropType: string;
        measurementKey: string;
        labelEn: string;
        labelMl: string | null;
        unit: string | null;
        inputType: string;
        options: any;
        required: boolean;
        sortOrder: number;
    }[]>;
    upsertMeasurementTemplate(input: {
        cropType: string;
        measurementKey: string;
        labelEn: string;
        unit?: string;
        inputType?: string;
        sortOrder?: number;
    }): Promise<any>;
};
//# sourceMappingURL=field-findings-masters.service.d.ts.map