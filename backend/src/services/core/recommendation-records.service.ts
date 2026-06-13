import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError } from '../../lib/errors.js';
import { blockService } from './block.service.js';
import { productGapService } from './product-gap.service.js';
import { appendAuditEntry } from './recommendation-audit.util.js';

export type RecommendationStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'communicated'
  | 'applied'
  | 'outcome_recorded'
  | 'cancelled';

async function districtForFarmer(farmerId: string, blockId?: string): Promise<string | undefined> {
  if (blockId) {
    const block = await blockService.getById(blockId, farmerId);
    if (block?.pincode_id) {
      const { data } = await supabase
        .from('pincode_master')
        .select('district')
        .eq('id', block.pincode_id)
        .maybeSingle();
      if (data?.district) return String(data.district);
    }
  }
  const { data } = await supabase.from('farmers').select('district').eq('id', farmerId).maybeSingle();
  return data?.district ? String(data.district) : undefined;
}

export const recommendationRecordsService = {
  async create(input: {
    farmerId: string;
    blockId?: string;
    leadId?: string;
    aiSessionId?: string;
    crmRecommendationId?: string;
    fieldFindingId?: string;
    visitIssueId?: string;
    source: 'ai' | 'agronomist' | 'rule' | 'template' | 'field_finding';
    issueDetected?: string;
    recommendationText: string;
    products?: unknown[];
    dosage?: string;
    applicationType?: string;
    weatherWarning?: string;
    language?: string;
    createdBy?: string;
    status?: RecommendationStatus;
    technicalName?: string;
    tradeName?: string;
    severity?: 'low' | 'medium' | 'high';
  }) {
    let dap: number | null = null;
    let cropType: string | undefined;
    if (input.blockId) {
      const block = await blockService.getById(input.blockId, input.farmerId);
      if (block) {
        dap = block.dap;
        cropType = block.crop_type;
      }
    }

    const status = input.status ?? (input.source === 'agronomist' ? 'pending_approval' : 'draft');

    const createdBy = input.createdBy ?? null;
    const metadata = appendAuditEntry(
      {},
      {
        action: 'created',
        by: createdBy ?? 'system',
        note: input.source,
      }
    );

    const { data, error } = await supabase
      .from('recommendation_records')
      .insert({
        farmer_id: input.farmerId,
        block_id: input.blockId ?? null,
        lead_id: input.leadId ?? null,
        ai_session_id: input.aiSessionId ?? null,
        crm_recommendation_id: input.crmRecommendationId ?? null,
        field_finding_id: input.fieldFindingId ?? null,
        visit_issue_id: input.visitIssueId ?? null,
        source: input.source,
        issue_detected: input.issueDetected ?? null,
        recommendation_text: input.recommendationText,
        products: input.products ?? [],
        dosage: input.dosage ?? null,
        application_type: input.applicationType ?? null,
        weather_warning: input.weatherWarning ?? null,
        dap_at_recommendation: dap,
        language: input.language ?? 'en',
        status,
        created_by: createdBy,
        technical_name: input.technicalName ?? null,
        trade_name: input.tradeName ?? null,
        severity: input.severity ?? null,
        application_status: 'pending_application',
        metadata,
      })
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not create recommendation record');

    const recordId = String(data.id);

    void (async () => {
      const { weatherSnapshotService } = await import('./weather-snapshot.service.js');
      await weatherSnapshotService.capture({
        farmerId: input.farmerId,
        blockId: input.blockId,
        eventType: 'recommendation',
        eventId: recordId,
      });
    })();
    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: recordId,
      farmerId: input.farmerId,
      milestone: 'created',
      employeeEmail: createdBy,
      metadata: { source: input.source },
    });

    const dist = await districtForFarmer(input.farmerId, input.blockId);

    for (const p of input.products ?? []) {
      const title =
        typeof p === 'object' && p && 'productTitle' in p
          ? String((p as { productTitle: string }).productTitle)
          : typeof p === 'string'
            ? p
            : null;
      if (title) {
        await productGapService.incrementFromRecommendation({
          technicalName: title,
          cropType,
          district: dist,
          recommendationRecordId: recordId,
        });
      }
    }

    return data;
  },

  async submitForApproval(id: string, reviewedBy?: string) {
    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();

    const metadata = appendAuditEntry(existing?.metadata, {
      action: 'submitted',
      by: reviewedBy ?? 'agronomist',
    });

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        status: 'pending_approval',
        reviewed_by: reviewedBy ?? null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not submit recommendation');
    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: id,
      farmerId: String(data.farmer_id),
      milestone: 'submitted',
      employeeEmail: reviewedBy ?? null,
    });
    return data;
  },

  async approve(id: string, approvedBy: string) {
    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();

    const metadata = appendAuditEntry(existing?.metadata, {
      action: 'approved',
      by: approvedBy,
    });

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'pending_approval')
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not approve recommendation');
    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: id,
      farmerId: String(data.farmer_id),
      milestone: 'approved',
      employeeEmail: approvedBy,
    });
    return data;
  },

  async reject(id: string, approvedBy: string, notes?: string) {
    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();

    const metadata = appendAuditEntry(existing?.metadata, {
      action: 'rejected',
      by: approvedBy,
      note: notes ?? null,
    });

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        status: 'rejected',
        approved_by: approvedBy,
        outcome_notes: notes ?? null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not reject recommendation');
    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: id,
      farmerId: String(data.farmer_id),
      milestone: 'rejected',
      employeeEmail: approvedBy,
      metadata: { notes: notes ?? null },
    });
    return data;
  },

  async recordOutcome(
    id: string,
    outcome: 'better' | 'partial' | 'no_improvement' | 'unknown',
    options?: {
      notes?: string;
      recoveryDays?: number;
      farmerFeedback?: string;
      agronomistFeedback?: string;
      issueResolved?: boolean;
      recordedBy?: string;
    }
  ) {
    const notes = options?.notes;
    const issueResolved =
      options?.issueResolved ?? (outcome === 'better' || outcome === 'partial');

    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();

    const metadata = {
      ...((existing?.metadata as Record<string, unknown>) ?? {}),
      outcomeReview: {
        recordedBy: options?.recordedBy ?? null,
        recordedAt: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        status: 'outcome_recorded',
        outcome,
        outcome_notes: notes ?? null,
        outcome_at: new Date().toISOString(),
        recovery_days: options?.recoveryDays ?? null,
        farmer_outcome_feedback: options?.farmerFeedback?.trim() ?? null,
        agronomist_outcome_feedback: options?.agronomistFeedback?.trim() ?? null,
        issue_resolved: issueResolved,
        outcome_recorded_by: options?.recordedBy ?? null,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not record outcome');
    const { farmerEventCaptureService } = await import(
      '../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.trackRecommendationMilestone({
      recommendationRecordId: id,
      farmerId: String(data.farmer_id),
      milestone: 'outcome_recorded',
      outcome,
      employeeEmail: options?.recordedBy ?? null,
      metadata: {
        notes: notes ?? null,
        recoveryDays: options?.recoveryDays ?? null,
        issueResolved,
      },
    });
    return data;
  },

  async listPendingApproval(limit = 50) {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select('*, farmers(name, phone), farm_blocks(name, crop_type, plot_label)')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(limit);

    throwIfSupabaseError(error, 'Could not load pending recommendations');
    return data ?? [];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select('*, farmers(name, phone, preferred_language), farm_blocks(name, crop_type, plot_label)')
      .eq('id', id)
      .maybeSingle();

    throwIfSupabaseError(error, 'Could not load recommendation');
    return data;
  },

  async updateDraft(
    id: string,
    patch: {
      issueDetected?: string;
      recommendationText?: string;
      products?: unknown[];
      dosage?: string;
      applicationType?: string;
      weatherWarning?: string;
      language?: string;
      blockId?: string;
    }
  ) {
    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('status')
      .eq('id', id)
      .maybeSingle();

    if (!existing || existing.status !== 'draft') {
      throw new AppError('Only draft recommendations can be edited', 400, 'INVALID_STATUS');
    }

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        ...(patch.issueDetected !== undefined ? { issue_detected: patch.issueDetected } : {}),
        ...(patch.recommendationText !== undefined
          ? { recommendation_text: patch.recommendationText }
          : {}),
        ...(patch.products !== undefined ? { products: patch.products } : {}),
        ...(patch.dosage !== undefined ? { dosage: patch.dosage } : {}),
        ...(patch.applicationType !== undefined ? { application_type: patch.applicationType } : {}),
        ...(patch.weatherWarning !== undefined ? { weather_warning: patch.weatherWarning } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.blockId !== undefined ? { block_id: patch.blockId } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not update recommendation');
    return data;
  },

  async listByStatus(
    status: RecommendationStatus | RecommendationStatus[],
    limit = 50
  ) {
    const statuses = Array.isArray(status) ? status : [status];
    const { data, error } = await supabase
      .from('recommendation_records')
      .select('*, farmers(name, phone), farm_blocks(name, crop_type, plot_label)')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(limit);

    throwIfSupabaseError(error, 'Could not load recommendations');
    return data ?? [];
  },

  async listByFarmer(farmerId: string, limit = 30) {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(limit);

    throwIfSupabaseError(error, 'Could not load recommendations');
    return data ?? [];
  },
};
