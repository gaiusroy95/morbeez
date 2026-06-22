import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { modelEvalService } from '../ml/retraining-pipeline.service.js';

export const retrainingOpsService = {
  async listGoldQueue(limit = 100) {
    const { data, error } = await supabase
      .from('ml_gold_queue')
      .select('id, case_id, status, created_at, exported_at, metadata')
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not load gold queue');
    return data ?? [];
  },

  async getEvalSummary() {
    return modelEvalService.runEval().catch(() => ({
      accuracy: null,
      falsePositiveRate: null,
      recoveryRate: null,
    }));
  },

  async triggerWeeklyExport() {
    const { retrainingPipelineService } = await import('../ml/retraining-pipeline.service.js');
    return retrainingPipelineService.runWeekly();
  },
};

export const protocolDefinitionService = {
  async list(cropType?: string) {
    let q = supabase.from('protocol_definitions').select('*').order('updated_at', { ascending: false });
    if (cropType) q = q.eq('crop_type', cropType);
    const { data, error } = await q.limit(100);
    throwIfSupabaseError(error, 'Could not list protocols');
    return data ?? [];
  },

  async create(input: {
    cropType: string;
    issueLabel: string;
    label: string;
    stages: unknown[];
    products: unknown[];
    createdBy?: string;
  }) {
    const { data, error } = await supabase
      .from('protocol_definitions')
      .insert({
        crop_type: input.cropType,
        issue_label: input.issueLabel,
        label: input.label,
        stages: input.stages,
        products: input.products,
        created_by: input.createdBy ?? null,
        status: 'draft',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create protocol');
    return data;
  },

  async publish(id: string) {
    const { data, error } = await supabase
      .from('protocol_definitions')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not publish protocol');
    return data;
  },

  async updateDraft(
    id: string,
    input: { label?: string; issueLabel?: string; stages?: unknown[]; products?: unknown[] }
  ) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.label != null) patch.label = input.label;
    if (input.issueLabel != null) patch.issue_label = input.issueLabel;
    if (input.stages != null) patch.stages = input.stages;
    if (input.products != null) patch.products = input.products;
    const { data, error } = await supabase
      .from('protocol_definitions')
      .update(patch)
      .eq('id', id)
      .eq('status', 'draft')
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update protocol (draft only)');
    return data;
  },
};

export const applicationHistoryService = {
  async listForFarmer(farmerId: string, blockId?: string) {
    let q = supabase
      .from('application_history')
      .select('*')
      .eq('farmer_id', farmerId)
      .order('applied_at', { ascending: false })
      .limit(100);
    if (blockId) q = q.eq('block_id', blockId);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load application history');
    return data ?? [];
  },

  async record(input: {
    farmerId: string;
    blockId?: string;
    productName: string;
    dose?: string;
    method: 'spray' | 'drench' | 'fertigation' | 'soil';
    source?: string;
    sourceId?: string;
  }) {
    const { data, error } = await supabase
      .from('application_history')
      .insert({
        farmer_id: input.farmerId,
        block_id: input.blockId ?? null,
        product_name: input.productName,
        dose: input.dose ?? null,
        method: input.method,
        source: input.source ?? 'visit',
        source_id: input.sourceId ?? null,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not record application');
    return data;
  },
};

export const experimentDefinitionService = {
  async list(status?: string) {
    let q = supabase.from('experiment_definitions').select('*').order('updated_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q.limit(100);
    throwIfSupabaseError(error, 'Could not list experiments');
    return data ?? [];
  },

  async get(id: string) {
    const { data, error } = await supabase
      .from('experiment_definitions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load experiment');
    if (!data) throw new Error('Experiment not found');
    return data;
  },

  async create(input: {
    experimentKey: string;
    label: string;
    hypothesis?: string;
    variants?: unknown[];
    createdBy?: string;
  }) {
    const { data, error } = await supabase
      .from('experiment_definitions')
      .insert({
        experiment_key: input.experimentKey,
        label: input.label,
        hypothesis: input.hypothesis ?? null,
        variants: input.variants ?? [],
        created_by: input.createdBy ?? null,
        status: 'draft',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create experiment');
    return data;
  },

  async update(
    id: string,
    patch: {
      label?: string;
      hypothesis?: string;
      variants?: unknown[];
      status?: 'draft' | 'running' | 'completed' | 'archived';
      metadata?: Record<string, unknown>;
    }
  ) {
    const { data, error } = await supabase
      .from('experiment_definitions')
      .update({
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.hypothesis !== undefined ? { hypothesis: patch.hypothesis } : {}),
        ...(patch.variants !== undefined ? { variants: patch.variants } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        ...(patch.status === 'running' ? { started_at: new Date().toISOString() } : {}),
        ...(patch.status === 'completed' || patch.status === 'archived'
          ? { ended_at: new Date().toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update experiment');
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from('experiment_definitions').delete().eq('id', id);
    throwIfSupabaseError(error, 'Could not delete experiment');
  },

  async assignOnVisitClose(fieldFindingId: string) {
    const running = await this.list('running');
    if (!running.length) return null;
    const exp = running[0]!;
    const rawVariants = (exp.variants as unknown[]) ?? [];
    const keys = rawVariants.map((v) =>
      typeof v === 'string' ? v : String((v as { key?: string }).key ?? 'variant')
    );
    const pool = keys.length ? keys : ['control', 'treatment'];
    const variantKey = pool[Math.floor(Math.random() * pool.length)]!;
    await supabase
      .from('crm_field_findings')
      .update({
        experiment_id: String(exp.experiment_key),
        variant_key: variantKey,
      })
      .eq('id', fieldFindingId);
    return { experimentId: String(exp.experiment_key), variantKey };
  },
};
