/** Build a public carrier tracking URL from AWB / courier metadata. */

export function delhiveryTrackUrl(awb: string): string {
  const clean = awb.replace(/\s/g, '');
  return `https://www.delhivery.com/track-v2/package/${encodeURIComponent(clean)}`;
}

export function resolveTrackingUrl(input: {
  trackingId?: string | null;
  trackingUrl?: string | null;
  courier?: string | null;
}): string | null {
  const stored = input.trackingUrl?.trim();
  if (stored && stored.startsWith('http')) return stored;

  const id = input.trackingId?.trim();
  if (!id || id === '—') return null;

  // Delhivery is the default last-mile partner (often via Shiprocket rules).
  return delhiveryTrackUrl(id);
}

export function trackingLinkLabel(courier: string | null | undefined, trackingId: string): string {
  const c = (courier ?? '').trim();
  if (c && c !== '—') return `Track on ${c}`;
  return `Track shipment ${trackingId}`;
}
