export type ClickToCallResult = {
    callLogId: string;
    providerCallId: string | null;
    status: string;
    mode: 'exotel' | 'native';
    dialPhone?: string;
};
export declare const exotelService: {
    isConfigured(): boolean;
    initiateNativeDialFallback(input: {
        leadId: string;
        farmerPhone: string;
        agentEmail: string;
        farmerId: string;
    }): Promise<ClickToCallResult>;
    initiateClickToCall(input: {
        leadId: string;
        farmerPhone: string;
        agentEmail: string;
    }): Promise<ClickToCallResult>;
    handleStatusWebhook(payload: Record<string, unknown>): Promise<{
        ok: boolean;
        callId?: undefined;
    } | {
        ok: boolean;
        callId: string;
    }>;
};
//# sourceMappingURL=exotel.service.d.ts.map