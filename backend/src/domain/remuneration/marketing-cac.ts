export function marketingCac(spendInr: number, eligibleOrderCount: number): number | null {
  const spend = Math.max(0, Number(spendInr) || 0);
  const n = Math.max(0, Math.floor(Number(eligibleOrderCount) || 0));
  if (n <= 0) return null;
  return Math.round((spend / n) * 100) / 100;
}

export function eligibleRoi(eligibleRevenueInr: number, spendInr: number): number | null {
  const spend = Math.max(0, Number(spendInr) || 0);
  if (spend <= 0) return null;
  return Math.round((Math.max(0, Number(eligibleRevenueInr) || 0) / spend) * 100) / 100;
}
