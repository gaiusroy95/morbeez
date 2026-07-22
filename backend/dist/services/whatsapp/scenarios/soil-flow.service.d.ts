import { type SoilLabMetrics } from '../../soil/soil-lab-metrics.js';
import type { InboundMessage } from '../pipeline/types.js';
import type { AdvisoryLanguage } from '../../ai/types.js';
type SoilMenuList = {
    body: string;
    buttonText: string;
    sections: Array<{
        title: string;
        rows: Array<{
            id: string;
            title: string;
            description?: string;
        }>;
    }>;
};
/** Scenarios 12–14, 43 — soil testing flows. */
export declare const soilFlowService: {
    soilMenuList(language: AdvisoryLanguage): SoilMenuList;
    hasSoilReport(farmerId: string): Promise<boolean>;
    handleLowYieldWithoutReport(_farmerId: string, language: AdvisoryLanguage): Promise<{
        body: string;
        list: SoilMenuList;
    }>;
    addressReply(language: AdvisoryLanguage): string;
    requestSoilTesting(farmerId: string, language: AdvisoryLanguage): Promise<string>;
    reportReceivedReply(language: AdvisoryLanguage): string;
    resolveSoilBlockId(farmerId: string, preferredBlockId?: string | null): Promise<string | null>;
    /**
     * Download WhatsApp soil report (photo/PDF), store file, insert crm_soil_reports
     * so telecaller portal + farmer/agronomist apps can display it on the block.
     */
    saveUploadedReportFromWhatsApp(params: {
        farmerId: string;
        msg: InboundMessage;
        blockId?: string | null;
    }): Promise<{
        reportId: string | null;
        pdfUrl: string | null;
        blockId: string | null;
    }>;
    macroEntryPrompt(lang: AdvisoryLanguage): string;
    microEntryPrompt(lang: AdvisoryLanguage): string;
    soilTypeEntryPrompt(lang: AdvisoryLanguage): string;
    parseSoilTypeInput(text: string): string | null;
    saveLabMetrics(farmerId: string, metrics: SoilLabMetrics, options?: {
        blockId?: string;
        uploadedBy?: string;
    }): Promise<string>;
    parseMacroInput(text: string): SoilLabMetrics | null;
    parseMicroInput(draft: SoilLabMetrics, text: string): SoilLabMetrics | null;
    savedLabReply(lang: AdvisoryLanguage, summary: string): string;
    invalidValuesReply(lang: AdvisoryLanguage, step: "macro" | "micro"): string;
    draftFromContext(ctx: Record<string, unknown>): SoilLabMetrics;
    draftToContext(metrics: SoilLabMetrics): Record<string, unknown>;
    metricsHasValues(metrics: SoilLabMetrics): boolean;
};
export {};
//# sourceMappingURL=soil-flow.service.d.ts.map