import { env } from '../../../config/env.js';
import { exotelService } from '../../call-intelligence/exotel.service.js';
import { logger } from '../../../lib/logger.js';
/**
 * Telephony adapter. Exotel today is click-to-call (human), not a conversational
 * voicebot. Until a voicebot URL exists, initiate() returns unavailable so the
 * orchestrator can use WhatsApp or a staff script instead of faking a call.
 */
export const callingTelephonyProvider = {
    isExotelConfigured() {
        return exotelService.isConfigured();
    },
    isVoicebotConfigured() {
        return (env.ENABLE_AI_CALLING_VOICE === true &&
            Boolean(env.SARVAM_API_KEY?.trim()) &&
            this.isExotelConfigured());
    },
    async initiate(input) {
        if (!this.isVoicebotConfigured()) {
            return { mode: 'unavailable', providerCallId: null, status: 'voicebot_not_configured' };
        }
        logger.info({ farmerId: input.farmerId, fromDid: input.fromDid ?? null }, 'AI calling voicebot path is flagged on — still no conversational Exotel applet; refusing to fake a live call');
        return { mode: 'unavailable', providerCallId: null, status: 'voicebot_applet_missing' };
    },
    /** Human agronomist click-to-call for queued_for_agent jobs. */
    async clickToCall(input) {
        const result = await exotelService.initiateClickToCall(input);
        return {
            callLogId: result.callLogId,
            mode: result.mode,
            dialPhone: result.dialPhone,
        };
    },
};
//# sourceMappingURL=telephony.provider.js.map