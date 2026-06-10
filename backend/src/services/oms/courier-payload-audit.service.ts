import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';

export const courierPayloadAuditService = {
  async record(input: {
    commerceOrderId: string;
    courierName?: string | null;
    payloadJson: Record<string, unknown>;
    awbNumber?: string | null;
    labelUrl?: string | null;
    apiResponse?: unknown;
    success: boolean;
  }) {
    const { error } = await supabase.from('courier_payloads').insert({
      commerce_order_id: input.commerceOrderId,
      courier_name: input.courierName ?? null,
      payload_json: input.payloadJson,
      awb_number: input.awbNumber ?? null,
      label_url: input.labelUrl ?? null,
      api_response: input.apiResponse ?? null,
      success: input.success,
    });
    throwIfSupabaseError(error, 'Record courier payload');
  },

  async listForOrder(commerceOrderId: string) {
    const { data, error } = await supabase
      .from('courier_payloads')
      .select('*')
      .eq('commerce_order_id', commerceOrderId)
      .order('created_at', { ascending: false });
    throwIfSupabaseError(error, 'List courier payloads');
    return data ?? [];
  },
};
