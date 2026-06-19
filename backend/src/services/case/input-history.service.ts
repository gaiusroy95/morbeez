import { supabase } from '../../lib/supabase.js';
import type { MaiosInputHistoryEntry, MaiosInputHistorySummary } from '../../domain/case/types.js';

const HISTORY_DAYS = 21;

function sinceDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - HISTORY_DAYS);
  return d.toISOString().slice(0, 10);
}

function productNames(products: unknown): string[] {
  if (!Array.isArray(products)) return [];
  return products
    .map((p) => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') {
        const row = p as Record<string, unknown>;
        return String(row.name ?? row.product ?? row.title ?? '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function analyzeWarnings(entries: MaiosInputHistoryEntry[]): string[] {
  const warnings: string[] = [];
  const sprays = entries.filter((e) => e.activityType === 'spray_applied');
  const fertigations = entries.filter((e) => e.activityType === 'fertigation');

  if (sprays.length >= 4) {
    warnings.push(`High spray frequency: ${sprays.length} applications in ${HISTORY_DAYS} days`);
  }
  if (fertigations.length >= 5) {
    warnings.push(`High fertigation frequency: ${fertigations.length} events in ${HISTORY_DAYS} days`);
  }

  const qoiPattern = /azox|triflox|difenoconazole|tebuconazole|mancozeb/i;
  const qoiSprays = sprays.filter((s) => s.products.some((p) => qoiPattern.test(p)));
  if (qoiSprays.length >= 2) {
    warnings.push('QoI/triazole class used multiple times in 21d — check rotation resistance risk');
  }

  return [...new Set(warnings)].slice(0, 5);
}

export const inputHistoryService = {
  async load21Day(farmerId: string, blockId?: string | null): Promise<MaiosInputHistorySummary> {
    const since = sinceDate();
    let q = supabase
      .from('cultivation_activities')
      .select('applied_at, activity_type, products, dosage_notes')
      .eq('farmer_id', farmerId)
      .gte('applied_at', since)
      .order('applied_at', { ascending: false })
      .limit(30);

    if (blockId) {
      q = q.eq('farm_block_id', blockId);
    }

    const { data: rows } = await q;

    const entries: MaiosInputHistoryEntry[] = (rows ?? []).map((r) => ({
      appliedAt: String(r.applied_at),
      activityType: String(r.activity_type ?? 'other'),
      products: productNames(r.products),
      dosageNotes: r.dosage_notes ? String(r.dosage_notes) : null,
    }));

    const sprayCount = entries.filter((e) => e.activityType === 'spray_applied').length;
    const fertigationCount = entries.filter((e) => e.activityType === 'fertigation').length;

    return {
      days: HISTORY_DAYS,
      entries,
      sprayCount,
      fertigationCount,
      warnings: analyzeWarnings(entries),
      hasRecentActivity: entries.length > 0,
    };
  },
};
