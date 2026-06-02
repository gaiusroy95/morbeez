import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { farmerEventService } from './farmer-event.service.js';
import { employeeProfileResolveService } from './employee-profile-resolve.service.js';
import type { FarmerEventSource, FarmerEventType } from './farmer-event.types.js';

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('farmer_events') &&
    (msg.includes('does not exist') || msg.includes('PGRST204') || msg.includes('schema'))
  );
}

async function resolveLeadAssigneeEmail(farmerId: string): Promise<string | null> {
  const { data } = await supabase
    .from('leads')
    .select('assigned_to')
    .eq('farmer_id', farmerId)
    .maybeSingle();
  return data?.assigned_to ? String(data.assigned_to).trim().toLowerCase() : null;
}

async function syncAttribution(params: {
  farmerId: string;
  eventType: FarmerEventType;
  employeeEmail?: string | null;
  eventValue?: Record<string, unknown>;
}): Promise<void> {
  const { employeeAttributionCaptureService } = await import(
    './employee-attribution-capture.service.js'
  );
  void employeeAttributionCaptureService.onFarmerEvent(params);
}

function mapOnboardSource(source?: string): FarmerEventSource {
  const s = (source ?? '').toLowerCase();
  if (s === 'whatsapp') return 'whatsapp';
  if (s === 'web' || s === 'website') return 'web';
  if (s === 'shopify') return 'shopify';
  if (s === 'phone' || s === 'crm') return 'crm';
  if (s === 'referral') return 'system';
  return 'system';
}

function mapWhatsAppMessageType(
  msgType: string,
  direction: 'inbound' | 'outbound'
): FarmerEventType {
  const t = msgType.toLowerCase();
  if (direction === 'outbound') return 'MESSAGE_SENT';

  if (t.includes('image') || t === 'sticker') return 'IMAGE_UPLOAD';
  if (t.includes('audio') || t.includes('voice') || t === 'ptt') return 'VOICE_NOTE';
  if (t.includes('video')) return 'IMAGE_UPLOAD';
  return 'MESSAGE_REPLY';
}

/**
 * Phase 1: fire-and-forget farmer_events capture. Never throws to callers.
 */
export const farmerEventCaptureService = {
  async recordSafe(input: Parameters<typeof farmerEventService.record>[0]): Promise<void> {
    try {
      await farmerEventService.record(input);
    } catch (err) {
      if (isMissingTableError(err)) {
        logger.warn('farmer_events table missing — run migration 20260637000000_opportunity_intelligence_phase0.sql');
        return;
      }
      logger.warn({ err, eventType: input.eventType, farmerId: input.farmerId }, 'Farmer event capture failed');
    }
  },

  async captureWhatsAppInteraction(params: {
    farmerId: string;
    direction: 'inbound' | 'outbound';
    messageType?: string;
    externalMessageId?: string;
    contentPreview?: string;
    employeeEmail?: string | null;
    occurredAt?: string;
  }): Promise<void> {
    const msgType = params.messageType ?? 'text';
    const eventType = mapWhatsAppMessageType(msgType, params.direction);
    const assignee =
      params.employeeEmail ?? (params.direction === 'inbound' ? await resolveLeadAssigneeEmail(params.farmerId) : null);

    const idempotencyKey = params.externalMessageId
      ? `wa:${params.direction}:${params.externalMessageId}`
      : undefined;

    await this.recordSafe({
      farmerId: params.farmerId,
      eventType,
      source: 'whatsapp',
      employeeEmail: assignee ?? undefined,
      idempotencyKey,
      referenceType: params.externalMessageId ? 'whatsapp_message' : undefined,
      referenceId: undefined,
      eventValue: {
        messageType: msgType,
        direction: params.direction,
        preview: params.contentPreview?.slice(0, 200) ?? null,
      },
      occurredAt: params.occurredAt,
    });

    if (params.direction === 'inbound' && eventType === 'MESSAGE_REPLY') {
      await syncAttribution({
        farmerId: params.farmerId,
        eventType: 'MESSAGE_REPLY',
        employeeEmail: assignee,
      });
      await this.recordReactivationIfNeeded(params.farmerId, assignee);
    }
  },

  async recordReactivationIfNeeded(farmerId: string, assigneeEmail: string | null): Promise<void> {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentInbound } = await supabase
      .from('interaction_logs')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .eq('direction', 'inbound')
      .gte('created_at', since30);

    if ((recentInbound ?? 0) > 1) return;

    const { count: priorInbound } = await supabase
      .from('interaction_logs')
      .select('id', { count: 'exact', head: true })
      .eq('farmer_id', farmerId)
      .eq('direction', 'inbound')
      .lt('created_at', since30);

    if ((priorInbound ?? 0) < 3) return;

    await this.recordSafe({
      farmerId,
      eventType: 'FARMER_REACTIVATED',
      source: 'whatsapp',
      employeeEmail: assigneeEmail ?? undefined,
      eventValue: { inactiveDays: 30 },
    });

    await syncAttribution({
      farmerId,
      eventType: 'FARMER_REACTIVATED',
      employeeEmail: assigneeEmail,
    });
  },

  async trackFarmerOnboarded(params: {
    farmerId: string;
    leadId?: string;
    source?: string;
    intent?: string;
    assignedTo?: string | null;
  }): Promise<void> {
    const src = mapOnboardSource(params.source);
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'FARMER_ONBOARDED',
      source: src,
      employeeEmail: params.assignedTo ?? undefined,
      referenceType: params.leadId ? 'lead' : undefined,
      referenceId: params.leadId,
      idempotencyKey: params.leadId ? `onboard:lead:${params.leadId}` : `onboard:farmer:${params.farmerId}`,
      eventValue: {
        entrySource: params.source ?? 'unknown',
        intent: params.intent ?? 'general',
      },
    });

    if (params.assignedTo) {
      const { employeeAttributionCaptureService } = await import(
        './employee-attribution-capture.service.js'
      );
      void employeeAttributionCaptureService.trackTelecallerAssigned(
        params.farmerId,
        params.assignedTo
      );
    }
  },

  async trackLeadAssignment(farmerId: string, agentEmail: string): Promise<void> {
    const { employeeAttributionCaptureService } = await import(
      './employee-attribution-capture.service.js'
    );
    void employeeAttributionCaptureService.trackTelecallerAssigned(farmerId, agentEmail);

    await this.recordSafe({
      farmerId,
      eventType: 'CALLBACK_REQUESTED',
      source: 'crm',
      employeeEmail: agentEmail,
      eventValue: { kind: 'lead_assigned' },
    });
  },

  async trackRecommendationMilestone(params: {
    recommendationRecordId: string;
    farmerId: string;
    milestone: 'created' | 'submitted' | 'approved' | 'rejected' | 'communicated' | 'outcome_recorded' | 'farmer_feedback';
    employeeEmail?: string | null;
    outcome?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const employeeProfileId = await employeeProfileResolveService.resolve({
      employeeEmail: params.employeeEmail ?? undefined,
    });

    try {
      await supabase.from('recommendation_history').insert({
        recommendation_record_id: params.recommendationRecordId,
        farmer_id: params.farmerId,
        employee_profile_id: employeeProfileId,
        milestone: params.milestone,
        outcome: params.outcome ?? null,
        metadata: params.metadata ?? {},
      });
    } catch (err) {
      if (!isMissingTableError(err)) {
        logger.warn({ err }, 'recommendation_history insert failed');
      }
    }

    const eventMap: Partial<Record<typeof params.milestone, FarmerEventType>> = {
      approved: 'RECOMMENDATION_APPROVED',
      communicated: 'RECOMMENDATION_COMMUNICATED',
      outcome_recorded: 'FOLLOWUP_COMPLETED',
    };

    const eventType = eventMap[params.milestone];
    if (!eventType) return;

    await this.recordSafe({
      farmerId: params.farmerId,
      eventType,
      source: 'agronomist',
      employeeEmail: params.employeeEmail ?? undefined,
      referenceType: 'recommendation_record',
      referenceId: params.recommendationRecordId,
      idempotencyKey: `rec:${params.milestone}:${params.recommendationRecordId}`,
      eventValue: { milestone: params.milestone, outcome: params.outcome ?? null, ...params.metadata },
    });

    if (eventType) {
      await syncAttribution({
        farmerId: params.farmerId,
        eventType,
        employeeEmail: params.employeeEmail ?? null,
      });
    }
  },

  async trackRecommendationApplied(params: {
    farmerId: string;
    recommendationRecordId: string;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'RECOMMENDATION_APPLIED',
      source: 'whatsapp',
      referenceType: 'recommendation_record',
      referenceId: params.recommendationRecordId,
      idempotencyKey: `rec:applied:${params.recommendationRecordId}`,
      eventValue: { confirmedBy: 'farmer' },
    });
  },

  async trackRoiEntry(params: {
    farmerId: string;
    entryId: string;
    entryType: string;
    amountInr: number;
    entryDate: string;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'ROI_ENTRY',
      source: 'roi',
      referenceType: 'farmer_roi_entry',
      referenceId: params.entryId,
      idempotencyKey: `roi:${params.entryId}`,
      eventValue: {
        entryType: params.entryType,
        amountInr: params.amountInr,
        entryDate: params.entryDate,
      },
    });
  },

  async trackOrderConverted(params: {
    farmerId: string;
    shopifyOrderId: string;
    orderName?: string | null;
    total?: string | number | null;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'ORDER_CONVERTED',
      source: 'shopify',
      idempotencyKey: `order:paid:${params.shopifyOrderId}`,
      eventValue: {
        shopifyOrderId: params.shopifyOrderId,
        orderName: params.orderName ?? null,
        total: params.total ?? null,
      },
    });

    await syncAttribution({
      farmerId: params.farmerId,
      eventType: 'ORDER_CONVERTED',
      eventValue: {
        shopifyOrderId: params.shopifyOrderId,
        orderName: params.orderName ?? null,
        total: params.total ?? null,
      },
    });
  },

  async trackAdvisorySessionCompleted(params: {
    farmerId: string;
    sessionId: string;
    escalated: boolean;
    confidence?: number;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'ADVISORY_SESSION_COMPLETED',
      source: 'whatsapp',
      referenceType: 'ai_advisory_session',
      referenceId: params.sessionId,
      idempotencyKey: `advisory:completed:${params.sessionId}`,
      eventValue: {
        escalated: params.escalated,
        confidence: params.confidence ?? null,
      },
    });

    if (params.escalated) {
      await this.recordSafe({
        farmerId: params.farmerId,
        eventType: 'CROP_ASSESSMENT_REQUESTED',
        source: 'whatsapp',
        referenceType: 'ai_advisory_session',
        referenceId: params.sessionId,
        idempotencyKey: `advisory:escalated:${params.sessionId}`,
      });
    }
  },

  async trackCallbackRequested(params: {
    farmerId: string;
    sessionId?: string;
    employeeEmail?: string | null;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'CALLBACK_REQUESTED',
      source: 'whatsapp',
      employeeEmail: params.employeeEmail ?? (await resolveLeadAssigneeEmail(params.farmerId)) ?? undefined,
      referenceType: params.sessionId ? 'ai_advisory_session' : undefined,
      referenceId: params.sessionId,
      eventValue: {},
    });
  },

  async trackCaseReviewSubmitted(params: {
    farmerId: string;
    escalationId: string;
    recommendationId?: string | null;
    agentEmail: string;
    submittedForApproval: boolean;
    selfApproved?: boolean;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'CROP_ASSESSMENT_REQUESTED',
      source: 'agronomist',
      employeeEmail: params.agentEmail,
      referenceType: 'agronomist_escalation',
      referenceId: params.escalationId,
      idempotencyKey: `case-review:${params.escalationId}:${params.submittedForApproval ? 'submit' : 'draft'}`,
      eventValue: {
        recommendationId: params.recommendationId ?? null,
        submittedForApproval: params.submittedForApproval,
        selfApproved: params.selfApproved ?? false,
        escalationId: params.escalationId,
      },
    });

    await syncAttribution({
      farmerId: params.farmerId,
      eventType: 'CROP_ASSESSMENT_REQUESTED',
      employeeEmail: params.agentEmail,
      eventValue: { submittedForApproval: params.submittedForApproval, escalationId: params.escalationId },
    });
  },

  async trackCrmFollowUpCompleted(params: {
    farmerId: string;
    taskId: string;
    agentEmail: string;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'FOLLOWUP_COMPLETED',
      source: 'crm',
      employeeEmail: params.agentEmail,
      referenceType: 'crm_task',
      referenceId: params.taskId,
      idempotencyKey: `crm-task:done:${params.taskId}`,
    });
  },

  async trackSoilTestUploaded(params: {
    farmerId: string;
    soilReportId: string;
    blockId?: string | null;
    employeeEmail?: string | null;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'SOIL_TEST_UPLOADED',
      source: 'crm',
      employeeEmail: params.employeeEmail ?? undefined,
      referenceType: 'crm_soil_report',
      referenceId: params.soilReportId,
      idempotencyKey: `soil:${params.soilReportId}`,
      eventValue: { blockId: params.blockId ?? null },
    });

    await syncAttribution({
      farmerId: params.farmerId,
      eventType: 'SOIL_TEST_UPLOADED',
      employeeEmail: params.employeeEmail ?? null,
    });
  },

  async trackSiteVisitScheduled(params: {
    farmerId: string;
    taskId: string;
    employeeEmail: string;
    dueAt: string;
    blockId?: string | null;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'SITE_VISIT_ACCEPTED',
      source: 'crm',
      employeeEmail: params.employeeEmail,
      referenceType: 'crm_task',
      referenceId: params.taskId,
      idempotencyKey: `visit:scheduled:${params.taskId}`,
      eventValue: { dueAt: params.dueAt, blockId: params.blockId ?? null },
    });

    await syncAttribution({
      farmerId: params.farmerId,
      eventType: 'SITE_VISIT_ACCEPTED',
      employeeEmail: params.employeeEmail,
    });
  },

  async trackFieldFinding(params: {
    farmerId: string;
    findingId: string;
    agentEmail: string;
  }): Promise<void> {
    await this.recordSafe({
      farmerId: params.farmerId,
      eventType: 'FIELD_FINDING_LOGGED',
      source: 'field_pwa',
      employeeEmail: params.agentEmail,
      referenceType: 'crm_field_finding',
      referenceId: params.findingId,
      idempotencyKey: `finding:${params.findingId}`,
    });

    await syncAttribution({
      farmerId: params.farmerId,
      eventType: 'FIELD_FINDING_LOGGED',
      employeeEmail: params.agentEmail,
    });
  },
};
