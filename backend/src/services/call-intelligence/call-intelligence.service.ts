import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { crmFarmerService } from '../admin/crm-farmer.service.js';
import { farmerEventCaptureService } from '../intelligence/farmer-event-capture.service.js';
import { employeeProfileResolveService } from '../intelligence/employee-profile-resolve.service.js';
import { responseLocalizationService } from '../regional-terminology/response-localization.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { callStorageService } from './call-storage.service.js';
import { callIntelligenceProcessor } from './call-intelligence.processor.js';
import { callDiagnosisService } from './call-diagnosis.service.js';
import type { CallOutcome, CallSummaryJson } from '../../domain/call-intelligence/types.js';
import { logger } from '../../lib/logger.js';

async function resolveLead(leadId: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('id, farmer_id, stage, assigned_to')
    .eq('id', leadId)
    .single();
  if (error || !data) throw new NotFoundError('Lead not found');
  return data;
}

async function logCallEvidence(agentEmail: string, durationSeconds: number) {
  try {
    const profileId = await employeeProfileResolveService.resolve({ employeeEmail: agentEmail });
    if (!profileId) return;
    const eventDate = new Date().toISOString().slice(0, 10);
    const minutes = Math.round((durationSeconds / 60) * 100) / 100;
    await supabase.from('activity_evidence_logs').insert({
      employee_profile_id: profileId,
      event_date: eventDate,
      event_type: 'call',
      event_count: 1,
      active_minutes: minutes,
      metadata: { source: 'telecaller_crm' },
    });
  } catch (err) {
    logger.warn({ err, agentEmail }, 'activity_evidence_logs insert failed');
  }
}

function followUpIso(days: number | null | undefined): string | null {
  if (days == null || days <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const callIntelligenceService = {
  async uploadAndProcess(input: {
    leadId: string;
    agentEmail: string;
    audioBase64?: string;
    filename?: string;
    mimeType?: string;
    transcript?: string;
    outcome?: CallOutcome;
    durationSeconds?: number;
    recordingProvider?: 'app_upload' | 'voice_note' | 'exotel';
  }) {
    const lead = await resolveLead(input.leadId);
    const farmerId = String(lead.farmer_id);
    const now = new Date().toISOString();

    let recordingUrl: string | null = null;
    let storagePath: string | null = null;
    if (input.audioBase64) {
      const uploaded = await callStorageService.uploadAudio({
        farmerId,
        leadId: input.leadId,
        filename: input.filename ?? 'recording.m4a',
        mimeType: input.mimeType ?? 'audio/m4a',
        dataBase64: input.audioBase64,
      });
      recordingUrl = uploaded.publicUrl;
      storagePath = uploaded.storagePath;
    }

    const { data: callRow, error: insertErr } = await supabase
      .from('crm_call_logs')
      .insert({
        farmer_id: farmerId,
        lead_id: input.leadId,
        agent_email: input.agentEmail,
        direction: 'outbound',
        outcome: input.outcome ?? 'connected',
        duration_seconds: input.durationSeconds ?? 0,
        recording_url: recordingUrl,
        recording_storage_path: storagePath,
        recording_provider: input.recordingProvider ?? (input.audioBase64 ? 'app_upload' : 'manual'),
        transcript_status: input.transcript ? 'completed' : storagePath ? 'pending' : 'none',
        transcript: input.transcript ?? null,
        processing_status: 'processing',
        updated_at: now,
      })
      .select('*')
      .single();
    throwIfSupabaseError(insertErr, 'Could not create call log');

    void this.processCall(String(callRow.id)).catch((err) => {
      logger.error({ err, callId: callRow.id }, 'Call intelligence processing failed');
    });

    return { call: callRow };
  },

  async processCall(callId: string) {
    const { data: call, error } = await supabase.from('crm_call_logs').select('*').eq('id', callId).single();
    if (error || !call) throw new NotFoundError('Call not found');

    await supabase
      .from('crm_call_logs')
      .update({
        processing_status: 'processing',
        transcript_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId);

    try {
      const { data: farmer } = await supabase
        .from('farmers')
        .select('preferred_language, district')
        .eq('id', call.farmer_id)
        .maybeSingle();

      const language = (farmer?.preferred_language ?? 'en') as AdvisoryLanguage;
      let transcript = call.transcript ? String(call.transcript) : '';

      if (!transcript && call.recording_storage_path) {
        const { buffer, mimeType } = await callStorageService.download(String(call.recording_storage_path));
        transcript = await callIntelligenceProcessor.transcribeAudio(buffer, mimeType, language);
      } else if (!transcript && call.recording_url) {
        const { buffer, mimeType } = await callStorageService.downloadFromUrl(String(call.recording_url));
        transcript = await callIntelligenceProcessor.transcribeAudio(buffer, mimeType, language);
      }

      if (!transcript?.trim()) {
        throw new ValidationError('No transcript available for processing');
      }

      const { summary, summaryText, detection } = await callIntelligenceProcessor.summarizeTranscript({
        farmerId: String(call.farmer_id),
        leadId: String(call.lead_id),
        transcript,
        language,
      });

      const qc = await callIntelligenceProcessor.runQc({
        transcript,
        summaryText,
        agentEmail: String(call.agent_email),
      });

      let suggestedWhatsapp: string | null = null;
      try {
        suggestedWhatsapp = await responseLocalizationService.localize({
          standardResponse: summary.nextAction
            ? `Follow up: ${summary.nextAction}`
            : 'Photo ayakkuka — njan noktittu parayam.',
          detection,
          language,
          district: farmer?.district ? String(farmer.district) : null,
        });
      } catch {
        suggestedWhatsapp = null;
      }

      const followUpAt = followUpIso(summary.followUpDays);

      const interaction = await crmFarmerService.createInteraction(
        String(call.farmer_id),
        call.lead_id ? String(call.lead_id) : null,
        {
          interactionType: 'Phone Call',
          channel: 'call',
          summary: summaryText,
          interactionAt: call.created_at ? String(call.created_at) : new Date().toISOString(),
          outcome: summary.suggestedOutcome ?? String(call.outcome ?? 'connected'),
          nextAction: summary.nextAction ?? undefined,
          nextActionAt: followUpAt ?? undefined,
          workflowStatus: summary.interestLevel === 'high' ? 'Active' : 'Closed',
          doneBy: String(call.agent_email),
          doneByRole: 'telecaller',
        }
      );

      await supabase
        .from('crm_call_logs')
        .update({
          transcript,
          transcript_status: 'completed',
          ai_summary: summaryText,
          ai_summary_json: summary,
          suggested_stage: summary.suggestedStage,
          suggested_follow_up_at: followUpAt,
          suggested_whatsapp_reply: suggestedWhatsapp,
          qc_score: qc.totalScore,
          qc_rubric_json: qc.rubric,
          qc_flagged: qc.flagged,
          qc_flag_reason: qc.flagReason,
          processing_status: 'completed',
          interaction_log_id: interaction.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId);

      await farmerEventCaptureService.trackInteractionSession({
        farmerId: String(call.farmer_id),
        interactionLogId: String(interaction.id),
        interactionType: 'Phone Call',
        workflowStatus: summary.interestLevel === 'high' ? 'Active' : 'Closed',
        escalated: false,
        outcome: summary.suggestedOutcome ?? null,
        nextAction: summary.nextAction ?? null,
        employeeEmail: String(call.agent_email),
      });

      await logCallEvidence(String(call.agent_email), Number(call.duration_seconds ?? 0));

      if (summary.interestedInSoilTest && call.lead_id) {
        await this.applySoilTestAutomation(String(call.lead_id), String(call.farmer_id), summary, String(call.agent_email));
      }

      return { callId, summary, qc, interactionId: interaction.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing failed';
      await supabase
        .from('crm_call_logs')
        .update({
          processing_status: 'failed',
          processing_error: message,
          transcript_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId);
      throw err;
    }
  },

  async confirmCall(callId: string, input: { acceptStage?: boolean; stage?: string; agentEmail: string }) {
    const { data: call } = await supabase.from('crm_call_logs').select('*').eq('id', callId).single();
    if (!call) throw new NotFoundError('Call not found');

    const summary = call.ai_summary_json as CallSummaryJson | null;
    const stage = input.stage ?? summary?.suggestedStage;

    if (input.acceptStage !== false && stage && call.lead_id) {
      await supabase
        .from('leads')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', call.lead_id);
    }

    await supabase
      .from('crm_call_logs')
      .update({ processing_status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', callId);

    return { ok: true };
  },

  async applySoilTestAutomation(
    leadId: string,
    farmerId: string,
    summary: CallSummaryJson,
    agentEmail: string
  ) {
    const { data: lead } = await supabase.from('leads').select('stage').eq('id', leadId).maybeSingle();
    const rank: Record<string, number> = {
      new_lead: 1,
      interested: 2,
      follow_up: 3,
      recommendation: 4,
      order_placed: 5,
      repeat_customer: 6,
    };
    const current = rank[String(lead?.stage ?? 'new_lead')] ?? 1;
    if (current < rank.interested) {
      await supabase
        .from('leads')
        .update({ stage: 'interested', updated_at: new Date().toISOString() })
        .eq('id', leadId);
    }

    const due = followUpIso(summary.followUpDays ?? 3);
    await supabase.from('crm_tasks').insert({
      farmer_id: farmerId,
      lead_id: leadId,
      assigned_to: agentEmail,
      task_type: 'follow_up',
      title: 'Schedule soil sample collection',
      notes: summary.nextAction ?? 'Farmer interested in soil testing — schedule sample collection.',
      due_at: due,
      status: 'pending',
    });
  },

  async getCall(callId: string) {
    const { data, error } = await supabase.from('crm_call_logs').select('*').eq('id', callId).single();
    throwIfSupabaseError(error, 'Load call');
    return data;
  },

  async runDiagnosis(callId: string, input?: { imageBase64?: string; imageMimeType?: string }) {
    const call = await this.getCall(callId);
    const transcript = call.transcript ? String(call.transcript) : '';
    if (!transcript) throw new ValidationError('Transcript required for diagnosis');
    return callDiagnosisService.runFromTranscript({
      farmerId: String(call.farmer_id),
      leadId: String(call.lead_id),
      transcript,
      imageBase64: input?.imageBase64,
      imageMimeType: input?.imageMimeType,
    }).then(async (result) => {
      await supabase
        .from('crm_call_logs')
        .update({
          diagnosis_session_id: result.sessionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId);
      return result;
    });
  },

  async getLeadTimeline(leadId: string) {
    const { data: lead } = await supabase.from('leads').select('farmer_id').eq('id', leadId).single();
    if (!lead) throw new NotFoundError('Lead not found');
    const farmerId = String(lead.farmer_id);

    const [interactions, calls, soil, findings] = await Promise.all([
      supabase
        .from('interaction_logs')
        .select('id, interaction_type, channel, summary, interaction_at, created_at, workflow_status, outcome, is_operational_session')
        .eq('farmer_id', farmerId)
        .eq('is_operational_session', true)
        .order('interaction_at', { ascending: false })
        .limit(50),
      supabase
        .from('crm_call_logs')
        .select('id, outcome, duration_seconds, ai_summary, qc_score, qc_flagged, created_at, processing_status')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('crm_soil_reports')
        .select('id, reported_at, created_at')
        .eq('farmer_id', farmerId)
        .order('reported_at', { ascending: false })
        .limit(10),
      supabase
        .from('crm_field_findings')
        .select('id, issue_description, created_at, status')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    type TimelineItem = {
      id: string;
      type: string;
      title: string;
      detail: string | null;
      at: string;
      meta?: Record<string, unknown>;
    };

    const items: TimelineItem[] = [];

    for (const ix of interactions.data ?? []) {
      items.push({
        id: String(ix.id),
        type: String(ix.interaction_type ?? ix.channel ?? 'interaction'),
        title: String(ix.interaction_type ?? 'Interaction'),
        detail: ix.summary ? String(ix.summary) : null,
        at: String(ix.interaction_at ?? ix.created_at),
        meta: { outcome: ix.outcome, workflowStatus: ix.workflow_status },
      });
    }

    for (const c of calls.data ?? []) {
      if (items.some((i) => i.meta?.callId === c.id)) continue;
      items.push({
        id: `call-${c.id}`,
        type: 'call',
        title: 'Phone call',
        detail: c.ai_summary ? String(c.ai_summary) : null,
        at: String(c.created_at),
        meta: {
          callId: c.id,
          qcScore: c.qc_score,
          qcFlagged: c.qc_flagged,
          durationSeconds: c.duration_seconds,
        },
      });
    }

    for (const s of soil.data ?? []) {
      items.push({
        id: `soil-${s.id}`,
        type: 'soil_test',
        title: 'Soil test',
        detail: null,
        at: String(s.reported_at ?? s.created_at),
      });
    }

    for (const f of findings.data ?? []) {
      items.push({
        id: `finding-${f.id}`,
        type: 'field_finding',
        title: 'Field finding',
        detail: f.issue_description ? String(f.issue_description) : null,
        at: String(f.created_at),
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return { items };
  },
};
