export declare const agronomistEarningsTriggers: {
    onVisitCheckout(session: {
        id: string;
        agronomist_email: string;
        farmer_id: string;
        field_finding_id?: string | null;
        check_in_lat?: number | null;
        check_in_lng?: number | null;
        check_out_lat?: number | null;
        check_out_lng?: number | null;
    }): void;
    onStructuredVisitSubmitted(params: {
        findingId: string;
        agronomistEmail: string;
        farmerId: string;
    }): void;
    onRecommendationApplied(recommendationRecordId: string): void;
    onEscalationResolved(params: {
        escalationId: string;
        assignedTo?: string | null;
        agentEmail: string;
        farmerId?: string | null;
    }): void;
    onOrderPaidForAssignedFarmer(params: {
        farmerId: string;
        orderId: string;
    }): void;
};
//# sourceMappingURL=agronomist-earnings-triggers.d.ts.map