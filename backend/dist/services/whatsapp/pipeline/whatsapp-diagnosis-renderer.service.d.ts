import type { AdvisoryLanguage, StructuredAdvisory } from '../../ai/types.js';
export type RenderDiagnosisInput = {
    advisory: StructuredAdvisory;
    language: AdvisoryLanguage;
    plotLabel?: string;
    reuseNote?: string;
    safetyNote?: string;
    escalateNote?: string;
    /** When true, refuse generic farmerSummary-only output without photo observations. */
    requiresImageEvidence?: boolean;
};
declare function hasImageEvidence(advisory: StructuredAdvisory): boolean;
declare function hasRichSections(advisory: StructuredAdvisory): boolean;
export declare const whatsappDiagnosisRendererService: {
    hasRichSections: typeof hasRichSections;
    hasImageEvidence: typeof hasImageEvidence;
    render(input: RenderDiagnosisInput): string;
};
export {};
//# sourceMappingURL=whatsapp-diagnosis-renderer.service.d.ts.map