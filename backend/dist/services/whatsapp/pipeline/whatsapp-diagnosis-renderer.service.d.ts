import type { AdvisoryLanguage, StructuredAdvisory } from '../../ai/types.js';
export type RenderDiagnosisInput = {
    advisory: StructuredAdvisory;
    language: AdvisoryLanguage;
    plotLabel?: string;
    reuseNote?: string;
    safetyNote?: string;
    escalateNote?: string;
};
declare function hasRichSections(advisory: StructuredAdvisory): boolean;
export declare const whatsappDiagnosisRendererService: {
    hasRichSections: typeof hasRichSections;
    render(input: RenderDiagnosisInput): string;
};
export {};
//# sourceMappingURL=whatsapp-diagnosis-renderer.service.d.ts.map