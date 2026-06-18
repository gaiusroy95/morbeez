import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';

const PHOTO_MSG_TYPES = new Set(['image', 'document', 'audio', 'video']);

export const visitEvidenceInboundService = {
  async tryHandleFarmerMessage(params: {
    farmerId: string;
    msgType: string;
    text?: string | null;
  }): Promise<{ handled: boolean; ack?: string }> {
    const hasMedia = PHOTO_MSG_TYPES.has(params.msgType);
    const hasText = Boolean(params.text?.trim());
    if (!hasMedia && !hasText) return { handled: false };

    const { data: waitingCases } = await supabase
      .from('visit_ai_cases')
      .select('id, issue_name, farmer_id')
      .eq('farmer_id', params.farmerId)
      .eq('status', 'waiting_farmer_response')
      .order('updated_at', { ascending: false })
      .limit(5);

    if (!waitingCases?.length) return { handled: false };

    for (const caseRow of waitingCases) {
      const { data: evidenceReq } = await supabase
        .from('visit_ai_evidence_requests')
        .select('id, status')
        .eq('visit_ai_case_id', caseRow.id)
        .in('status', ['pending', 'sent'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!evidenceReq) continue;

      await supabase
        .from('visit_ai_evidence_requests')
        .update({
          status: 'responded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', evidenceReq.id);

      await supabase
        .from('visit_ai_cases')
        .update({
          status: 'analyzed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', caseRow.id);

      void createTelecallerTask({
        farmerId: params.farmerId,
        title: 'Visit evidence received',
        notes: `Farmer replied to evidence request for ${String(caseRow.issue_name)}. Resume visit AI case ${String(caseRow.id).slice(0, 8)}.`,
        priority: 'normal',
      }).catch((err) => logger.warn({ err }, 'Could not create evidence resume task'));

      return {
        handled: true,
        ack: 'Thank you. Our agronomist team will review your response and follow up shortly.',
      };
    }

    return { handled: false };
  },
};
