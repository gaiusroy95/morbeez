import type { DifferentialDiagnosisItem, StructuredAdvisory } from '../ai/types.js';
import type { MaiosReasoningSnapshot, PosteriorEntry } from '../../domain/maios-reasoning/types.js';

export type FusedCandidate = {
  label: string;
  posterior?: number;
  llmProbability?: number;
  llmPrimary: boolean;
  fusedScore: number;
};

const STOP_WORDS = new Set(['the', 'and', 'with', 'leaf', 'disease', 'damage', 'infection']);

export function normalizeDiagnosisLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Fuzzy label match — no crop-specific disease names. */
export function diagnosisLabelsMatch(a: string, b: string): boolean {
  const na = normalizeDiagnosisLabel(a);
  const nb = normalizeDiagnosisLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const tokensA = na.split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  const tokensB = nb.split(/\s+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  if (!tokensA.length || !tokensB.length) return false;

  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.includes(t)) overlap++;
  }
  if (overlap >= 2) return true;
  return overlap >= 1 && Math.min(tokensA.length, tokensB.length) === 1;
}

function findCandidate(candidates: FusedCandidate[], label: string): FusedCandidate | undefined {
  return candidates.find((c) => diagnosisLabelsMatch(c.label, label));
}

function upsertCandidate(
  map: Map<string, FusedCandidate>,
  label: string,
  patch: Partial<Omit<FusedCandidate, 'label' | 'fusedScore'>>
): void {
  const trimmed = label.trim();
  if (!trimmed) return;

  const existingKey = [...map.keys()].find((k) => diagnosisLabelsMatch(k, trimmed));
  const key = existingKey ?? trimmed;
  const row = map.get(key) ?? { label: key, llmPrimary: false, fusedScore: 0 };

  if (patch.posterior != null) {
    row.posterior = Math.max(row.posterior ?? 0, patch.posterior);
  }
  if (patch.llmProbability != null) {
    row.llmProbability = Math.max(row.llmProbability ?? 0, patch.llmProbability);
  }
  if (patch.llmPrimary) row.llmPrimary = true;

  map.set(key, row);
}

function computeFusedScore(
  candidate: FusedCandidate,
  params: { bayesianLocked: boolean; topPosteriorLabel?: string }
): number {
  const post = candidate.posterior ?? 0;
  const llm = candidate.llmProbability ?? 0;
  let score = post * 0.48 + llm * 0.47;

  if (candidate.llmPrimary && llm >= 0.6) score += 0.06;
  if (params.bayesianLocked && params.topPosteriorLabel) {
    if (diagnosisLabelsMatch(candidate.label, params.topPosteriorLabel)) score += 0.1;
  }
  if (llm > post + 0.12 && llm >= 0.55) score += 0.05;

  return Math.round(score * 1000) / 1000;
}

export function buildFusedCandidates(params: {
  posterior: PosteriorEntry[];
  advisory: StructuredAdvisory;
  bayesianLocked?: boolean;
  topPosteriorLabel?: string;
}): FusedCandidate[] {
  const map = new Map<string, FusedCandidate>();

  for (const p of params.posterior) {
    if (p.label === 'Unknown') continue;
    upsertCandidate(map, p.label, { posterior: p.probability });
  }

  const llmIssue = params.advisory.probableIssue?.trim();
  if (llmIssue) {
    upsertCandidate(map, llmIssue, {
      llmProbability: params.advisory.confidence,
      llmPrimary: true,
    });
  }

  for (const d of params.advisory.differentialDiagnosis ?? []) {
    if (!d.label?.trim()) continue;
    upsertCandidate(map, d.label, { llmProbability: d.probability });
  }

  return [...map.values()]
    .map((c) => ({
      ...c,
      fusedScore: computeFusedScore(c, {
        bayesianLocked: Boolean(params.bayesianLocked),
        topPosteriorLabel: params.topPosteriorLabel,
      }),
    }))
    .sort((a, b) => b.fusedScore - a.fusedScore);
}

export function pickFusedPrimary(params: {
  candidates: FusedCandidate[];
  reasoning: MaiosReasoningSnapshot;
  advisory: StructuredAdvisory;
}): { label: string; confidence: number } {
  const sorted = [...params.candidates].sort((a, b) => b.fusedScore - a.fusedScore);
  const top = sorted[0];
  if (!top) {
    return {
      label: params.advisory.probableIssue?.trim() || 'Field issue',
      confidence: params.advisory.confidence || 0.4,
    };
  }

  const locked = params.reasoning.decision.action === 'LOCK';
  const llmIssue = params.advisory.probableIssue?.trim();
  const llmConf = params.advisory.confidence ?? 0;

  if (locked && params.reasoning.decision.topLabel) {
    const lockedRow =
      findCandidate(sorted, params.reasoning.decision.topLabel) ?? top;
    return {
      label: lockedRow.label,
      confidence: lockedRow.posterior ?? lockedRow.fusedScore,
    };
  }

  const llmRanked = [...(params.advisory.differentialDiagnosis ?? [])]
    .filter((d) => d.label?.trim())
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  const llmTop = llmRanked[0];

  if (llmTop?.label && (llmTop.probability ?? 0) >= 0.5) {
    const llmTopRow = findCandidate(sorted, llmTop.label);
    const issueRow = llmIssue ? findCandidate(sorted, llmIssue) : undefined;
    const topProb = llmTop.probability ?? 0;
    const beatsIssue =
      topProb > llmConf + 0.05 ||
      (issueRow && llmTopRow && llmTopRow.fusedScore > issueRow.fusedScore + 0.04);
    if (llmTopRow && beatsIssue && !diagnosisLabelsMatch(llmTop.label, llmIssue ?? '')) {
      return {
        label: llmTopRow.label,
        confidence: Math.max(
          topProb,
          llmTopRow.llmProbability ?? 0,
          llmTopRow.posterior ?? 0,
          llmTopRow.fusedScore
        ),
      };
    }
  }

  if (llmIssue && llmConf >= 0.68) {
    const llmRow = findCandidate(sorted, llmIssue);
    if (llmRow && llmRow.fusedScore >= top.fusedScore - 0.06) {
      return {
        label: llmRow.label,
        confidence: Math.max(llmConf, llmRow.llmProbability ?? llmRow.fusedScore),
      };
    }
  }

  return {
    label: top.label,
    confidence: Math.max(top.posterior ?? 0, top.llmProbability ?? 0, top.fusedScore),
  };
}

export function alternativesBelowPrimary(
  primaryLabel: string,
  items: DifferentialDiagnosisItem[]
): DifferentialDiagnosisItem[] {
  return items
    .filter((d) => d.label?.trim() && !diagnosisLabelsMatch(d.label, primaryLabel))
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
}
