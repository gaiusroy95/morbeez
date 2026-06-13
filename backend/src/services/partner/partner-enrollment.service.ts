import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { partnerService } from './partner.service.js';
import { farmerOwnershipService } from './farmer-ownership.service.js';
import { partnerAttributionCaptureService } from './partner-attribution-capture.service.js';
import { leadService } from '../crm/lead.service.js';
import { farmerEventCaptureService } from '../intelligence/farmer-event-capture.service.js';
import { logger } from '../../lib/logger.js';
import { ValidationError } from '../../lib/errors.js';
import { normalizePhone, isValidIndianPhone } from '../../lib/phone.js';

export const partnerEnrollmentService = {
  async resolvePartnerFromCode(partnerCode?: string | null, qrToken?: string | null) {
    if (qrToken) {
      const byQr = await partnerService.getByQrToken(qrToken);
      if (byQr && ['active', 'certified', 'training'].includes(byQr.status)) return byQr;
    }
    if (partnerCode?.trim()) {
      const byCode = await partnerService.getByCode(partnerCode);
      if (byCode && ['active', 'certified', 'training'].includes(byCode.status)) return byCode;
    }
    return null;
  },

  async enrollFarmerWithPartner(input: {
    farmerId: string;
    phone: string;
    name?: string;
    partnerCode?: string | null;
    qrToken?: string | null;
    enrollmentSource?: string;
  }) {
    const partner = await this.resolvePartnerFromCode(input.partnerCode, input.qrToken);
    if (!partner) return { enrolled: false as const, partner: null };

    if (partner.currentActiveFarmers >= partner.maxActiveFarmers) {
      throw new ValidationError('Partner has reached farmer capacity');
    }

    await farmerOwnershipService.setEnrollmentOwnership({
      farmerId: input.farmerId,
      enrollmentOwnerType: 'partner',
      enrollmentOwnerPartnerId: partner.id,
      enrollmentSource: input.enrollmentSource ?? 'partner_qr',
      partnerCodeAtEnrollment: partner.partnerCode,
      serviceModel: 'partner_assisted',
      customerOwnerType: 'partner',
      customerOwnerPartnerId: partner.id,
      assignedPartnerId: partner.id,
    });

    await partnerAttributionCaptureService.trackEnrollment(
      input.farmerId,
      partner.id,
      input.enrollmentSource ?? 'partner_qr'
    );

    await partnerService.incrementActiveFarmers(partner.id, 1);

    try {
      await leadService.upsertSignupLead({
        farmerId: input.farmerId,
        phone: input.phone,
        name: input.name,
        channel: 'mobile',
        campaignSource: `partner:${partner.partnerCode}`,
      });
      await supabase
        .from('leads')
        .update({
          affiliate_source: partner.partnerCode,
          lead_channel: 'field',
          updated_at: new Date().toISOString(),
        })
        .eq('farmer_id', input.farmerId);
    } catch (err) {
      logger.error({ err, farmerId: input.farmerId }, 'Partner enrollment lead upsert failed');
    }

    void farmerEventCaptureService.trackFarmerOnboarded({
      farmerId: input.farmerId,
      source: 'partner',
      intent: 'general',
      assignedTo: null,
    });

    return { enrolled: true as const, partner };
  },

  async enrollByPhone(input: {
    phone: string;
    name?: string;
    partnerCode?: string | null;
    qrToken?: string | null;
  }) {
    if (!isValidIndianPhone(input.phone)) {
      throw new ValidationError('Valid phone required');
    }
    const phone = normalizePhone(input.phone);

    const { data: existing } = await supabase
      .from('farmers')
      .select('id, name, enrollment_owner_type')
      .eq('phone', phone)
      .maybeSingle();

    if (existing?.enrollment_owner_type) {
      return {
        farmerId: String(existing.id),
        alreadyEnrolled: true,
        partner: null,
      };
    }

    let farmerId = existing?.id ? String(existing.id) : null;
    if (!farmerId) {
      const { data: created, error } = await supabase
        .from('farmers')
        .insert({
          phone,
          name: input.name?.trim() || `Farmer ${phone.slice(-4)}`,
          preferred_language: 'en',
          source: 'partner_enrollment',
          metadata: { signup_channel: 'partner_qr' },
        })
        .select('id')
        .single();
      throwIfSupabaseError(error, 'Could not create farmer');
      if (!created?.id) throw new ValidationError('Could not create farmer');
      farmerId = String(created.id);
    }

    const result = await this.enrollFarmerWithPartner({
      farmerId,
      phone,
      name: input.name ?? existing?.name ?? undefined,
      partnerCode: input.partnerCode,
      qrToken: input.qrToken,
      enrollmentSource: input.qrToken ? 'partner_qr' : 'partner_referral',
    });

    return {
      farmerId,
      alreadyEnrolled: false,
      ...result,
    };
  },

  async listPartnerFarmers(partnerId: string, limit = 50) {
    const { data, error } = await supabase
      .from('farmers')
      .select('id, name, phone, village, district, service_model, created_at')
      .or(
        `enrollment_owner_partner_id.eq.${partnerId},assigned_partner_id.eq.${partnerId},customer_owner_partner_id.eq.${partnerId}`
      )
      .order('created_at', { ascending: false })
      .limit(limit);
    throwIfSupabaseError(error, 'Could not list partner farmers');
    return data ?? [];
  },
};
