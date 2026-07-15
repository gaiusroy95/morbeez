import type { IssueCategory } from '../types/field-findings.js';

export type FarmerRecommendationRefined = {
  label: string;
  probability?: number;
  reason?: string;
  role?: string;
};

export type FarmerRecommendationSource = {
  suggestedDiagnosis?: string | null;
  suggestedDiagnoses?: string[];
  refinedConditions?: FarmerRecommendationRefined[];
};

export type FarmerRecommendationItem = {
  label: string;
  reason?: string;
  role?: string;
};

function normalizeLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Prefer refined WhatsApp conditions; fall back to farmer diagnosis list. */
export function collectFarmerRecommendations(
  source?: FarmerRecommendationSource | null
): FarmerRecommendationItem[] {
  const refined = source?.refinedConditions?.filter((c) => c.label?.trim()) ?? [];
  if (refined.length) {
    const seen = new Set<string>();
    const out: FarmerRecommendationItem[] = [];
    for (const c of refined) {
      const label = c.label.trim();
      const key = normalizeLabelKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        label,
        reason: c.reason?.trim() || undefined,
        role: c.role?.trim() || undefined,
      });
    }
    return out;
  }

  const diagnoses =
    source?.suggestedDiagnoses?.filter(Boolean) ??
    (source?.suggestedDiagnosis?.trim() ? [source.suggestedDiagnosis.trim()] : []);

  const seen = new Set<string>();
  const out: FarmerRecommendationItem[] = [];
  for (const raw of diagnoses) {
    const label = raw.trim();
    const key = normalizeLabelKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ label });
  }
  return out;
}

export function inferIssueCategoryFromFarmerLabel(label: string): IssueCategory {
  const t = label.toLowerCase();
  if (
    /deficien|potash|potassium|nitrogen|phosphorus|zinc|iron|magnesium|calcium|boron|manganese|copper|nutrient|\bfe\b|\bzn\b|\bmg\b|\bca\b/.test(
      t
    )
  ) {
    return 'nutrient_deficiency';
  }
  if (/water\s*stress|drought|moisture\s*stress|waterlog|irrigation/.test(t)) return 'water_stress';
  if (/thrips|mite|aphid|pest|borer|nematode|beetle|weevil|insect|whitefly/.test(t)) return 'pest';
  if (/toxic|excess|salt\s*injury/.test(t)) return 'nutrient_toxicity';
  if (/heat\s*stress|cold|frost|environmental/.test(t)) return 'environmental_stress';
  if (/\bsoil\b|drainage|compaction/.test(t)) return 'soil_problem';
  if (/weed/.test(t)) return 'weed';
  if (/fungal|fungus|anthracnose|blight|rot|spot|wilt|disease|mildew|rust|colletotrichum/.test(t)) {
    return 'disease';
  }
  return 'other';
}

export function issueMatchesFarmerLabel(
  issueName: string,
  farmerLabel: string,
  finalDiagnosis?: string | null
): boolean {
  const hay = `${issueName} ${finalDiagnosis ?? ''}`.toLowerCase();
  const nk = normalizeLabelKey(farmerLabel);
  const ik = normalizeLabelKey(hay);
  if (!nk || !ik) return false;
  if (ik.includes(nk) || nk.includes(ik)) return true;

  const labelTokens = nk.split(' ').filter((w) => w.length > 3);
  const matchCount = labelTokens.filter((tok) => hay.includes(tok)).length;
  if (labelTokens.length >= 2 && matchCount >= 2) return true;
  if (labelTokens.length === 1 && hay.includes(labelTokens[0]!)) return true;

  if (/potassium|potash/.test(nk) && /potassium|potash/.test(hay)) return true;
  if (/calcium/.test(nk) && /calcium/.test(hay)) return true;
  if (/anthracnose|fungal|leaf spot/.test(nk) && /anthracnose|fungal|leaf spot/.test(hay)) return true;
  if (/water\s*stress|drought|moisture/.test(nk) && /water|drought|moisture/.test(hay)) return true;

  return false;
}

export type FarmerRecommendationIssueDraft = {
  localId: string;
  category: IssueCategory;
  issueName: string;
  finalDiagnosis: string;
  selectedHypothesisLabel: string;
  severity: 'medium';
  status: 'open';
  observation?: string;
  photos: [];
};

export function buildIssueDraftFromFarmerRecommendation(params: {
  label: string;
  reason?: string;
  localId: string;
  observation?: string;
}): FarmerRecommendationIssueDraft {
  const category = inferIssueCategoryFromFarmerLabel(params.label);
  const obsParts = [
    params.observation?.trim(),
    params.reason?.trim() ? `Refine note: ${params.reason.trim()}` : null,
  ].filter(Boolean);

  return {
    localId: params.localId,
    category,
    issueName: params.label,
    finalDiagnosis: params.label,
    selectedHypothesisLabel: params.label,
    severity: 'medium',
    status: 'open',
    observation: obsParts.length ? obsParts.join('\n') : undefined,
    photos: [],
  };
}

export function slugFarmerLabel(label: string): string {
  return normalizeLabelKey(label).replace(/\s+/g, '-').slice(0, 48) || 'issue';
}
