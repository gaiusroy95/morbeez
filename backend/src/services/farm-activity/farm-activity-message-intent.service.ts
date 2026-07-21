/** Detect farmer messages that log work/costs — not crop-health questions. */

const ACTIVITY_INTENT_RE =
  /\b(spray|sprayed|fertiliz|fertilis|labour|labor|harvest|harvested|bought|purchase|purchased|expense|irrigat|weeded|plough|plow|applied|drench|scouting|workers?|wage|cost|spent|income|paid)\b|സ്പ്രേ|വളം|തൊഴിലാളി|വിളവെടുപ്പ്|വാങ്ങി|ചെലവ്|தொழிலாளர்|அறுவடை|வாங்கி|खरीदा|खर्च|मजदूर|ಕೊಂಡು|ಕೂಲಿ|ಸಿಂಪಡಣೆ/i;

const ACTIVITY_QUANTITY_RE =
  /\b\d+(?:\.\d+)?\s*(?:kg|g|kilograms?|litre?s?|liters?|ml|bags?|acres?|hours?|days?)\b|\b₹\s*\d+|\brs\.?\s*\d+|\bper\s+(?:acre|labou?r|worker|day)\b|\b\d+\s*:\s*\d+\s*:\s*\d+\b/i;

export function looksLikeFarmActivityMessage(text: string): boolean {
  const normalized = text.trim().replace(/^["']+|["']+$/g, '');
  if (normalized.length < 8) return false;
  if (!ACTIVITY_INTENT_RE.test(normalized)) return false;
  return ACTIVITY_QUANTITY_RE.test(normalized) || /\blabou?r\b/i.test(normalized);
}
