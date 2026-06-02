import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import {
  DEFAULT_ATTRIBUTION_WEIGHTS,
  type AttributionType,
  type EmployeeFarmerAttributionRow,
  type UpsertAttributionInput,
} from './employee-attribution.types.js';

function mapRow(row: Record<string, unknown>): EmployeeFarmerAttributionRow {
  return {
    id: String(row.id),
    farmerId: String(row.farmer_id),
    employeeProfileId: String(row.employee_profile_id),
    attributionType: String(row.attribution_type) as AttributionType,
    employeeRole: String(row.employee_role) as EmployeeFarmerAttributionRow['employeeRole'],
    weight: Number(row.weight),
    firstTouchAt: String(row.first_touch_at),
    lastTouchAt: String(row.last_touch_at),
    touchCount: Number(row.touch_count ?? 1),
    active: Boolean(row.active),
  };
}

/**
 * Phase 0: upsert multi-touch attribution rows.
 * Phase 2: invoked via employeeAttributionCaptureService from CRM, WhatsApp, agronomist, orders.
 */
export const employeeAttributionService = {
  async upsertTouch(input: UpsertAttributionInput): Promise<EmployeeFarmerAttributionRow> {
    const touchAt = input.touchAt ?? new Date().toISOString();
    const weight = input.weight ?? DEFAULT_ATTRIBUTION_WEIGHTS[input.attributionType];

    const { data: existing, error: loadErr } = await supabase
      .from('employee_farmer_attribution')
      .select('*')
      .eq('farmer_id', input.farmerId)
      .eq('employee_profile_id', input.employeeProfileId)
      .eq('attribution_type', input.attributionType)
      .maybeSingle();

    throwIfSupabaseError(loadErr, 'Could not load attribution');

    if (existing) {
      const { data, error } = await supabase
        .from('employee_farmer_attribution')
        .update({
          last_touch_at: touchAt,
          touch_count: Number(existing.touch_count ?? 0) + 1,
          weight: Math.max(Number(existing.weight), weight),
          employee_role: input.employeeRole,
          metadata: { ...(existing.metadata as object), ...(input.metadata ?? {}) },
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      throwIfSupabaseError(error, 'Could not update attribution');
      return mapRow(data as Record<string, unknown>);
    }

    const { data, error } = await supabase
      .from('employee_farmer_attribution')
      .insert({
        farmer_id: input.farmerId,
        employee_profile_id: input.employeeProfileId,
        attribution_type: input.attributionType,
        employee_role: input.employeeRole,
        weight,
        first_touch_at: touchAt,
        last_touch_at: touchAt,
        touch_count: 1,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not create attribution');
    return mapRow(data as Record<string, unknown>);
  },

  async listForFarmer(farmerId: string, activeOnly = true): Promise<EmployeeFarmerAttributionRow[]> {
    let q = supabase
      .from('employee_farmer_attribution')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('last_touch_at', { ascending: false });

    if (activeOnly) q = q.eq('active', true);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list attributions');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  /** Active touches within conversion window (excludes conversion_assist rows). */
  async listEligibleForConversion(
    farmerId: string,
    windowDays = 180
  ): Promise<EmployeeFarmerAttributionRow[]> {
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('employee_farmer_attribution')
      .select('*')
      .eq('farmer_id', farmerId)
      .eq('active', true)
      .neq('attribution_type', 'conversion_assist')
      .gte('last_touch_at', cutoff)
      .order('last_touch_at', { ascending: false });

    throwIfSupabaseError(error, 'Could not list conversion-eligible attributions');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  async listForEmployee(
    employeeProfileId: string,
    activeOnly = true
  ): Promise<EmployeeFarmerAttributionRow[]> {
    let q = supabase
      .from('employee_farmer_attribution')
      .select('*')
      .eq('employee_profile_id', employeeProfileId)
      .order('last_touch_at', { ascending: false });

    if (activeOnly) q = q.eq('active', true);

    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list employee attributions');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },
};
