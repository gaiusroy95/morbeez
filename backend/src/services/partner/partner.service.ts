import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { generatePartnerCode, generateQrToken } from '../../lib/partner-jwt.js';
import { env } from '../../config/env.js';
import { normalizePhone, isValidIndianPhone } from '../../lib/phone.js';
import type { PartnerStatus, PartnerTier } from './partner.types.js';

export type PartnerRow = Record<string, unknown>;

function referralUrl(slug: string | null, partnerCode: string): string {
  const base = env.API_BASE_URL ?? env.CONSOLE_PUBLIC_URL ?? 'https://morbeez.in';
  const path = slug ? `/enroll/${slug}` : `/enroll?code=${encodeURIComponent(partnerCode)}`;
  return `${base.replace(/\/$/, '')}${path}`;
}

export const partnerService = {
  mapRow(row: PartnerRow) {
    const slug = row.referral_slug ? String(row.referral_slug) : null;
    const partnerCode = String(row.partner_code);
    return {
      id: String(row.id),
      partnerCode,
      fullName: String(row.full_name),
      phone: String(row.phone),
      email: row.email ? String(row.email) : null,
      status: row.status as PartnerStatus,
      tier: row.tier as PartnerTier,
      state: row.state ? String(row.state) : null,
      district: row.district ? String(row.district) : null,
      taluk: row.taluk ? String(row.taluk) : null,
      village: row.village ? String(row.village) : null,
      languages: (row.languages as string[]) ?? [],
      cropsExpertise: (row.crops_expertise as string[]) ?? [],
      referralSlug: slug,
      qrToken: row.qr_token ? String(row.qr_token) : null,
      maxActiveFarmers: Number(row.max_active_farmers ?? 50),
      currentActiveFarmers: Number(row.current_active_farmers ?? 0),
      reliabilityScore: Number(row.reliability_score ?? 70),
      performanceScore: Number(row.performance_score ?? 50),
      leadAllocationWeight: Number(row.lead_allocation_weight ?? 1),
      commissionEligible: Boolean(row.commission_eligible ?? true),
      referralUrl: referralUrl(slug, partnerCode),
    };
  },

  async getById(id: string) {
    const { data, error } = await supabase.from('partners').select('*').eq('id', id).maybeSingle();
    throwIfSupabaseError(error, 'Could not load partner');
    if (!data) return null;
    return this.mapRow(data);
  },

  async getByPhone(phone: string) {
    const normalized = normalizePhone(phone);
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('phone', normalized)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load partner');
    if (!data) return null;
    return this.mapRow(data);
  },

  async getByCode(partnerCode: string) {
    const code = partnerCode.trim().toUpperCase();
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('partner_code', code)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load partner');
    if (!data) return null;
    return this.mapRow(data);
  },

  async getByQrToken(qrToken: string) {
    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('qr_token', qrToken)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load partner');
    if (!data) return null;
    return this.mapRow(data);
  },

  async list(filters?: { status?: PartnerStatus; tier?: PartnerTier; limit?: number }) {
    let q = supabase.from('partners').select('*').order('created_at', { ascending: false });
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.tier) q = q.eq('tier', filters.tier);
    q = q.limit(filters?.limit ?? 100);
    const { data, error } = await q;
    throwIfSupabaseError(error, 'Could not list partners');
    return (data ?? []).map((r) => this.mapRow(r));
  },

  async createFromApplication(input: {
    fullName: string;
    phone: string;
    email?: string | null;
    state?: string | null;
    district?: string | null;
    taluk?: string | null;
    village?: string | null;
    languages?: string[];
    cropsExpertise?: string[];
    changedBy?: string;
  }) {
    if (!isValidIndianPhone(input.phone)) {
      throw new ValidationError('Valid phone required');
    }
    const phone = normalizePhone(input.phone);
    const existing = await this.getByPhone(phone);
    if (existing) throw new ConflictError('Partner with this phone already exists');

    const partnerCode = generatePartnerCode(input.fullName);
    const qrToken = generateQrToken(partnerCode);
    const referralSlug = partnerCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { data, error } = await supabase
      .from('partners')
      .insert({
        partner_code: partnerCode,
        full_name: input.fullName.trim(),
        phone,
        email: input.email?.trim() || null,
        state: input.state ?? null,
        district: input.district ?? null,
        taluk: input.taluk ?? null,
        village: input.village ?? null,
        languages: input.languages ?? [],
        crops_expertise: input.cropsExpertise ?? [],
        referral_slug: referralSlug,
        qr_token: qrToken,
        status: 'verified',
      })
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not create partner');

    await supabase.from('partner_status_history').insert({
      partner_id: data.id,
      from_status: null,
      to_status: 'verified',
      reason: 'created_from_application',
      changed_by: input.changedBy ?? 'admin',
    });

    return this.mapRow(data);
  },

  async updateStatus(
    partnerId: string,
    toStatus: PartnerStatus,
    reason: string,
    changedBy?: string
  ) {
    const { data: current, error: curErr } = await supabase
      .from('partners')
      .select('status')
      .eq('id', partnerId)
      .single();
    throwIfSupabaseError(curErr, 'Could not load partner');
    if (!current) throw new NotFoundError('Partner not found');

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: toStatus,
      updated_at: now,
    };
    if (toStatus === 'certified') patch.certified_at = now;
    if (toStatus === 'active') patch.activated_at = now;

    const { data, error } = await supabase
      .from('partners')
      .update(patch)
      .eq('id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update partner status');

    await supabase.from('partner_status_history').insert({
      partner_id: partnerId,
      from_status: current.status,
      to_status: toStatus,
      reason,
      changed_by: changedBy ?? 'admin',
    });

    return this.mapRow(data);
  },

  async updateTier(partnerId: string, tier: PartnerTier, changedBy?: string) {
    const { data, error } = await supabase
      .from('partners')
      .update({ tier, updated_at: new Date().toISOString() })
      .eq('id', partnerId)
      .select('*')
      .single();
    throwIfSupabaseError(error, 'Could not update partner tier');
    await supabase.from('partner_status_history').insert({
      partner_id: partnerId,
      from_status: data.status,
      to_status: data.status,
      reason: `tier_changed_to_${tier}`,
      changed_by: changedBy ?? 'admin',
    });
    return this.mapRow(data);
  },

  async incrementActiveFarmers(partnerId: string, delta = 1) {
    const { data, error } = await supabase.rpc('increment_partner_active_farmers', {
      p_partner_id: partnerId,
      p_delta: delta,
    });
    if (error) {
      const { data: row } = await supabase
        .from('partners')
        .select('current_active_farmers')
        .eq('id', partnerId)
        .single();
      const next = Math.max(0, Number(row?.current_active_farmers ?? 0) + delta);
      await supabase
        .from('partners')
        .update({ current_active_farmers: next, updated_at: new Date().toISOString() })
        .eq('id', partnerId);
      return next;
    }
    return Number(data ?? 0);
  },
};
