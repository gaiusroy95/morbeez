import type { CallLanguage } from '../../../domain/ai-calling/types.js';
/**
 * Voice AI adapter. STT can reuse Whisper when audio exists. TTS is Sarvam when
 * keyed — never synthesize a "completed call" without a real provider response.
 */
export declare const callingVoiceAiProvider: {
    isTtsConfigured(): boolean;
    synthesize(_text: string, _language: CallLanguage): Promise<{
        audioUrl: string;
    } | null>;
};
//# sourceMappingURL=voice-ai.provider.d.ts.map