import { supabase } from '../../lib/supabase.js';
import { normalizePhone } from '../../lib/phone.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { learningLoopService } from '../core/learning-loop.service.js';

type ActivityCostBreakdown = {
  labourCostInr?: number | null;
  sprayCostInr?: number | null;
  fertilizerCostInr?: number | null;
  machineryCostInr?: number | null;
};

type RoiExpenseType = 'labour' | 'purchase' | 'misc';

function normalizeExpense(value?: number | null): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Number(value);
}

function computeTotalCost(costInr?: number | null, breakdown?: ActivityCostBreakdown): number {
  const items = [
    normalizeExpense(breakdown?.labourCostInr),
    normalizeExpense(breakdown?.sprayCostInr),
    normalizeExpense(breakdown?.fertilizerCostInr),
    normalizeExpense(breakdown?.machineryCostInr),
  ].filter((v): v is number => v != null);
  if (items.length > 0) return Number(items.reduce((sum, v) => sum + v, 0).toFixed(2));
  return Number(normalizeExpense(costInr) ?? 0);
}

function deriveRoiEntryType(breakdown?: ActivityCostBreakdown): RoiExpenseType {
  const labour = normalizeExpense(breakdown?.labourCostInr) ?? 0;
  const spray = normalizeExpense(breakdown?.sprayCostInr) ?? 0;
  const fertilizer = normalizeExpense(breakdown?.fertilizerCostInr) ?? 0;
  const machinery = normalizeExpense(breakdown?.machineryCostInr) ?? 0;
  const max = Math.max(labour, spray, fertilizer, machinery);
  if (max === 0) return 'misc';
  if (max === labour) return 'labour';
  if (max === machinery) return 'misc';
  return 'purchase';
}

function deriveRoiCostType(breakdown?: ActivityCostBreakdown): 'labour' | 'spray' | 'fertilizer' | 'machinery' | 'mixed' {
  const parts = [
    normalizeExpense(breakdown?.labourCostInr) ? 'labour' : null,
    normalizeExpense(breakdown?.sprayCostInr) ? 'spray' : null,
    normalizeExpense(breakdown?.fertilizerCostInr) ? 'fertilizer' : null,
    normalizeExpense(breakdown?.machineryCostInr) ? 'machinery' : null,
  ].filter((v): v is 'labour' | 'spray' | 'fertilizer' | 'machinery' => Boolean(v));
  if (parts.length === 1) return parts[0];
  if (parts.length > 1) return 'mixed';
  return 'mixed';
}

export const whatsappOsAdminService = {
  async listFieldActivityBlocks(limit = 100) {
    const { data, error } = await supabase
      .from('farm_blocks')
      .select(
        'id, farmer_id, name, plot_label, crop_type, stage, acreage_decimal, planting_date, latitude, longitude, created_at, farmers(name, phone, district)'
      )
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 300));
    throwIfSupabaseError(error, 'Could not load field activity blocks');
    return data ?? [];
  },

  async listFieldActivities(params: { blockId: string; limit?: number }) {
    const { data, error } = await supabase
      .from('cultivation_activities')
      .select(
        '*, field_activity_types(id, activity_name, category, icon, color_tag, followup_default_days), roi_activity_costs(roi_entry_id, cost_type, amount_inr, link_status)'
      )
      .eq('farm_block_id', params.blockId)
      .order('applied_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(params.limit ?? 100, 1), 300));
    throwIfSupabaseError(error, 'Could not load field activities');
    return data ?? [];
  },

  async listFieldActivityTypes(params: { cropType?: string | null; activeOnly?: boolean }) {
    let q = supabase
      .from('field_activity_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('activity_name', { ascending: true });
    if (params.activeOnly ?? true) q = q.eq('active_status', true);
    if (params.cropType?.trim()) {
      const crop = params.cropType.trim().toLowerCase();
      q = q.or(`crop.is.null,crop.eq.${crop}`);
    }
    const { data, error } = await q.limit(200);
    throwIfSupabaseError(error, 'Could not load field activity types');
    return data ?? [];
  },

  async createFieldActivityType(params: {
    activityName: string;
    category?: string;
    crop?: string | null;
    icon?: string | null;
    colorTag?: string | null;
    followupDefaultDays?: number | null;
  }) {
    const activityName = params.activityName.trim();
    if (!activityName) throw new Error('Activity name is required');
    const crop = params.crop?.trim().toLowerCase() || null;
    const category = (params.category?.trim() || 'operations').toLowerCase();

    const { data: existing, error: findErr } = await (crop
      ? supabase
          .from('field_activity_types')
          .select('*')
          .eq('activity_name', activityName)
          .eq('crop', crop)
      : supabase
          .from('field_activity_types')
          .select('*')
          .eq('activity_name', activityName)
          .is('crop', null)
    ).maybeSingle();
    throwIfSupabaseError(findErr, 'Could not validate field activity type');
    if (existing?.id) {
      if (!existing.active_status) {
        const { data: revived, error: reviveErr } = await supabase
          .from('field_activity_types')
          .update({ active_status: true, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        throwIfSupabaseError(reviveErr, 'Could not reactivate field activity type');
        return revived;
      }
      return existing;
    }

    const { data, error } = await supabase
      .from('field_activity_types')
      .insert({
        activity_name: activityName,
        category,
        crop,
        icon: params.icon?.trim() || 'layers',
        color_tag: params.colorTag?.trim() || 'emerald',
        followup_default_days: params.followupDefaultDays ?? null,
        active_status: true,
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create field activity type');
    return data;
  },

  async listFieldPendingTasks(params: { blockId: string; limit?: number }) {
    const { data, error } = await supabase
      .from('pending_tasks')
      .select('*')
      .eq('crop_block_id', params.blockId)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true })
      .limit(Math.min(Math.max(params.limit ?? 100, 1), 300));
    throwIfSupabaseError(error, 'Could not load field pending tasks');
    return data ?? [];
  },

  async updateFieldBlockLocation(params: { blockId: string; latitude: number; longitude: number }) {
    const { data, error } = await supabase
      .from('farm_blocks')
      .update({
        latitude: params.latitude,
        longitude: params.longitude,
        location_source: 'admin',
        location_captured_at: new Date().toISOString(),
      })
      .eq('id', params.blockId)
      .is('archived_at', null)
      .select(
        'id, farmer_id, name, plot_label, crop_type, stage, acreage_decimal, planting_date, latitude, longitude, created_at, farmers(name, phone, district)'
      )
      .single();
    throwIfSupabaseError(error, 'Could not update field GPS location');
    return data;
  },

  async listMarketOptions(_cropType?: string) {
    const { crmFarmerService } = await import('./crm-farmer.service.js');
    const masters = await crmFarmerService.listMasters('market');
    return masters.map((row) => ({
      id: String(row.id),
      market_name: String(row.name),
      district: row.category ? String(row.category) : null,
    }));
  },

  async listFarmerMarketPreferences(params: { farmerId: string; cropType?: string }) {
    let q = supabase
      .from('farmer_market_preferences')
      .select('*')
      .eq('farmer_id', params.farmerId)
      .eq('active', true)
      .order('priority', { ascending: true });
    if (params.cropType?.trim()) q = q.eq('crop_type', params.cropType.trim().toLowerCase());
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load farmer market preferences');
    return data ?? [];
  },

  async saveFarmerMarketPreferences(params: {
    farmerId: string;
    cropType?: string;
    markets: Array<{ marketName: string; district?: string | null }>;
  }) {
    const cropType = params.cropType?.trim().toLowerCase() || null;
    const { error: clearErr } = await supabase
      .from('farmer_market_preferences')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('farmer_id', params.farmerId)
      .eq('crop_type', cropType);
    throwIfSupabaseError(clearErr, 'Could not clear prior market preferences');

    if (params.markets.length === 0) return [];

    const payload = params.markets.slice(0, 10).map((m, idx) => ({
      farmer_id: params.farmerId,
      crop_type: cropType,
      market_name: m.marketName.trim(),
      district: m.district?.trim() || null,
      priority: idx + 1,
      active: true,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('farmer_market_preferences')
      .insert(payload)
      .select('*');
    throwIfSupabaseError(error, 'Could not save market preferences');
    return data ?? [];
  },

  async createFieldActivity(params: {
    blockId: string;
    activityType: 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'other';
    activityTypeId?: string;
    activityLabel?: string;
    activityDate: string;
    dap?: number | null;
    notes?: string;
    costInr?: number | null;
    costBreakdown?: ActivityCostBreakdown;
    followUpRequired?: boolean;
    followUpDate?: string | null;
    status?: 'completed' | 'pending' | 'cancelled';
    source?: 'admin' | 'telecaller' | 'whatsapp' | 'system';
    assignedEmployee?: string;
  }) {
    const { data: block, error: bErr } = await supabase
      .from('farm_blocks')
      .select('id, farmer_id, crop_type, stage, planting_date')
      .eq('id', params.blockId)
      .is('archived_at', null)
      .maybeSingle();
    throwIfSupabaseError(bErr, 'Could not validate farm block');
    if (!block?.id || !block.farmer_id) {
      throw new Error('Valid block is required');
    }

    const activityTypeId = params.activityTypeId ?? null;
    let resolvedActivityType = params.activityType;
    let resolvedActivityLabel = params.activityLabel?.trim() || null;
    let followUpDate = params.followUpRequired ? params.followUpDate ?? null : null;

    if (activityTypeId) {
      const { data: typeRow, error: tErr } = await supabase
        .from('field_activity_types')
        .select('id, activity_name, category, followup_default_days')
        .eq('id', activityTypeId)
        .eq('active_status', true)
        .maybeSingle();
      throwIfSupabaseError(tErr, 'Could not validate field activity type');
      if (typeRow?.id) {
        resolvedActivityLabel = resolvedActivityLabel || String(typeRow.activity_name);
        const category = String(typeRow.category ?? '').toLowerCase();
        if (category.includes('nutrition')) resolvedActivityType = 'fertigation';
        else if (category.includes('protection')) resolvedActivityType = 'spray_applied';
        else if (category.includes('observation')) resolvedActivityType = 'scouting';
        else if (category.includes('operations') || category.includes('labour')) resolvedActivityType = 'other';
        if (params.followUpRequired && !followUpDate && typeRow.followup_default_days != null) {
          const due = new Date(`${params.activityDate}T00:00:00.000Z`);
          due.setUTCDate(due.getUTCDate() + Number(typeRow.followup_default_days));
          followUpDate = due.toISOString().slice(0, 10);
        }
      }
    }

    const autoDap = block.planting_date
      ? Math.max(
          0,
          Math.floor(
            (new Date(`${params.activityDate}T00:00:00.000Z`).getTime() -
              new Date(`${block.planting_date}T00:00:00.000Z`).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;
    const finalDap = params.dap ?? autoDap;
    const totalCost = computeTotalCost(params.costInr, params.costBreakdown);

    const { data, error } = await supabase
      .from('cultivation_activities')
      .insert({
        farmer_id: block.farmer_id,
        farm_block_id: block.id,
        // farmer_crop_id references farmer_crops.id, not farm_blocks.id.
        // Keep null here unless a valid farmer_crops row is explicitly resolved.
        farmer_crop_id: null,
        activity_type: resolvedActivityType,
        activity_label: resolvedActivityLabel,
        activity_type_id: activityTypeId,
        applied_at: params.activityDate,
        dap: finalDap,
        crop_type: block.crop_type ?? null,
        crop_stage: block.stage ?? null,
        notes: params.notes?.trim() || null,
        source: params.source ?? 'admin',
        cost_inr: totalCost > 0 ? totalCost : null,
        labour_cost_inr: normalizeExpense(params.costBreakdown?.labourCostInr),
        spray_cost_inr: normalizeExpense(params.costBreakdown?.sprayCostInr),
        fertilizer_cost_inr: normalizeExpense(params.costBreakdown?.fertilizerCostInr),
        machinery_cost_inr: normalizeExpense(params.costBreakdown?.machineryCostInr),
        follow_up_required: params.followUpRequired ?? false,
        follow_up_date: followUpDate,
        activity_status: params.status ?? 'completed',
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create field activity');

    void (async () => {
      const { weatherSnapshotService } = await import('../core/weather-snapshot.service.js');
      const captured = await weatherSnapshotService.capture({
        farmerId: String(block.farmer_id),
        blockId: String(block.id),
        eventType: 'field_activity',
        eventId: String(data.id),
      });
      if (captured?.snapshotId) {
        await supabase
          .from('cultivation_activities')
          .update({ weather_snapshot_id: captured.snapshotId })
          .eq('id', data.id);
      }
    })();

    if (data.follow_up_required) {
      const dueDate = data.follow_up_date ?? params.activityDate;
      const { error: ptErr } = await supabase.from('pending_tasks').insert({
        task_type: 'activity_follow_up',
        farmer_id: block.farmer_id,
        crop_block_id: block.id,
        source_activity_id: data.id,
        due_date: dueDate,
        assigned_employee: params.assignedEmployee ?? null,
        status: 'pending',
        title: resolvedActivityLabel ? `Follow-up: ${resolvedActivityLabel}` : 'Field activity follow-up',
        notes: params.notes?.trim() || null,
      });
      throwIfSupabaseError(ptErr, 'Could not create follow-up task');
    }

    if (totalCost > 0) {
      const linked = await this.syncFieldActivityToRoi({
        farmerId: block.farmer_id,
        blockId: block.id,
        activityId: data.id,
        activityDate: params.activityDate,
        amountInr: totalCost,
        comments: resolvedActivityLabel ?? params.notes?.trim() ?? 'Field activity cost',
        roiEntryType: deriveRoiEntryType(params.costBreakdown),
        roiCostType: deriveRoiCostType(params.costBreakdown),
      });
      if (linked?.roiEntryId) {
        await supabase
          .from('cultivation_activities')
          .update({ roi_entry_id: linked.roiEntryId, updated_at: new Date().toISOString() })
          .eq('id', data.id);
      }
    }

    return data;
  },

  async syncFieldActivityToRoi(params: {
    farmerId: string;
    blockId: string;
    activityId: string;
    activityDate: string;
    amountInr: number;
    comments: string;
    roiEntryType: RoiExpenseType;
    roiCostType: 'labour' | 'spray' | 'fertilizer' | 'machinery' | 'mixed';
  }): Promise<{ roiEntryId: string }> {
    const { data: existingLink, error: linkErr } = await supabase
      .from('roi_activity_costs')
      .select('roi_entry_id')
      .eq('activity_id', params.activityId)
      .maybeSingle();
    throwIfSupabaseError(linkErr, 'Could not validate ROI activity link');
    if (existingLink?.roi_entry_id) return { roiEntryId: String(existingLink.roi_entry_id) };

    const { data: candidateRows, error: cErr } = await supabase
      .from('farmer_roi_entries')
      .select('id, entry_type, amount_inr')
      .eq('farmer_id', params.farmerId)
      .eq('block_id', params.blockId)
      .eq('entry_date', params.activityDate)
      .in('entry_type', ['labour', 'purchase', 'misc'])
      .order('created_at', { ascending: false })
      .limit(20);
    throwIfSupabaseError(cErr, 'Could not load ROI entries for dedupe');

    let roiEntryId: string | null = null;
    for (const row of candidateRows ?? []) {
      if (Number(row.amount_inr ?? 0) === params.amountInr) {
        roiEntryId = String(row.id);
        break;
      }
    }

    let linkStatus: 'linked' | 'created' | 'deduped' = 'created';
    if (!roiEntryId) {
      const { data: created, error: createErr } = await supabase
        .from('farmer_roi_entries')
        .insert({
          farmer_id: params.farmerId,
          block_id: params.blockId,
          entry_type: params.roiEntryType,
          amount_inr: params.amountInr,
          note: params.comments,
          comments: params.comments,
          debit_inr: params.amountInr,
          credit_inr: null,
          entry_date: params.activityDate,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      throwIfSupabaseError(createErr, 'Could not create ROI entry');
      if (!created?.id) throw new Error('Could not create ROI entry');
      roiEntryId = String(created.id);
    } else {
      linkStatus = 'deduped';
    }

    const { error: linkInsertErr } = await supabase.from('roi_activity_costs').insert({
      farmer_id: params.farmerId,
      block_id: params.blockId,
      activity_id: params.activityId,
      roi_entry_id: roiEntryId,
      cost_type: params.roiCostType,
      amount_inr: params.amountInr,
      link_status: linkStatus,
      linked_at: new Date().toISOString(),
    });
    throwIfSupabaseError(linkInsertErr, 'Could not link ROI activity cost');

    return { roiEntryId };
  },

  async getConversationSession(farmerId: string) {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('farmer_id', farmerId)
      .eq('channel', 'whatsapp')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load conversation session');
    return data;
  },

  async updateConversationSession(
    farmerId: string,
    patch: {
      aiPaused?: boolean;
      owner?: 'ai' | 'telecaller' | 'agronomist';
      preferredLanguage?: string | null;
      activePlotId?: string | null;
      activeBlockId?: string | null;
    }
  ) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.aiPaused !== undefined) payload.ai_paused = patch.aiPaused;
    if (patch.owner) payload.conversation_owner = patch.owner;
    if (patch.preferredLanguage !== undefined) payload.preferred_language = patch.preferredLanguage;
    const blockId = patch.activeBlockId ?? patch.activePlotId;
    if (blockId !== undefined) {
      payload.active_block_id = blockId;
      payload.active_plot_id = blockId;
    }

    const { data, error } = await supabase
      .from('conversation_sessions')
      .update(payload)
      .eq('farmer_id', farmerId)
      .eq('channel', 'whatsapp')
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update conversation session');

    if (patch.preferredLanguage) {
      await supabase
        .from('farmers')
        .update({ preferred_language: patch.preferredLanguage, updated_at: new Date().toISOString() })
        .eq('id', farmerId);
    }

    return data;
  },

  async listCropDailyPrices(cropType?: string) {
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from('crop_daily_prices')
      .select('*')
      .eq('price_date', today)
      .eq('active', true)
      .order('market_name');
    if (cropType) q = q.eq('crop_type', cropType);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load crop prices');
    return data ?? [];
  },

  async upsertCropDailyPrice(row: {
    cropType: string;
    marketName: string;
    district?: string;
    pricePerKg: number;
    lastYearPricePerKg?: number;
    priceDate?: string;
  }) {
    const priceDate = row.priceDate ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('crop_daily_prices')
      .upsert(
        {
          crop_type: row.cropType,
          market_name: row.marketName,
          district: row.district ?? null,
          price_per_kg: row.pricePerKg,
          last_year_price_per_kg: row.lastYearPricePerKg ?? null,
          price_date: priceDate,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'crop_type,market_name,price_date' }
      )
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not save crop price');
    return data;
  },

  async listTerminologyReviewTasks(status: string = 'open') {
    const allowed = new Set(['open', 'in_review', 'resolved', 'dismissed', 'all']);
    const s = allowed.has(status) ? status : 'open';

    let q = supabase
      .from('terminology_review_tasks')
      .select('*, farmers(phone, name, district, state, preferred_language)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (s !== 'all') q = q.eq('status', s);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load terminology tasks');
    return data ?? [];
  },

  /** Manual queue entry (Operations UI) or testing without a live WhatsApp message. */
  async createTerminologyReviewTask(params: {
    term: string;
    rawMessage?: string;
    language?: string;
    cropType?: string;
    district?: string;
    farmerId?: string;
    farmerPhone?: string;
  }) {
    const term = params.term.trim().slice(0, 120);
    if (!term) throw new Error('Term is required');

    const termKey = term.toLowerCase();
    let farmerId = params.farmerId ?? null;
    let district = params.district ?? null;

    if (!farmerId && params.farmerPhone?.trim()) {
      const phone = normalizePhone(params.farmerPhone);
      const { data: farmer } = await supabase
        .from('farmers')
        .select('id, district')
        .eq('phone', phone)
        .maybeSingle();
      if (farmer?.id) {
        farmerId = farmer.id;
        if (!district && farmer.district) district = String(farmer.district);
      }
    }

    const rawMessage = (params.rawMessage ?? term).trim().slice(0, 500);

    const { data, error } = await supabase
      .from('terminology_review_tasks')
      .insert({
        farmer_id: farmerId,
        term: termKey,
        unknown_word: term,
        raw_message: rawMessage,
        language: params.language ?? 'ml',
        crop_type: params.cropType ?? null,
        district,
        context_text: rawMessage,
        status: 'open',
        occurrence_count: 1,
        priority_score: 1,
        ai_confidence_reduced: true,
      })
      .select('*, farmers(phone, name, district, state, preferred_language)')
      .single();

    throwIfSupabaseError(error, 'Could not create terminology task');
    return data;
  },

  async updateTerminologyTask(
    id: string,
    patch: {
      status: 'open' | 'in_review' | 'resolved' | 'dismissed';
      resolutionMeaning?: string;
      standardTerm?: string;
      assignedTo?: string;
      resolvedBy?: string;
    }
  ) {
    const payload: Record<string, unknown> = { status: patch.status };
    if (patch.assignedTo !== undefined) payload.assigned_to = patch.assignedTo;
    if (patch.resolutionMeaning !== undefined) payload.resolution_meaning = patch.resolutionMeaning;
    if (patch.standardTerm !== undefined) payload.standard_term = patch.standardTerm;
    if (patch.status === 'resolved' || patch.status === 'dismissed') {
      payload.resolved_at = new Date().toISOString();
      if (patch.resolvedBy) payload.resolved_by = patch.resolvedBy;
    }

    const { data, error } = await supabase
      .from('terminology_review_tasks')
      .update(payload)
      .eq('id', id)
      .select('*, farmers(phone, name, district, state, preferred_language)')
      .single();
    throwIfSupabaseError(error, 'Could not update terminology task');

    if (patch.status === 'resolved' && patch.resolutionMeaning?.trim() && data) {
      const row = data as {
        id: string;
        term: string;
        language?: string | null;
        crop_type?: string | null;
        district?: string | null;
        farmer_id?: string | null;
      };
      await learningLoopService
        .onTerminologyResolved({
          taskId: row.id,
          term: row.term,
          language: row.language ?? 'en',
          meaning: patch.resolutionMeaning,
          standardTerm: patch.standardTerm ?? patch.resolutionMeaning,
          cropType: row.crop_type,
          district: row.district,
          resolvedBy: patch.resolvedBy,
          farmerId: row.farmer_id,
        })
        .catch(() => {});
    }

    return data;
  },
};

