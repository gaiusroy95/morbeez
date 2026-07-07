import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { regionalLearningService } from '../regional-learning/regional-learning.service.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';

export type LearningFacadeInput = {
  farmerId: string;
  cropType: string;
  issueLabel: string;
  sessionId?: string;
  channel: 'visit' | 'whatsapp' | 'api' | 'field_visit';
  reasoning?: MaiosReasoningSnapshot | null;
  agronomistVerified?: boolean;
  outcome?: 'improved' | 'partial' | 'no_improvement' | null;
};

/** Domain 11 — unified learning entry point. Records regional stats; LR matrix is never auto-updated. */
export const maiosLearningFacadeService = {
  async recordOutcome(input: LearningFacadeInput): Promise<void> {
    const label = input.issueLabel?.trim();
    if (!label) return;

    const { data: farmer } = await supabase
      .from('farmers')
      .select('district')
      .eq('id', input.farmerId)
      .maybeSingle();

    const district = farmer?.district ? String(farmer.district).trim().toLowerCase() : null;
    if (district) {
      await regionalLearningService.recordIssueStat(district, input.cropType, label);
    }

    if (input.sessionId) {
      const { data: existing } = await supabase
        .from('ai_advisory_sessions')
        .select('metadata')
        .eq('id', input.sessionId)
        .maybeSingle();
      const priorMeta = (existing?.metadata as Record<string, unknown>) ?? {};
      await supabase
        .from('ai_advisory_sessions')
        .update({
          metadata: {
            ...priorMeta,
            learningRecordedAt: new Date().toISOString(),
            learningChannel: input.channel,
            agronomistVerified: Boolean(input.agronomistVerified),
            reasoningLocked: input.reasoning?.decision.action === 'LOCK',
            lrMatrixUpdated: false,
            outcome: input.outcome ?? null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.sessionId)
        .then(({ error }) => {
          if (error) {
            logger.warn({ err: error, sessionId: input.sessionId }, 'Learning facade session metadata update failed');
          }
        });
    }

    logger.info(
      {
        farmerId: input.farmerId,
        cropType: input.cropType,
        issueLabel: label,
        channel: input.channel,
        lrMatrixUpdated: false,
      },
      'MAIOS v17 learning facade recorded outcome (LR matrix unchanged)'
    );
  },

  async recordFromReasoningSnapshot(input: {
    farmerId: string;
    cropType: string;
    sessionId?: string;
    channel: LearningFacadeInput['channel'];
    snapshot: MaiosReasoningSnapshot;
  }): Promise<void> {
    if (input.snapshot.decision.action !== 'LOCK' || !input.snapshot.decision.topLabel) return;
    await this.recordOutcome({
      farmerId: input.farmerId,
      cropType: input.cropType,
      issueLabel: input.snapshot.decision.topLabel,
      sessionId: input.sessionId,
      channel: input.channel,
      reasoning: input.snapshot,
      agronomistVerified: false,
    });
  },

  /** Agronomist-confirmed diagnosis on visit close — records regional stats, never updates LR matrix. */
  async recordAgronomistVerifiedOutcome(input: {
    farmerId: string;
    cropType: string;
    verifiedIssueLabel: string;
    sessionId?: string;
    reasoning?: MaiosReasoningSnapshot | null;
    outcome?: LearningFacadeInput['outcome'];
    reviewAction?: string | null;
  }): Promise<void> {
    const label = input.verifiedIssueLabel?.trim();
    if (!label) return;

    await this.recordOutcome({
      farmerId: input.farmerId,
      cropType: input.cropType,
      issueLabel: label,
      sessionId: input.sessionId,
      channel: 'visit',
      reasoning: input.reasoning ?? null,
      agronomistVerified: true,
      outcome: input.outcome ?? null,
    });

    logger.info(
      {
        farmerId: input.farmerId,
        cropType: input.cropType,
        verifiedIssueLabel: label,
        reviewAction: input.reviewAction ?? null,
        lrMatrixUpdated: false,
      },
      'MAIOS v17 agronomist-verified visit outcome recorded'
    );
  },
};
