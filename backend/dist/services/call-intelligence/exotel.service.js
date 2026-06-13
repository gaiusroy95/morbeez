import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { AppError } from '../../lib/errors.js';
import { callIntelligenceService } from './call-intelligence.service.js';
import { logger } from '../../lib/logger.js';
export const exotelService = {
    isConfigured() {
        return Boolean(env.EXOTEL_SID && env.EXOTEL_TOKEN && env.EXOTEL_CALLER_ID);
    },
    async initiateClickToCall(input) {
        if (!this.isConfigured()) {
            throw new AppError('Exotel is not configured. Set EXOTEL_SID, EXOTEL_TOKEN, EXOTEL_CALLER_ID.', 503, 'EXOTEL_NOT_CONFIGURED');
        }
        const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', input.leadId).single();
        if (!lead)
            throw new AppError('Lead not found', 404, 'NOT_FOUND');
        const url = `https://${env.EXOTEL_SUBDOMAIN ?? 'api'}.exotel.com/v1/Accounts/${env.EXOTEL_SID}/Calls/connect.json`;
        const body = new URLSearchParams({
            From: input.farmerPhone.replace(/\D/g, '').slice(-10),
            CallerId: env.EXOTEL_CALLER_ID,
            Url: `${env.API_BASE_URL ?? ''}/webhooks/exotel/status`,
            Record: 'true',
            CustomField: JSON.stringify({ leadId: input.leadId, agentEmail: input.agentEmail }),
        });
        const auth = Buffer.from(`${env.EXOTEL_SID}:${env.EXOTEL_TOKEN}`).toString('base64');
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        });
        const text = await res.text();
        if (!res.ok) {
            logger.error({ status: res.status, text }, 'Exotel click-to-call failed');
            throw new AppError('Exotel call failed', 502, 'EXOTEL_CALL_FAILED', text);
        }
        let providerCallId = null;
        try {
            const parsed = JSON.parse(text);
            providerCallId = parsed.Call?.Sid ?? null;
        }
        catch {
            providerCallId = null;
        }
        const { data: callRow } = await supabase
            .from('crm_call_logs')
            .insert({
            farmer_id: lead.farmer_id,
            lead_id: input.leadId,
            agent_email: input.agentEmail,
            direction: 'outbound',
            outcome: 'connected',
            recording_provider: 'exotel',
            provider_call_id: providerCallId,
            processing_status: 'pending',
            transcript_status: 'pending',
        })
            .select('id')
            .single();
        return {
            callLogId: String(callRow?.id),
            providerCallId,
            status: 'initiated',
        };
    },
    async handleStatusWebhook(payload) {
        const callSid = payload.CallSid ? String(payload.CallSid) : null;
        const recordingUrl = payload.RecordingUrl ? String(payload.RecordingUrl) : null;
        const duration = payload.DialCallDuration ? Number(payload.DialCallDuration) : 0;
        const custom = payload.CustomField ? String(payload.CustomField) : '{}';
        let leadId = null;
        try {
            const meta = JSON.parse(custom);
            leadId = meta.leadId ?? null;
        }
        catch {
            leadId = null;
        }
        if (!callSid)
            return { ok: false };
        const { data: existing } = await supabase
            .from('crm_call_logs')
            .select('id, lead_id')
            .eq('provider_call_id', callSid)
            .maybeSingle();
        if (!existing?.id) {
            logger.warn({ callSid, leadId }, 'Exotel webhook for unknown call — skip insert');
            return { ok: false };
        }
        const callId = String(existing.id);
        await supabase
            .from('crm_call_logs')
            .update({
            recording_url: recordingUrl,
            duration_seconds: duration,
            processing_status: 'processing',
            updated_at: new Date().toISOString(),
        })
            .eq('id', callId);
        if (recordingUrl) {
            void callIntelligenceService.processCall(String(callId)).catch((err) => {
                logger.error({ err, callId }, 'Exotel recording process failed');
            });
        }
        return { ok: true, callId };
    },
};
//# sourceMappingURL=exotel.service.js.map