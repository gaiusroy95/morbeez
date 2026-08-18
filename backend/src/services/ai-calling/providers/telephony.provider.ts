import { env } from '../../../config/env.js';
import { exotelService } from '../../call-intelligence/exotel.service.js';
import { logger } from '../../../lib/logger.js';

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
export const callingTelephonyProvider = {
  isExotelConfigured(): boolean {
    return exotelService.isConfigured();
  },

  isVoicebotConfigured(): boolean {
    return (
      env.ENABLE_AI_CALLING_VOICE === true &&
      Boolean(env.SARVAM_API_KEY?.trim()) &&
      this.isExotelConfigured()
    );
  },

  async initiate(input: TelephonyInitiateInput): Promise<TelephonyInitiateResult> {
    if (!this.isVoicebotConfigured()) {
      return { mode: 'unavailable', providerCallId: null, status: 'voicebot_not_configured' };
    }

    logger.info(
      { farmerId: input.farmerId, fromDid: input.fromDid ?? null },
      'AI calling voicebot path is flagged on — still no conversational Exotel applet; refusing to fake a live call'
    );
    return { mode: 'unavailable', providerCallId: null, status: 'voicebot_applet_missing' };
  },

  /** Human agronomist click-to-call for queued_for_agent jobs. */
  async clickToCall(input: {
    leadId: string;
    farmerPhone: string;
    agentEmail: string;
  }): Promise<{ callLogId: string; mode: 'exotel' | 'native'; dialPhone?: string }> {
    const result = await exotelService.initiateClickToCall(input);
    return {
      callLogId: result.callLogId,
      mode: result.mode,
      dialPhone: result.dialPhone,
    };
  },
};
