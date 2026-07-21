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
/** Walk entire webhook JSON — BSPs nest button_reply in non-standard places. */
export function deepFindLanguageButtonId(payload) {
    const seen = new Set();
    const walk = (node) => {
        if (node == null)
            return null;
        if (typeof node === 'string') {
            const match = node.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
            return match ? `lang.${match[1].toLowerCase()}` : null;
        }
        if (typeof node !== 'object')
            return null;
        if (seen.has(node))
            return null;
        seen.add(node);
        const rec = node;
        for (const key of ['id', 'button_id', 'payload', 'button_payload']) {
            const val = rec[key];
            if (typeof val === 'string') {
                const match = val.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
                if (match)
                    return `lang.${match[1].toLowerCase()}`;
            }
        }
        for (const val of Object.values(rec)) {
            const found = walk(val);
            if (found)
                return found;
        }
        return null;
    };
    return walk(payload);
}
export function isLanguageMenuEcho(text) {
    const t = text.trim().toLowerCase();
    return (t.includes('welcome to morbeez agriculture assistant') &&
        t.includes('please select your language'));
}
export function hasInteractiveUserReply(msg) {
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    if (extractInteractiveFromBlob(blob))
        return true;
    if (deepFindLanguageButtonId(msg.rawPayload))
        return true;
    if (deepFindLanguageButtonId(msg.messageObject))
        return true;
    return false;
}
/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export function resolveInboundUserText(msg) {
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const deepLang = deepFindLanguageButtonId(msg.rawPayload) ?? deepFindLanguageButtonId(msg.messageObject);
    if (deepLang)
        return deepLang;
    const interactiveText = extractInteractiveFromBlob(blob);
    if (interactiveText)
        return interactiveText;
    const trimmed = msg.text?.trim() ?? '';
    if (trimmed && !isLanguageMenuEcho(trimmed))
        return trimmed;
    const textObj = blob.text;
    if (textObj?.body?.trim() && !isLanguageMenuEcho(textObj.body))
        return textObj.body.trim();
    if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
        const body = blob.message_body.trim();
        if (!isLanguageMenuEcho(body))
            return body;
    }
    if (typeof blob.body === 'string' && blob.body.trim()) {
        const body = blob.body.trim();
        if (!isLanguageMenuEcho(body))
            return body;
    }
    return trimmed;
}
//# sourceMappingURL=inbound-reply-text.util.js.map