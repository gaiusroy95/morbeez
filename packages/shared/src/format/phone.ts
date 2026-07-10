/**
 * Phone display / dial helpers for Morbeez (India-first, E.164-friendly).
 * Stored values are often digits-only (e.g. 916282873542); UI and tel: links need "+".
 */

/** Digits only. */
export function phoneDigits(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '');
}

/**
 * Canonical international form with leading "+", e.g. +916282873542.
 * - 10-digit local India numbers → +91…
 * - Already country-coded digits → +…
 * - Values that already include "+" are normalized to +digits
 */
export function formatPhoneE164(
  phone: string | null | undefined,
  defaultCountryCode = '91'
): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  const digits = phoneDigits(raw);
  if (!digits) return null;

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && defaultCountryCode === '91') {
    return `+${defaultCountryCode}${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/** Human-facing display (same as E.164 for Morbeez). Empty → em dash. */
export function formatPhoneDisplay(
  phone: string | null | undefined,
  empty = '—'
): string {
  return formatPhoneE164(phone) ?? empty;
}

/** `tel:+91…` URI for native/web dialers. */
export function telHref(phone: string | null | undefined): string | null {
  const e164 = formatPhoneE164(phone);
  return e164 ? `tel:${e164}` : null;
}

/** Digits for https://wa.me/{digits} (no "+"). */
export function whatsAppPhone(phone: string | null | undefined): string | null {
  const e164 = formatPhoneE164(phone);
  if (!e164) return null;
  return e164.replace(/\D/g, '') || null;
}

export function whatsAppHref(phone: string | null | undefined): string | null {
  const digits = whatsAppPhone(phone);
  return digits ? `https://wa.me/${digits}` : null;
}
