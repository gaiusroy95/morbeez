import { buildFusedCandidates, diagnosisLabelsMatch, pickFusedPrimary, } from './diagnosis-fusion.service.js';
const PRIMARY_CONFIDENCE_FLOOR = 0.5;
const DISEASE_WATCH_MIN = 0.15;
const NUTRIENT_LABEL_RE = /nutrient|deficien|uptake|potassium|nitrogen|magnesium/i;
const FUNGAL_LABEL_RE = /blast|anthracnose|fungal|leaf spot|blight|rot|phytophthora/i;
const PEST_LABEL_RE = /thrip|mite|borer|weevil|insect|pest/i;
const NUTRIENT_CONTEXT_KEYS = new Set([
    'context:k_demand_stage',
    'context:fertilizer_gap_21d',
    'context:prolonged_wet',
    'soil:low_n',
    'symptom:margin_scorch',
]);
const DISEASE_VISION_KEYS = new Set([
    'symptom:spindle_lesion',
    'symptom:grey_center',
    'symptom:black_dots',
    'symptom:silver_streak',
    'symptom:concentric_rings',
    'symptom:water_soaked',
    'symptom:soft_rot',
    'vision:blast',
    'vision:rot',
    'vision:thrips',
    'vision:sigatoka',
    'farmer:black_dots_yes',
]);
function labelCategory(label) {
    const t = label.toLowerCase();
    if (NUTRIENT_LABEL_RE.test(t))
        return 'nutrient';
    if (PEST_LABEL_RE.test(t))
        return 'pest';
    if (FUNGAL_LABEL_RE.test(t))
        return 'disease';
    return 'other';
}
export function inferTreatmentFocus(advisory) {
    const text = [
        ...advisory.dosageGuidance.map((d) => `${d.product} ${d.rate} ${d.method}`),
        ...advisory.treatments.map((t) => `${t.action} ${t.productType ?? ''}`),
        advisory.rootCorrection ?? '',
        advisory.agronomistAssessment ?? '',
        advisory.sprayTiming ?? '',
    ]
        .join(' ')
        .toLowerCase();
    const nutrient = /potash|muriate|mop|npk|fertilizer|fertigation|k2o|potassium|urea|micronutrient|zinc|chelate/.test(text);
    const fungicide = /fungicide|mancozeb|azox|triflox|strobilurin|triazole|copper|carbendazim|propiconazole/.test(text);
    const pest = /insecticide|spinosad|emamectin|neem|imidacloprid/.test(text);
    const cultural = /drainage|irrigation|mulch|weed|canopy/.test(text);
    const hits = [nutrient, fungicide, pest, cultural].filter(Boolean).length;
    if (hits > 1)
        return 'mixed';
    if (nutrient)
        return 'nutrient';
    if (fungicide)
        return 'fungicide';
    if (pest)
        return 'pest';
    if (cultural)
        return 'cultural';
    return 'unknown';
}
function hasNutrientContextEvidence(reasoning) {
    const keys = reasoning.evidence?.map((e) => e.key) ?? [];
    return keys.some((k) => NUTRIENT_CONTEXT_KEYS.has(k));
}
function hasStrongDiseaseVisionEvidence(reasoning) {
    const keys = reasoning.evidence?.map((e) => e.key) ?? [];
    return keys.some((k) => DISEASE_VISION_KEYS.has(k));
}
function probabilityToStars(p) {
    if (p >= 0.75)
        return 5;
    if (p >= 0.55)
        return 4;
    if (p >= 0.35)
        return 3;
    if (p >= 0.2)
        return 2;
    return 1;
}
function maybeDemoteToNutrient(params) {
    const topCat = labelCategory(params.primary.label);
    if (topCat !== 'disease' && topCat !== 'pest')
        return params.primary;
    if (params.primary.confidence >= PRIMARY_CONFIDENCE_FLOOR)
        return params.primary;
    if (params.treatmentFocus !== 'nutrient')
        return params.primary;
    if (!hasNutrientContextEvidence(params.reasoning))
        return params.primary;
    if (hasStrongDiseaseVisionEvidence(params.reasoning))
        return params.primary;
    const nutrientRow = params.candidates.find((c) => labelCategory(c.label) === 'nutrient');
    if (!nutrientRow)
        return params.primary;
    const primaryRow = params.candidates.find((c) => diagnosisLabelsMatch(c.label, params.primary.label));
    const primaryScore = primaryRow?.fusedScore ?? params.primary.confidence;
    if (nutrientRow.fusedScore < primaryScore - 0.05)
        return params.primary;
    return {
        label: nutrientRow.label,
        confidence: Math.max(nutrientRow.posterior ?? 0, nutrientRow.llmProbability ?? 0, nutrientRow.fusedScore),
    };
}
function buildDiseaseWatch(params) {
    const primary = params.primaryLabel.toLowerCase();
    const candidate = params.candidates.find((c) => !diagnosisLabelsMatch(c.label, primary) &&
        (labelCategory(c.label) === 'disease' || labelCategory(c.label) === 'pest') &&
        (c.posterior ?? c.fusedScore) >= DISEASE_WATCH_MIN &&
        (c.posterior ?? c.fusedScore) < PRIMARY_CONFIDENCE_FLOOR);
    if (!candidate)
        return undefined;
    return {
        label: candidate.label,
        probability: candidate.posterior ?? candidate.fusedScore,
        note: 'Weather or field context can favour this — photos do not confirm it yet. Monitor for new symptoms before treating as confirmed.',
    };
}
function buildHeadline(params) {
    const pct = Math.round(params.primaryConfidence * 100);
    let headline = params.primaryLabel;
    if (params.primaryConfidence < PRIMARY_CONFIDENCE_FLOOR) {
        headline = `${params.primaryLabel} (most likely among several factors — ${pct}% confidence)`;
    }
    else if (pct < 90) {
        headline = `${params.primaryLabel} (${pct}% confidence)`;
    }
    if (params.diseaseWatch) {
        headline += `. Monitor for ${params.diseaseWatch.label.toLowerCase()} if symptoms change.`;
    }
    return headline.trim();
}
function displayProbability(c) {
    return Math.round(Math.max(c.posterior ?? 0, c.llmProbability ?? 0, c.fusedScore) * 1000) / 1000;
}
function buildRankedList(params) {
    const primaryKey = params.primaryLabel.toLowerCase();
    const watchKey = params.diseaseWatchLabel?.toLowerCase();
    const rows = params.candidates
        .filter((c) => c.fusedScore >= 0.08)
        .slice(0, 6)
        .map((c) => {
        const key = c.label.toLowerCase();
        const prob = displayProbability(c);
        let role = 'alternative';
        if (diagnosisLabelsMatch(c.label, params.primaryLabel) || key === primaryKey) {
            role = 'primary';
        }
        else if (watchKey && diagnosisLabelsMatch(c.label, params.diseaseWatchLabel ?? '')) {
            role = 'disease_watch';
        }
        else if (prob >= 0.25 || c.fusedScore >= 0.28) {
            role = 'contributing';
        }
        return {
            label: c.label,
            probability: prob,
            role,
            stars: probabilityToStars(prob),
            _sort: diagnosisLabelsMatch(c.label, params.primaryLabel) ? 1 : 0,
            fusedScore: c.fusedScore,
        };
    });
    return rows
        .sort((a, b) => {
        if (a._sort !== b._sort)
            return b._sort - a._sort;
        return b.fusedScore - a.fusedScore;
    })
        .map(({ _sort, fusedScore, ...row }) => row);
}
/** Harmonize LLM vision ranking, Bayesian posterior, and farmer-facing labels. */
export const diagnosisPresentationService = {
    build(params) {
        const posterior = params.reasoning.posterior.filter((p) => p.label !== 'Unknown');
        const treatmentFocus = inferTreatmentFocus(params.advisory);
        const candidates = buildFusedCandidates({
            posterior,
            advisory: params.advisory,
            bayesianLocked: params.reasoning.decision.action === 'LOCK',
            topPosteriorLabel: posterior[0]?.label,
        });
        let primary = params.shadowMode
            ? {
                label: params.advisory.probableIssue?.trim() || posterior[0]?.label || 'Field issue',
                confidence: params.advisory.confidence,
            }
            : pickFusedPrimary({
                candidates,
                reasoning: params.reasoning,
                advisory: params.advisory,
            });
        if (!params.shadowMode) {
            primary = maybeDemoteToNutrient({
                primary,
                candidates,
                treatmentFocus,
                reasoning: params.reasoning,
            });
        }
        const diseaseWatch = buildDiseaseWatch({
            candidates,
            primaryLabel: primary.label,
        });
        const ranked = buildRankedList({
            candidates,
            primaryLabel: primary.label,
            diseaseWatchLabel: diseaseWatch?.label,
        });
        const headline = buildHeadline({
            primaryLabel: primary.label,
            primaryConfidence: primary.confidence,
            diseaseWatch,
        });
        return {
            headline,
            primaryLabel: primary.label,
            primaryConfidence: primary.confidence,
            ranked,
            diseaseWatch,
            alignmentNote: undefined,
            showLowConfidencePrimary: primary.confidence < PRIMARY_CONFIDENCE_FLOOR,
        };
    },
    applyToAdvisory(advisory, presentation, reasoning) {
        const alternatives = presentation.ranked.filter((r) => r.role !== 'primary');
        const differentialFromRanked = [
            ...presentation.ranked.filter((r) => r.role === 'primary'),
            ...alternatives,
        ].map((r) => ({
            label: r.label,
            reason: r.role === 'primary'
                ? 'Leading combined assessment'
                : r.role === 'disease_watch'
                    ? 'Elevated context risk — monitor'
                    : r.role === 'contributing'
                        ? 'Contributing factor'
                        : 'Alternative hypothesis',
            probability: r.probability,
        }));
        const rejected = reasoning.explanation.rejected.length
            ? reasoning.explanation.rejected
            : alternatives
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
//# sourceMappingURL=diagnosis-presentation.service.js.map