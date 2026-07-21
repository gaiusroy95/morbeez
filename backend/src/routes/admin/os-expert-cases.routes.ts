import type { FastifyInstance } from 'fastify';
import type { VisitAssistantRecommendationValidationRequest } from '@morbeez/shared/visit-assistant';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { assertModuleAccess } from '../../lib/rbac.js';
import { supabase } from '../../lib/supabase.js';
import { expertCaseBackfillService } from '../../services/expert-case/expert-case-backfill.service.js';
import { expertCaseChatService } from '../../services/expert-case/expert-case-chat.service.js';
import { expertCaseCommitService } from '../../services/expert-case/expert-case-commit.service.js';
import { loadExpertCaseBriefing } from '../../services/expert-case/expert-case-copilot-simulation.service.js';
import { buildExpertCaseNavigation } from '../../services/expert-case/expert-case-navigation.service.js';
import { expertCaseLifecycleService } from '../../services/expert-case/expert-case-lifecycle.service.js';
import { expertCaseOwnershipService } from '../../services/expert-case/expert-case-ownership.service.js';
import { expertCaseQueueService } from '../../services/expert-case/expert-case-queue.service.js';
import { governanceAuditService } from '../../services/governance/governance-audit.service.js';
import { learningGovernanceService } from '../../services/learning/learning-governance.service.js';
import { expertCapabilityService } from '../../services/governance/expert-capability.service.js';
import { recommendationSafetyGateService } from '../../services/safety/recommendation-safety-gate.service.js';

const uuidParam = z.object({ id: z.string().uuid() });

const draftSchema = z
  .object({
    diagnosis: z.string().max(500).nullish(),
    confidence: z.number().min(0).max(100).nullish(),
    severity: z.string().max(100).nullish(),
    secondaryDiagnosis: z.string().max(500).nullish(),
    secondaryConfidence: z.number().min(0).max(100).nullish(),
    recommendationText: z.string().max(10_000).nullish(),
    dosage: z.string().max(1000).nullish(),
    dosageSource: z.enum(['label', 'manual', 'pending']).nullish(),
    applicationMethod: z.string().max(200).nullish(),
    applicationTiming: z.string().max(200).nullish(),
    treatmentProduct: z.string().max(500).nullish(),
    evidence: z.array(z.string().max(300)).max(30).optional(),
    rootCauses: z.array(z.string().max(300)).max(20).optional(),
    nutritionProduct: z.string().max(300).nullish(),
    nutritionDose: z.string().max(200).nullish(),
    nutritionTiming: z.string().max(200).nullish(),
    culturalPractices: z.array(z.string().max(300)).max(20).optional(),
    precautions: z.array(z.string().max(300)).max(20).optional(),
    farmerTasks: z.array(z.string().max(300)).max(20).optional(),
    followUpDays: z.number().int().min(0).max(365).nullish(),
    recoveryStatus: z.string().max(100).nullish(),
    knowledgeCandidate: z.boolean().optional(),
    knowledgeCandidateReason: z.string().max(2000).nullish(),
    notes: z.string().max(10_000).nullish(),
    unresolvedFields: z.array(z.string().max(100)).max(50).optional(),
    farmerQuestions: z.array(z.string().max(500)).max(20).optional(),
    farmerQuestionsSent: z.boolean().optional(),
    farmerAnswers: z.record(z.string(), z.string().max(500)).nullish(),
    imageAnalysis: z
      .object({
        findings: z.array(z.string().max(300)).max(20).optional(),
        annotated: z.boolean().optional(),
        offerAnnotate: z.boolean().optional(),
      })
      .nullish(),
    validations: z.record(z.string(), z.unknown()).nullish(),
  })
  .passthrough();

export async function osExpertCasesRoutes(app: FastifyInstance): Promise<void> {
  const api = '/morbeez-staff/api/v1/os/expert-cases';

  app.get(`${api}/queue`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'read');
    if (!expertCaseQueueService.enabled()) {
      return reply.send({
        ok: true,
        enabled: false,
        buckets: { my_work: [], available: [], at_risk: [], intervention: [] },
      });
    }
    const buckets = await expertCaseQueueService.listBuckets(admin.email);
    const capacity = await expertCaseOwnershipService.ensureCapacity(admin.email);
    return reply.send({ ok: true, enabled: true, buckets, capacity });
  });

  app.patch(`${api}/capacity`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const body = z
      .object({
        availability: z.enum(['accepting', 'paused', 'draining', 'offline']),
        reason: z.string().max(500).optional(),
        pausedUntil: z.string().datetime().nullish(),
      })
      .parse(request.body);
    await expertCaseOwnershipService.setAvailability({
      email: admin.email,
      availability: body.availability,
      reason: body.reason,
      pausedUntil: body.pausedUntil,
    });
    return reply.send({ ok: true });
  });

  app.post(`${api}/backfill`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'write');
    const body = z.object({ limit: z.number().int().min(1).max(1000).default(200) }).parse(
      request.body ?? {}
    );
    const result = await expertCaseBackfillService.backfillOpenEscalations(body.limit);
    return reply.send({ ok: true, result });
  });

  app.post(`${api}/reconcile`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'write');
    const body = z.object({ limit: z.number().int().min(1).max(2000).default(500) }).parse(
      request.body ?? {}
    );
    const result = await expertCaseBackfillService.reconcileLinkedEscalations(body.limit);
    return reply.send({ ok: true, result });
  });

  app.get(`${api}/governance/audit/verify`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'settings', 'read');
    await expertCapabilityService.assert(admin.email, 'audit.verify');
    const query = z.object({ limit: z.coerce.number().int().min(1).max(5000).default(500) }).parse(
      request.query
    );
    const verification = await governanceAuditService.verifyChain(query.limit);
    return reply.send({ ok: true, verification });
  });

  app.post(`${api}/governance/candidates/:id/review`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'approve_recommendations', 'write');
    await expertCapabilityService.assert(admin.email, 'candidate.review');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        verdict: z.enum(['approve', 'reject', 'needs_evidence']),
        notes: z.string().max(5000).optional(),
        reasonCodes: z.array(z.string().max(100)).max(30).optional(),
      })
      .parse(request.body);
    const result = await learningGovernanceService.reviewCandidate({
      candidateId: id,
      reviewerEmail: admin.email,
      ...body,
    });
    return reply.send({ ok: true, result });
  });

  app.get(`${api}/:id`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'read');
    const { id } = uuidParam.parse(request.params);
    const expertCase = await expertCaseLifecycleService.getById(id);
    if (!expertCase) return reply.status(404).send({ ok: false, error: 'Expert case not found' });

    const [revisions, links, turns, draft, safety] = await Promise.all([
      supabase
        .from('expert_case_revisions')
        .select('*')
        .eq('case_id', id)
        .order('revision', { ascending: true }),
      supabase.from('expert_case_links').select('*').eq('case_id', id),
      expertCaseChatService.listTurns(id),
      expertCaseChatService.getPendingDraft(id),
      supabase
        .from('safety_gate_decisions')
        .select('*')
        .eq('case_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const briefing = await loadExpertCaseBriefing({
      expertCase: expertCase as unknown as Record<string, unknown>,
      links: links.data ?? [],
    });

    let caseNavigation = null;
    try {
      if (expertCaseQueueService.enabled()) {
        caseNavigation = await buildExpertCaseNavigation({
          ownerEmail: admin.email,
          caseId: id,
        });
      }
    } catch {
      /* optional */
    }

    return reply.send({
      ok: true,
      enabled: env.ENABLE_EXPERT_CASES,
      expertCase,
      revisions: revisions.data ?? [],
      links: links.data ?? [],
      turns,
      draft,
      safety: safety.data ?? null,
      briefing,
      nextCaseId: caseNavigation?.nextCaseId ?? null,
      previousCaseId: caseNavigation?.previousCaseId ?? null,
      caseNavigation,
    });
  });

  app.post(`${api}/:id/claim`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {});
    const ownership = await expertCaseOwnershipService.claim({
      caseId: id,
      ownerEmail: admin.email,
      reason: body.reason,
    });
    return reply.send({ ok: true, ownership });
  });

  app.post(`${api}/:id/heartbeat`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z.object({ leaseToken: z.string().uuid() }).parse(request.body);
    const lease = await expertCaseOwnershipService.renewLease({
      caseId: id,
      ownerEmail: admin.email,
      leaseToken: body.leaseToken,
    });
    return reply.send({ ok: true, lease });
  });

  app.post(`${api}/:id/release`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        leaseToken: z.string().uuid().optional(),
        reason: z.string().max(500).optional(),
        interruption: z.boolean().default(false),
      })
      .parse(request.body ?? {});
    await expertCaseOwnershipService.release({
      caseId: id,
      ownerEmail: admin.email,
      leaseToken: body.leaseToken,
      reason: body.reason,
      countInterruption: body.interruption,
    });
    return reply.send({ ok: true });
  });

  app.get(`${api}/:id/chat`, async (request, reply) => {
    await assertModuleAccess(request, 'agronomist', 'read');
    const { id } = uuidParam.parse(request.params);
    const [turns, draft] = await Promise.all([
      expertCaseChatService.listTurns(id),
      expertCaseChatService.getPendingDraft(id),
    ]);
    return reply.send({ ok: true, enabled: expertCaseChatService.enabled(), turns, draft });
  });

  app.post(`${api}/:id/chat`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        content: z.string().min(1).max(10_000),
        leaseToken: z.string().uuid().nullish(),
        uiLocale: z.enum(['en', 'hi', 'ml', 'ta', 'kn']).nullish(),
      })
      .parse(request.body);
    const result = await expertCaseChatService.postMessage({
      caseId: id,
      ownerEmail: admin.email,
      leaseToken: body.leaseToken,
      content: body.content,
      uiLocale: body.uiLocale,
    });
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/:id/draft/approve`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        leaseToken: z.string().uuid().nullish(),
        expectedBaseRevision: z.number().int().min(0),
        draftPatch: draftSchema.optional(),
      })
      .parse(request.body);
    const result = await expertCaseChatService.approveDraft({
      caseId: id,
      ownerEmail: admin.email,
      ...body,
    });
    return reply.send({ ok: true, ...result });
  });

  app.post(`${api}/:id/safety`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        recommendationRevision: z.string().min(1).max(100),
        validation: z.record(z.string(), z.unknown()),
        unstructured: z
          .object({
            recommendationText: z.string().max(10_000).nullish(),
            dosage: z.string().max(1000).nullish(),
            cropType: z.string().max(200).nullish(),
            applicationType: z.string().max(200).nullish(),
            phiDays: z.number().int().min(0).max(1000).nullish(),
            reiHours: z.number().int().min(0).max(1000).nullish(),
          })
          .optional(),
      })
      .parse(request.body);
    const result = await recommendationSafetyGateService.evaluate({
      aggregateType: 'expert_case',
      aggregateId: id,
      caseId: id,
      recommendationRevision: body.recommendationRevision,
      actorEmail: admin.email,
      validation: body.validation as unknown as VisitAssistantRecommendationValidationRequest,
      unstructured: body.unstructured,
    });
    return reply.send({ ok: true, result });
  });

  app.post(`${api}/:id/commit`, async (request, reply) => {
    const admin = await assertModuleAccess(request, 'agronomist', 'write');
    const { id } = uuidParam.parse(request.params);
    const body = z
      .object({
        idempotencyKey: z.string().min(8).max(200),
        leaseToken: z.string().uuid().nullish(),
        expectedRevision: z.number().int().min(0),
        draft: draftSchema,
        safetyDecisionId: z.string().uuid().nullish(),
        closeCase: z.boolean().optional(),
        summary: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(request.body);
    const result = await expertCaseCommitService.commitCaseReview({
      caseId: id,
      actorEmail: admin.email,
      ...body,
    });
    return reply.send({ ok: true, result });
  });
}
