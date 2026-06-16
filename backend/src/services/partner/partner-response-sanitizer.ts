/** Strip fields partners must never receive in API responses. */

const FORBIDDEN_KEYS = new Set([
  'margin',
  'profit',
  'roi',
  'clv',
  'customerLifetimeValue',
  'reliabilityScore',
  'performanceScore',
  'leadAllocationWeight',
  'commissionRate',
  'aiConfidence',
  'confidenceScore',
  'confidence',
  'finalConfidence',
  'fraudFlag',
]);

export function sanitizePartnerPayload<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePartnerPayload(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    out[key] = sanitizePartnerPayload(val);
  }
  return out as T;
}

/** Strip confidence scores from visit AI responses for partner mobile. */
export function sanitizeVisitAiForPartner<T>(value: T): T {
  return sanitizePartnerPayload(value);
}
