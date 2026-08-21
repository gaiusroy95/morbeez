export type TelephonyInitiateInput = {
    farmerPhone: string;
    fromDid?: string | null;
    farmerId: string;
    leadId?: string | null;
    agentEmail: string;
};
export type TelephonyInitiateResult = {
    mode: 'voicebot' | 'click_to_call' | 'unavailable';
    providerCallId: string | null;
    status: string;
};
/**
 * Telephony adapter. Exotel today is click-to-call (human), not a conversational
 * voicebot. Until a voicebot URL exists, initiate() returns unavailable so the
 * orchestrator can use WhatsApp or a staff script instead of faking a call.
 */
export declare const callingTelephonyProvider: {
    isExotelConfigured(): boolean;
    isVoicebotConfigured(): boolean;
    initiate(input: TelephonyInitiateInput): Promise<TelephonyInitiateResult>;
    /** Human agronomist click-to-call for queued_for_agent jobs. */
    clickToCall(input: {
        leadId: string;
        farmerPhone: string;
        agentEmail: string;
    }): Promise<{
        callLogId: string;
        mode: "exotel" | "native";
        dialPhone?: string;
    }>;
};
//# sourceMappingURL=telephony.provider.d.ts.map