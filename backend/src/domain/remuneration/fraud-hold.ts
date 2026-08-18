export const FRAUD_FLAG_TYPES = [
  'duplicate_claim',
  'gps_missing',
  'fake_visit',
  'fake_km',
  'introduction_fraud',
  'order_fraud',
  'manual',
] as const;

export type FraudFlagType = (typeof FRAUD_FLAG_TYPES)[number];

export const FRAUD_FLAG_STATUSES = ['open', 'confirmed', 'cleared'] as const;
export type FraudFlagStatus = (typeof FRAUD_FLAG_STATUSES)[number];

export function blocksPayout(status: string): boolean {
  return status === 'open' || status === 'confirmed';
}

export function payoutHoldFromFlags(flags: Array<{ status: string }>): {
  hold: boolean;
  openCount: number;
  confirmedCount: number;
} {
  const openCount = flags.filter((f) => f.status === 'open').length;
  const confirmedCount = flags.filter((f) => f.status === 'confirmed').length;
  return {
    hold: openCount + confirmedCount > 0,
    openCount,
    confirmedCount,
  };
}
