import { detectFarmActivityLanguage } from '../../services/farm-activity/farm-activity-language.service.js';
import { CALL_LANGUAGES, type CallLanguage } from './types.js';

export function isCallLanguage(value: string | null | undefined): value is CallLanguage {
  return Boolean(value && (CALL_LANGUAGES as readonly string[]).includes(value));
}

export function normalizeCallLanguage(value: string | null | undefined): CallLanguage {
  return isCallLanguage(value) ? value : 'en';
}

/**
 * First-speech language lock. Native script in the utterance always wins over
 * a stored English default. Later calls keep the locked preference unless
 * `force` is set by staff.
 */
export function detectCallLanguage(
  speech: string,
  storedPreference?: string | null
): { language: CallLanguage; shouldLock: boolean; source: 'first_speech' | 'stored' } {
  const stored = normalizeCallLanguage(storedPreference);
  const text = speech.trim();
  if (!text) {
    return { language: stored, shouldLock: false, source: 'stored' };
  }

  const detected = detectFarmActivityLanguage(text, stored).detectedLanguage;
  const language = normalizeCallLanguage(detected);
  const hasNativeScript = /[\u0900-\u097F\u0B80-\u0D7F]/u.test(text);
  const shouldLock = language !== 'en' || hasNativeScript || stored === 'en';
  return {
    language,
    shouldLock: shouldLock && language !== stored,
    source: 'first_speech',
  };
}
