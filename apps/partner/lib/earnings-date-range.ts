export type EarningsRangePreset = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

export type EarningsDateRange = {
  from: string;
  to: string;
  preset: EarningsRangePreset;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function rangeForPreset(preset: EarningsRangePreset, custom?: { from: string; to: string }): EarningsDateRange {
  const now = new Date();
  if (preset === 'this_month') {
    return { preset, from: toIsoDate(startOfMonth(now)), to: toIsoDate(endOfMonth(now)) };
  }
  if (preset === 'last_month') {
    const m = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { preset, from: toIsoDate(startOfMonth(m)), to: toIsoDate(endOfMonth(m)) };
  }
  if (preset === 'last_3_months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { preset, from: toIsoDate(from), to: toIsoDate(endOfMonth(now)) };
  }
  return {
    preset: 'custom',
    from: custom?.from?.trim() || toIsoDate(startOfMonth(now)),
    to: custom?.to?.trim() || toIsoDate(endOfMonth(now)),
  };
}

export function defaultEarningsRange(): EarningsDateRange {
  return rangeForPreset('this_month');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d;
}

export function formatRangeLabel(from: string, to: string): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
  if (from === to) {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(start);
  }
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${monthFmt.format(start)}`;
  }
  const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${dayFmt.format(start)} – ${dayFmt.format(end)}`;
}
