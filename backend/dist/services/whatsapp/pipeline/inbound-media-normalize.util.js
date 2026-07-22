import { extractInboundSelectionReply, isInteractiveInbound, resolveInboundUserText, } from '../inbound-reply-text.util.js';
const IMAGE_MSG_TYPES = new Set([
    'image',
    'image_message',
    'photo',
    'picture',
    'media',
    'document',
]);
function messageBlob(msg, raw) {
    const message = (raw?.message ?? msg);
    return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}) };
}
/** True when webhook payload carries image bytes or a fetchable image URL. */
export function hasInboundImageAttachment(msg) {
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const image = blob.image;
    if (image?.id || image?.url)
        return true;
    if (typeof blob.media_url === 'string' && blob.media_url.length > 8)
        return true;
    if (typeof blob.header_image === 'string' && blob.header_image.length > 8)
        return true;
    if (typeof blob.media_id === 'string' || typeof blob.media_id === 'number')
        return true;
    const doc = blob.document;
    const docMime = String(doc?.mime_type ?? '');
    if (docMime.startsWith('image/'))
        return true;
    const t = String(blob.type ?? blob.message_type ?? msg.msgType ?? '').toLowerCase();
    return IMAGE_MSG_TYPES.has(t) && (Boolean(image) || Boolean(blob.media_url));
}
export function normalizeInboundMsgType(msg) {
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const rawType = String(msg.msgType ?? blob.type ?? blob.message_type ?? 'text').toLowerCase();
    if (hasInboundImageAttachment(msg)) {
        const docMime = String(blob.document?.mime_type ?? '');
        if (rawType === 'document' && !docMime.startsWith('image/'))
            return 'document';
        return 'image';
    }
    if (IMAGE_MSG_TYPES.has(rawType))
        return 'image';
    return rawType || 'text';
}
/** Caption / symptom text sent together with an image (not button taps). */
export function extractInboundCaption(msg) {
    if (isInteractiveInbound(msg)) {
        return extractInboundSelectionReply(msg) ?? '';
    }
    const existing = msg.text?.trim();
    if (existing)
        return existing;
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const image = blob.image;
    if (image?.caption?.trim())
        return image.caption.trim();
    if (typeof blob.caption === 'string' && blob.caption.trim())
        return blob.caption.trim();
    const text = blob.text;
    if (text?.body?.trim())
        return text.body.trim();
    return '';
}
export function withNormalizedMediaFields(msg) {
    const msgType = normalizeInboundMsgType(msg);
    const selection = extractInboundSelectionReply(msg);
    const text = selection || resolveInboundUserText(msg) || extractInboundCaption(msg) || msg.text;
    return { ...msg, msgType, text };
}
//# sourceMappingURL=inbound-media-normalize.util.js.map