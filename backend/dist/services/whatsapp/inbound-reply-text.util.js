function messageBlob(msg, raw) {
    const message = (raw?.message ?? msg);
    return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}) };
}
/** Button / list reply from WhatsApp interactive messages — prefer stable ids (e.g. lang.en). */
export function extractInteractiveReplyText(interactive) {
    if (!interactive)
        return null;
    const btn = interactive.button_reply;
    const list = interactive.list_reply;
    const id = btn?.id ?? list?.id;
    if (id?.trim())
        return id.trim();
    const title = btn?.title ?? list?.title;
    return title?.trim() ? title.trim() : null;
}
/** Meta quick-reply / template button (type "button", not interactive). */
function extractLegacyButtonText(blob) {
    const button = blob.button;
    const payload = button?.payload?.trim();
    if (payload)
        return payload;
    const text = button?.text?.trim();
    return text || null;
}
function extractInteractiveFromBlob(blob) {
    const direct = extractInteractiveReplyText(blob.interactive);
    if (direct)
        return direct;
    const nestedMessage = blob.message;
    if (nestedMessage) {
        const fromNested = extractInteractiveReplyText(nestedMessage.interactive);
        if (fromNested)
            return fromNested;
        const legacy = extractLegacyButtonText(nestedMessage);
        if (legacy)
            return legacy;
    }
    return extractLegacyButtonText(blob);
}
/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export function resolveInboundUserText(msg) {
    const trimmed = msg.text?.trim();
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const interactiveText = extractInteractiveFromBlob(blob);
    if (interactiveText)
        return interactiveText;
    if (trimmed)
        return trimmed;
    const textObj = blob.text;
    if (textObj?.body?.trim())
        return textObj.body.trim();
    if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
        return blob.message_body.trim();
    }
    if (typeof blob.body === 'string' && blob.body.trim())
        return blob.body.trim();
    return '';
}
//# sourceMappingURL=inbound-reply-text.util.js.map