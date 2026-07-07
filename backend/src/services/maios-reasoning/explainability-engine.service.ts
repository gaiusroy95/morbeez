import type {
  CropKnowledgePackage,
  PosteriorEntry,
  ReasoningEvidenceItem,
  ReasoningExplanation,
} from '../../domain/maios-reasoning/types.js';
import { maiosKnowledgeService } from './knowledge.service.js';

export const maiosExplainabilityEngineService = {
  build(params: {
    pkg: CropKnowledgePackage;
    posterior: PosteriorEntry[];
    evidence: ReasoningEvidenceItem[];
    llmHypothesisLabels?: string[];
    missingPhotoSlots?: string[];
  }): ReasoningExplanation {
    const top = params.posterior[0];
    const topLabel = top?.label ?? null;
    const confidence = top?.probability ?? 0;

    const supporting: string[] = [];
    for (const item of params.evidence) {
      if (item.key.startsWith('photo:missing')) continue;
      const rules = topLabel
        ? maiosKnowledgeService.listLikelihoodRatios(params.pkg, item.key).filter(
            (r) => r.diseaseLabel === topLabel && r.lr >= 1.2
          )
        : [];
      if (rules.length || item.reliability >= 0.8) {
        supporting.push(`✓ ${item.label} (${Math.round(item.reliability * 100)}%)`);
      }
    }

    const rejected = params.posterior
      .filter((p) => p.label !== topLabel && p.label !== 'Unknown' && p.probability < 0.12)
      .map((p) => p.label)
      .slice(0, 4);

    for (const label of params.llmHypothesisLabels ?? []) {
      if (
        label !== topLabel &&
        !rejected.includes(label) &&
        !params.posterior.some((p) => p.label === label && p.probability >= 0.12)
      ) {
        rejected.push(label);
      }
    }

    const missing: string[] = [];
    for (const slot of params.missingPhotoSlots ?? []) {
      missing.push(slot.replace(/_/g, ' '));
    }
    if (!params.evidence.some((e) => e.source === 'lab')) {
      missing.push('Laboratory confirmation');
    }

    return {
      diagnosis: topLabel,
      confidence,
      supporting: supporting.slice(0, 8),
      rejected: [...new Set(rejected)].slice(0, 5),
      missing: missing.slice(0, 6),
    };
  },
};
