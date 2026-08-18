export type MonthBucket = {
  month: string;
  earned: number;
  held: number;
  due: number;
  paid: number;
};

export function lastNMonths(n: number, asOf = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  for (let i = 0; i < n; i += 1) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

export function emptyBuckets(months: string[]): MonthBucket[] {
  return months.map((month) => ({ month, earned: 0, held: 0, due: 0, paid: 0 }));
}

export function addToBucket(
  buckets: MonthBucket[],
  month: string,
  field: keyof Omit<MonthBucket, 'month'>,
  amount: number
): void {
  const row = buckets.find((b) => b.month === month);
  if (!row) return;
  row[field] = Math.round((row[field] + (Number(amount) || 0)) * 100) / 100;
}
