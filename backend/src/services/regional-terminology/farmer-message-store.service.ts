import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type { AdvisoryLanguage } from '../ai/types.js';

/**
 * Stage 1 — persist raw farmer messages for terminology + learning audit.
 */
export const farmerMessageStoreService = {
  async record(params: {
    farmerId: string;
    rawMessage: string;
    detectedLanguage: AdvisoryLanguage;
    channel?: string;
    messageType?: string;
    externalMessageId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    const raw = params.rawMessage?.trim();
    if (!raw) return null;

    const { data, error } = await supabase
      .from('farmer_messages')
      .insert({
        farmer_id: params.farmerId,
        channel: params.channel ?? 'whatsapp',
        raw_message: raw.slice(0, 4000),
        detected_language: params.detectedLanguage,
        message_type: params.messageType ?? null,
        external_message_id: params.externalMessageId ?? null,
        metadata: params.metadata ?? {},
      })
      .select('id')
      .single();

    throwIfSupabaseError(error, 'Could not store farmer message');
    return data ? String(data.id) : null;
  },
};
