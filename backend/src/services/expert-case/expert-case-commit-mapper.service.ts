import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';
import { whatsappOsAdminService } from '../admin/whatsapp-os-admin.service.js';

function mapActivityType(method?: string | null): 'spray_applied' | 'fertigation' | 'drench' | 'other' {
  const m = String(method ?? '').toLowerCase();
  if (/drench|soil/.test(m)) return 'drench';
  if (/drip|fertigation|nutrition/.test(m)) return 'fertigation';
  if (/spray|foliar/.test(m)) return 'spray_applied';
  return 'other';
}

export const expertCaseCommitMapperService = {
  async persistStructuredOutputs(params: {
    caseId: string;
    farmerId: string;
    blockId?: string | null;
    actorEmail: string;
    commandId: string;
    draft: ExpertCaseReviewDraft;
  }): Promise<{
    recommendationId?: string | null;
    activityIds: string[];
  }> {
    const activityIds: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    let blockId = params.blockId ?? null;
    if (!blockId) {
      const { data: caseRow } = await supabase
        .from('expert_cases')
        .select('block_id')
        .eq('id', params.caseId)
        .maybeSingle();
      blockId = caseRow?.block_id ? String(caseRow.block_id) : null;
    }
    if (!blockId) {
      const { data: block } = await supabase
        .from('farm_blocks')
        .select('id')
        .eq('farmer_id', params.farmerId)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      blockId = block?.id ? String(block.id) : null;
    }

    const activities =
      (params.draft.treatmentActivities?.length ?? 0) > 0
        ? params.draft.treatmentActivities!
        : params.draft.treatmentProduct || params.draft.recommendationText
          ? [
              {
                method: params.draft.applicationMethod,
                product: params.draft.treatmentProduct ?? params.draft.recommendationText,
                dose: params.draft.dosage,
                dilutionVolumeL: params.draft.sprayVolumeL,
                dilutionNotes: params.draft.dilutionNotes,
                interval: params.draft.applicationTiming,
              },
            ]
          : [];

    if (blockId) {
      for (const [index, row] of activities.entries()) {
        try {
          const notes = [
            row.product,
            row.dose,
            row.dilutionVolumeL != null ? `${row.dilutionVolumeL} L water` : row.dilutionNotes,
            row.interval ? `Every ${row.interval}` : null,
            `Expert case ${params.caseId.slice(0, 8)}`,
          ]
            .filter(Boolean)
            .join(' · ');
          const created = await whatsappOsAdminService.createFieldActivity({
            blockId,
            activityType: mapActivityType(row.method),
            activityLabel: row.method ?? row.product ?? 'Expert recommendation',
            activityDate: today,
            notes,
            status: 'pending',
            source: 'mobile',
            assignedEmployee: params.actorEmail,
          });
          activityIds.push(String(created.id));
          await supabase
            .from('cultivation_activities')
            .update({
              source_command_id: params.commandId,
              source_idempotency_key: `expert:${params.caseId}:activity:${index}`,
            })
            .eq('id', created.id);
        } catch (err) {
          logger.warn({ err, caseId: params.caseId, index }, 'Expert case activity row failed');
        }
      }
    }

    let recommendationId: string | null = null;
    const recommendationText =
      params.draft.recommendationText ||
      activities
        .map((row) =>
          [row.method, row.product, row.dose, row.dilutionNotes].filter(Boolean).join(' · ')
        )
        .join(' | ');
    if (recommendationText) {
      try {
        const rec = await crmFarmerService.createRecommendation(params.farmerId, null, {
          blockId: blockId ?? undefined,
          recType: 'expert_copilot',
          problem: params.draft.diagnosis ?? undefined,
          recommendation: recommendationText,
          dosage: params.draft.dosage ?? undefined,
          applicationMethod: params.draft.applicationMethod ?? undefined,
          followUpAt:
            params.draft.followUpDays != null
              ? new Date(Date.now() + params.draft.followUpDays * 86400000).toISOString()
              : undefined,
          recommendedBy: params.actorEmail,
        });
        recommendationId = String(rec.id);
        await supabase
          .from('crm_recommendations')
          .update({ status: 'pending' })
          .eq('id', recommendationId);
      } catch (err) {
        logger.warn({ err, caseId: params.caseId }, 'Expert case CRM recommendation failed');
      }
    }

    return { recommendationId, activityIds };
  },
};
