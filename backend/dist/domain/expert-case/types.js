export function normalizeIssueFingerprint(issueLabel) {
    const raw = String(issueLabel ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!raw)
        return 'unknown';
    return raw.slice(0, 80);
}
export function buildExpertCaseKey(params) {
    const block = params.blockId || 'noblock';
    const gen = params.generation && params.generation > 1 ? `:g${params.generation}` : '';
    return `ec:${params.farmerId}:${block}:${params.fingerprint}${gen}`;
}
export function priorityTierFromPriority(priority) {
    if (priority === 'urgent')
        return 'emergency';
    if (priority === 'high')
        return 'sla_risk';
    return 'standard';
}
export function slaMinutesForPriority(priority) {
    switch (priority) {
        case 'urgent':
            return 30;
        case 'high':
            return 120;
        case 'low':
            return 480;
        default:
            return 240;
    }
}
export function queueWeightForPriority(priority) {
    switch (priority) {
        case 'urgent':
            return 2;
        case 'high':
            return 1.5;
        case 'low':
            return 0.5;
        default:
            return 1;
    }
}
//# sourceMappingURL=types.js.map