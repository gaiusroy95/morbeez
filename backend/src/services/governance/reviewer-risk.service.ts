import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';

const BURST_WINDOW_MS = 10 * 60 * 1000;
const BURST_LIMIT = 20;

export const reviewerRiskService = {
  enabled(): boolean {
    return env.ENABLE_REVIEWER_RISK_MONITORING === true;
  },

  async assertCanApprove(reviewerEmail: string): Promise<void> {
    if (!this.enabled()) return;
    const email = reviewerEmail.trim().toLowerCase();
    const { data } = await supabase
      .from('reviewer_restrictions')
      .select('id')
      .eq('reviewer_email', email)
      .eq('active', true)
      .limit(1)
      .maybeSingle();
    if (data) {
      throw new UnauthorizedError('Reviewer approvals are frozen');
    }
  },

  async recordSignal(params: {
    reviewerEmail: string;
    signalType: string;
    severity?: string;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.enabled()) return;
    await supabase.from('reviewer_risk_signals').insert({
      reviewer_email: params.reviewerEmail.trim().toLowerCase(),
      signal_type: params.signalType,
      severity: params.severity ?? 'medium',
      detail: params.detail ?? {},
      status: 'open',
    });
  },

  async observeReview(params: {
    reviewerEmail: string;
    verdict: string;
    candidateId: string;
  }): Promise<void> {
    if (!this.enabled()) return;
    const email = params.reviewerEmail.trim().toLowerCase();
    const since = new Date(Date.now() - BURST_WINDOW_MS).toISOString();
    const { data: recent } = await supabase
      .from('knowledge_candidate_reviews')
      .select('id')
      .eq('reviewer_email', email)
      .gte('reviewed_at', since);

    if ((recent?.length ?? 0) >= BURST_LIMIT) {
      await this.recordSignal({
        reviewerEmail: email,
        signalType: 'review_burst',
        severity: 'high',
        detail: { count: recent?.length ?? 0, windowMs: BURST_WINDOW_MS },
      });
      await this.quarantineApprovals({
        reviewerEmail: email,
        reason: 'Excessive review burst',
      });
    }

    if (params.verdict === 'approve') {
      // Tracked via signals; excessive overrides handled by callers.
      logger.debug({ email, candidateId: params.candidateId }, 'Reviewer approve observed');
    }
  },

  async quarantineApprovals(params: {
    reviewerEmail: string;
    reason: string;
    createdBy?: string;
  }): Promise<void> {
    if (!this.enabled()) return;
    const email = params.reviewerEmail.trim().toLowerCase();
    await supabase.from('reviewer_restrictions').insert({
      reviewer_email: email,
      restriction_type: 'freeze_approvals',
      reason: params.reason,
      active: true,
      created_by: params.createdBy ?? 'system',
    });

    // Reassign active owned cases to queue
    const { data: owned } = await supabase
      .from('expert_cases')
      .select('id, owner_email, lease_token')
      .eq('owner_email', email)
      .eq('review_flag', 'open');

    for (const row of owned ?? []) {
      await supabase
        .from('expert_cases')
        .update({
          owner_email: null,
          owner_employee_id: null,
          lease_token: null,
          lease_expires_at: null,
          assignment_status: 'queued',
          interruption_count: 0,
          last_interruption_reason: 'reviewer_quarantine',
          queue_version: Number((row as { queue_version?: number }).queue_version ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }

    await supabase.from('staff_notifications').upsert(
      {
        recipient_email: 'ops@morbeez.internal',
        category: 'security',
        title: 'Reviewer quarantined',
        body: `${email}: ${params.reason}`,
        dedupe_key: `reviewer:${email}:quarantine:${Date.now()}`,
      },
      { onConflict: 'dedupe_key' }
    );
  },
};
