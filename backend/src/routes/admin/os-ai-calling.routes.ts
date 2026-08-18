import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { assertModuleAccess } from '../../lib/rbac.js';
import { logAdminMutation } from '../../lib/admin-mutation-audit.js';
import { aiCallingOrchestrator } from '../../services/ai-calling/ai-calling-orchestrator.service.js';
import { CALL_LANGUAGES, CALL_TYPES } from '../../domain/ai-calling/types.js';
import { callingTelephonyProvider } from '../../services/ai-calling/providers/telephony.provider.js';

const api = '/morbeez-staff/api/v1';

export async function osAiCallingRoutes(app: FastifyInstance): Promise<void> {
  app.get(`${api}/ai-calling/console`, async (request, reply) => {
    await assertModuleAccess(request, 'ai_calling', 'read');
    const data = await aiCallingOrchestrator.listConsole();
    return reply.send({ ok: true, ...data });
  });

  app.post(`${api}/ai-calling/jobs`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'ai_calling', 'write');
    const body = z
      .object({
        farmerId: z.string().uuid(),
        callType: z.enum(CALL_TYPES),
        leadId: z.string().uuid().optional(),
        payload: z.record(z.unknown()).optional(),
      })
      .parse(request.body);
    const job = await aiCallingOrchestrator.enqueue({
      farmerId: body.farmerId,
      callType: body.callType,
      leadId: body.leadId,
      payload: { staffInitiated: true, ...(body.payload ?? {}) },
    });
    await logAdminMutation({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'create',
      resource: 'ai_calling',
      resourceId: job?.id,
      details: { callType: body.callType, farmerId: body.farmerId },
    });
    return reply.code(201).send({ ok: true, job });
  });

  app.post(`${api}/ai-calling/jobs/process-due`, async (request, reply) => {
    await assertModuleAccess(request, 'ai_calling', 'write');
    const processed = await aiCallingOrchestrator.processDueJobs(25);
    return reply.send({ ok: true, processed });
  });

  app.post(`${api}/ai-calling/sessions/:id/simulate-reply`, async (request, reply) => {
    await assertModuleAccess(request, 'ai_calling', 'write');
    const { id } = request.params as { id: string };
    const body = z.object({ text: z.string().min(1).max(4000) }).parse(request.body);
    const result = await aiCallingOrchestrator.applyFarmerReply({
      sessionId: id,
      text: body.text,
      source: 'staff_simulate',
    });
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/ai-calling/farmers/:farmerId/consent`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'ai_calling', 'write');
    const { farmerId } = request.params as { farmerId: string };
    const body = z
      .object({
        consentOutboundCall: z.boolean().optional(),
        consentWhatsapp: z.boolean().optional(),
        dnd: z.boolean().optional(),
        language: z.enum(CALL_LANGUAGES).optional(),
      })
      .parse(request.body);
    await aiCallingOrchestrator.setConsent(farmerId, body);
    await logAdminMutation({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'update',
      resource: 'ai_calling_consent',
      resourceId: farmerId,
      details: body,
    });
    return reply.send({ ok: true });
  });

  app.post(`${api}/ai-calling/farmers/:farmerId/opt-out`, async (request, reply) => {
    await assertModuleAccess(request, 'ai_calling', 'write');
    const { farmerId } = request.params as { farmerId: string };
    const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body);
    await aiCallingOrchestrator.optOut(farmerId, body.reason ?? 'staff_opt_out');
    return reply.send({ ok: true });
  });

  app.put(`${api}/ai-calling/identities/:slot`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'ai_calling', 'write');
    const slot = Number((request.params as { slot: string }).slot);
    const body = z
      .object({
        agronomistEmail: z.string().email().optional().nullable(),
        displayName: z.string().min(3).max(80).optional(),
        didNumber: z.string().max(20).optional().nullable(),
        backupIdentityId: z.string().uuid().optional().nullable(),
        isActive: z.boolean().optional(),
        notes: z.string().max(500).optional().nullable(),
      })
      .parse(request.body);
    const identity = await aiCallingOrchestrator.upsertIdentity({
      slotNumber: slot,
      agronomistEmail: body.agronomistEmail,
      displayName: body.displayName,
      didNumber: body.didNumber,
      backupIdentityId: body.backupIdentityId,
      isActive: body.isActive,
      notes: body.notes,
    });
    await logAdminMutation({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'update',
      resource: 'ai_calling_identity',
      resourceId: identity ? String((identity as { id?: string }).id) : String(slot),
      details: { slot, ...body },
    });
    return reply.send({ ok: true, identity });
  });

  app.post(`${api}/ai-calling/jobs/:id/click-to-call`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'ai_calling', 'write');
    const { id } = request.params as { id: string };
    const { supabase } = await import('../../lib/supabase.js');
    const { data: job } = await supabase
      .from('ai_call_jobs')
      .select('id, farmer_id, lead_id')
      .eq('id', id)
      .maybeSingle();
    if (!job) return reply.code(404).send({ ok: false, error: 'Job not found' });
    const { data: farmer } = await supabase
      .from('farmers')
      .select('phone')
      .eq('id', job.farmer_id)
      .maybeSingle();
    if (!farmer?.phone) return reply.code(400).send({ ok: false, error: 'Farmer phone missing' });
    let leadId = job.lead_id ? String(job.lead_id) : '';
    if (!leadId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('farmer_id', job.farmer_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      leadId = lead?.id ? String(lead.id) : '';
    }
    if (!leadId) {
      return reply.code(400).send({ ok: false, error: 'No CRM lead to attach this click-to-call' });
    }
    const result = await callingTelephonyProvider.clickToCall({
      leadId,
      farmerPhone: String(farmer.phone),
      agentEmail: admin.email,
    });
    return reply.send({ ok: true, ...result });
  });
}
