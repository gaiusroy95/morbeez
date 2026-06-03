import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { escalationService, OPEN_ESCALATION_STATUSES } from '../ai/escalation.service.js';
import { escalationAdminService } from './escalation-admin.service.js';

/**
 * Create or update agronomist case review from a telecaller operational interaction.
 * Uses a lightweight AI advisory session row (required by agronomist_escalations FK).
 */
export const telecallerEscalationService = {
  async escalateFromInteraction(params: {
    farmerId: string;
    leadId: string | null;
    interactionLogId: string;
    summary: string;
    interactionType: string;
    blockId?: string;
    cropType?: string;
    agentEmail: string;
  }): Promise<{ escalationId: string; created: boolean }> {
    const reason = `[Telecaller] ${params.interactionType}: ${params.summary}`.slice(0, 500);

    const { data: open } = await supabase
      .from('agronomist_escalations')
      .select('id, status')
      .eq('farmer_id', params.farmerId)
      .in('status', [...OPEN_ESCALATION_STATUSES])
      .maybeSingle();

    if (open?.id) {
      await escalationAdminService.addEscalationComment(
        String(open.id),
        reason,
        params.agentEmail,
        'telecaller'
      );
      await supabase
        .from('agronomist_escalations')
        .update({
          reason,
          priority: 'high',
          updated_at: new Date().toISOString(),
        })
        .eq('id', open.id);
      return { escalationId: String(open.id), created: false };
    }

    let cropType = (params.cropType ?? 'ginger').trim().toLowerCase() || 'ginger';
    if (params.blockId) {
      const { data: block } = await supabase
        .from('farm_blocks')
        .select('crop_name, crop_type')
        .eq('id', params.blockId)
        .maybeSingle();
      cropType = String(block?.crop_name ?? block?.crop_type ?? cropType)
        .trim()
        .toLowerCase() || cropType;
    }

    const { data: session, error: sessionErr } = await supabase
      .from('ai_advisory_sessions')
      .insert({
        farmer_id: params.farmerId,
        channel: 'api',
        crop_type: cropType,
        status: 'completed',
        symptoms_text: params.summary.slice(0, 2000),
        escalation_recommended: true,
        metadata: {
          source: 'telecaller_interaction',
          interaction_log_id: params.interactionLogId,
          lead_id: params.leadId,
          interaction_type: params.interactionType,
        },
      })
      .select('id')
      .single();
    throwIfSupabaseError(sessionErr, 'Could not open case review session');
    if (!session?.id) {
      throw new Error('Could not open case review session');
    }

    const { escalationId } = await escalationService.createCaseForReview({
      sessionId: String(session.id),
      farmerId: params.farmerId,
      reason,
      confidence_at_escalation: 0.55,
      priority: 'high',
    });

    return { escalationId, created: true };
  },
};
