import type {
  CropKnowledgePackage,
  EvsiCandidate,
  PosteriorEntry,
  ReasoningEvidenceItem,
} from '../../domain/maios-reasoning/types.js';
import { maiosBayesianEngineService } from './bayesian-engine.service.js';

function entropy(posterior: PosteriorEntry[]): number {
  let h = 0;
  for (const p of posterior) {
    const prob = p.probability;
    if (prob <= 0) continue;
    h -= prob * Math.log2(prob);
  }
  return h;
}

export const maiosEvsiEngineService = {
  rankQuestions(params: {
    pkg: CropKnowledgePackage;
    posterior: PosteriorEntry[];
    evidence: ReasoningEvidenceItem[];
    answeredQuestionIds: Set<string>;
  }): EvsiCandidate | null {
    const baseH = entropy(params.posterior);
    let best: EvsiCandidate | null = null;

    for (const q of params.pkg.questions) {
      if (params.answeredQuestionIds.has(q.id)) continue;

      const yesEvidence: ReasoningEvidenceItem = {
        key: q.evidenceKeyIfYes,
        label: q.text,
        source: 'farmer',
        reliability: 0.85,
      };
      const postYes = maiosBayesianEngineService.update(params.pkg, params.posterior, [yesEvidence]);
      const gainYes = baseH - entropy(postYes);

      let gainNo = gainYes * 0.35;
      if (q.evidenceKeyIfNo) {
        const noEvidence: ReasoningEvidenceItem = {
          key: q.evidenceKeyIfNo,
          label: `${q.text} (no)`,
          source: 'farmer',
          reliability: 0.7,
        };
        const postNo = maiosBayesianEngineService.update(params.pkg, params.posterior, [noEvidence]);
        gainNo = baseH - entropy(postNo);
      }

      const expectedGain = Math.max(gainYes, gainNo) * 100;
      const candidate: EvsiCandidate = {
        kind: 'question',
        id: q.id,
        label: q.text,
        expectedInformationGain: Math.round(expectedGain * 10) / 10,
      };

      if (!best || candidate.expectedInformationGain > best.expectedInformationGain) {
        best = candidate;
      }
    }

    return best;
  },

  rankMissingPhoto(params: {
    missingSlots: string[];
    posterior: PosteriorEntry[];
  }): EvsiCandidate | null {
    if (!params.missingSlots.length) return null;
    const top = params.posterior[0]?.probability ?? 0;
    const slot = params.missingSlots[0]!;
    return {
      kind: 'photo_slot',
      id: slot,
      label: `Capture photo: ${slot.replace(/_/g, ' ')}`,
      expectedInformationGain: Math.round((1 - top) * 40 * 10) / 10,
    };
  },
};
