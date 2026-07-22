import { randomUUID } from 'node:crypto';
function field(value, refs, confidence = 'high') {
    return {
        value,
        confidence,
        provenance: ['explicit_text'],
        sourceRefs: refs,
    };
}
function missingField(detail, refs) {
    return {
        value: null,
        confidence: 'low',
        provenance: ['assistant_inference'],
        sourceRefs: refs,
        unresolved: { reason: 'missing', detail },
    };
}
const FERTILIZER_SEGMENT_RE = /([a-z0-9:+\-][a-z0-9:+\-\s]{0,80}?)\s+(\d+(?:\.\d+)?)\s*kg\b/gi;
const LABOUR_COUNT_COST_RE = /\b(\d+)\s*labou?r(?:ers?|ers)?\b[^.\n]{0,120}?(?:paid|pay|at|₹|rs\.?)\s*(\d+)\s*(?:per\s*labou?r|each|ea)\b/i;
/**
 * Deterministic parser for common WhatsApp activity logs (fertilizer + labour).
 * Used before/alongside LLM extraction so activity messages never fall through to Crop Doctor.
 */
export function parseDeterministicFarmActivityUtterance(text, messageId) {
    const normalized = text.trim().replace(/^["']+|["']+$/g, '');
    if (!normalized)
        return [];
    const refs = [messageId];
    const events = [];
    let sequence = 0;
    const appliedMatch = /\b(applied|spread|used)\b/i.test(normalized);
    const fertilizerMention = /\b(fertiliz|fertilis|manure|npk|urea|dap|mop|zinc|magnesium|sulphate|sulfate|\d+\s*:\s*\d+\s*:\s*\d+)/i.test(normalized);
    if (appliedMatch && fertilizerMention) {
        const products = [];
        let totalKg = 0;
        for (const match of normalized.matchAll(FERTILIZER_SEGMENT_RE)) {
            const label = String(match[1] ?? '').trim();
            const qty = Number(match[2]);
            if (!label || Number.isNaN(qty))
                continue;
            products.push(`${label} ${qty} kg`);
            totalKg += qty;
        }
        const description = products.length > 0
            ? products.join('; ')
            : normalized.slice(0, 500);
        events.push({
            id: randomUUID(),
            kind: 'activity',
            sequence: ++sequence,
            sourceRefs: refs,
            occurredOn: missingField('Activity date was not stated.', refs),
            activityType: field('fertilizer application', refs),
            blockRef: missingField('Plot/block was not stated.', refs),
            description: field(description, refs),
            quantity: totalKg > 0 ? field(totalKg, refs) : missingField('Quantity was not clear.', refs),
            unit: totalKg > 0 ? field('kg', refs) : missingField('Unit was not clear.', refs),
        });
    }
    const labourMatch = LABOUR_COUNT_COST_RE.exec(normalized);
    if (labourMatch) {
        const workerCount = Number(labourMatch[1]);
        const rate = Number(labourMatch[2]);
        const totalCost = !Number.isNaN(workerCount) && !Number.isNaN(rate) ? workerCount * rate : null;
        events.push({
            id: randomUUID(),
            kind: 'labour',
            sequence: ++sequence,
            sourceRefs: refs,
            occurredOn: missingField('Labour date was not stated.', refs),
            workType: field('field labour', refs),
            workerCount: !Number.isNaN(workerCount) ? field(workerCount, refs) : missingField('Worker count was not clear.', refs),
            durationHours: missingField('Duration was not stated.', refs),
            rate: !Number.isNaN(rate)
                ? field({ amount: rate, currency: 'INR' }, refs)
                : missingField('Rate was not clear.', refs),
            totalCost: totalCost != null
                ? field({ amount: totalCost, currency: 'INR' }, refs)
                : missingField('Total labour cost was not clear.', refs),
        });
    }
    return events;
}
//# sourceMappingURL=farm-activity-utterance-parser.service.js.map