type RubricCriterion = {
    key: string;
    label: string;
    maxPoints: number;
};
type QcResult = {
    totalScore: number;
    flagged: boolean;
    flagReason: string | null;
    rubric: Record<string, {
        score: number;
        maxPoints: number;
        note?: string;
    }>;
};
export declare const callQcService: {
    getActiveRubric(): Promise<RubricCriterion[]>;
    scoreCall(input: {
        transcript: string;
        summary: string;
        agentEmail: string;
    }): Promise<QcResult>;
    getOverview(days: number, agentEmail?: string): Promise<{
        callsToday: number;
        totalCalls: number;
        averageScore: number;
        interested: number;
        soilTestInterest: number;
        flaggedCalls: number;
    }>;
    listFlaggedCalls(days: number, limit?: number): Promise<{
        id: any;
        lead_id: any;
        farmer_id: any;
        agent_email: any;
        qc_score: any;
        qc_flag_reason: any;
        qc_rubric_json: any;
        transcript: any;
        ai_summary: any;
        created_at: any;
        farmers: {
            name: any;
            phone: any;
        }[];
    }[]>;
};
export {};
//# sourceMappingURL=call-qc.service.d.ts.map