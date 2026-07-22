import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { ContextPack } from '../whatsapp/pipeline/context-pack.service.js';
export type FieldActivitySnapshot = {
    label: string;
    date?: string;
    daysAgo?: string;
};
export type CropDoctorReportContext = {
    cropType?: string;
    cropStage?: string;
    variety?: string;
    dap?: number;
    location?: string;
    plotLabel?: string;
    contextPack?: ContextPack;
    reasoning?: MaiosReasoningSnapshot | null;
    weather?: {
        temperature?: string;
        humidity?: string;
        rainfall7d?: string;
        weather?: string;
        soilMoisture?: string;
    };
    lastFertilizer?: FieldActivitySnapshot;
    lastFoliarSpray?: FieldActivitySnapshot;
    lastDrench?: FieldActivitySnapshot;
    previousDisease?: string;
    previousRecommendation?: string;
    previousDiagnosisStatus?: string;
    soilSummary?: string;
    soilReportLines?: string[];
    soilReportDate?: string;
};
export declare const cropDoctorReportContextService: {
    build(params: {
        farmerId: string;
        blockId?: string | null;
        cropType?: string;
        cropStage?: string;
        plotLabel?: string;
        contextPack?: ContextPack;
        currentIssue?: string;
    }): Promise<CropDoctorReportContext>;
};
//# sourceMappingURL=crop-doctor-report-context.service.d.ts.map