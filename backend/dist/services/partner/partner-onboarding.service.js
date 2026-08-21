import { createHash, randomBytes } from 'node:crypto';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { isValidIndianPhone, normalizePhone } from '../../lib/phone.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { partnerService } from './partner.service.js';
function hashToken(token) {
    return createHash('sha256').update(`partner-activate:${token}`).digest('hex');
}
function displayPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91'))
        return digits.slice(2);
    return digits;
}
function partnerAppHint() {
    const base = (env.CONSOLE_PUBLIC_URL ?? env.API_BASE_URL ?? 'https://morbeez.in').replace(/\/$/, '');
    return `${base}/partners`;
}
export const partnerOnboardingService = {
    async submitApplication(input) {
        const { data, error } = await supabase
            .from('partner_applications')
            .insert({
            full_name: input.fullName.trim(),
            phone: input.phone.trim(),
            email: input.email?.trim() || null,
            state: input.state ?? null,
            district: input.district ?? null,
            village: input.village ?? null,
            languages: input.languages ?? [],
            experience_notes: input.experienceNotes ?? null,
            metadata: input.metadata ?? {},
            status: 'pending',
        })
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not submit application');
        return data;
    },
    /**
     * Admin "Create Partner": creates a real partners row (active), marks an
     * application as approved for audit, and sends an activation WhatsApp.
     */
    async createPartnerByAdmin(input, adminEmail) {
        if (!isValidIndianPhone(input.phone)) {
            throw new ValidationError('Enter a valid 10-digit Indian mobile number');
        }
        const phone = normalizePhone(input.phone);
        const existing = await partnerService.getByPhone(phone);
        if (existing)
            throw new ConflictError('Partner with this phone already exists');
        const partner = await partnerService.createFromApplication({
            fullName: input.fullName,
            phone,
            email: input.email ?? null,
            state: input.state ?? null,
            district: input.district ?? null,
            village: input.village ?? null,
            languages: input.languages ?? [],
            changedBy: adminEmail,
            status: 'active',
            metadata: {
                ...(input.metadata ?? {}),
                createdByAdmin: adminEmail,
                experienceNotes: input.experienceNotes ?? null,
            },
        });
        const { data: application, error: appErr } = await supabase
            .from('partner_applications')
            .insert({
            full_name: input.fullName.trim(),
            phone,
            email: input.email?.trim() || null,
            state: input.state ?? null,
            district: input.district ?? null,
            village: input.village ?? null,
            languages: input.languages ?? [],
            experience_notes: input.experienceNotes ?? null,
            metadata: input.metadata ?? {},
            status: 'approved',
            partner_id: partner.id,
            reviewed_by: adminEmail,
            reviewed_at: new Date().toISOString(),
        })
            .select('*')
            .single();
        throwIfSupabaseError(appErr, 'Could not record partner application');
        let activation = null;
        if (input.createAppAccount !== false && input.sendActivation !== false) {
            activation = await this.sendActivationInvite(partner.id);
        }
        return { partner, application, activation };
    },
    async sendActivationInvite(partnerId) {
        const partner = await partnerService.getById(partnerId);
        if (!partner)
            throw new NotFoundError('Partner not found');
        const token = randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const mobile = displayPhone(partner.phone);
        const activationMessage = `Welcome to Morbeez Partner Program, ${partner.fullName}!\n\n` +
            `Your partner account (${partner.partnerCode}) is active.\n` +
            `Open the Morbeez Partner app and sign in with mobile ${mobile} using OTP.\n\n` +
            `If you set a password later, you can also use password login.\n` +
            `Ref: ${partnerAppHint()}`;
        const { data: row } = await supabase
            .from('partners')
            .select('metadata')
            .eq('id', partnerId)
            .maybeSingle();
        const metadata = row?.metadata ?? {};
        await supabase
            .from('partners')
            .update({
            metadata: {
                ...metadata,
                activationTokenHash: hashToken(token),
                activationExpiresAt: expiresAt,
                activationInvitedAt: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
        })
            .eq('id', partnerId);
        let sent = false;
        let deliveryError = null;
        try {
            await whatsappService.sendText(partner.phone, activationMessage);
            sent = true;
        }
        catch (err) {
            deliveryError = err instanceof Error ? err.message : 'WhatsApp send failed';
            logger.warn({ err, partnerId, phone: partner.phone }, 'Partner activation WhatsApp failed — returning message for admin');
        }
        // Dev / non-production: also log so QA can copy the invite text
        if (!sent || env.NODE_ENV !== 'production') {
            logger.info({ partnerId, phone: partner.phone, activationMessage, sent }, 'Partner activation invite created');
        }
        return {
            sent,
            channel: sent ? 'whatsapp' : 'manual',
            expiresAt,
            message: activationMessage,
            deliveryError,
            phone: partner.phone,
        };
    },
    async listApplications(status) {
        let q = supabase
            .from('partner_applications')
            .select('*')
            .order('created_at', { ascending: false });
        if (status)
            q = q.eq('status', status);
        const { data, error } = await q.limit(200);
        throwIfSupabaseError(error, 'Could not list applications');
        return data ?? [];
    },
    async approveApplication(applicationId, adminEmail) {
        const { data: app, error } = await supabase
            .from('partner_applications')
            .select('*')
            .eq('id', applicationId)
            .single();
        throwIfSupabaseError(error, 'Could not load application');
        if (!app)
            throw new NotFoundError('Application not found');
        if (String(app.status) === 'approved' && app.partner_id) {
            const existing = await partnerService.getById(String(app.partner_id));
            if (existing)
                return { partner: existing, activation: null };
        }
        const partner = await partnerService.createFromApplication({
            fullName: String(app.full_name),
            phone: String(app.phone),
            email: app.email ? String(app.email) : null,
            state: app.state ? String(app.state) : null,
            district: app.district ? String(app.district) : null,
            village: app.village ? String(app.village) : null,
            languages: app.languages ?? [],
            changedBy: adminEmail,
            status: 'active',
            metadata: app.metadata ?? {},
        });
        await supabase
            .from('partner_applications')
            .update({
            status: 'approved',
            partner_id: partner.id,
            reviewed_by: adminEmail,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', applicationId);
        const activation = await this.sendActivationInvite(partner.id);
        return { partner, activation };
    },
    async rejectApplication(applicationId, adminEmail, notes) {
        const { data, error } = await supabase
            .from('partner_applications')
            .update({
            status: 'rejected',
            reviewed_by: adminEmail,
            reviewed_at: new Date().toISOString(),
            review_notes: notes ?? null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', applicationId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not reject application');
        return data;
    },
    async advanceStage(applicationId, stage, adminEmail, notes) {
        const { data, error } = await supabase
            .from('partner_applications')
            .update({
            onboarding_stage: stage,
            review_notes: notes ?? null,
            reviewed_by: adminEmail,
            updated_at: new Date().toISOString(),
        })
            .eq('id', applicationId)
            .select('*')
            .single();
        throwIfSupabaseError(error, 'Could not advance onboarding stage');
        if (!data)
            throw new NotFoundError('Application not found');
        return data;
    },
};
//# sourceMappingURL=partner-onboarding.service.js.map