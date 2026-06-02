import { createHash } from 'node:crypto';
import { normalizeRegionalFarmerQuery } from './regional-query-normalize.util.js';

/** Strip punctuation and collapse whitespace (keeps letters/numbers in any script). */
export function normalizeQuestionText(text: string): string {
  const regional = normalizeRegionalFarmerQuery(text);
  return regional
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSymptomKey(...parts: (string | undefined)[]): string {
  const raw = normalizeQuestionText(parts.filter(Boolean).join(' ')).slice(0, 240);
  if (!raw) return '_image_';
  return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'my',
  'on',
  'in',
  'of',
  'to',
  'for',
  'and',
  'or',
  'what',
  'why',
  'how',
  'me',
  'hai',
  'ho',
  'ka',
  'ke',
  'ki',
  'ko',
  'mein',
  'par',
  'aur',
  'kya',
  'ye',
  'yeh',
  'mera',
  'meri',
  'mere',
]);

/** Romanized / informal spellings → canonical tokens for reuse keys. */
const TOKEN_ALIASES: Record<string, string> = {
  adrak: 'ginger',
  adhrak: 'ginger',
  inji: 'ginger',
  injhi: 'ginger',
  haldi: 'turmeric',
  mirch: 'chilli',
  mirchi: 'chilli',
  peele: 'yellow',
  peela: 'yellow',
  pila: 'yellow',
  peeli: 'yellow',
  patte: 'leaf',
  patta: 'leaf',
  pat: 'leaf',
  dhabbe: 'spot',
  dhabba: 'spot',
  dabbe: 'spot',
  dabba: 'spot',
  kana: 'sprout',
  kanaya: 'sprout',
  sprout: 'sprout',
  sprouting: 'sprout',
  chimb: 'chimb',
  chimbi: 'chimb',
};

function canonicalToken(token: string): string {
  if (token.length < 2) return '';
  return TOKEN_ALIASES[token] ?? token;
}

/**
 * Order-independent key — "yellow spots ginger" and "ginger yellow spots" match.
 */
export function buildLooseSymptomKey(...parts: (string | undefined)[]): string {
  const normalized = normalizeQuestionText(parts.filter(Boolean).join(' '));
  if (!normalized) return '_image_';

  const tokens = normalized
    .split(' ')
    .map(canonicalToken)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  if (!tokens.length) {
    return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
  }

  const sorted = [...new Set(tokens)].sort().join(' ');
  return createHash('sha256').update(sorted).digest('hex').slice(0, 24);
}

/** All lookup/index keys to try for one farmer utterance. */
export function buildQuestionReuseKeys(parts: {
  text: string;
  voiceTranscript?: string;
  compactHistory?: string;
  issueLabelHint?: string | null;
  intentSlug?: string | null;
}): string[] {
  const blob = [parts.text, parts.voiceTranscript, parts.compactHistory].filter(Boolean).join(' ');
  const keys = new Set<string>();

  keys.add(buildSymptomKey(blob));
  keys.add(buildLooseSymptomKey(blob));

  if (parts.intentSlug) keys.add(buildSymptomKey(parts.intentSlug));
  if (parts.issueLabelHint?.trim()) {
    keys.add(buildSymptomKey(parts.issueLabelHint.trim()));
    keys.add(buildLooseSymptomKey(parts.issueLabelHint.trim()));
  }

  return [...keys];
}
