export type FarmActivityLanguageCode = 'en' | 'ml' | 'ta' | 'kn' | 'hi';

export type FarmActivityLanguageDetection = {
  detectedLanguage: FarmActivityLanguageCode;
  codeMixed: boolean;
};

const SCRIPT_PATTERNS: Record<Exclude<FarmActivityLanguageCode, 'en'>, RegExp> = {
  ml: /[\u0D00-\u0D7F]/gu,
  ta: /[\u0B80-\u0BFF]/gu,
  kn: /[\u0C80-\u0CFF]/gu,
  hi: /[\u0900-\u097F]/gu,
};

const ROMANIZED_TERMS: Record<Exclude<FarmActivityLanguageCode, 'en'>, Set<string>> = {
  ml: new Set(['anu', 'cheythu', 'innu', 'kilo', 'krishi', 'mazha', 'nattu', 'thottam', 'vila']),
  ta: new Set(['indru', 'panninen', 'payir', 'mazhai', 'nilam', 'vivasayam', 'velai', 'vithai']),
  kn: new Set(['beLe', 'holadalli', 'indu', 'kelasa', 'krushi', 'maLe', 'maaDidde', 'thota'].map((v) => v.toLowerCase())),
  hi: new Set(['aaj', 'fasal', 'khet', 'khad', 'kiya', 'mazdoor', 'paani', 'rupaye']),
};

const ENGLISH_TERMS = new Set([
  'acre', 'applied', 'bag', 'bought', 'cost', 'day', 'field', 'harvested', 'hour',
  'kg', 'labour', 'litre', 'paid', 'plot', 'sprayed', 'today', 'worker',
]);

function normalizeHint(hint?: string | null): FarmActivityLanguageCode | null {
  const code = hint?.trim().toLowerCase().split(/[-_]/u)[0];
  return code === 'en' || code === 'ml' || code === 'ta' || code === 'kn' || code === 'hi'
    ? code
    : null;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Detects the language from the final text/transcript. The stored preference is
 * only a tie-breaker and never overrides a script observed in the transcript.
 */
export function detectFarmActivityLanguage(
  transcript: string,
  storedPreference?: string | null
): FarmActivityLanguageDetection {
  const text = transcript.normalize('NFKC');
  const words = text.toLowerCase().match(/[a-z]+/gu) ?? [];
  const scores = new Map<FarmActivityLanguageCode, number>([['en', 0]]);
  const observedScripts: FarmActivityLanguageCode[] = [];

  for (const [code, pattern] of Object.entries(SCRIPT_PATTERNS) as Array<
    [Exclude<FarmActivityLanguageCode, 'en'>, RegExp]
  >) {
    const score = countMatches(text, pattern);
    scores.set(code, score);
    if (score > 0) observedScripts.push(code);
  }

  let englishSignals = 0;
  for (const word of words) {
    if (ENGLISH_TERMS.has(word)) englishSignals += 1;
    for (const [code, terms] of Object.entries(ROMANIZED_TERMS) as Array<
      [Exclude<FarmActivityLanguageCode, 'en'>, Set<string>]
    >) {
      if (terms.has(word)) scores.set(code, (scores.get(code) ?? 0) + 2);
    }
  }
  scores.set('en', englishSignals);

  const hint = normalizeHint(storedPreference);
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const strongest = ranked[0];
  const detectedLanguage = strongest && strongest[1] > 0
    ? strongest[0]
    : hint ?? 'en';
  const languageSignals = ranked.filter(([, score]) => score > 0).map(([code]) => code);
  const hasNativeScript = observedScripts.length > 0;
  const hasLatinContent = words.length > 0;
  const codeMixed = new Set(languageSignals).size > 1
    || observedScripts.length > 1
    || (hasNativeScript && hasLatinContent && englishSignals > 0);

  return { detectedLanguage, codeMixed };
}

export const farmActivityLanguageService = {
  detect: detectFarmActivityLanguage,
};
