/** Button ids, short acks, and system tokens — not farmer crop questions. */
export function isStructuredSystemMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (
    /^(lang|menu|soil|crop|plot|acreage|water|order|pay|chimb|feedback|roi|action|diagnosis)\./i.test(
      t
    )
  ) {
    return true;
  }
  if (/^(hi|hello)$/i.test(t)) return true;
  if (/^(yes|no|ok|okay|thanks|thank you|👍|👋)$/i.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  return false;
}
