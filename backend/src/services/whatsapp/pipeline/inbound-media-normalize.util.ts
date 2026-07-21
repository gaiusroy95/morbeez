import type { InboundMessage } from './types.js';
import { resolveInboundUserText } from '../inbound-reply-text.util.js';

const IMAGE_MSG_TYPES = new Set([
  'image',
  'image_message',
  'photo',
  'picture',
  'media',
  'document',
]);

function messageBlob(msg?: Record<string, unknown>, raw?: Record<string, unknown>): Record<string, unknown> {
  const message = (raw?.message ?? msg) as Record<string, unknown> | undefined;
  return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}) };
}

/** True when webhook payload carries image bytes or a fetchable image URL. */
export function hasInboundImageAttachment(msg: InboundMessage): boolean {
  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const image = blob.image as Record<string, unknown> | undefined;
  if (image?.id || image?.url) return true;
  if (typeof blob.media_url === 'string' && blob.media_url.length > 8) return true;
  if (typeof blob.header_image === 'string' && blob.header_image.length > 8) return true;
  if (typeof blob.media_id === 'string' || typeof blob.media_id === 'number') return true;

  const doc = blob.document as Record<string, unknown> | undefined;
  const docMime = String(doc?.mime_type ?? '');
  if (docMime.startsWith('image/')) return true;

  const t = String(blob.type ?? blob.message_type ?? msg.msgType ?? '').toLowerCase();
  return IMAGE_MSG_TYPES.has(t) && (Boolean(image) || Boolean(blob.media_url));
}

export function normalizeInboundMsgType(msg: InboundMessage): string {
  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const rawType = String(
    msg.msgType ?? blob.type ?? blob.message_type ?? 'text'
  ).toLowerCase();

  if (hasInboundImageAttachment(msg)) {
    const docMime = String((blob.document as Record<string, unknown> | undefined)?.mime_type ?? '');
    if (rawType === 'document' && !docMime.startsWith('image/')) return 'document';
    return 'image';
  }

  if (IMAGE_MSG_TYPES.has(rawType)) return 'image';
  return rawType || 'text';
}

/** Caption / symptom text sent together with an image. */
export function extractInboundCaption(msg: InboundMessage): string {
  const existing = msg.text?.trim();
  if (existing) return existing;

  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const image = blob.image as Record<string, string> | undefined;
  if (image?.caption?.trim()) return image.caption.trim();
  if (typeof blob.caption === 'string' && blob.caption.trim()) return blob.caption.trim();
  if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
    return blob.message_body.trim();
  }
  if (typeof blob.body === 'string' && blob.body.trim()) return blob.body.trim();
  const text = blob.text as Record<string, string> | undefined;
  if (text?.body?.trim()) return text.body.trim();

  return '';
}

export function withNormalizedMediaFields(msg: InboundMessage): InboundMessage {
  const msgType = normalizeInboundMsgType(msg);
  const text = resolveInboundUserText(msg) || extractInboundCaption(msg) || msg.text;
  return { ...msg, msgType, text };
}
