/**
 * Normalize farmer text before reuse-key hashing so romanized, Malayalam script,
 * and English variants map to the same advisory (e.g. Kana / കണാ / sprout).
 */

const SCRIPT_REPLACEMENTS: Array<[RegExp, string]> = [
  [/കണാ|കണ/gu, ' sprout '],
  [/ചിമ്പ്|ചിമ്പ/gu, ' chimb '],
  [/ഇഞ്ചി|ഇഞ്ച/gu, ' ginger '],
  [/മഞ്ഞ/gu, ' yellow '],
  [/ഇല/gu, ' leaf '],
  [/പുള്ളി/gu, ' spot '],
];

/** Roman / informal → canonical English tokens (merged into loose reuse keys). */
const ROMAN_ALIASES: Record<string, string> = {
  kana: 'sprout',
  kanaya: 'sprout',
  kanay: 'sprout',
  sprout: 'sprout',
  sprouting: 'sprout',
  chimb: 'chimb',
  chimbi: 'chimb',
  adrak: 'ginger',
  adhrak: 'ginger',
  inji: 'ginger',
  injhi: 'ginger',
};

export function normalizeRegionalFarmerQuery(text: string): string {
  let t = text.trim();
  if (!t) return t;

  for (const [re, repl] of SCRIPT_REPLACEMENTS) {
    t = t.replace(re, repl);
  }

  const words = t.split(/\s+/).filter(Boolean);
  const expanded = words.map((w) => {
    const bare = w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    if (!bare) return w;
    return ROMAN_ALIASES[bare] ?? w;
  });

  return expanded.join(' ').replace(/\s+/g, ' ').trim();
}
