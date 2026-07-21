import type { InboundMessage } from './pipeline/types.js';

function messageBlob(
  msg?: Record<string, unknown>,
  raw?: Record<string, unknown>
): Record<string, unknown> {
  const message = (raw?.message ?? msg) as Record<string, unknown> | undefined;
  return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}) };
}

/** Button / list reply from WhatsApp interactive messages — prefer stable ids (e.g. lang.en). */
export function extractInteractiveReplyText(
  interactive: Record<string, unknown> | undefined
): string | null {
  if (!interactive) return null;
  const btn = interactive.button_reply as Record<string, string> | undefined;
  const list = interactive.list_reply as Record<string, string> | undefined;
  const id = btn?.id ?? list?.id;
  if (id?.trim()) return id.trim();
  const title = btn?.title ?? list?.title;
  return title?.trim() ? title.trim() : null;
}

/** Meta quick-reply / template button (type "button", not interactive). */
function extractLegacyButtonText(blob: Record<string, unknown>): string | null {
  const button = blob.button as Record<string, string> | undefined;
  const payload = button?.payload?.trim();
  if (payload) return payload;
  const text = button?.text?.trim();
  return text || null;
}

function extractInteractiveFromBlob(blob: Record<string, unknown>): string | null {
  const direct = extractInteractiveReplyText(blob.interactive as Record<string, unknown> | undefined);
  if (direct) return direct;

  const nestedMessage = blob.message as Record<string, unknown> | undefined;
  if (nestedMessage) {
    const fromNested = extractInteractiveReplyText(
      nestedMessage.interactive as Record<string, unknown> | undefined
    );
    if (fromNested) return fromNested;
    const legacy = extractLegacyButtonText(nestedMessage);
    if (legacy) return legacy;
  }

  return extractLegacyButtonText(blob);
}

/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export function resolveInboundUserText(msg: InboundMessage): string {
  const trimmed = msg.text?.trim();
  const blob = messageBlob(msg.messageObject, msg.rawPayload);

  const interactiveText = extractInteractiveFromBlob(blob);
  if (interactiveText) return interactiveText;

  if (trimmed) return trimmed;

  const textObj = blob.text as Record<string, string> | undefined;
  if (textObj?.body?.trim()) return textObj.body.trim();
  if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
    return blob.message_body.trim();
  }
  if (typeof blob.body === 'string' && blob.body.trim()) return blob.body.trim();

  return '';
}
