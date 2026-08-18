export type AgronomistEventType =
  | 'field_visit'
  | 'km_allowance'
  | 'recommendation_success'
  | 'escalation_resolved'
  | 'retention';

export type AgronomistCompSnapshot = {
  incentiveEnabled: boolean;
  fieldVisitBonus: number;
  recommendationSuccessBonus: number;
  escalationBonus: number;
  farmerRetentionBonus: number;
  kmAllowanceEnabled: boolean;
  ratePerKm: number;
};

export function amountForEvent(
  type: AgronomistEventType,
  comp: AgronomistCompSnapshot,
  extra?: { km?: number }
): number {
  if (!comp.incentiveEnabled) return 0;
  if (type === 'field_visit') return Math.max(0, comp.fieldVisitBonus);
  if (type === 'recommendation_success') return Math.max(0, comp.recommendationSuccessBonus);
  if (type === 'escalation_resolved') return Math.max(0, comp.escalationBonus);
  if (type === 'retention') return Math.max(0, comp.farmerRetentionBonus);
  if (type === 'km_allowance') {
    if (!comp.kmAllowanceEnabled) return 0;
    const km = extra?.km ?? 0;
    return Math.round(Math.max(0, km) * Math.max(0, comp.ratePerKm) * 100) / 100;
  }
  return 0;
}

export function periodMonth(at = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
}
