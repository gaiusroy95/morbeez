import type { CallRuleAction, CallType, FarmerIntent } from './types.js';
export declare function nextHealthFollowUpDays(fromDay?: number | null): number[];
export declare function resolveCallAction(params: {
    callType: CallType;
    intent: FarmerIntent;
    followUpHoursIfNo?: number;
}): CallRuleAction;
export declare function escalationLadderStep(current: 'assigned' | 'backup' | 'queue'): 'backup' | 'queue';
//# sourceMappingURL=rule-engine.d.ts.map