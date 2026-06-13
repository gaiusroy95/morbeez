export declare const exotelService: {
    isConfigured(): boolean;
    initiateClickToCall(input: {
        leadId: string;
        farmerPhone: string;
        agentEmail: string;
    }): Promise<{
        callLogId: string;
        providerCallId: string | null;
        status: string;
    }>;
    handleStatusWebhook(payload: Record<string, unknown>): Promise<{
        ok: boolean;
        callId?: undefined;
    } | {
        ok: boolean;
        callId: string;
    }>;
};
//# sourceMappingURL=exotel.service.d.ts.map