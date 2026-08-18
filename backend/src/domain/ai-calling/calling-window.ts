import type { CallingWindow } from './types.js';

const IST = 'Asia/Kolkata';

export type ConsentState = {
  dnd: boolean;
  optedOut: boolean;
  consentOutboundCall: boolean;
  staffInitiated: boolean;
};

function istParts(at: Date): { hour: number; minute: number; weekday: number; y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: weekdayMap[parts.weekday ?? 'Mon'] ?? 1,
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
  };
}

/** Next 08:00 IST after `at` (or same morning if still before 08:00). */
export function nextCallingWindowStart(at: Date): Date {
  const p = istParts(at);
  const alreadyOpen = p.hour > 8 || (p.hour === 8 && p.minute === 0);
  const startUtc = Date.parse(
    `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}T02:30:00.000Z`
  );
  if (!alreadyOpen) return new Date(startUtc);
  return new Date(startUtc + 24 * 60 * 60 * 1000);
}

export function isWithinCallingHours(at: Date, quietStartHour = 8, quietEndHour = 20): boolean {
  const { hour } = istParts(at);
  return hour >= quietStartHour && hour < quietEndHour;
}

export function evaluateCallingWindow(at: Date, consent: ConsentState): CallingWindow {
  if (consent.dnd || consent.optedOut) {
    return { allowed: false, reason: consent.dnd ? 'dnd' : 'opted_out' };
  }
  if (!consent.consentOutboundCall && !consent.staffInitiated) {
    return { allowed: false, reason: 'no_consent' };
  }
  if (!isWithinCallingHours(at)) {
    return { allowed: false, reason: 'quiet_hours', nextAllowedAt: nextCallingWindowStart(at) };
  }
  return { allowed: true, reason: 'ok' };
}
