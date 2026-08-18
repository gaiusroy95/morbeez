import type { CallRuleAction, CallType, FarmerIntent } from './types.js';

const HEALTH_DAYS = [1, 3, 7] as const;

export function nextHealthFollowUpDays(fromDay?: number | null): number[] {
  const current = fromDay ?? 0;
  return HEALTH_DAYS.filter((d) => d > current);
}

export function resolveCallAction(params: {
  callType: CallType;
  intent: FarmerIntent;
  followUpHoursIfNo?: number;
}): CallRuleAction {
  const hours = params.followUpHoursIfNo ?? 24;

  if (params.intent === 'opt_out') {
    return { kind: 'opt_out', note: 'Farmer asked to stop automated voice calls' };
  }
  if (params.intent === 'human_requested') {
    return { kind: 'transfer_human', note: 'Farmer requested the assigned agronomist' };
  }
  if (params.intent === 'unclear') {
    return { kind: 'clarify', note: 'Reply was not a clear yes/no/symptoms' };
  }

  if (params.intent === 'worsening' || params.intent === 'symptoms') {
    if (params.callType === 'escalation' || params.intent === 'worsening') {
      return {
        kind: 'escalate',
        ladder: 'assigned',
        note: params.intent === 'worsening' ? 'Crop worsening reported' : 'Symptoms reported during call',
      };
    }
    return { kind: 'open_ticket', priority: 'high', note: 'Symptoms reported — agronomist ticket, no prescription' };
  }

  if (params.intent === 'yes_completed') {
    if (params.callType === 'crop_application' || params.callType === 'health_follow_up') {
      return { kind: 'mark_completed', note: 'Farmer confirmed application or improvement' };
    }
    if (params.callType === 'qualification') {
      return { kind: 'mark_completed', note: 'Farmer agreed to continue qualification' };
    }
    return { kind: 'mark_completed', note: 'Farmer confirmed the reminder' };
  }

  if (params.intent === 'no_pending') {
    return { kind: 'schedule_reminder', hours, note: 'Farmer said not yet — schedule reminder' };
  }

  return { kind: 'clarify', note: 'No matching rule' };
}

export function escalationLadderStep(current: 'assigned' | 'backup' | 'queue'): 'backup' | 'queue' {
  return current === 'assigned' ? 'backup' : 'queue';
}
