import type { StructuredAdvisory } from '../ai/types.js';
import type { MaiosReasoningSnapshot, PosteriorEntry } from '../../domain/maios-reasoning/types.js';

export type DiagnosisRankRole = 'primary' | 'contributing' | 'disease_watch' | 'alternative';

export type DiagnosisRankItem = {
  label: string;
  probability: number;
  role: DiagnosisRankRole;
  stars: number;
};

export type DiagnosisPresentation = {
  headline: string;
  primaryLabel: string;
  primaryConfidence: number;
  ranked: DiagnosisRankItem[];
  diseaseWatch?: { label: string; probability: number; note: string };
  alignmentNote?: string;
  showLowConfidencePrimary: boolean;
};

const PRIMARY_CONFIDENCE_FLOOR = 0.5;
const DISEASE_WATCH_MIN = 0.15;
const NUTRIENT_LABEL_RE = /nutrient|deficien|uptake|potassium|nitrogen|magnesium/i;
const FUNGAL_LABEL_RE = /blast|anthracnose|fungal|leaf spot|rot|phytophthora/i;
const PEST_LABEL_RE = /thrip|mite|borer|weevil|insect/i;

export type TreatmentFocus = 'nutrient' | 'fungicide' | 'pest' | 'cultural' | 'mixed' | 'unknown';

function labelCategory(label: string): 'nutrient' | 'disease' | 'pest' | 'other' {
  const t = label.toLowerCase();
  if (NUTRIENT_LABEL_RE.test(t)) return 'nutrient';
  if (PEST_LABEL_RE.test(t)) return 'pest';
  if (FUNGAL_LABEL_RE.test(t)) return 'disease';
  return 'other';
}

export function inferTreatmentFocus(advisory: StructuredAdvisory): TreatmentFocus {
  const text = [
    ...advisory.dosageGuidance.map((d) => `${d.product} ${d.rate} ${d.method}`),
    ...advisory.treatments.map((t) => `${t.action} ${t.productType ?? ''}`),
    advisory.rootCorrection ?? '',
    advisory.agronomistAssessment ?? '',
    advisory.sprayTiming ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const nutrient = /potash|muriate|mop|npk|fertilizer|fertigation|k2o|potassium|urea|micronutrient|zinc|chelate/.test(
    text
  );
  const fungicide = /fungicide|mancozeb|azox|triflox|strobilurin|triazole|copper|carbendazim|propiconazole/.test(
    text
  );
  const pest = /insecticide|spinosad|emamectin|neem|thrips|imidacloprid/.test(text);
  const cultural = /drainage|irrigation|mulch|weed|canopy/.test(text);

  const hits = [nutrient, fungicide, pest, cultural].filter(Boolean).length;
  if (hits > 1) return 'mixed';
  if (nutrient) return 'nutrient';
  if (fungicide) return 'fungicide';
  if (pest) return 'pest';
  if (cultural) return 'cultural';
  return 'unknown';
}

function probabilityToStars(p: number): number {
  if (p >= 0.75) return 5;
  if (p >= 0.55) return 4;
  if (p >= 0.35) return 3;
  if (p >= 0.2) return 2;
  return 1;
}

function pickActionablePrimary(params: {
  posterior: PosteriorEntry[];
  llmIssue?: string;
  treatmentFocus: TreatmentFocus;
}): { label: string; confidence: number } {
  const ranked = params.posterior.filter((p) => p.label !== 'Unknown');
  const top = ranked[0];
  if (!top) {
    return { label: params.llmIssue?.trim() || 'Field issue', confidence: 0.4 };
  }

  const topCat = labelCategory(top.label);
  const treatment = params.treatmentFocus;

  const nutrientRow = ranked.find((p) => labelCategory(p.label) === 'nutrient');
  const llmNutrient =
    params.llmIssue && labelCategory(params.llmIssue) === 'nutrient' ? params.llmIssue : null;

  const treatmentWantsNutrient = treatment === 'nutrient' || treatment === 'cultural' || treatment === 'mixed';
  const topIsWeak = top.probability < PRIMARY_CONFIDENCE_FLOOR;
  const topIsDisease = topCat === 'disease' || topCat === 'pest';

  if (topIsWeak && topIsDisease && treatmentWantsNutrient) {
    if (nutrientRow && nutrientRow.probability >= DISEASE_WATCH_MIN) {
      return { label: nutrientRow.label, confidence: nutrientRow.probability };
    }
    if (llmNutrient) {
      return {
        label: llmNutrient,
        confidence: Math.max(nutrientRow?.probability ?? 0.45, top.probability),
      };
    }
  }

  if (topIsWeak && nutrientRow && nutrientRow.probability >= top.probability - 0.08) {
    return { label: nutrientRow.label, confidence: nutrientRow.probability };
  }

  return { label: top.label, confidence: top.probability };
}

function buildDiseaseWatch(params: {
  posterior: PosteriorEntry[];
  primaryLabel: string;
}): DiagnosisPresentation['diseaseWatch'] | undefined {
  const primary = params.primaryLabel.toLowerCase();
  const candidate = params.posterior.find(
    (p) =>
      p.label !== 'Unknown' &&
      p.label.toLowerCase() !== primary &&
      labelCategory(p.label) === 'disease' &&
      p.probability >= DISEASE_WATCH_MIN &&
      p.probability < PRIMARY_CONFIDENCE_FLOOR
  );
  if (!candidate) return undefined;

  return {
    label: candidate.label,
    probability: candidate.probability,
    note:
      'Humidity and weather can favour this disease. Photos do not confirm it yet — monitor for new lesions rather than treating as confirmed.',
  };
}

function buildHeadline(params: {
  primaryLabel: string;
  primaryConfidence: number;
  diseaseWatch?: DiagnosisPresentation['diseaseWatch'];
  alignmentNote?: string;
}): string {
  const pct = Math.round(params.primaryConfidence * 100);
  let headline = params.primaryLabel;
  if (params.primaryConfidence < PRIMARY_CONFIDENCE_FLOOR) {
    headline = `${params.primaryLabel} (most likely among several factors — ${pct}% confidence)`;
  } else if (pct < 90) {
    headline = `${params.primaryLabel} (${pct}% confidence)`;
  }
  if (params.diseaseWatch) {
    headline += `. Watch for ${params.diseaseWatch.label.toLowerCase()} in current weather.`;
  }
  if (params.alignmentNote) {
    headline += ` ${params.alignmentNote}`;
  }
  return headline.trim();
}

function buildRankedList(params: {
  posterior: PosteriorEntry[];
  primaryLabel: string;
  diseaseWatchLabel?: string;
}): DiagnosisRankItem[] {
  const primaryKey = params.primaryLabel.toLowerCase();
  const watchKey = params.diseaseWatchLabel?.toLowerCase();

  return params.posterior
    .filter((p) => p.label !== 'Unknown' && p.probability >= 0.08)
    .slice(0, 5)
    .map((p) => {
      const key = p.label.toLowerCase();
      let role: DiagnosisRankRole = 'alternative';
      if (key === primaryKey) role = 'primary';
      else if (watchKey && key === watchKey) role = 'disease_watch';
      else if (p.probability >= 0.25) role = 'contributing';
      return {
        label: p.label,
        probability: Math.round(p.probability * 1000) / 1000,
        role,
        stars: probabilityToStars(p.probability),
      };
    });
}

function detectAlignmentNote(params: {
  primaryLabel: string;
  topPosteriorLabel: string;
  topPosteriorConfidence: number;
  treatmentFocus: TreatmentFocus;
}): string | undefined {
  const primaryCat = labelCategory(params.primaryLabel);
  const topCat = labelCategory(params.topPosteriorLabel);
  const treatment = params.treatmentFocus;

  if (
    topCat === 'disease' &&
    params.topPosteriorConfidence < PRIMARY_CONFIDENCE_FLOOR &&
    primaryCat === 'nutrient' &&
    (treatment === 'nutrient' || treatment === 'cultural')
  ) {
    return 'Treatment focuses on nutrition and field conditions; fungal disease is a secondary weather risk, not the main visible pattern.';
  }

  if (params.topPosteriorLabel.toLowerCase() !== params.primaryLabel.toLowerCase() && treatment !== 'unknown') {
    const treatmentCat =
      treatment === 'nutrient' || treatment === 'cultural'
        ? 'nutrient'
        : treatment === 'fungicide'
          ? 'disease'
          : treatment === 'pest'
            ? 'pest'
            : 'other';
    if (primaryCat === treatmentCat && topCat !== treatmentCat) {
      return 'Recommendations match the most actionable field issue, not the highest weak disease prior.';
    }
  }

  return undefined;
}

/** Harmonize Bayesian posterior, LLM treatments, and farmer-facing labels. */
export const diagnosisPresentationService = {
  build(params: {
    advisory: StructuredAdvisory;
    reasoning: MaiosReasoningSnapshot;
    shadowMode: boolean;
  }): DiagnosisPresentation {
    const posterior = params.reasoning.posterior.filter((p) => p.label !== 'Unknown');
    const topPosterior = posterior[0];
    const treatmentFocus = inferTreatmentFocus(params.advisory);
    const llmIssue = params.advisory.probableIssue;

    const actionable = params.shadowMode
      ? { label: llmIssue?.trim() || topPosterior?.label || 'Field issue', confidence: params.advisory.confidence }
      : pickActionablePrimary({ posterior, llmIssue, treatmentFocus });

    const diseaseWatch = buildDiseaseWatch({
      posterior,
      primaryLabel: actionable.label,
    });

    const alignmentNote = detectAlignmentNote({
      primaryLabel: actionable.label,
      topPosteriorLabel: topPosterior?.label ?? actionable.label,
      topPosteriorConfidence: topPosterior?.probability ?? actionable.confidence,
      treatmentFocus,
    });

    const ranked = buildRankedList({
      posterior,
      primaryLabel: actionable.label,
      diseaseWatchLabel: diseaseWatch?.label,
    });

    const headline = buildHeadline({
      primaryLabel: actionable.label,
      primaryConfidence: actionable.confidence,
      diseaseWatch,
      alignmentNote,
    });

    return {
      headline,
      primaryLabel: actionable.label,
      primaryConfidence: actionable.confidence,
      ranked,
      diseaseWatch,
      alignmentNote,
      showLowConfidencePrimary: actionable.confidence < PRIMARY_CONFIDENCE_FLOOR,
    };
  },

  applyToAdvisory(
    advisory: StructuredAdvisory,
    presentation: DiagnosisPresentation,
    reasoning: MaiosReasoningSnapshot
  ): StructuredAdvisory {
    const differentialFromRanked = presentation.ranked.map((r) => ({
      label: r.label,
      reason:
        r.role === 'primary'
          ? 'Leading combined assessment'
          : r.role === 'disease_watch'
            ? 'Elevated weather risk — monitor'
            : r.role === 'contributing'
              ? 'Contributing factor'
              : 'Alternative hypothesis',
      probability: r.probability,
    }));

    const rejected = reasoning.explanation.rejected.length
      ? reasoning.explanation.rejected
      : presentation.ranked
          .filter((r) => r.role === 'alternative' && r.probability < 0.15)
          .map((r) => r.label);

    return {
      ...advisory,
      probableIssue: presentation.primaryLabel,
      confidence: presentation.primaryConfidence,
      uncertain: reasoning.decision.action !== 'LOCK' || presentation.showLowConfidencePrimary,
      differentialDiagnosis: differentialFromRanked,
      diagnosisHeadline: presentation.headline,
      diagnosisRanked: presentation.ranked,
      diseaseWatchNote: presentation.diseaseWatch?.note,
      treatmentAlignmentNote: presentation.alignmentNote,
      rejectedHypotheses: [...new Set([...(advisory.rejectedHypotheses ?? []), ...rejected])].slice(0, 6),
    };
  },
};
