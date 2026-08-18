import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import type { CallLanguage } from '../../../domain/ai-calling/types.js';

/**
 * Voice AI adapter. STT can reuse Whisper when audio exists. TTS is Sarvam when
 * keyed — never synthesize a "completed call" without a real provider response.
 */
export const callingVoiceAiProvider = {
  isTtsConfigured(): boolean {
    return Boolean(env.SARVAM_API_KEY?.trim());
  },

  async synthesize(_text: string, _language: CallLanguage): Promise<{ audioUrl: string } | null> {
    if (!this.isTtsConfigured()) return null;
    logger.warn('Sarvam TTS is keyed but the live voicebot applet is not wired — skipping synthesis');
    return null;
  },
};
