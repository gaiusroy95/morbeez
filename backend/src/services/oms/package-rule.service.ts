import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';
import type { ShippingBox } from './shipping-box.service.js';
import { shippingBoxService } from './shipping-box.service.js';
export type PackageRule = {
  id: string;
  packagingCategoryId: string;
  packagingCategoryName: string;
  minWeightKg: number;
  maxWeightKg: number;
  preferredBoxId: string;
  preferredBoxCode: string;
  preferredBoxName: string;
  priority: number;
  active: boolean;
};

function mapRule(row: Record<string, unknown>): PackageRule {
  const cat = row.packaging_categories as Record<string, unknown> | null;
  const box = row.shipping_boxes as Record<string, unknown> | null;
  return {
    id: String(row.id),
    packagingCategoryId: String(row.packaging_category_id),
    packagingCategoryName: cat ? String(cat.name) : '—',
    minWeightKg: Number(row.min_weight_kg),
    maxWeightKg: Number(row.max_weight_kg),
    preferredBoxId: String(row.preferred_box_id),
    preferredBoxCode: box ? String(box.code) : '—',
    preferredBoxName: box ? String(box.name) : '—',
    priority: Number(row.priority ?? 100),
    active: row.active !== false,
  };
}

export const packageRuleService = {
  async listAll(): Promise<PackageRule[]> {
    const { data, error } = await supabase
      .from('package_rules')
      .select('*, packaging_categories(name), shipping_boxes(code, name)')
      .order('priority', { ascending: false });
    throwIfSupabaseError(error, 'List package rules');
    return (data ?? []).map((r) => mapRule(r as Record<string, unknown>));
  },

  async listActiveForCategory(categoryId: string): Promise<PackageRule[]> {
    const { data, error } = await supabase
      .from('package_rules')
      .select('*, packaging_categories(name), shipping_boxes(code, name)')
      .eq('packaging_category_id', categoryId)
      .eq('active', true)
      .order('priority', { ascending: false });
    throwIfSupabaseError(error, 'List package rules for category');
    return (data ?? []).map((r) => mapRule(r as Record<string, unknown>));
  },

  async matchRule(
    categoryId: string,
    totalWeightKg: number
  ): Promise<{ rule: PackageRule; box: ShippingBox } | null> {
    const rules = await this.listActiveForCategory(categoryId);
    for (const rule of rules) {
      if (totalWeightKg >= rule.minWeightKg && totalWeightKg <= rule.maxWeightKg) {
        const box = await shippingBoxService.getById(rule.preferredBoxId);
        if (box.active) return { rule, box };
      }
    }
    return null;
  },

  async create(input: {
    packagingCategoryId: string;
    minWeightKg: number;
    maxWeightKg: number;
    preferredBoxId: string;
    priority?: number;
  }): Promise<PackageRule> {
    const { data, error } = await supabase
      .from('package_rules')
      .insert({
        packaging_category_id: input.packagingCategoryId,
        min_weight_kg: input.minWeightKg,
        max_weight_kg: input.maxWeightKg,
        preferred_box_id: input.preferredBoxId,
        priority: input.priority ?? 100,
      })
      .select('*, packaging_categories(name), shipping_boxes(code, name)')
      .single();
    throwIfSupabaseError(error, 'Create package rule');
    return mapRule(data as Record<string, unknown>);
  },

  async update(
    id: string,
    patch: Partial<{
      packagingCategoryId: string;
      minWeightKg: number;
      maxWeightKg: number;
      preferredBoxId: string;
      priority: number;
      active: boolean;
    }>
  ): Promise<PackageRule> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.packagingCategoryId !== undefined) row.packaging_category_id = patch.packagingCategoryId;
    if (patch.minWeightKg !== undefined) row.min_weight_kg = patch.minWeightKg;
    if (patch.maxWeightKg !== undefined) row.max_weight_kg = patch.maxWeightKg;
    if (patch.preferredBoxId !== undefined) row.preferred_box_id = patch.preferredBoxId;
    if (patch.priority !== undefined) row.priority = patch.priority;
    if (patch.active !== undefined) row.active = patch.active;

    const { data, error } = await supabase
      .from('package_rules')
      .update(row)
      .eq('id', id)
      .select('*, packaging_categories(name), shipping_boxes(code, name)')
      .maybeSingle();
    throwIfSupabaseError(error, 'Update package rule');
    if (!data) throw new NotFoundError('Package rule not found');
    return mapRule(data as Record<string, unknown>);
  },
};
