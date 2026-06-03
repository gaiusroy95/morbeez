import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { NotFoundError } from '../../lib/errors.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { resolveAdvisoryImageUrl } from './advisory-image-storage.service.js';
import { blockService } from './block.service.js';
import { weatherSnapshotService } from './weather-snapshot.service.js';
import { aiTrainingEventService } from './ai-training-event.service.js';
import type { ImageReviewStatus } from '../../domain/ai-training/enums.js';
import type { ReviewSeverity } from '../../domain/ai-training/enums.js';

export type CropImageReviewAction = 'confirm_ai' | 'correct_ai' | 'skip' | 'exclude';

export type EnqueueCropImageInput = {
  farmerId: string;
  blockId?: string | null;
  aiSessionId?: string | null;
  fieldFindingId?: string | null;
  interactionLogId?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  source?: 'whatsapp' | 'field_visit' | 'crm' | 'api';
  crop?: string | null;
  dap?: number | null;
  symptoms?: string[];
  gpsRegion?: string | null;
  aiPrediction?: string | null;
  aiConfidence?: number | null;
  metadata?: Record<string, unknown>;
};

function mapRow(r: Record<string, unknown>) {
  return {
    id: String(r.id),
    farmerId: String(r.farmer_id),
    blockId: r.block_id ? String(r.block_id) : null,
    aiSessionId: r.ai_session_id ? String(r.ai_session_id) : null,
    fieldFindingId: r.field_finding_id ? String(r.field_finding_id) : null,
    storagePath: r.storage_path ? String(r.storage_path) : null,
    externalUrl: r.external_url ? String(r.external_url) : null,
    source: String(r.source ?? 'whatsapp'),
    crop: r.crop ? String(r.crop) : null,
    dap: r.dap != null ? Number(r.dap) : null,
    symptoms: (r.symptoms as string[]) ?? [],
    gpsRegion: r.gps_region ? String(r.gps_region) : null,
    aiPrediction: r.ai_prediction ? String(r.ai_prediction) : null,
    aiConfidence: r.ai_confidence != null ? Number(r.ai_confidence) : null,
    agronomistLabel: r.agronomist_label ? String(r.agronomist_label) : null,
    severity: r.severity ? (String(r.severity) as ReviewSeverity) : null,
    reviewStatus: String(r.review_status ?? 'pending') as ImageReviewStatus,
    reviewAction: r.review_action ? String(r.review_action) : null,
    reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
    reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
    reviewNotes: r.review_notes ? String(r.review_notes) : null,
    createdAt: String(r.created_at),
    imageUrl: null as string | null,
    farmer: null as { name: string | null; phone: string | null; district: string | null } | null,
    block: null as { name: string; cropType: string } | null,
  };
}

async function resolveImageUrl(row: {
  storagePath: string | null;
  externalUrl: string | null;
}): Promise<string | null> {
  if (row.externalUrl?.startsWith('http')) return row.externalUrl;
  if (row.storagePath) return resolveAdvisoryImageUrl(row.storagePath);
  return null;
}

async function resolveBlockContext(farmerId: string, blockId?: string | null) {
  if (blockId) {
    const block = await blockService.getById(blockId);
    if (block) {
      return {
        blockId: block.id,
        crop: block.crop_type ?? block.crop_name,
        dap: blockService.computeDap(block),
        gpsRegion: block.plot_label ?? block.name ?? null,
      };
    }
  }
  const primary = await blockService.getPrimaryBlock(farmerId);
  if (!primary) return { blockId: null, crop: null, dap: null, gpsRegion: null };
  return {
    blockId: primary.id,
    crop: primary.crop_type ?? primary.crop_name,
    dap: blockService.computeDap(primary),
    gpsRegion: primary.plot_label ?? primary.name ?? null,
  };
}

export const cropImageReviewService = {
  async enqueue(input: EnqueueCropImageInput): Promise<string | null> {
    if (!input.storagePath?.trim() && !input.externalUrl?.trim()) return null;

    if (input.storagePath?.trim()) {
      const { data: existing } = await supabase
        .from('crop_images')
        .select('id')
        .eq('storage_path', input.storagePath.trim())
        .maybeSingle();
      if (existing?.id) return String(existing.id);
    }

    const blockCtx = await resolveBlockContext(input.farmerId, input.blockId);
    let weatherSnapshotId: string | null = null;

    try {
      const captured = await weatherSnapshotService.capture({
        farmerId: input.farmerId,
        blockId: input.blockId ?? blockCtx.blockId,
        eventType: input.source === 'field_visit' ? 'field_finding' : 'ai_session',
        eventId: input.aiSessionId ?? input.fieldFindingId ?? null,
      });
      weatherSnapshotId = captured?.snapshotId ?? null;
    } catch {
      /* weather is best-effort */
    }

    const { data, error } = await supabase
      .from('crop_images')
      .insert({
        farmer_id: input.farmerId,
        block_id: input.blockId ?? blockCtx.blockId,
        ai_session_id: input.aiSessionId ?? null,
        field_finding_id: input.fieldFindingId ?? null,
        interaction_log_id: input.interactionLogId ?? null,
        storage_path: input.storagePath?.trim() ?? null,
        external_url: input.externalUrl?.trim() ?? null,
        source: input.source ?? 'whatsapp',
        crop: input.crop ?? blockCtx.crop,
        dap: input.dap ?? blockCtx.dap,
        symptoms: input.symptoms ?? [],
        gps_region: input.gpsRegion ?? blockCtx.gpsRegion,
        weather_snapshot_id: weatherSnapshotId,
        ai_prediction: input.aiPrediction ?? null,
        ai_confidence: input.aiConfidence ?? null,
        metadata: input.metadata ?? {},
      })
      .select('id')
      .single();

    if (error) {
      logger.warn({ err: error.message, farmerId: input.farmerId }, 'crop_images enqueue failed');
      return null;
    }

    return String(data.id);
  },

  async enqueueFromSession(params: {
    sessionId: string;
    farmerId: string;
    storagePath: string;
    cropType: string;
    blockId?: string | null;
    symptoms?: string[];
    aiPrediction?: string | null;
    aiConfidence?: number | null;
  }): Promise<string | null> {
    return this.enqueue({
      farmerId: params.farmerId,
      blockId: params.blockId,
      aiSessionId: params.sessionId,
      storagePath: params.storagePath,
      source: 'whatsapp',
      crop: params.cropType,
      symptoms: params.symptoms ?? [],
      aiPrediction: params.aiPrediction,
      aiConfidence: params.aiConfidence,
    });
  },

  async syncPendingFromExisting(limit = 80): Promise<number> {
    let inserted = 0;

    const { data: sessions } = await supabase
      .from('ai_advisory_sessions')
      .select('id, farmer_id, crop_type, image_storage_path, symptoms_text, confidence_score, metadata')
      .not('image_storage_path', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    for (const s of sessions ?? []) {
      const path = s.image_storage_path ? String(s.image_storage_path) : '';
      if (!path) continue;
      const { data: exists } = await supabase
        .from('crop_images')
        .select('id')
        .eq('storage_path', path)
        .maybeSingle();
      if (exists?.id) continue;

      const meta = (s.metadata as Record<string, unknown>) ?? {};
      const blockId = meta.activePlotId ? String(meta.activePlotId) : null;
      const id = await this.enqueueFromSession({
        sessionId: String(s.id),
        farmerId: String(s.farmer_id),
        storagePath: path,
        cropType: String(s.crop_type ?? 'unknown'),
        blockId,
        symptoms: s.symptoms_text ? [String(s.symptoms_text).slice(0, 200)] : [],
        aiPrediction: null,
        aiConfidence: s.confidence_score != null ? Number(s.confidence_score) : null,
      });
      if (id) inserted += 1;
    }

    const { data: findings } = await supabase
      .from('crm_field_findings')
      .select('id, farmer_id, block_id, crop_type, photo_urls, observations, ai_prediction')
      .is('archived_at', null)
      .not('photo_urls', 'eq', '[]')
      .order('visited_at', { ascending: false })
      .limit(Math.max(20, Math.floor(limit / 2)));

    for (const f of findings ?? []) {
      const photos = (f.photo_urls as string[]) ?? [];
      for (const url of photos) {
        if (!url?.trim()) continue;
        const { data: exists } = await supabase
          .from('crop_images')
          .select('id')
          .eq('external_url', url.trim())
          .maybeSingle();
        if (exists?.id) continue;

        const id = await this.enqueue({
          farmerId: String(f.farmer_id),
          blockId: f.block_id ? String(f.block_id) : null,
          fieldFindingId: String(f.id),
          externalUrl: url.trim(),
          source: 'field_visit',
          crop: f.crop_type ? String(f.crop_type) : null,
          symptoms: f.observations ? [String(f.observations).slice(0, 200)] : [],
          aiPrediction: f.ai_prediction ? String(f.ai_prediction) : null,
        });
        if (id) inserted += 1;
      }
    }

    return inserted;
  },

  async listQueue(params: {
    status?: ImageReviewStatus | 'all';
    crop?: string;
    page?: number;
    limit?: number;
    sync?: boolean;
  }) {
    if (params.sync !== false) {
      await this.syncPendingFromExisting().catch(() => {});
    }

    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 24));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const status = params.status ?? 'pending';

    let query = supabase
      .from('crop_images')
      .select(
        '*, farmers(name, phone, district), farm_blocks(name, crop_type, plot_label)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status !== 'all') query = query.eq('review_status', status);
    if (params.crop?.trim()) query = query.ilike('crop', `%${params.crop.trim()}%`);

    const { data, error, count } = await query;
    throwIfSupabaseError(error, 'Could not load image review queue');

    const items = await Promise.all(
      (data ?? []).map(async (row) => {
        const mapped = mapRow(row as Record<string, unknown>);
        const farmer = row.farmers as Record<string, unknown> | null;
        const block = row.farm_blocks as Record<string, unknown> | null;
        mapped.imageUrl = await resolveImageUrl(mapped);
        mapped.farmer = farmer
          ? {
              name: farmer.name ? String(farmer.name) : null,
              phone: farmer.phone ? String(farmer.phone) : null,
              district: farmer.district ? String(farmer.district) : null,
            }
          : null;
        mapped.block = block
          ? {
              name: String(block.name ?? 'Block'),
              cropType: String(block.crop_type ?? mapped.crop ?? '—'),
            }
          : null;
        return mapped;
      })
    );

    const { count: pendingCount } = await supabase
      .from('crop_images')
      .select('id', { count: 'exact', head: true })
      .eq('review_status', 'pending');

    return {
      items,
      pagination: {
        page,
        limit,
        total: count ?? 0,
        pages: Math.max(1, Math.ceil((count ?? 0) / limit)),
      },
      pendingCount: pendingCount ?? 0,
    };
  },

  async getDetail(id: string) {
    const { data, error } = await supabase
      .from('crop_images')
      .select('*, farmers(name, phone, district), farm_blocks(name, crop_type, plot_label, planting_date)')
      .eq('id', id)
      .maybeSingle();

    throwIfSupabaseError(error, 'Could not load crop image');
    if (!data) throw new NotFoundError('Crop image not found');

    const mapped = mapRow(data as Record<string, unknown>);
    mapped.imageUrl = await resolveImageUrl(mapped);

    const farmer = data.farmers as Record<string, unknown> | null;
    const block = data.farm_blocks as Record<string, unknown> | null;
    mapped.farmer = farmer
      ? {
          name: farmer.name ? String(farmer.name) : null,
          phone: farmer.phone ? String(farmer.phone) : null,
          district: farmer.district ? String(farmer.district) : null,
        }
      : null;
    mapped.block = block
      ? {
          name: String(block.name ?? 'Block'),
          cropType: String(block.crop_type ?? mapped.crop ?? '—'),
        }
      : null;

    let weather: Record<string, unknown> | null = null;
    if (data.weather_snapshot_id) {
      const snap = await weatherSnapshotService.getById(String(data.weather_snapshot_id));
      if (snap) {
        weather = {
          rainfallMm: snap.rainfallMm,
          humidityPct: snap.humidityPct,
          temperatureC: snap.temperatureC,
          locationLabel: snap.locationLabel,
        };
      }
    }

    return { image: mapped, weather };
  },

  async submitReview(
    id: string,
    body: {
      action: CropImageReviewAction;
      agronomistLabel?: string;
      severity?: ReviewSeverity;
      reviewNotes?: string;
    },
    agentEmail: string
  ) {
    const { image: existing } = await this.getDetail(id);
    if (existing.reviewStatus !== 'pending' && existing.reviewStatus !== 'skipped') {
      throw new NotFoundError('Image is not awaiting review');
    }

    const reviewStatus: ImageReviewStatus =
      body.action === 'skip' ? 'skipped' : body.action === 'exclude' ? 'excluded' : 'reviewed';

    const agronomistLabel =
      body.action === 'confirm_ai'
        ? existing.aiPrediction ?? body.agronomistLabel ?? null
        : body.agronomistLabel?.trim() ?? null;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('crop_images')
      .update({
        review_status: reviewStatus,
        review_action: body.action,
        agronomist_label: agronomistLabel,
        severity: body.severity ?? null,
        review_notes: body.reviewNotes?.trim() ?? null,
        reviewed_by: agentEmail,
        reviewed_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not save image review');

    if (reviewStatus === 'reviewed' && agronomistLabel) {
      const humanAction =
        body.action === 'confirm_ai'
          ? 'confirm_ai'
          : body.action === 'correct_ai'
            ? 'correct_ai'
            : body.action;

      void aiTrainingEventService.record({
        farmerId: existing.farmerId,
        blockId: existing.blockId,
        aiSessionId: existing.aiSessionId,
        fieldFindingId: existing.fieldFindingId,
        source: existing.source as 'whatsapp' | 'field_visit' | 'crm' | 'api',
        reviewSurface: 'image_review',
        aiPrediction: existing.aiPrediction,
        aiConfidence: existing.aiConfidence,
        humanAction,
        humanFinalLabel: agronomistLabel,
        correctionReason: body.reviewNotes ?? null,
        confidenceBefore: existing.aiConfidence,
        reviewedBy: agentEmail,
        metadata: { cropImageId: id, severity: body.severity ?? null },
      });
    }

    const mapped = mapRow(data as Record<string, unknown>);
    mapped.imageUrl = await resolveImageUrl(mapped);
    return mapped;
  },
};
