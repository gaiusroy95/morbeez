/**
 * Resolve follow-up due date from explicit datetime or phrases like "Recovery Check after 5 days".
 */
export function resolveNextActionDueAt(input) {
    if (input.nextActionAt?.trim()) {
        const d = new Date(input.nextActionAt);
        if (!Number.isNaN(d.getTime()))
            return d.toISOString();
    }
    const text = String(input.nextAction ?? '');
    const base = input.interactionAt ? new Date(input.interactionAt) : new Date();
    if (Number.isNaN(base.getTime()))
        return null;
    const daysMatch = text.match(/after\s+(\d+)\s+days?/i);
    if (daysMatch) {
        const days = Math.max(1, parseInt(daysMatch[1], 10));
        const due = new Date(base);
        due.setDate(due.getDate() + days);
        due.setHours(9, 0, 0, 0);
        return due.toISOString();
    }
    if (/monthly/i.test(text)) {
        const due = new Date(base);
        due.setMonth(due.getMonth() + 1);
        due.setHours(9, 0, 0, 0);
        return due.toISOString();
    }
    if (/close\s+workflow/i.test(text)) {
        return null;
    }
    if (text.trim()) {
        const due = new Date(base);
        due.setDate(due.getDate() + 3);
        due.setHours(9, 0, 0, 0);
        return due.toISOString();
    }
    return null;
}
//# sourceMappingURL=interaction-next-action.js.map