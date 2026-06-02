import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import type { RecommendationStatus } from './recommendation-records.service.js';
import {
  appendAuditEntry,
  formatAuditLabel,
  readAuditLog,
  type RecommendationAuditEntry,
} from './recommendation-audit.util.js';
import { canApproveRecommendations } from '../../lib/console-roles.js';

const EDITABLE_STATUSES: RecommendationStatus[] = ['draft', 'pending_approval'];

const LIST_SELECT =
  '*, farmers(id, name, phone, preferred_language), farm_blocks(id, name, crop_type, plot_label)';

function normalizeJoinRow(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return (raw[0] as Record<string, unknown>) ?? null;
  return raw as Record<string, unknown>;
}

function mapListRow(row: Record<string, unknown>) {
  const farmer = normalizeJoinRow(row.farmers);
  const block = normalizeJoinRow(row.farm_blocks);
  const audit = readAuditLog(row.metadata);
  return {
    id: String(row.id),
    farmerId: String(row.farmer_id),
    status: String(row.status),
    source: String(row.source),
    issueDetected: row.issue_detected ? String(row.issue_detected) : null,
    recommendationText: String(row.recommendation_text ?? ''),
    dosage: row.dosage ? String(row.dosage) : null,
    language: String(row.language ?? 'en'),
    createdBy: row.created_by ? String(row.created_by) : null,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    farmerName: farmer?.name ? String(farmer.name) : null,
    farmerPhone: farmer?.phone ? String(farmer.phone) : null,
    blockLabel: block?.plot_label
      ? String(block.plot_label)
      : block?.name
        ? String(block.name)
        : null,
    cropType: block?.crop_type ? String(block.crop_type) : null,
    lastAudit: audit.length ? formatAuditLabel(audit[audit.length - 1]) : null,
  };
}

export const recommendationApprovalsService = {
  async list(params: {
    status?: string;
    createdBy?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = params.offset ?? 0;

    let query = supabase
      .from('recommendation_records')
      .select(LIST_SELECT, { count: 'exact' })
      .in('source', ['agronomist', 'field_finding'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status && params.status !== 'all') {
      if (params.status === 'open') {
        query = query.in('status', ['draft', 'pending_approval']);
      } else {
        query = query.eq('status', params.status);
      }
    }

    if (params.createdBy) {
      query = query.eq('created_by', params.createdBy);
    }

    const { data, error, count } = await query;
    throwIfSupabaseError(error, 'Could not list recommendations');

    return {
      items: (data ?? []).map((r) => mapListRow(r as Record<string, unknown>)),
      total: count ?? 0,
      limit,
      offset,
    };
  },

  async getDetail(id: string) {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select(LIST_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Recommendation not found');

    const row = data as Record<string, unknown>;
    const audit = readAuditLog(row.metadata);
    const synthesized: RecommendationAuditEntry[] = [...audit];

    if (!synthesized.some((e) => e.action === 'created') && row.created_by) {
      synthesized.unshift({
        action: 'created',
        by: String(row.created_by),
        at: String(row.created_at),
      });
    }
    if (
      row.status === 'pending_approval' &&
      row.reviewed_by &&
      !synthesized.some((e) => e.action === 'submitted')
    ) {
      synthesized.push({
        action: 'submitted',
        by: String(row.reviewed_by),
        at: String(row.updated_at),
      });
    }
    if (row.approved_by && row.approved_at && !synthesized.some((e) => e.action === 'approved')) {
      const st = String(row.status);
      if (st === 'approved' || st === 'communicated' || st === 'applied') {
        synthesized.push({
          action: 'approved',
          by: String(row.approved_by),
          at: String(row.approved_at),
        });
      }
      if (st === 'rejected') {
        synthesized.push({
          action: 'rejected',
          by: String(row.approved_by),
          at: String(row.approved_at),
          note: row.outcome_notes ? String(row.outcome_notes) : null,
        });
      }
    }

    synthesized.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      ...mapListRow(row),
      products: row.products ?? [],
      applicationType: row.application_type ? String(row.application_type) : null,
      weatherWarning: row.weather_warning ? String(row.weather_warning) : null,
      outcomeNotes: row.outcome_notes ? String(row.outcome_notes) : null,
      canEdit: EDITABLE_STATUSES.includes(String(row.status) as RecommendationStatus),
      auditLog: synthesized.map((e) => ({
        ...e,
        label: formatAuditLabel(e),
      })),
    };
  },

  assertCanEdit(
    row: { status: string; created_by?: string | null },
    editorEmail: string,
    editorRole: string
  ): void {
    const status = String(row.status);
    if (!EDITABLE_STATUSES.includes(status as RecommendationStatus)) {
      throw new AppError('This recommendation can no longer be edited', 400, 'INVALID_STATUS');
    }
    if (canApproveRecommendations(editorRole)) return;
    const creator = row.created_by ? String(row.created_by).toLowerCase() : '';
    if (creator !== editorEmail.toLowerCase()) {
      throw new AppError('You can only edit your own submissions', 403, 'FORBIDDEN');
    }
  },

  async update(
    id: string,
    patch: {
      issueDetected?: string;
      recommendationText?: string;
      dosage?: string;
      language?: string;
      applicationType?: string;
      weatherWarning?: string;
    },
    editorEmail: string,
    editorRole: string
  ) {
    const { data: existing, error: loadErr } = await supabase
      .from('recommendation_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!existing) throw new NotFoundError('Recommendation not found');

    this.assertCanEdit(existing, editorEmail, editorRole);

    const changed: string[] = [];
    if (patch.issueDetected !== undefined) changed.push('issue');
    if (patch.recommendationText !== undefined) changed.push('recommendation');
    if (patch.dosage !== undefined) changed.push('dosage');
    if (patch.language !== undefined) changed.push('language');

    const metadata = appendAuditEntry(existing.metadata, {
      action: 'updated',
      by: editorEmail,
      fields: changed,
    });

    const { data, error } = await supabase
      .from('recommendation_records')
      .update({
        ...(patch.issueDetected !== undefined ? { issue_detected: patch.issueDetected } : {}),
        ...(patch.recommendationText !== undefined
          ? { recommendation_text: patch.recommendationText }
          : {}),
        ...(patch.dosage !== undefined ? { dosage: patch.dosage } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
        ...(patch.applicationType !== undefined
          ? { application_type: patch.applicationType }
          : {}),
        ...(patch.weatherWarning !== undefined
          ? { weather_warning: patch.weatherWarning }
          : {}),
        reviewed_by: editorEmail,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not update recommendation');
    return data;
  },

  async recordAudit(
    id: string,
    entry: Omit<RecommendationAuditEntry, 'at'> & { at?: string }
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('recommendation_records')
      .select('metadata')
      .eq('id', id)
      .maybeSingle();
    if (!existing) return;

    const metadata = appendAuditEntry(existing.metadata, entry);
    await supabase
      .from('recommendation_records')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', id);
  },
};
