import type {
  ExpertCaseReviewDraft,
  ExpertTreatmentActivity,
} from '@morbeez/shared/expert-case';
import {
  draftNeedsDilutionClarification,
  mergeExpertCaseDraft,
} from '@morbeez/shared/expert-case';

const METHOD_PATTERNS: Array<{ re: RegExp; method: string }> = [
  { re: /\b(soil\s+)?drench\b/i, method: 'Soil Drench' },
  { re: /\bfoliar\s+spray\b|\bfoliar\b/i, method: 'Foliar Spray' },
  { re: /\bspray\b/i, method: 'Foliar Spray' },
  { re: /\bdrip\b/i, method: 'Drip' },
  { re: /\bbroadcast\b/i, method: 'Broadcast' },
];

const DILUTION_VOLUME_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:liter|litre|liters|litres|ltr|l)\b(?:\s*(?:of\s+)?water)?/i;

const DOSE_RE =
  /(\d+(?:\.\d+)?\s*(?:kg|g|gm|grams?|ml|l|litre|liter|ltr)s?)/i;

const INTERVAL_RE = /\bevery\s+(\d+\s+days?)\b/i;

export function parseDilutionVolumeL(text: string): number | null {
  const match = text.match(DILUTION_VOLUME_RE);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function detectTreatmentMethod(segment: string): string | null {
  for (const { re, method } of METHOD_PATTERNS) {
    if (re.test(segment)) return method;
  }
  return null;
}

export function splitCompositeTreatmentMessage(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const byAnd = normalized.split(
    /\s+and\s+(?=(?:spray|drench|foliar|soil|apply)\b)/i
  );
  if (byAnd.length > 1) {
    return byAnd.map((part) => part.trim()).filter(Boolean);
  }

  const byDrench = normalized.split(/\s+(?=drench\b)/i);
  if (byDrench.length > 1) {
    return byDrench.map((part) => part.trim()).filter(Boolean);
  }

  return [normalized];
}

function extractInterval(text: string): string | null {
  const match = text.match(INTERVAL_RE);
  return match ? match[1].trim() : null;
}

function extractDoseFromSegment(segment: string): string | null {
  const doses = [...segment.matchAll(new RegExp(DOSE_RE.source, 'gi'))].map((m) => m[1].trim());
  if (!doses.length) return null;
  return doses.join(' + ');
}

function extractProductFromSegment(segment: string): string | null {
  let working = segment
    .replace(/\b(spray|drench|foliar|soil|with|every|interval|days?)\b/gi, ' ')
    .replace(DOSE_RE, ' ')
    .replace(DILUTION_VOLUME_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const plusParts = working
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter((part) => /[A-Za-z]/.test(part) && part.length > 2);
  if (plusParts.length) return plusParts.join(' + ');

  const tokens = working
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter((part) => /[A-Za-z]/.test(part) && part.length > 2);
  if (tokens.length) return tokens[0];

  return working.length > 2 ? working.slice(0, 120) : null;
}

export function parseTreatmentActivitiesFromMessage(message: string): ExpertTreatmentActivity[] {
  const segments = splitCompositeTreatmentMessage(message);
  const globalVolume = parseDilutionVolumeL(message);
  const activities: ExpertTreatmentActivity[] = [];

  for (const segment of segments) {
    const method = detectTreatmentMethod(segment);
    if (!method && segments.length > 1) continue;

    const dose = extractDoseFromSegment(segment);
    const product = extractProductFromSegment(segment);
    const dilutionVolumeL =
      parseDilutionVolumeL(segment) ??
      (method === 'Foliar Spray' ? globalVolume : null);

    if (!method && !product && !dose) continue;

    activities.push({
      method,
      product,
      dose,
      dilutionVolumeL,
      dilutionNotes:
        dilutionVolumeL != null ? `${dilutionVolumeL} L spray volume` : null,
      interval: extractInterval(segment) ?? extractInterval(message),
      notes: null,
    });
  }

  return activities;
}

function summarizeActivities(activities: ExpertTreatmentActivity[]): string {
  return activities
    .map((row) =>
      [
        row.method,
        row.product,
        row.dose,
        row.dilutionVolumeL != null ? `in ${row.dilutionVolumeL} L water` : null,
        row.interval ? `every ${row.interval}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    )
    .join(' | ');
}

/** Merge LLM extraction with deterministic parsing from the latest agronomist message. */
export function supplementTreatmentDraft(
  draft: ExpertCaseReviewDraft,
  latestMessage: string
): ExpertCaseReviewDraft {
  const parsed = parseTreatmentActivitiesFromMessage(latestMessage);
  const volume = parseDilutionVolumeL(latestMessage);
  const patch: ExpertCaseReviewDraft = {};

  const existing = [...(draft.treatmentActivities ?? [])];
  if (parsed.length > 0) {
    if (existing.length === 0) {
      patch.treatmentActivities = parsed;
    } else if (parsed.length > existing.length) {
      const merged = [...existing];
      for (const row of parsed) {
        const key = `${row.method ?? ''}|${row.product ?? ''}`;
        if (!merged.some((item) => `${item.method ?? ''}|${item.product ?? ''}` === key)) {
          merged.push(row);
        }
      }
      patch.treatmentActivities = merged;
    } else {
      patch.treatmentActivities = existing.map((row, index) => {
        const fallback = parsed[index];
        if (!fallback) return row;
        return {
          method: row.method ?? fallback.method,
          product: row.product ?? fallback.product,
          dose: row.dose ?? fallback.dose,
          dilutionVolumeL: row.dilutionVolumeL ?? fallback.dilutionVolumeL,
          dilutionNotes: row.dilutionNotes ?? fallback.dilutionNotes,
          interval: row.interval ?? fallback.interval,
          notes: row.notes ?? fallback.notes,
        };
      });
    }
  }

  const activities = patch.treatmentActivities ?? draft.treatmentActivities ?? [];
  if (activities.length > 0) {
    const foliar =
      activities.find((row) => /spray|foliar/i.test(String(row.method ?? ''))) ?? activities[0];
    const drench = activities.find((row) => /drench/i.test(String(row.method ?? '')));

    if (foliar?.product && !draft.treatmentProduct) patch.treatmentProduct = foliar.product;
    if (foliar?.dose && !draft.dosage) patch.dosage = foliar.dose;
    if (foliar?.method && !draft.applicationMethod) patch.applicationMethod = foliar.method;
    if (foliar?.dilutionVolumeL != null && draft.sprayVolumeL == null) {
      patch.sprayVolumeL = foliar.dilutionVolumeL;
    }

    if (drench?.product && !draft.nutritionProduct) {
      patch.nutritionProduct = drench.product;
      patch.nutritionDose = drench.dose ?? draft.nutritionDose;
    }

    const interval = extractInterval(latestMessage);
    if (interval && !draft.applicationTiming) {
      patch.applicationTiming = `Every ${interval}`;
    } else if (foliar?.interval && !draft.applicationTiming) {
      patch.applicationTiming = `Every ${foliar.interval}`;
    }

    if (!String(draft.recommendationText ?? '').trim()) {
      patch.recommendationText = summarizeActivities(activities);
    }
  }

  if (volume != null) {
    if (draft.sprayVolumeL == null) patch.sprayVolumeL = volume;
    if (!String(draft.dilutionNotes ?? '').trim()) {
      patch.dilutionNotes = `${volume} L spray volume`;
    }
    if (patch.treatmentActivities?.length) {
      patch.treatmentActivities = patch.treatmentActivities.map((row) =>
        /spray|foliar/i.test(String(row.method ?? '')) && row.dilutionVolumeL == null
          ? {
              ...row,
              dilutionVolumeL: volume,
              dilutionNotes: row.dilutionNotes ?? `${volume} L spray volume`,
            }
          : row
      );
    }
  }

  const merged = mergeExpertCaseDraft(draft, patch);
  if (draftNeedsDilutionClarification(merged)) {
    merged.unresolvedFields = [
      ...new Set([...(merged.unresolvedFields ?? []), 'dilutionVolume']),
    ];
  }
  return merged;
}
