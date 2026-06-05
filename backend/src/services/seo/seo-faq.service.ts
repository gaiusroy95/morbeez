import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError } from '../../lib/errors.js';

export const seoFaqService = {
  async list(opts?: { pageId?: string; productId?: string }) {
    let q = supabase.from('seo_faqs').select('*').order('sort_order');
    if (opts?.pageId) q = q.eq('page_id', opts.pageId);
    if (opts?.productId) q = q.eq('shopify_product_id', opts.productId);
    const { data, error } = await q.limit(200);
    throwIfSupabaseError(error, 'List FAQs');
    return data ?? [];
  },

  async create(input: {
    pageId?: string;
    shopifyProductId?: string;
    question: string;
    answer: string;
    sortOrder?: number;
    schemaEnabled?: boolean;
    aiGenerated?: boolean;
  }) {
    const { data, error } = await supabase
      .from('seo_faqs')
      .insert({
        page_id: input.pageId ?? null,
        shopify_product_id: input.shopifyProductId ?? null,
        question: input.question,
        answer: input.answer,
        sort_order: input.sortOrder ?? 0,
        schema_enabled: input.schemaEnabled ?? true,
        ai_generated: input.aiGenerated ?? false,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create FAQ');
    return data;
  },

  async update(id: string, input: Partial<{ question: string; answer: string; sortOrder: number; schemaEnabled: boolean }>) {
    const { data, error } = await supabase
      .from('seo_faqs')
      .update({
        question: input.question,
        answer: input.answer,
        sort_order: input.sortOrder,
        schema_enabled: input.schemaEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Update FAQ');
    if (!data) throw new NotFoundError('FAQ not found');
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('seo_faqs').delete().eq('id', id);
    throwIfSupabaseError(error, 'Delete FAQ');
    return { ok: true };
  },
};
