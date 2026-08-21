import { supabase } from '../../../lib/supabase.js';
import { leadService } from '../../crm/lead.service.js';
import { createCropAdvisorTask } from '../pipeline/crop-advisor-tasks.service.js';
import { t } from './whatsapp-flow-copy.js';
import type { AdvisoryLanguage } from '../../ai/types.js';

/** Scenario 20 — callback request. */
export const callbackFlowService = {
  async createCallback(farmerId: string, language: AdvisoryLanguage, notes?: string): Promise<string> {
    const { data: farmer } = await supabase
      .from('farmers')
      .select('district, preferred_language')
      .eq('id', farmerId)
      .maybeSingle();

    await supabase.from('callback_requests').insert({
      farmer_id: farmerId,
      preferred_time: 'any',
      status: 'pending',
      crop_advisor_notes: notes?.slice(0, 500) ?? `WhatsApp callback (${language})`,
    });

    await createCropAdvisorTask({
      farmerId,
      title: 'WhatsApp callback requested',
      notes: `District: ${farmer?.district ?? 'unknown'} | ${notes ?? ''}`,
      priority: 'high',
    });

    await leadService.ensureLeadForFarmer({
      farmerId,
      intent: 'callback',
      source: 'whatsapp',
      status: 'new',
      priority: 'high',
      stage: 'follow_up',
      notes: notes?.slice(0, 500) ?? 'Callback from WhatsApp menu',
      mergeNotes: true,
    });

    const { aiCallingTriggers } = await import('../../ai-calling/ai-calling-triggers.js');
    aiCallingTriggers.onCallbackRequested({ farmerId, notes });

    return t('callbackReceived', language);
  },
};
