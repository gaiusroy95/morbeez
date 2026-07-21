import type { InboundMessage } from './pipeline/types.js';
import type { AdvisoryLanguage } from '../ai/types.js';

const LANGUAGE_CODES = new Set(['en', 'ml', 'ta', 'kn', 'hi']);

const LANGUAGE_TITLE_TO_CODE: Record<string, AdvisoryLanguage> = {
  english: 'en',
  en: 'en',
  malayalam: 'ml',
  ml: 'ml',
  tamil: 'ta',
  ta: 'ta',
  kannada: 'kn',
  kn: 'kn',
  hindi: 'hi',
  hi: 'hi',
};

function messageBlob(
  msg?: Record<string, unknown>,
  raw?: Record<string, unknown>
): Record<string, unknown> {
  const message = (raw?.message ?? msg) as Record<string, unknown> | undefined;
  return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}) };
}

function languageFromLabel(label: string): AdvisoryLanguage | null {
  const key = label.trim().toLowerCase();
  if (key === 'hi' || key === 'hello') return null;
  return LANGUAGE_TITLE_TO_CODE[key] ?? null;
}

function languageFromButtonId(id: string): AdvisoryLanguage | null {
  const match = id.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
  if (!match) return null;
  const code = match[1].toLowerCase() as AdvisoryLanguage;
  return LANGUAGE_CODES.has(code) ? code : null;
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

function extractFlatReply(blob: Record<string, unknown>): string | null {
  const directId = blob.id;
  const directTitle = blob.title;
  if (typeof directId === 'string' && directId.trim()) return directId.trim();
  if (typeof directTitle === 'string' && directTitle.trim()) return directTitle.trim();

  const btn = blob.button_reply as Record<string, string> | undefined;
  const list = blob.list_reply as Record<string, string> | undefined;
  if (btn?.id?.trim()) return btn.id.trim();
  if (list?.id?.trim()) return list.id.trim();
  if (btn?.title?.trim()) return btn.title.trim();
  if (list?.title?.trim()) return list.title.trim();
  return null;
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
  const flat = extractFlatReply(blob);
  if (flat) return flat;

  const direct = extractInteractiveReplyText(blob.interactive as Record<string, unknown> | undefined);
  if (direct) return direct;

  const nestedMessage = blob.message as Record<string, unknown> | undefined;
  if (nestedMessage) {
    const nestedFlat = extractFlatReply(nestedMessage);
    if (nestedFlat) return nestedFlat;
    const fromNested = extractInteractiveReplyText(
      nestedMessage.interactive as Record<string, unknown> | undefined
    );
    if (fromNested) return fromNested;
    const legacy = extractLegacyButtonText(nestedMessage);
    if (legacy) return legacy;
  }

  return extractLegacyButtonText(blob);
}

function languageFromReplyValue(value: string): AdvisoryLanguage | null {
  return languageFromButtonId(value) ?? languageFromLabel(value);
}

/** Walk entire webhook JSON — BSPs nest button_reply in non-standard places. */
export function deepFindLanguageButtonId(payload: unknown): string | null {
  const seen = new Set<unknown>();

  const walk = (node: unknown): string | null => {
    if (node == null) return null;
    if (typeof node === 'string') {
      const match = node.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
      if (match) return `lang.${match[1].toLowerCase()}`;
      const fromLabel = languageFromLabel(node);
      return fromLabel ? `lang.${fromLabel}` : null;
    }
    if (typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);

    const rec = node as Record<string, unknown>;

    const titleReply = extractFlatReply(rec);
    if (titleReply) {
      const fromReply = languageFromReplyValue(titleReply);
      if (fromReply) return `lang.${fromReply}`;
    }

    for (const key of ['id', 'button_id', 'payload', 'button_payload', 'title'] as const) {
      const val = rec[key];
      if (typeof val === 'string') {
        const match = val.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
        if (match) return `lang.${match[1].toLowerCase()}`;
        const fromLabel = languageFromLabel(val);
        if (fromLabel) return `lang.${fromLabel}`;
      }
    }

    for (const val of Object.values(rec)) {
      const found = walk(val);
      if (found) return found;
    }
    return null;
  };

  return walk(payload);
}

export function isLanguageMenuEcho(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes('welcome to morbeez agriculture assistant') &&
    t.includes('please select your language')
  );
}

export function hasInteractiveUserReply(msg: InboundMessage): boolean {
  if (msg.msgType === 'interactive' || msg.msgType === 'button') return true;
  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  if (extractInteractiveFromBlob(blob)) return true;
  if (deepFindLanguageButtonId(msg.rawPayload)) return true;
  if (deepFindLanguageButtonId(msg.messageObject)) return true;
  return false;
}

/** Parse Meta Cloud API message object (messages[0]) for farmer reply text. */
export function parseMetaCloudMessageObject(msg: Record<string, unknown>): string {
  const interactive = msg.interactive as Record<string, unknown> | undefined;

  const fromInteractive = extractInteractiveReplyText(interactive);
  if (fromInteractive) return fromInteractive;

  const fromFlat = extractFlatReply(msg);
  if (fromFlat) return fromFlat;

  const button = msg.button as Record<string, string> | undefined;
  if (button?.payload?.trim()) return button.payload.trim();
  if (button?.text?.trim()) return button.text.trim();

  const textBody = (msg.text as Record<string, string> | undefined)?.body?.trim();
  if (textBody) return textBody;

  const inbound: InboundMessage = {
    channel: 'whatsapp_cloud',
    phone: String(msg.from ?? ''),
    messageId: String(msg.id ?? ''),
    msgType: String(msg.type ?? 'text'),
    text: '',
    rawPayload: { message: msg },
    messageObject: msg,
  };
  return resolveInboundUserText(inbound);
}

/**
 * Detect language choice from any webhook shape (Cloud, AdsGyani, flattened button_reply).
 */
export function detectInboundLanguageChoice(msg: InboundMessage): AdvisoryLanguage | null {
  const deepId =
    deepFindLanguageButtonId(msg.rawPayload) ?? deepFindLanguageButtonId(msg.messageObject);
  if (deepId) {
    const code = languageFromButtonId(deepId);
    if (code) return code;
  }

  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const reply = extractInteractiveFromBlob(blob);
  if (reply) {
    const fromReply = languageFromReplyValue(reply);
    if (fromReply) return fromReply;
  }

  const trimmed = msg.text?.trim() ?? '';
  if (trimmed && !isLanguageMenuEcho(trimmed)) {
    const fromText = languageFromReplyValue(trimmed);
    if (fromText) return fromText;
  }

  return null;
}

/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export function resolveInboundUserText(msg: InboundMessage): string {
  const choice = detectInboundLanguageChoice(msg);
  if (choice) return `lang.${choice}`;

  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const interactiveText = extractInteractiveFromBlob(blob);
  if (interactiveText && !isLanguageMenuEcho(interactiveText)) return interactiveText;

  const trimmed = msg.text?.trim() ?? '';
  if (trimmed && !isLanguageMenuEcho(trimmed)) return trimmed;

  const textObj = blob.text as Record<string, string> | undefined;
  if (textObj?.body?.trim() && !isLanguageMenuEcho(textObj.body)) return textObj.body.trim();
  if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
    const body = blob.message_body.trim();
    if (!isLanguageMenuEcho(body)) return body;
  }
  if (typeof blob.body === 'string' && blob.body.trim()) {
    const body = blob.body.trim();
    if (!isLanguageMenuEcho(body)) return body;
  }

  return '';
}
