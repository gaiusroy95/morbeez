import type { DiagnoseInput, DiagnoseResult, StructuredAdvisory } from './types.js';
export { buildSymptomKey, buildLooseSymptomKey } from './question-reuse-keys.util.js';
export declare function buildDapBucket(dap: number): number;
export declare const aiReuseService: {
    peekMatch(input: {
        farmerId: string;
        cropType: string;
        symptomsText?: string;
        voiceTranscript?: string;
        compactHistory?: string;
        activePlotId?: string | null;
    }): Promise<boolean>;
    findReusableCase(params: {
        cropType: string;
        district: string | null;
        dapBucket: number;
        symptomKey: string;
    }): Promise<{
        id: string;
        sourceSessionId: string;
        advisory: StructuredAdvisory;
        products: DiagnoseResult["productRecommendations"];
        issueLabel: string;
    } | null>;
    indexSuccessfulCase(params: {
        sessionId: string;
        farmerId: string;
        cropType: string;
        district: string | null;
        dap: number;
        symptomKey: string;
        advisory: StructuredAdvisory;
        products: DiagnoseResult["productRecommendations"];
        escalated: boolean;
    }): Promise<void>;
    markOutcomeForSession(sessionId: string | null | undefined, outcomeOk: boolean): Promise<void>;
    findReusableForFarmerMessage(params: {
        cropType: string;
        district: string | null;
        dapBucket: number;
        text: string;
        voiceTranscript?: string;
        compactHistory?: string;
        issueLabelHint?: string | null;
    }): Promise<{
        id: string;
        sourceSessionId: string;
        advisory: StructuredAdvisory;
        products: DiagnoseResult["productRecommendations"];
        issueLabel: string;
    } | null>;
    tryReuse(input: DiagnoseInput & {
        activePlotId?: string | null;
    }, sessionId: string): Promise<DiagnoseResult | null>;
};
//# sourceMappingURL=ai-reuse.service.d.ts.map