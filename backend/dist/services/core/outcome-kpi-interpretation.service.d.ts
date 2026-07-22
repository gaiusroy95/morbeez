import type { AdvisoryLanguage } from '../ai/types.js';
import { type ImprovementLevel, aiClassificationFromLevel } from '../../domain/ai-training/outcome-kpi.js';
export type InterpretedOutcomeKpi = {
    improvementLevel: ImprovementLevel;
    confidence: number;
    aiClassification: ReturnType<typeof aiClassificationFromLevel>;
    source: 'whatsapp_text' | 'whatsapp_ai';
    rawSnippet: string;
};
export declare const outcomeKpiInterpretationService: {
    interpretFarmerReply(params: {
        text: string;
        language: AdvisoryLanguage;
        issueLabel?: string | null;
        hasImage?: boolean;
    }): Promise<InterpretedOutcomeKpi | null>;
    fromRule(rule: {
        level: ImprovementLevel;
        confidence: number;
    }, snippet: string): InterpretedOutcomeKpi;
};
//# sourceMappingURL=outcome-kpi-interpretation.service.d.ts.map