import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';

const STANDARD_TO_REGIONAL: Array<{ pattern: RegExp; regional: string }> = [
  { pattern: /\bshoot emergence\b/gi, regional: '' },
  { pattern: /\bnew sprout(s)?\b/gi, regional: '' },
  { pattern: /\bnew shoot(s)?\b/gi, regional: '' },
  { pattern: /\btiller emergence\b/gi, regional: '' },
];

type ProfilePreferred = { conceptId?: string; termId?: string; regionalTerm?: string };

async function loadProfilePreferred(
  language: AdvisoryLanguage,
  district?: string | null
): Promise<Map<string, string>> {
  if (!district) return new Map();
  const { data, error } = await supabase
    .from('terminology_localization_profiles')
    .select('preferred_terms')
    .eq('language', language)
    .eq('district', district)
    .maybeSingle();
  throwIfSupabaseError(error, 'Could not load localization profile');
  const map = new Map<string, string>();
  for (const item of (data?.preferred_terms as ProfilePreferred[] | null) ?? []) {
    if (item.conceptId && item.regionalTerm) map.set(String(item.conceptId), String(item.regionalTerm));
  }
  return map;
}

/**
 * Stage 8 — Response Localization Engine
 * Swap standard scientific phrases → farmer regional terms when known.
 */
export const responseLocalizationService = {
  async localize(params: {
    standardResponse: string;
    detection: TerminologyDetectionResult | null;
    language: AdvisoryLanguage;
    district?: string | null;
  }): Promise<string> {
    let text = params.standardResponse.trim();
    if (!text || !params.detection?.knownTerms.length) return text;

    const profileTerms = await loadProfilePreferred(params.language, params.district);

    for (const known of params.detection.knownTerms) {
      if (known.replyPreferred === false) continue;

      const regional =
        (known.conceptId && profileTerms.get(known.conceptId)) || known.token;
      const std = known.standardTerm ?? known.meaning;
      if (!std || !regional) continue;

      const stdParts = std.split(/\s*\/\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      for (const part of stdParts) {
        if (part.length < 4) continue;
        const re = new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        text = text.replace(re, regional);
      }

      for (const rule of STANDARD_TO_REGIONAL) {
        text = text.replace(rule.pattern, regional || known.token);
      }
    }

    return text;
  },

  /** Sync wrapper for callers that cannot await. */
  localizeSync(params: {
    standardResponse: string;
    detection: TerminologyDetectionResult | null;
    language: AdvisoryLanguage;
  }): string {
    let text = params.standardResponse.trim();
    if (!text || !params.detection?.knownTerms.length) return text;

    for (const known of params.detection.knownTerms) {
      if (known.replyPreferred === false) continue;
      const regional = known.token;
      const std = known.standardTerm ?? known.meaning;
      if (!std || !regional) continue;
      const stdParts = std.split(/\s*\/\s*|\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      for (const part of stdParts) {
        if (part.length < 4) continue;
        const re = new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        text = text.replace(re, regional);
      }
    }
    return text;
  },

  farmerPendingCopy(language: AdvisoryLanguage): string {
    if (language === 'ml') {
      return 'മനസ്സിലായി 👍\n\nഈ പ്രാദേശിക പദം ഞങ്ങളുടെ crop team verify ചെയ്യുന്നു. വേഗത്തിൽ മറുപടി നൽകാം.';
    }
    if (language === 'hi') {
      return 'समझ गया 👍\n\nयह स्थानीय शब्द हमारी crop team verify कर रही है। जल्द जवाब मिलेगा।';
    }
    return 'Understood 👍\n\nWe are verifying this local term with our crop team. You will get a clear answer soon.';
  },
};
