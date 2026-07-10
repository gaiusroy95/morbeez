import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';

export type PincodeRow = {
  id: string;
  pincode: string;
  village: string | null;
  taluk: string;
  district: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
};

export type AssignPincodeResult = {
  row: PincodeRow;
  /** master = cache hit; india_post = live India Post; provisional = accepted while geo unavailable */
  source: 'master' | 'india_post' | 'provisional';
};

function normalizePincode(input: string): string | null {
  const digits = String(input ?? '')
    .normalize('NFKC')
    .replace(/\D/g, '')
    .slice(0, 6);
  // Indian PINs are exactly 6 digits; first digit is 1–9.
  if (digits.length !== 6 || digits[0] === '0') return null;
  return digits;
}

function mapRow(r: Record<string, unknown>): PincodeRow {
  return {
    id: String(r.id),
    pincode: String(r.pincode).replace(/\D/g, '').slice(0, 6),
    village: r.village ? String(r.village) : null,
    taluk: String(r.taluk),
    district: String(r.district),
    state: String(r.state),
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
  };
}

/** Last-resort label when India Post is unreachable — not a PIN allowlist. */
function provisionalRow(pincode: string): Omit<PincodeRow, 'id'> {
  return {
    pincode,
    village: null,
    taluk: 'Pending verification',
    district: `PIN ${pincode}`,
    state: 'India',
    latitude: null,
    longitude: null,
  };
}

type IndiaPostOffice = {
  Name?: string;
  District?: string;
  State?: string;
  Block?: string;
  Division?: string;
  Region?: string;
};

async function fetchIndiaPostPincode(pincode: string): Promise<Omit<PincodeRow, 'id'> | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      Status?: string;
      Message?: string;
      PostOffice?: IndiaPostOffice[] | null;
    }>;
    const first = data?.[0];
    if (first?.Status !== 'Success' || !first.PostOffice?.length) return null;

    // Prefer an office that has both district and state filled.
    const po =
      first.PostOffice.find((o) => String(o.District ?? '').trim() && String(o.State ?? '').trim()) ??
      first.PostOffice[0]!;

    const district = String(po.District ?? '').trim();
    const state = String(po.State ?? '').trim();
    if (!district || !state) return null;

    return {
      pincode,
      village: po.Name ? String(po.Name).trim() : null,
      taluk: String(po.Block || po.Division || po.Region || 'Unknown').trim() || 'Unknown',
      district,
      state,
      latitude: null,
      longitude: null,
    };
  } catch (err) {
    logger.warn({ err, pincode }, 'India Post pincode lookup failed');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const pincodeService = {
  async lookupByPincode(pincode: string): Promise<PincodeRow | null> {
    const normalized = normalizePincode(pincode);
    if (!normalized) return null;

    const { data, error } = await supabase
      .from('pincode_master')
      .select('*')
      .eq('pincode', normalized)
      .eq('active', true)
      .maybeSingle();

    throwIfSupabaseError(error, 'Pincode lookup failed');
    return data ? mapRow(data) : null;
  },

  async search(params: { district?: string; q?: string; limit?: number }): Promise<PincodeRow[]> {
    let q = supabase.from('pincode_master').select('*').eq('active', true).order('district').order('pincode');

    if (params.district) q = q.ilike('district', params.district.trim());
    if (params.q?.trim()) {
      const term = params.q.trim();
      q = q.or(`pincode.ilike.${term}%,village.ilike.%${term}%,taluk.ilike.%${term}%`);
    }

    const { data, error } = await q.limit(params.limit ?? 50);
    throwIfSupabaseError(error, 'Pincode search failed');
    return (data ?? []).map(mapRow);
  },

  async upsertMaster(row: Omit<PincodeRow, 'id'>): Promise<PincodeRow> {
    const { data, error } = await supabase
      .from('pincode_master')
      .upsert(
        {
          pincode: row.pincode,
          village: row.village,
          taluk: row.taluk,
          district: row.district,
          state: row.state,
          latitude: row.latitude,
          longitude: row.longitude,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'pincode' }
      )
      .select('*')
      .single();

    throwIfSupabaseError(error, 'Could not upsert pincode');
    return mapRow(data as Record<string, unknown>);
  },

  /**
   * Resolve any valid Indian 6-digit PIN dynamically.
   * Cache → India Post (authoritative) → provisional accept if API is down.
   * No hardcoded PIN allowlist.
   */
  async resolvePincode(pincode: string): Promise<AssignPincodeResult | null> {
    const normalized = normalizePincode(pincode);
    if (!normalized) return null;

    const existing = await this.lookupByPincode(normalized);
    // Prefer live India Post when cache row is only a provisional placeholder.
    const isProvisionalCache =
      existing &&
      (existing.taluk === 'Pending verification' ||
        existing.district === `PIN ${normalized}` ||
        existing.state === 'India');

    if (existing && !isProvisionalCache) {
      return { row: existing, source: 'master' };
    }

    const remote = await fetchIndiaPostPincode(normalized);
    if (remote) {
      const row = await this.upsertMaster(remote);
      logger.info({ pincode: normalized, district: row.district }, 'Pincode resolved via India Post');
      return { row, source: 'india_post' };
    }

    // API down / timeout: still accept so onboarding is never blocked by master seed gaps.
    if (existing) return { row: existing, source: 'provisional' };
    const row = await this.upsertMaster(provisionalRow(normalized));
    logger.info({ pincode: normalized }, 'Pincode accepted provisionally (India Post unavailable)');
    return { row, source: 'provisional' };
  },

  async assignFarmerPincodeDetailed(
    farmerId: string,
    pincode: string
  ): Promise<AssignPincodeResult | null> {
    const resolved = await this.resolvePincode(pincode);
    if (!resolved) return null;

    const { row } = resolved;
    const { error } = await supabase
      .from('farmers')
      .update({
        pincode_id: row.id,
        delivery_pincode: row.pincode,
        district: row.district,
        state: row.state,
        village: row.village,
        updated_at: new Date().toISOString(),
      })
      .eq('id', farmerId);

    throwIfSupabaseError(error, 'Could not assign farmer pincode');
    return resolved;
  },

  async assignFarmerPincode(farmerId: string, pincode: string): Promise<PincodeRow | null> {
    const result = await this.assignFarmerPincodeDetailed(farmerId, pincode);
    return result?.row ?? null;
  },
};
