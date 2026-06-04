import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { supabase } from '../../../lib/supabase.js';
import { whatsappService } from '../whatsapp.service.js';
import { marketInsightDataService } from './market-insight-data.service.js';
import { marketInsightRenderService } from './market-insight-render.service.js';
import { marketInsightStorageService } from './market-insight-storage.service.js';
import type { MarketInsightPayload } from './market-insight.types.js';

export type MarketInsightRunResult = {
  farmersScanned: number;
  built: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

async function upsertSnapshot(params: {
  farmerId: string;
  insightDate: string;
  status: string;
  payload?: MarketInsightPayload;
  imagePath?: string | null;
  failureReason?: string;
}): Promise<void> {
  const row = {
    farmer_id: params.farmerId,
    insight_date: params.insightDate,
    status: params.status,
    payload: params.payload ?? {},
    image_storage_path: params.imagePath ?? null,
    failure_reason: params.failureReason ?? null,
    built_at: params.status === 'ready' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('market_insight_snapshots').upsert(row, {
    onConflict: 'farmer_id,insight_date',
  });
  if (error) logger.warn({ err: error, farmerId: params.farmerId }, 'Market insight snapshot upsert failed');
}

export const marketInsightBroadcastService = {
  async buildSnapshots(options?: {
    farmerId?: string;
    insightDate?: string;
    dryRun?: boolean;
  }): Promise<MarketInsightRunResult> {
    const result: MarketInsightRunResult = {
      farmersScanned: 0,
      built: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const insightDate = options?.insightDate ?? marketInsightDataService.todayInIst();

    let q = supabase.from('farmers').select('id, phone').not('phone', 'is', null);
    if (options?.farmerId) q = q.eq('id', options.farmerId);
    const { data: farmers, error } = await q.limit(options?.farmerId ? 1 : 10_000);
    if (error) {
      result.errors.push(error.message);
      return result;
    }

    for (const farmer of farmers ?? []) {
      result.farmersScanned++;
      const farmerId = String(farmer.id);
      const built = await marketInsightDataService.buildForFarmer(farmerId, insightDate);
      if (!built.ok || !built.payload) {
        result.skipped++;
        if (!options?.dryRun) {
          await upsertSnapshot({
            farmerId,
            insightDate,
            status: 'skipped',
            failureReason: built.error ?? 'build failed',
          });
        }
        if (built.error) result.errors.push(`${farmerId}: ${built.error}`);
        continue;
      }

      if (options?.dryRun) {
        result.built++;
        continue;
      }

      try {
        const png = await marketInsightRenderService.renderPng(built.payload);
        const path = await marketInsightStorageService.uploadPng(farmerId, insightDate, png);
        if (!path) {
          result.failed++;
          await upsertSnapshot({
            farmerId,
            insightDate,
            status: 'failed',
            payload: built.payload,
            failureReason: 'storage upload failed',
          });
          continue;
        }
        await upsertSnapshot({
          farmerId,
          insightDate,
          status: 'ready',
          payload: built.payload,
          imagePath: path,
        });
        result.built++;
      } catch (err) {
        result.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${farmerId}: ${msg}`);
        await upsertSnapshot({
          farmerId,
          insightDate,
          status: 'failed',
          payload: built.payload,
          failureReason: msg,
        });
      }
    }

    return result;
  },

  async sendSnapshots(options?: {
    farmerId?: string;
    insightDate?: string;
    dryRun?: boolean;
  }): Promise<MarketInsightRunResult> {
    const result: MarketInsightRunResult = {
      farmersScanned: 0,
      built: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    if (env.WHATSAPP_PROVIDER !== 'cloud') {
      result.errors.push('Market insight images require WHATSAPP_PROVIDER=cloud');
      return result;
    }

    const insightDate = options?.insightDate ?? marketInsightDataService.todayInIst();

    let q = supabase
      .from('market_insight_snapshots')
      .select('id, farmer_id, image_storage_path, status')
      .eq('insight_date', insightDate)
      .eq('status', 'ready');

    if (options?.farmerId) q = q.eq('farmer_id', options.farmerId);

    const { data: rows, error } = await q.limit(10_000);
    if (error) {
      result.errors.push(error.message);
      return result;
    }

    const farmerIds = [...new Set((rows ?? []).map((r) => String(r.farmer_id)))];
    const phoneByFarmer = new Map<string, string>();
    if (farmerIds.length) {
      const { data: farmers } = await supabase
        .from('farmers')
        .select('id, phone')
        .in('id', farmerIds);
      for (const f of farmers ?? []) {
        if (f.phone) phoneByFarmer.set(String(f.id), String(f.phone).replace(/\D/g, ''));
      }
    }

    for (const row of rows ?? []) {
      result.farmersScanned++;
      const phone = phoneByFarmer.get(String(row.farmer_id)) ?? '';
      const path = row.image_storage_path ? String(row.image_storage_path) : '';
      if (!phone || !path) {
        result.skipped++;
        continue;
      }

      const url = marketInsightStorageService.publicUrl(path);
      if (!url) {
        result.failed++;
        result.errors.push(`${row.farmer_id}: no public image URL`);
        continue;
      }

      if (options?.dryRun) {
        result.sent++;
        continue;
      }

      try {
        await whatsappService.sendImage(phone, url);
        await supabase
          .from('market_insight_snapshots')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        result.sent++;
      } catch (err) {
        result.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${row.farmer_id}: ${msg}`);
        await supabase
          .from('market_insight_snapshots')
          .update({
            status: 'failed',
            failure_reason: msg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
      }
    }

    return result;
  },

  async runDaily(options?: {
    farmerId?: string;
    insightDate?: string;
    dryRun?: boolean;
    phase?: 'build' | 'send' | 'both';
  }): Promise<{ build: MarketInsightRunResult; send: MarketInsightRunResult }> {
    const phase = options?.phase ?? 'both';
    const build =
      phase === 'send'
        ? { farmersScanned: 0, built: 0, sent: 0, skipped: 0, failed: 0, errors: [] }
        : await this.buildSnapshots(options);
    const send =
      phase === 'build'
        ? { farmersScanned: 0, built: 0, sent: 0, skipped: 0, failed: 0, errors: [] }
        : await this.sendSnapshots(options);
    return { build, send };
  },
};
