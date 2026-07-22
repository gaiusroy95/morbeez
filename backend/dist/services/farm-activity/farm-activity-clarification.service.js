import { blockDisplayName } from '../core/block.service.js';
function resolvedField(value, messageId) {
    return {
        value,
        confidence: 'high',
        provenance: ['user_edit'],
        sourceRefs: [messageId],
    };
}
export function normalizePlotAnswer(text) {
    return text
        .trim()
        .toLowerCase()
        .replace(/^crop\./, '')
        .replace(/\s+plot$/i, '')
        .trim();
}
/** Match farmer reply ("ginger", "Ginger Plot", crop.ginger) to a farm block id. */
export function resolveBlockRefFromBlocks(blocks, text) {
    const answer = text.trim();
    if (!answer)
        return null;
    if (answer.startsWith('crop.')) {
        const slug = normalizePlotAnswer(answer);
        const byCrop = blocks.find((block) => block.crop_type.toLowerCase() === slug);
        if (byCrop)
            return byCrop.id;
    }
    const needle = normalizePlotAnswer(answer);
    const plotNeedle = `${needle} plot`;
    const lowerAnswer = answer.toLowerCase();
    for (const block of blocks) {
        const candidates = [
            block.id,
            block.name,
            block.plot_label,
            block.crop_type,
            block.crop_name,
            blockDisplayName(block),
        ]
            .filter((item) => Boolean(item))
            .map((item) => item.trim().toLowerCase());
        const expanded = new Set();
        for (const candidate of candidates) {
            expanded.add(candidate);
            expanded.add(candidate.replace(/\s+plot$/i, '').trim());
            expanded.add(`${candidate.replace(/\s+plot$/i, '').trim()} plot`);
        }
        if (expanded.has(needle) || expanded.has(plotNeedle) || expanded.has(lowerAnswer)) {
            return block.id;
        }
        if (needle.length >= 3) {
            for (const candidate of expanded) {
                if (candidate === needle || candidate.startsWith(needle) || needle.startsWith(candidate)) {
                    return block.id;
                }
            }
        }
    }
    return null;
}
export function applyClarificationAnswer(input) {
    const { draft, clarification, answerText, messageId } = input;
    const event = draft.subEvents.find((item) => item.id === clarification.subEventId);
    if (!event)
        return null;
    let fieldValue = null;
    if (clarification.field === 'blockRef') {
        fieldValue = input.blockRef ?? null;
        if (!fieldValue)
            return null;
    }
    else {
        const trimmed = answerText.trim();
        if (!trimmed)
            return null;
        fieldValue = trimmed;
    }
    const subEvents = draft.subEvents.map((item) => {
        if (item.id !== clarification.subEventId)
            return item;
        if (!(clarification.field in item))
            return item;
        return {
            ...item,
            [clarification.field]: resolvedField(fieldValue, messageId),
        };
    });
    return {
        ...draft,
        revision: draft.revision + 1,
        subEvents,
        clarifications: draft.clarifications.filter((item) => item.id !== clarification.id),
    };
}
//# sourceMappingURL=farm-activity-clarification.service.js.map