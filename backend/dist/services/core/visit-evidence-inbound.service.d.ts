export declare const visitEvidenceInboundService: {
    tryHandleFarmerMessage(params: {
        farmerId: string;
        msgType: string;
        text?: string | null;
    }): Promise<{
        handled: boolean;
        ack?: string;
    }>;
};
//# sourceMappingURL=visit-evidence-inbound.service.d.ts.map