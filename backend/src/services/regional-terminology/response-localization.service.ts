import type { AdvisoryLanguage } from '../ai/types.js';
import type { TerminologyDetectionResult } from './types.js';

const STANDARD_TO_REGIONAL: Array<{ pattern: RegExp; regional: string }> = [
  { pattern: /\bshoot emergence\b/gi, regional: '' },
  { pattern: /\bnew sprout(s)?\b/gi, regional: '' },
  { pattern: /\bnew shoot(s)?\b/gi, regional: '' },
  { pattern: /\btiller emergence\b/gi, regional: '' },
];

/**
 * Stage 8 — Response Localization Engine
 * Swap standard scientific phrases → farmer regional terms when known.
 */
export const responseLocalizationService = {
  localize(params: {
    standardResponse: string;
    detection: TerminologyDetectionResult | null;
    language: AdvisoryLanguage;
  }): string {
    let text = params.standardResponse.trim();
    if (!text || !params.detection?.knownTerms.length) return text;

    for (const known of params.detection.knownTerms) {
      const regional = known.token;
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

    if (params.language === 'ml' && params.detection.knownTerms.length) {
      const used = params.detection.knownTerms.map((k) => k.token).join(', ');
      if (!text.toLowerCase().includes(used.toLowerCase().split(',')[0] ?? '')) {
        /* keep natural — do not append glossary to every message */
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
