import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import type { PackageEstimate } from './package-rule-engine.service.js';

export const orderPackageService = {
  async upsertFromEstimate(
    commerceOrderId: string,
    estimate: PackageEstimate,
    opts?: {
      status?: string;
      matchedRuleId?: string | null;
      packagingCategoryId?: string | null;
      overrideUsed?: boolean;
      confirmedBy?: string | null;
      confirmedAt?: string | null;
      selectedBoxId?: string | null;
    }
  ) {
    const settings = estimate.meta;
    const volumetric =
      typeof settings.volumetricWeightKg === 'number'
        ? settings.volumetricWeightKg
        : estimate.billingWeightKg;

    const row = {
      commerce_order_id: commerceOrderId,
      packaging_category_id: opts?.packagingCategoryId ?? null,
      suggested_box_id: estimate.suggestedBox.id || null,
      selected_box_id: opts?.selectedBoxId ?? estimate.suggestedBox.id ?? null,
      matched_rule_id: opts?.matchedRuleId ?? null,
      estimated_weight_kg: estimate.estimatedWeightKg,
      volumetric_weight_kg: volumetric,
      billing_weight_kg: estimate.billingWeightKg,
      length_cm: estimate.lengthCm,
      breadth_cm: estimate.breadthCm,
      height_cm: estimate.heightCm,
      override_used: opts?.overrideUsed ?? false,
      confirmed_by: opts?.confirmedBy ?? null,
      confirmed_at: opts?.confirmedAt ?? null,
      status: opts?.status ?? 'estimated',
      estimate_meta: {
        lines: estimate.lines,
        courierPayload: estimate.courierPayload,
        ...estimate.meta,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('order_packages').upsert(row, {
      onConflict: 'commerce_order_id',
    });
    throwIfSupabaseError(error, 'Upsert order package');
  },

  async getByOrderId(commerceOrderId: string) {
    const { data, error } = await supabase
      .from('order_packages')
      .select('*')
      .eq('commerce_order_id', commerceOrderId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Get order package');
    return data;
  },
};
