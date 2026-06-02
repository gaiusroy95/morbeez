import type { AdvisoryLanguage } from '../../ai/types.js';

const ALLOWED: AdvisoryLanguage[] = ['en', 'ml', 'ta', 'kn', 'hi'];

/** Normalize stored / session language code. */
export function normalizeLanguage(
  _detected: AdvisoryLanguage | null,
  stored?: string | null
): AdvisoryLanguage {
  if (stored && ALLOWED.includes(stored as AdvisoryLanguage)) return stored as AdvisoryLanguage;
  return 'en';
}
