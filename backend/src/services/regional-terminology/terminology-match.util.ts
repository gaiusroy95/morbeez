/** Deterministic specificity scoring for scoped terminology / alias rows. */

export type ScopedLexiconRow = {
  cropType?: string | null;
  district?: string | null;
  confidence?: number | null;
};

export type LexiconScope = {
  cropType?: string | null;
  district?: string | null;
};

/**
 * Higher is better. Negative means the row is out of scope for the request.
 * Tiers: district+crop (100+) → district (80+) → crop (60+) → language-global (40+).
 */
export function lexiconSpecificityScore(
  row: ScopedLexiconRow,
  scope: LexiconScope
): number {
  const rowCrop = normalizeScopeKey(row.cropType);
  const rowDistrict = normalizeScopeKey(row.district);
  const wantCrop = normalizeScopeKey(scope.cropType);
  const wantDistrict = normalizeScopeKey(scope.district);

  if (rowCrop && wantCrop && rowCrop !== wantCrop) return -1;
  if (rowDistrict && wantDistrict && rowDistrict !== wantDistrict) return -1;
  // Scoped row that requires a dimension the caller did not provide is unusable.
  if (rowCrop && !wantCrop) return -1;
  if (rowDistrict && !wantDistrict) return -1;

  let score = 0;
  if (rowDistrict && wantDistrict && rowDistrict === wantDistrict) {
    score += rowCrop && wantCrop && rowCrop === wantCrop ? 100 : 80;
  } else if (rowCrop && wantCrop && rowCrop === wantCrop) {
    score += 60;
  } else if (!rowCrop && !rowDistrict) {
    score += 40;
  } else {
    return -1;
  }

  const confidence = Number(row.confidence ?? 0);
  if (Number.isFinite(confidence)) score += Math.min(Math.max(confidence, 0), 1);
  return score;
}

export function pickBestScopedRow<
  T extends ScopedLexiconRow,
>(rows: T[], scope: LexiconScope): T | null {
  let best: T | null = null;
  let bestScore = -1;
  for (const row of rows) {
    const score = lexiconSpecificityScore(row, scope);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

export function normalizeScopeKey(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function normalizeLexiconToken(token: string): string {
  return token.trim().toLowerCase();
}
