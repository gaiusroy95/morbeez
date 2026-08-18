import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ValidationError } from '../../lib/errors.js';
import { resolvePoolSplit, validatePoolSplit } from '../../domain/remuneration/pool-split.js';
import {
  addCalendarDays,
  currentAndPrevious,
  derivePoolStatus,
  indiaToday,
  isNoOpPoolChange,
  resolveVersionOnDate,
  snapshotFromVersion,
  validatePoolPct,
  versionLabel,
  type ChannelPoolSnapshot,
  type ChannelPoolStatus,
  type ChannelPoolVersionRow,
} from './channel-pool.util.js';

type DbRow = Record<string, unknown>;

function mapRow(row: DbRow): ChannelPoolVersionRow {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    variantId: String(row.variant_id),
    sku: row.sku ? String(row.sku) : null,
    versionNumber: Number(row.version_number) || 1,
    poolPct: Number(row.pool_pct) || 0,
    agronomistMaxPct: row.agronomist_max_pct == null ? null : Number(row.agronomist_max_pct),
    partnerMaxPct: row.partner_max_pct == null ? null : Number(row.partner_max_pct),
    previousPoolPct: row.previous_pool_pct == null ? null : Number(row.previous_pool_pct),
    effectiveFrom: String(row.effective_from).slice(0, 10),
    effectiveTo: row.effective_to ? String(row.effective_to).slice(0, 10) : null,
    status: (row.status as ChannelPoolStatus) || 'active',
    changeReason: String(row.change_reason ?? ''),
    editedByAdminId: row.edited_by_admin_id ? String(row.edited_by_admin_id) : null,
    editedByName: row.edited_by_name ? String(row.edited_by_name) : null,
    editedAt: String(row.edited_at),
  };
}

function withDerivedStatus(row: ChannelPoolVersionRow, asOf: string): ChannelPoolVersionRow {
  return { ...row, status: derivePoolStatus(row, asOf) };
}

async function loadVariantVersions(variantId: string): Promise<ChannelPoolVersionRow[]> {
  const { data, error } = await supabase
    .from('product_channel_pool_versions')
    .select('*')
    .eq('variant_id', variantId)
    .order('version_number', { ascending: false });
  throwIfSupabaseError(error, 'Load channel pool history');
  return (data ?? []).map((r) => mapRow(r as DbRow));
}

async function actorName(adminId: string, fallbackEmail?: string): Promise<string> {
  const { data: profile } = await supabase
    .from('employee_profiles')
    .select('full_name')
    .eq('admin_user_id', adminId)
    .maybeSingle();
  const name = profile?.full_name ? String(profile.full_name).trim() : '';
  if (name) return name;
  const { data: admin } = await supabase
    .from('admin_users')
    .select('full_name, email')
    .eq('id', adminId)
    .maybeSingle();
  return (
    (admin?.full_name ? String(admin.full_name).trim() : '') ||
    fallbackEmail ||
    admin?.email ||
    'Admin'
  );
}

export type ChannelPoolVariantView = {
  variantId: string;
  sku: string | null;
  current: ChannelPoolVersionRow | null;
  previous: ChannelPoolVersionRow | null;
  history: ChannelPoolVersionRow[];
};

export const channelPoolService = {
  async listForProduct(productId: string): Promise<ChannelPoolVariantView[]> {
    const asOf = indiaToday();
    const { data, error } = await supabase
      .from('product_channel_pool_versions')
      .select('*')
      .eq('product_id', productId)
      .order('variant_id', { ascending: true })
      .order('version_number', { ascending: false });
    throwIfSupabaseError(error, 'Load product channel pool');

    const byVariant = new Map<string, ChannelPoolVersionRow[]>();
    for (const raw of data ?? []) {
      const row = withDerivedStatus(mapRow(raw as DbRow), asOf);
      const list = byVariant.get(row.variantId) ?? [];
      list.push(row);
      byVariant.set(row.variantId, list);
    }

    return [...byVariant.entries()].map(([variantId, history]) => {
      const { current, previous } = currentAndPrevious(history, asOf);
      return {
        variantId,
        sku: current?.sku ?? history[0]?.sku ?? null,
        current,
        previous,
        history,
      };
    });
  },

  async resolve(input: {
    variantId?: string | number | null;
    sku?: string | null;
    asOf?: string | Date | null;
  }): Promise<ChannelPoolVersionRow | null> {
    const asOf =
      typeof input.asOf === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input.asOf)
        ? input.asOf.slice(0, 10)
        : input.asOf instanceof Date
          ? indiaToday(input.asOf)
          : indiaToday();

    const variantId = input.variantId != null && String(input.variantId).trim()
      ? String(input.variantId).trim()
      : '';
    const sku = input.sku?.trim() || '';
    if (!variantId && !sku) return null;

    const rows: DbRow[] = [];
    if (variantId) {
      const { data, error } = await supabase
        .from('product_channel_pool_versions')
        .select('*')
        .eq('variant_id', variantId);
      throwIfSupabaseError(error, 'Resolve channel pool');
      rows.push(...((data ?? []) as DbRow[]));
    }
    if (sku && !rows.length) {
      const { data, error } = await supabase
        .from('product_channel_pool_versions')
        .select('*')
        .eq('sku', sku);
      throwIfSupabaseError(error, 'Resolve channel pool by SKU');
      rows.push(...((data ?? []) as DbRow[]));
    }
    const versions = rows.map((r) => mapRow(r));
    const hit = resolveVersionOnDate(versions, asOf);
    return hit ? withDerivedStatus(hit, asOf) : null;
  },

  async snapshotForLine(input: {
    variantId?: string | number | null;
    sku?: string | null;
    asOf?: string | Date | null;
    salesInr?: number;
    existing?: Partial<ChannelPoolSnapshot> | null;
  }): Promise<ChannelPoolSnapshot> {
    if (input.existing?.channelPoolVersionId && input.existing.channelPoolPct != null) {
      const stub: ChannelPoolVersionRow = {
        id: String(input.existing.channelPoolVersionId),
        productId: '',
        variantId: String(input.variantId ?? ''),
        sku: input.sku ?? null,
        versionNumber: 0,
        poolPct: Number(input.existing.channelPoolPct),
        agronomistMaxPct:
          input.existing.channelPoolAgronomistPct == null
            ? null
            : Number(input.existing.channelPoolAgronomistPct),
        partnerMaxPct:
          input.existing.channelPoolPartnerPct == null
            ? null
            : Number(input.existing.channelPoolPartnerPct),
        previousPoolPct: null,
        effectiveFrom: input.existing.channelPoolEffectiveFrom ?? indiaToday(),
        effectiveTo: null,
        status: 'active',
        changeReason: '',
        editedByAdminId: null,
        editedByName: null,
        editedAt: '',
      };
      const snap = snapshotFromVersion(stub, input.salesInr);
      return {
        ...snap,
        channelPoolVersionLabel: input.existing.channelPoolVersionLabel ?? snap.channelPoolVersionLabel,
        channelPoolAmount: input.existing.channelPoolAmount ?? snap.channelPoolAmount,
        channelPoolAgronomistAmount:
          input.existing.channelPoolAgronomistAmount ?? snap.channelPoolAgronomistAmount,
        channelPoolPartnerAmount:
          input.existing.channelPoolPartnerAmount ?? snap.channelPoolPartnerAmount,
      };
    }
    const version = await this.resolve({
      variantId: input.variantId,
      sku: input.sku,
      asOf: input.asOf,
    });
    return snapshotFromVersion(version, input.salesInr);
  },

  async createVersion(input: {
    productId: string;
    variantId: string;
    sku?: string | null;
    poolPct: unknown;
    agronomistMaxPct?: unknown;
    partnerMaxPct?: unknown;
    effectiveFrom: string;
    reason: string;
    adminId: string;
    adminEmail?: string;
  }): Promise<ChannelPoolVersionRow> {
    const productId = input.productId.trim();
    const variantId = input.variantId.trim();
    if (!productId || !variantId) {
      throw new ValidationError('Product and SKU variant are required');
    }

    let poolPct: number;
    try {
      poolPct = validatePoolPct(input.poolPct);
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid Channel Pool');
    }

    const optionalPct = (raw: unknown): number | null => {
      if (raw == null || raw === '') return null;
      try {
        return validatePoolPct(raw);
      } catch (err) {
        throw new ValidationError(err instanceof Error ? err.message : 'Invalid pool split %');
      }
    };
    const agronomistMaxPct = optionalPct(input.agronomistMaxPct);
    const partnerMaxPct = optionalPct(input.partnerMaxPct);
    try {
      validatePoolSplit(resolvePoolSplit({ poolPct, agronomistMaxPct, partnerMaxPct }));
    } catch (err) {
      throw new ValidationError(err instanceof Error ? err.message : 'Invalid Channel Pool split');
    }

    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new ValidationError('Reason for change is required');
    }

    const today = indiaToday();
    const effectiveFrom = String(input.effectiveFrom ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      throw new ValidationError('Effective From must be a valid date');
    }
    if (effectiveFrom < today) {
      throw new ValidationError(
        'Effective From cannot be in the past. Historical orders keep their snapshotted pool.'
      );
    }

    const existing = await loadVariantVersions(variantId);
    const { current } = currentAndPrevious(existing, today);
    if (isNoOpPoolChange(current, poolPct, effectiveFrom, agronomistMaxPct, partnerMaxPct)) {
      throw new ValidationError('Channel Pool is unchanged — no new version created');
    }

    const nextNumber = existing.length ? Math.max(...existing.map((v) => v.versionNumber)) + 1 : 1;
    const editedByName = await actorName(input.adminId, input.adminEmail);
    const initialStatus: ChannelPoolStatus = effectiveFrom > today ? 'pending' : 'active';

    for (const row of existing) {
      if (row.effectiveTo && row.effectiveTo < effectiveFrom) continue;
      const superseded = row.effectiveFrom >= effectiveFrom;
      const nextTo = superseded ? row.effectiveFrom : addCalendarDays(effectiveFrom, -1);
      const nextStatus = superseded
        ? 'closed'
        : derivePoolStatus({ effectiveFrom: row.effectiveFrom, effectiveTo: nextTo }, today);
      const { error: closeErr } = await supabase
        .from('product_channel_pool_versions')
        .update({
          effective_to: nextTo,
          status: nextStatus,
        })
        .eq('id', row.id);
      throwIfSupabaseError(closeErr, 'Close previous channel pool version');
    }

    const { data, error } = await supabase
      .from('product_channel_pool_versions')
      .insert({
        product_id: productId,
        variant_id: variantId,
        sku: input.sku?.trim() || null,
        version_number: nextNumber,
        pool_pct: poolPct,
        agronomist_max_pct: agronomistMaxPct,
        partner_max_pct: partnerMaxPct,
        previous_pool_pct: current?.poolPct ?? null,
        effective_from: effectiveFrom,
        effective_to: null,
        status: initialStatus,
        change_reason: reason.slice(0, 500),
        edited_by_admin_id: input.adminId,
        edited_by_name: editedByName,
        edited_at: new Date().toISOString(),
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Create channel pool version');
    return withDerivedStatus(mapRow(data as DbRow), today);
  },
};

export { versionLabel };
