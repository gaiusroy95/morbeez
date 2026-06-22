import { env } from '../../config/env.js';
import type { VisitAnalyzeVisitRequest } from '../../domain/ai-training/validators.js';
import type { DiagnosisEnvelope, DiagnosisSource } from '../../domain/diagnosis/types.js';
import type { MaiosTriageLevel } from '../../domain/case/types.js';
import { moduleFusionService } from '../case/module-fusion.service.js';
import { visitAiContextService } from '../core/visit-ai-context.service.js';
import { visitAiOrchestratorService } from '../core/visit-ai-orchestrator.service.js';
import { resolveVisitImagePredictions } from '../core/visit-ai-image.service.js';
import {
  buildInsufficientEvidenceEnvelope,
  isDiagnosisInferenceAvailable,
  mapImageSourceToDiagnosisSource,
} from './diagnosis-integrity.util.js';

export type TriagePreviewResult = {
  level: MaiosTriageLevel;
  reason: string;
  route: 'fast' | 'standard' | 'complex' | 'critical';
  mandatoryFollowUp: boolean;
  blockAutoApprove: boolean;
};

function triageRoute(level: MaiosTriageLevel): TriagePreviewResult['route'] {
  if (level === 'L1') return 'fast';
  if (level === 'L2') return 'standard';
  if (level === 'L3') return 'complex';
  return 'critical';
}

function inferSeverityFromConfidence(confidence: number): 'mild' | 'moderate' | 'severe' {
  if (confidence < 0.55) return 'severe';
  if (confidence < 0.75) return 'moderate';
  return 'mild';
}

export const diagnosisOrchestratorService = {
  isCapable(): boolean {
    return isDiagnosisInferenceAvailable();
  },

  getCapabilityStatus(): { capable: boolean; diagnosisDegraded: boolean; openai: boolean; plantId: boolean } {
    const openai = Boolean(env.OPENAI_API_KEY?.trim());
    const plantId = Boolean(env.PLANT_ID_API_KEY?.trim());
    return {
      capable: openai || plantId,
      diagnosisDegraded: !openai,
      openai,
      plantId,
    };
  },

  async triagePreview(input: VisitAnalyzeVisitRequest): Promise<TriagePreviewResult> {
    const context = await visitAiContextService.buildVisitAiContext(input);
    const analyzePhotos = input.analyzePhotos?.map((p) => ({
      dataBase64: p.dataBase64,
      mimeType: p.mimeType,
    }));
    const imageSignal = await resolveVisitImagePredictions(analyzePhotos, {
      cropType: context.cropType,
      dap: context.dap,
      stage: context.stage,
    });
    const fusedConfidence = imageSignal?.confidence ?? 0.55;
    const triage = moduleFusionService.triageLevel({
      severity: inferSeverityFromConfidence(fusedConfidence),
      fusedConfidence,
      riskTagCount: context.measurements.length >= 3 ? 2 : 0,
      probableIssue: imageSignal?.label,
    });
    const level = triage.level;
    return {
      level,
      reason: triage.reason,
      route: triageRoute(level),
      mandatoryFollowUp: level !== 'L1',
      blockAutoApprove: level === 'L4',
    };
  },

  async analyzeVisit(input: VisitAnalyzeVisitRequest, agronomistEmail: string) {
    if (!this.isCapable()) {
      return {
        issues: [],
        diagnosisDegraded: true,
        envelope: buildInsufficientEvidenceEnvelope(
          'AI diagnosis unavailable — configure OPENAI_API_KEY or PLANT_ID_API_KEY'
        ),
      };
    }

    const triage = await this.triagePreview(input);
    const result = await visitAiOrchestratorService.analyzeVisit(input, agronomistEmail);

    const issues = (result.issues ?? []).map((issue) => {
      const row = issue as {
        hypotheses?: Array<{
          label: string;
          confidence: number;
          rationale?: string;
          selected?: boolean;
        }>;
        confidenceAction?: string;
        diagnosisSource?: DiagnosisSource;
        diagnosisEnvelope?: DiagnosisEnvelope;
      };
      const src = row.diagnosisSource ?? 'model';
      const envelope: DiagnosisEnvelope = row.diagnosisEnvelope ?? {
        hypotheses: (row.hypotheses ?? []).map((h) => ({
          label: h.label,
          confidence: h.confidence,
          rationale: h.rationale ?? '',
          selected: h.selected,
        })),
        source: src,
        degraded: src === 'insufficient_evidence',
        escalationRequired: src === 'insufficient_evidence' || row.confidenceAction === 'escalate',
        evidenceSummary: [],
        triage,
      };
      return { ...issue, diagnosisSource: envelope.source, diagnosisEnvelope: envelope, triage };
    });

    return {
      ...result,
      issues,
      triage,
      diagnosisDegraded: !env.OPENAI_API_KEY?.trim(),
    };
  },

  resolveSourceFromImage(
    hasModel: boolean,
    imageSource?: 'plant_id' | 'vision' | 'fusion' | null
  ): DiagnosisSource {
    if (hasModel) return 'model';
    return mapImageSourceToDiagnosisSource(imageSource);
  },
};
