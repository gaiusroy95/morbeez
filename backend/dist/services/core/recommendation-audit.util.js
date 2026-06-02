export function readAuditLog(metadata) {
    if (!metadata || typeof metadata !== 'object')
        return [];
    const log = metadata.auditLog;
    if (!Array.isArray(log))
        return [];
    return log
        .filter((e) => e && typeof e === 'object' && 'action' in e && 'by' in e && 'at' in e)
        .map((e) => e);
}
export function appendAuditEntry(metadata, entry) {
    const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};
    const log = readAuditLog(base);
    log.push({
        ...entry,
        at: entry.at ?? new Date().toISOString(),
    });
    return { ...base, auditLog: log };
}
export function formatAuditLabel(entry) {
    const who = entry.by || 'system';
    const when = formatDt(entry.at);
    switch (entry.action) {
        case 'created':
            return `Created by ${who} · ${when}`;
        case 'updated':
            return `Edited by ${who}${entry.fields?.length ? ` (${entry.fields.join(', ')})` : ''} · ${when}`;
        case 'submitted':
            return `Submitted for approval by ${who} · ${when}`;
        case 'approved':
            return `Approved by ${who} · ${when}`;
        case 'rejected':
            return `Rejected by ${who}${entry.note ? ` — ${entry.note}` : ''} · ${when}`;
        case 'communicated':
            return `Sent to farmer by ${who} · ${when}`;
        case 'cancelled':
            return `Cancelled by ${who} · ${when}`;
        default:
            return `${entry.action} · ${who} · ${when}`;
    }
}
function formatDt(iso) {
    try {
        return new Date(iso).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    }
    catch {
        return iso;
    }
}
//# sourceMappingURL=recommendation-audit.util.js.map