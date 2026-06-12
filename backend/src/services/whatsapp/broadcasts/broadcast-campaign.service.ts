import { supabase } from '../../../lib/supabase.js';
import { throwIfSupabaseError } from '../../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../../lib/errors.js';
import { whatsappService } from '../whatsapp.service.js';
import { whatsappOutboundService } from '../whatsapp-outbound.service.js';
import { broadcastThrottleService } from './broadcast-throttle.service.js';
import { loadFarmerVariableContext, renderBroadcastMessage } from './broadcast-variables.js';
import type { BroadcastKind } from './broadcast-copy.js';

export type BroadcastAudienceFilter = {
  cropTypes?: string[];
  districts?: string[];
  languages?: string[];
  broadcastTags?: string[];
  farmerCategories?: string[];
};

export type CampaignCategory =
  | 'cultivation_advisory'
  | 'fertigation_reminder'
  | 'pest_disease_alert'
  | 'weather_alert'
  | 'market_price_update'
  | 'custom_message';

const CATEGORY_TO_KIND: Record<CampaignCategory, BroadcastKind | 'custom_campaign'> = {
  cultivation_advisory: 'cultivation_schedule',
  fertigation_reminder: 'fertigation_reminder',
  pest_disease_alert: 'dap_task',
  weather_alert: 'cultivation_schedule',
  market_price_update: 'daily_market_price',
  custom_message: 'custom_campaign',
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    category: String(r.category),
    status: String(r.status),
    audienceJson: (r.audience_json ?? {}) as BroadcastAudienceFilter,
    messageTitle: r.message_title ? String(r.message_title) : null,
    messageBody: String(r.message_body ?? ''),
    languageMode: String(r.language_mode ?? 'auto'),
    mediaUrls: (r.media_urls ?? []) as string[],
    templateId: r.template_id ? String(r.template_id) : null,
    scheduledAt: r.scheduled_at ? String(r.scheduled_at) : null,
    sentAt: r.sent_at ? String(r.sent_at) : null,
    createdBy: r.created_by ? String(r.created_by) : null,
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    statsJson: (r.stats_json ?? {}) as Record<string, unknown>,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapTemplateRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    name: String(r.name),
    category: String(r.category),
    cropType: r.crop_type ? String(r.crop_type) : null,
    targetDap: r.target_dap != null ? Number(r.target_dap) : null,
    title: r.title ? String(r.title) : null,
    body: String(r.body),
    language: String(r.language ?? 'en'),
    mediaUrls: (r.media_urls ?? []) as string[],
    status: String(r.status),
    version: Number(r.version ?? 1),
    createdBy: r.created_by ? String(r.created_by) : null,
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

async function farmerIdsMatchingAudience(filter: BroadcastAudienceFilter, limit = 10000): Promise<string[]> {
  let q = supabase.from('farmers').select('id').limit(limit);

  if (filter.districts?.length) {
    q = q.in('district', filter.districts);
  }
  if (filter.languages?.length) {
    q = q.in('preferred_language', filter.languages);
  }

  const { data: farmers, error } = await q;
  throwIfSupabaseError(error, 'Could not load farmers for audience');
  let ids = (farmers ?? []).map((f) => String(f.id));

  if (filter.cropTypes?.length) {
    const { data: blocks } = await supabase
      .from('farm_blocks')
      .select('farmer_id')
      .in('crop_type', filter.cropTypes)
      .is('archived_at', null);
    const cropSet = new Set((blocks ?? []).map((b) => String(b.farmer_id)));
    ids = ids.filter((id) => cropSet.has(id));
  }

  if (filter.broadcastTags?.length) {
    const { data: leads } = await supabase
      .from('leads')
      .select('farmer_id, metadata')
      .not('farmer_id', 'is', null);
    const tagSet = new Set(filter.broadcastTags.map((t) => t.toLowerCase()));
    const tagged = new Set<string>();
    for (const lead of leads ?? []) {
      const meta = (lead.metadata ?? {}) as Record<string, unknown>;
      const tags = Array.isArray(meta.broadcast_tags)
        ? meta.broadcast_tags.map((t) => String(t).toLowerCase())
        : [];
      if (tags.some((t) => tagSet.has(t)) && lead.farmer_id) {
        tagged.add(String(lead.farmer_id));
      }
    }
    ids = ids.filter((id) => tagged.has(id));
  }

  if (filter.farmerCategories?.length) {
    const { data: prefs } = await supabase
      .from('farmer_broadcast_preferences')
      .select('farmer_id, opted_out_all, opted_out_categories')
      .in('farmer_id', ids);
    const blocked = new Set<string>();
    for (const p of prefs ?? []) {
      if (p.opted_out_all) blocked.add(String(p.farmer_id));
      const cats = Array.isArray(p.opted_out_categories) ? p.opted_out_categories : [];
      if (filter.farmerCategories.some((c) => cats.includes(c))) {
        blocked.add(String(p.farmer_id));
      }
    }
    ids = ids.filter((id) => !blocked.has(id));
  }

  {
    const { data: optOuts } = await supabase
      .from('farmer_broadcast_preferences')
      .select('farmer_id')
      .in('farmer_id', ids)
      .eq('opted_out_all', true);
    const blockedAll = new Set((optOuts ?? []).map((p) => String(p.farmer_id)));
    ids = ids.filter((id) => !blockedAll.has(id));
  }

  return ids;
}

export const broadcastCampaignService = {
  async listCampaigns(opts?: { status?: string; limit?: number }) {
    let q = supabase
      .from('whatsapp_broadcast_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 100);
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load campaigns');
    return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  },

  async getCampaign(id: string) {
    const { data, error } = await supabase
      .from('whatsapp_broadcast_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load campaign');
    if (!data) throw new NotFoundError('Campaign not found');
    return mapRow(data as Record<string, unknown>);
  },

  async createCampaign(input: {
    name: string;
    category: CampaignCategory;
    audienceJson?: BroadcastAudienceFilter;
    messageTitle?: string;
    messageBody?: string;
    languageMode?: string;
    mediaUrls?: string[];
    templateId?: string;
    createdBy?: string;
  }) {
    const { data, error } = await supabase
      .from('whatsapp_broadcast_campaigns')
      .insert({
        name: input.name.trim(),
        category: input.category,
        audience_json: input.audienceJson ?? {},
        message_title: input.messageTitle ?? null,
        message_body: input.messageBody ?? '',
        language_mode: input.languageMode ?? 'auto',
        media_urls: input.mediaUrls ?? [],
        template_id: input.templateId ?? null,
        created_by: input.createdBy ?? null,
        status: 'draft',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create campaign');
    return mapRow(data as Record<string, unknown>);
  },

  async updateCampaign(
    id: string,
    patch: Partial<{
      name: string;
      category: CampaignCategory;
      audienceJson: BroadcastAudienceFilter;
      messageTitle: string;
      messageBody: string;
      languageMode: string;
      mediaUrls: string[];
      status: string;
      scheduledAt: string | null;
      approvedBy: string;
    }>
  ) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name != null) payload.name = patch.name;
    if (patch.category != null) payload.category = patch.category;
    if (patch.audienceJson != null) payload.audience_json = patch.audienceJson;
    if (patch.messageTitle != null) payload.message_title = patch.messageTitle;
    if (patch.messageBody != null) payload.message_body = patch.messageBody;
    if (patch.languageMode != null) payload.language_mode = patch.languageMode;
    if (patch.mediaUrls != null) payload.media_urls = patch.mediaUrls;
    if (patch.status != null) payload.status = patch.status;
    if (patch.scheduledAt !== undefined) payload.scheduled_at = patch.scheduledAt;
    if (patch.approvedBy != null) payload.approved_by = patch.approvedBy;

    const { data, error } = await supabase
      .from('whatsapp_broadcast_campaigns')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update campaign');
    return mapRow(data as Record<string, unknown>);
  },

  async previewAudience(filter: BroadcastAudienceFilter) {
    const ids = await farmerIdsMatchingAudience(filter, 10000);
    const sampleIds = ids.slice(0, 5);
    const samples = await Promise.all(
      sampleIds.map(async (farmerId) => loadFarmerVariableContext(farmerId))
    );
    return { count: ids.length, sample: samples };
  },

  async previewMessage(campaignId: string, farmerId?: string) {
    const campaign = await this.getCampaign(campaignId);
    const ids = await farmerIdsMatchingAudience(campaign.audienceJson, 1);
    const targetId = farmerId ?? ids[0];
    if (!targetId) throw new ValidationError('No farmers match this audience');
    const ctx = await loadFarmerVariableContext(targetId);
    const body = renderBroadcastMessage(campaign.messageBody, ctx);
    const title = campaign.messageTitle
      ? renderBroadcastMessage(campaign.messageTitle, ctx)
      : null;
    return { farmerId: targetId, title, body, context: ctx };
  },

  async scheduleCampaign(id: string, scheduledAt: string) {
    return this.updateCampaign(id, { status: 'scheduled', scheduledAt });
  },

  async submitForApproval(id: string) {
    return this.updateCampaign(id, { status: 'pending_approval' });
  },

  async approveCampaign(id: string, approvedBy: string) {
    return this.updateCampaign(id, { status: 'draft', approvedBy });
  },

  async cancelCampaign(id: string) {
    return this.updateCampaign(id, { status: 'cancelled', scheduledAt: null });
  },

  async sendCampaign(id: string, opts?: { dryRun?: boolean }) {
    const campaign = await this.getCampaign(id);
    if (!campaign.messageBody.trim()) {
      throw new ValidationError('Message body is required');
    }

    const farmerIds = await farmerIdsMatchingAudience(campaign.audienceJson);
    const kind = CATEGORY_TO_KIND[campaign.category as CampaignCategory] ?? 'custom_campaign';
    const cropType = campaign.audienceJson.cropTypes?.[0] ?? 'all';

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    await this.updateCampaign(id, { status: 'sending' });

    for (const farmerId of farmerIds) {
      const ctx = await loadFarmerVariableContext(farmerId);
      const messageBody = renderBroadcastMessage(campaign.messageBody, ctx);
      const fullMessage = campaign.messageTitle
        ? `*${renderBroadcastMessage(campaign.messageTitle, ctx)}*\n\n${messageBody}`
        : messageBody;

      const throttle = await broadcastThrottleService.shouldSend({
        farmerId,
        broadcastKind: kind === 'custom_campaign' ? 'cultivation_knowledge' : kind,
        cropType,
        priority: 75,
      });

      if (!throttle.allowed) {
        skipped++;
        if (!opts?.dryRun) {
          await broadcastThrottleService.logSkipped({
            farmerId,
            broadcastKind: kind === 'custom_campaign' ? 'cultivation_knowledge' : kind,
            cropType,
            messageBody: fullMessage,
            skipReason: throttle.reason,
            priority: 75,
            campaignId: id,
          });
        }
        continue;
      }

      if (opts?.dryRun) {
        sent++;
        continue;
      }

      const { data: farmer } = await supabase
        .from('farmers')
        .select('phone')
        .eq('id', farmerId)
        .maybeSingle();
      if (!farmer?.phone) {
        failed++;
        continue;
      }

      try {
        const sendResult = await whatsappOutboundService.sendToFarmer(
          {
            sendText: (to, text) => whatsappService.sendText(to, text),
            sendTemplate: (to, name, params) => whatsappService.sendTemplate(to, name, params),
          },
          {
            phone: String(farmer.phone),
            farmerId,
            text: fullMessage,
          }
        );
        await broadcastThrottleService.logSent({
          farmerId,
          broadcastKind: kind === 'custom_campaign' ? 'cultivation_knowledge' : kind,
          cropType,
          messageBody: fullMessage,
          priority: 75,
          campaignId: id,
          whatsappMessageId: null,
        });
        sent++;
        void sendResult;
      } catch (e) {
        failed++;
        await broadcastThrottleService.logFailed({
          farmerId,
          broadcastKind: kind === 'custom_campaign' ? 'cultivation_knowledge' : kind,
          cropType,
          messageBody: fullMessage,
          error: e instanceof Error ? e.message : 'send_failed',
          priority: 75,
          campaignId: id,
        });
      }
    }

    const stats = { sent, skipped, failed, audience: farmerIds.length };
    if (!opts?.dryRun) {
      await supabase
        .from('whatsapp_broadcast_campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          stats_json: stats,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }

    return stats;
  },

  async listTemplates(opts?: { status?: string }) {
    let q = supabase
      .from('whatsapp_broadcast_templates')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not load templates');
    return (data ?? []).map((r) => mapTemplateRow(r as Record<string, unknown>));
  },

  async createTemplate(input: {
    name: string;
    category: string;
    cropType?: string;
    targetDap?: number;
    title?: string;
    body: string;
    language?: string;
    mediaUrls?: string[];
    createdBy?: string;
  }) {
    const { data, error } = await supabase
      .from('whatsapp_broadcast_templates')
      .insert({
        name: input.name.trim(),
        category: input.category,
        crop_type: input.cropType ?? null,
        target_dap: input.targetDap ?? null,
        title: input.title ?? null,
        body: input.body,
        language: input.language ?? 'en',
        media_urls: input.mediaUrls ?? [],
        created_by: input.createdBy ?? null,
        status: 'draft',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create template');
    return mapTemplateRow(data as Record<string, unknown>);
  },

  async updateTemplate(
    id: string,
    patch: Partial<{ name: string; body: string; title: string; status: string; approvedBy: string }>
  ) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name != null) payload.name = patch.name;
    if (patch.body != null) payload.body = patch.body;
    if (patch.title != null) payload.title = patch.title;
    if (patch.status != null) payload.status = patch.status;
    if (patch.approvedBy != null) payload.approved_by = patch.approvedBy;
    const { data, error } = await supabase
      .from('whatsapp_broadcast_templates')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update template');
    return mapTemplateRow(data as Record<string, unknown>);
  },

  async cloneTemplateToCampaign(templateId: string, createdBy?: string) {
    const { data: tpl, error } = await supabase
      .from('whatsapp_broadcast_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load template');
    if (!tpl) throw new NotFoundError('Template not found');
    return this.createCampaign({
      name: String(tpl.name),
      category: (tpl.category as CampaignCategory) ?? 'custom_message',
      messageTitle: tpl.title ? String(tpl.title) : undefined,
      messageBody: String(tpl.body),
      mediaUrls: (tpl.media_urls ?? []) as string[],
      templateId,
      createdBy,
    });
  },

  async exportDeliveriesCsv(opts?: { campaignId?: string; limit?: number }) {
    let q = supabase
      .from('whatsapp_broadcast_deliveries')
      .select('*, farmers(phone, name, district)')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 5000);
    if (opts?.campaignId) q = q.eq('campaign_id', opts.campaignId);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not export deliveries');
    const header = 'created_at,farmer_phone,farmer_name,district,kind,status,skip_reason,campaign_id';
    const rows = (data ?? []).map((d) => {
      const f = d.farmers as { phone?: string; name?: string; district?: string } | null;
      return [
        d.created_at,
        f?.phone ?? '',
        f?.name ?? '',
        f?.district ?? '',
        d.broadcast_kind,
        d.status,
        d.skip_reason ?? '',
        d.campaign_id ?? '',
      ]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });
    return [header, ...rows].join('\n');
  },

  async processScheduledCampaigns() {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('whatsapp_broadcast_campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(20);
    throwIfSupabaseError(error, 'Could not load scheduled campaigns');
    const results = [];
    for (const row of data ?? []) {
      results.push(await this.sendCampaign(String(row.id)));
    }
    return results;
  },

  async recordDeliveryStatus(params: {
    whatsappMessageId: string;
    status: 'delivered' | 'read';
  }) {
    const col = params.status === 'read' ? 'read_at' : 'delivered_at';
    const { data, error } = await supabase
      .from('whatsapp_broadcast_deliveries')
      .update({ [col]: new Date().toISOString() })
      .eq('whatsapp_message_id', params.whatsappMessageId)
      .select('id, campaign_id')
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not update delivery status');
    if (data) {
      await supabase.from('whatsapp_broadcast_events').insert({
        delivery_id: data.id,
        campaign_id: data.campaign_id,
        event_type: params.status,
        payload: { whatsappMessageId: params.whatsappMessageId },
      });
    }
    return data;
  },

  async getCampaignAnalytics(opts?: { campaignId?: string; days?: number }) {
    const days = opts?.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let q = supabase
      .from('whatsapp_broadcast_deliveries')
      .select('status, broadcast_kind, campaign_id, delivered_at, read_at, replied_at, created_at')
      .gte('created_at', since);
    if (opts?.campaignId) q = q.eq('campaign_id', opts.campaignId);
    const { data, error } = await q.limit(50000);
    throwIfSupabaseError(error, 'Could not load broadcast analytics');
    const rows = data ?? [];
    const totals = { sent: 0, failed: 0, skipped: 0, delivered: 0, read: 0, replied: 0 };
    const byKind: Record<string, { sent: number; failed: number; skipped: number }> = {};
    for (const row of rows) {
      const status = String(row.status);
      if (status === 'sent') totals.sent++;
      else if (status === 'failed') totals.failed++;
      else if (status === 'skipped') totals.skipped++;
      if (row.delivered_at) totals.delivered++;
      if (row.read_at) totals.read++;
      if (row.replied_at) totals.replied++;
      const kind = String(row.broadcast_kind ?? 'unknown');
      if (!byKind[kind]) byKind[kind] = { sent: 0, failed: 0, skipped: 0 };
      if (status === 'sent') byKind[kind].sent++;
      else if (status === 'failed') byKind[kind].failed++;
      else if (status === 'skipped') byKind[kind].skipped++;
    }
    return {
      totals,
      byKind: Object.entries(byKind).map(([kind, v]) => ({ kind, ...v, total: v.sent + v.failed + v.skipped })),
      periodDays: days,
    };
  },

  async listPendingApprovals() {
    const [campaigns, templates] = await Promise.all([
      this.listCampaigns({ status: 'pending_approval', limit: 50 }),
      this.listTemplates({ status: 'pending_approval' }),
    ]);
    return { campaigns, templates };
  },

  async getFarmerPreferences(farmerId: string) {
    const { data, error } = await supabase
      .from('farmer_broadcast_preferences')
      .select('*')
      .eq('farmer_id', farmerId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load broadcast preferences');
    if (!data) {
      return { farmerId, optedOutAll: false, optedOutCategories: [] as string[] };
    }
    return {
      farmerId,
      optedOutAll: Boolean(data.opted_out_all),
      optedOutCategories: (data.opted_out_categories ?? []) as string[],
    };
  },

  async updateFarmerPreferences(
    farmerId: string,
    patch: { optedOutAll?: boolean; optedOutCategories?: string[] }
  ) {
    const payload = {
      farmer_id: farmerId,
      opted_out_all: patch.optedOutAll ?? false,
      opted_out_categories: patch.optedOutCategories ?? [],
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('farmer_broadcast_preferences')
      .upsert(payload, { onConflict: 'farmer_id' })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update broadcast preferences');
    return {
      farmerId,
      optedOutAll: Boolean(data.opted_out_all),
      optedOutCategories: (data.opted_out_categories ?? []) as string[],
    };
  },
};
