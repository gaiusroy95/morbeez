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
};

/** Map visible button labels → stable reply ids used by scenario routers. */
const TITLE_TO_SELECTION_ID: Record<string, string> = {
  english: 'lang.en',
  malayalam: 'lang.ml',
  tamil: 'lang.ta',
  kannada: 'lang.kn',
  hindi: 'lang.hi',
  '0-1 acre': 'acreage.0_1',
  '2-5 acre': 'acreage.2_5',
  '5+ acre': 'acreage.5_plus',
  'ginger plot': 'crop.ginger',
  'banana plot': 'crop.banana',
  'cardamom plot': 'crop.cardamom',
  'pepper plot': 'crop.pepper',
  ginger: 'crop.ginger',
  banana: 'crop.banana',
  cardamom: 'crop.cardamom',
  pepper: 'crop.pepper',
  'crop assessment': 'menu.crop_assessment',
  'roi tracker': 'menu.roi_tracker',
  'call back': 'menu.expert',
  more: 'menu.more',
  'track order': 'menu.track_order',
  weather: 'menu.weather',
  'market price': 'menu.prices',
  'soil test': 'menu.soil',
  'previous advice': 'menu.prev_recommendations',
  'farm ledger': 'menu.ledger',
  others: 'crop.other',
  labour: 'roi.labour',
  purchase: 'roi.purchase',
  misc: 'roi.misc',
  harvest: 'roi.harvest',
  finish: 'roi.finish',
};

const SELECTION_ID_PATTERN =
  /^(lang|acreage|crop|menu|roi|dfq|plot|acreage|farm)\.[a-z0-9_]+$/i;

function isWhatsAppMessageId(value: string): boolean {
  const trimmed = value.trim();
  return /^wamid\./i.test(trimmed) || /^[a-f0-9-]{24,}$/i.test(trimmed);
}

function selectionFromReplyValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || isWhatsAppMessageId(trimmed)) return null;
  if (SELECTION_ID_PATTERN.test(trimmed)) return trimmed;
  const mapped = mapTitleToSelectionId(trimmed);
  if (mapped) return mapped;
  const langMatch = trimmed.match(/^lang\.(en|ml|ta|kn|hi)$/i);
  if (langMatch) return `lang.${langMatch[1].toLowerCase()}`;
  return null;
}

function messageBlob(
  msg?: Record<string, unknown>,
  raw?: Record<string, unknown>
): Record<string, unknown> {
  const message = (raw?.message ?? msg) as Record<string, unknown> | undefined;
  const nested = (raw?.webhook as Record<string, unknown> | undefined)?.entry;
  return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}), ...(nested ? { entry: nested } : {}) };
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

function mapTitleToSelectionId(label: string): string | null {
  const key = label.trim().toLowerCase();
  if (TITLE_TO_SELECTION_ID[key]) return TITLE_TO_SELECTION_ID[key];
  if (SELECTION_ID_PATTERN.test(label.trim())) return label.trim();
  const lang = languageFromLabel(label);
  return lang ? `lang.${lang}` : null;
}

function normalizeSelectionValue(raw: string): string {
  const trimmed = raw.trim();
  const mapped = mapTitleToSelectionId(trimmed);
  return mapped ?? trimmed;
}

const BOT_PROMPT_MARKERS = [
  'how many acres',
  'which plot',
  'which plot is this for',
  'please choose',
  'please select your language',
  'welcome to morbeez',
  'more options',
  'tap a button',
  'enter your 6-digit',
  '6-digit pincode',
  'planting date',
  'ddmmyyyy',
];

/** Bot menu / prompt text echoed in quoted reply payloads — not the farmer's choice. */
export function isBotPromptEcho(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (isLanguageMenuEcho(text)) return true;
  return BOT_PROMPT_MARKERS.some((m) => t.includes(m));
}

/**
 * BSPs often send button taps as multi-line quoted text:
 *   "How many acres are under cultivation?\n2-5 acre"
 * Prefer the last non-prompt line that maps to a known selection.
 */
export function selectionFromMultilineText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const wholeMapped = selectionFromReplyValue(trimmed) ?? mapTitleToSelectionId(trimmed);
  if (wholeMapped && !isBotPromptEcho(wholeMapped)) return wholeMapped;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (isBotPromptEcho(line)) continue;
    const mapped = selectionFromReplyValue(line) ?? mapTitleToSelectionId(line);
    if (mapped) return mapped;
    if (SELECTION_ID_PATTERN.test(line)) return line;
  }
  return null;
}

/** Button / list reply — prefer stable ids (lang.en, acreage.0_1, menu.crop_assessment, …). */
export function extractInteractiveReplyText(
  interactive: Record<string, unknown> | undefined
): string | null {
  if (!interactive) return null;

  const asFlat = extractFlatReply(interactive);
  if (asFlat) return asFlat;

  const btn = interactive.button_reply as Record<string, string> | undefined;
  const list = interactive.list_reply as Record<string, string> | undefined;
  const id = btn?.id ?? list?.id;
  if (id?.trim()) return id.trim();
  const title = btn?.title ?? list?.title;
  return title?.trim() ? title.trim() : null;
}

function extractFlatReply(blob: Record<string, unknown>): string | null {
  const btn = blob.button_reply as Record<string, string> | undefined;
  const list = blob.list_reply as Record<string, string> | undefined;
  const reply = blob.reply as Record<string, string> | undefined;
  if (btn?.id?.trim()) {
    const fromId = selectionFromReplyValue(btn.id);
    if (fromId) return fromId;
    return btn.id.trim();
  }
  if (list?.id?.trim()) {
    const fromId = selectionFromReplyValue(list.id);
    if (fromId) return fromId;
    return list.id.trim();
  }
  if (btn?.title?.trim()) {
    const mapped = mapTitleToSelectionId(btn.title) ?? btn.title.trim();
    return mapped;
  }
  if (list?.title?.trim()) {
    const mapped = mapTitleToSelectionId(list.title) ?? list.title.trim();
    return mapped;
  }
  if (reply?.id?.trim()) {
    const fromId = selectionFromReplyValue(reply.id);
    if (fromId) return fromId;
    return reply.id.trim();
  }
  if (reply?.title?.trim()) {
    const mapped = mapTitleToSelectionId(reply.title) ?? reply.title.trim();
    return mapped;
  }

  const directId = blob.id;
  const directTitle = blob.title;
  if (typeof directId === 'string') {
    const fromId = selectionFromReplyValue(directId);
    if (fromId) return fromId;
  }
  if (typeof directTitle === 'string' && directTitle.trim()) {
    const mapped = mapTitleToSelectionId(directTitle);
    if (mapped) return mapped;
  }
  return null;
}

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

  for (const key of [
    'selected_button',
    'button_response',
    'button_text',
    'selected_reply',
    'selected_id',
    'button_payload',
  ] as const) {
    const val = blob[key];
    if (typeof val === 'string' && val.trim()) {
      const mapped = selectionFromReplyValue(val) ?? mapTitleToSelectionId(val);
      if (mapped) return mapped;
    }
    if (val && typeof val === 'object') {
      const nested = extractFlatReply(val as Record<string, unknown>);
      if (nested) return nested;
    }
  }

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

/** Walk webhook JSON for any known selection id or mappable button title. */
export function deepFindSelectionReply(payload: unknown): string | null {
  const seen = new Set<unknown>();

  const walk = (node: unknown): string | null => {
    if (node == null) return null;
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (SELECTION_ID_PATTERN.test(trimmed)) return trimmed;
      const mapped = mapTitleToSelectionId(trimmed);
      if (mapped) return mapped;
      const langOnly = trimmed.match(/^lang\.(en|ml|ta|kn|hi)$/i);
      if (langOnly) return `lang.${langOnly[1].toLowerCase()}`;
      return null;
    }
    if (typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);

    const rec = node as Record<string, unknown>;

    const flat = extractFlatReply(rec);
    if (flat) {
      const normalized = normalizeSelectionValue(flat);
      if (normalized && !isLanguageMenuEcho(normalized)) return normalized;
    }

    for (const key of ['id', 'button_id', 'payload', 'button_payload', 'title', 'description'] as const) {
      const val = rec[key];
      if (typeof val === 'string') {
        const selection = selectionFromReplyValue(val);
        if (selection) return selection;
        if (key === 'title' || key === 'description') {
          const mapped = mapTitleToSelectionId(val);
          if (mapped) return mapped;
        }
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

/** @deprecated use deepFindSelectionReply */
export function deepFindLanguageButtonId(payload: unknown): string | null {
  const found = deepFindSelectionReply(payload);
  if (!found?.startsWith('lang.')) return null;
  return found;
}

export function isLanguageMenuEcho(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.includes('welcome to morbeez agriculture assistant') &&
    t.includes('please select your language')
  );
}

export function isInteractiveInbound(msg: InboundMessage): boolean {
  const t = String(msg.msgType ?? '').toLowerCase();
  return t === 'interactive' || t === 'button' || t === 'list';
}

export function hasInteractiveUserReply(msg: InboundMessage): boolean {
  if (isInteractiveInbound(msg)) return true;
  if (extractInboundSelectionReply(msg)) return true;
  return false;
}

/**
 * Extract farmer selection from button/list tap (preferred over typed text).
 * Returns stable id string e.g. lang.en, acreage.2_5, menu.crop_assessment.
 */
export function extractInboundSelectionReply(msg: InboundMessage): string | null {
  if (msg.messageObject) {
    const fromCloud = parseMetaCloudMessageObject(msg.messageObject);
    if (fromCloud.trim()) {
      const normalized = normalizeSelectionValue(fromCloud);
      if (!isLanguageMenuEcho(normalized)) return normalized;
    }
  }

  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const fromBlob = extractInteractiveFromBlob(blob);
  if (fromBlob) {
    const normalized = normalizeSelectionValue(fromBlob);
    if (!isLanguageMenuEcho(normalized)) return normalized;
  }

  const deep =
    deepFindSelectionReply(msg.rawPayload) ?? deepFindSelectionReply(msg.messageObject);
  if (deep) return deep;

  return null;
}

/** Parse Meta Cloud API message object (messages[0]). */
export function parseMetaCloudMessageObject(msg: Record<string, unknown>): string {
  const interactive = msg.interactive as Record<string, unknown> | undefined;

  const fromInteractive = extractInteractiveReplyText(interactive);
  if (fromInteractive) return normalizeSelectionValue(fromInteractive);

  const fromFlat = extractFlatReply(msg);
  if (fromFlat) return normalizeSelectionValue(fromFlat);

  const button = msg.button as Record<string, string> | undefined;
  if (button?.payload?.trim()) return normalizeSelectionValue(button.payload);
  if (button?.text?.trim()) return normalizeSelectionValue(button.text);

  const textBody = (msg.text as Record<string, string> | undefined)?.body?.trim();
  if (textBody && !isLanguageMenuEcho(textBody)) return textBody;

  const deep = deepFindSelectionReply(msg);
  return deep ?? '';

  // Note: do not fall back to echoed bot menu body for interactive-only payloads.
}

export function detectInboundLanguageChoice(msg: InboundMessage): AdvisoryLanguage | null {
  const selection = extractInboundSelectionReply(msg);
  if (selection) {
    const fromSelection = languageFromReplyValue(selection);
    if (fromSelection) return fromSelection;
  }

  const trimmed = msg.text?.trim() ?? '';
  if (trimmed && !isLanguageMenuEcho(trimmed)) {
    const fromText = languageFromReplyValue(trimmed);
    if (fromText) return fromText;
  }

  return null;
}

/**
 * Resolve farmer intent: button/list selection first, then typed text.
 */
export function resolveInboundUserText(msg: InboundMessage): string {
  const selection = extractInboundSelectionReply(msg);
  if (selection) return selection;

  const trimmed = msg.text?.trim() ?? '';
  if (trimmed) {
    const fromLines = selectionFromMultilineText(trimmed);
    if (fromLines) return fromLines;
    if (!isBotPromptEcho(trimmed)) return trimmed;
  }

  const blob = messageBlob(msg.messageObject, msg.rawPayload);
  const body =
    typeof blob.message_body === 'string'
      ? blob.message_body.trim()
      : (blob.text as Record<string, string> | undefined)?.body?.trim() ?? '';
  if (body) {
    const fromBody = selectionFromMultilineText(body);
    if (fromBody) return fromBody;
    if (!isInteractiveInbound(msg) && !isBotPromptEcho(body)) return body;
  }

  if (!isInteractiveInbound(msg)) {
    const textObj = blob.text as Record<string, string> | undefined;
    if (textObj?.body?.trim() && !isBotPromptEcho(textObj.body)) return textObj.body.trim();
  }

  return '';
}

/** Apply button/list selection onto inbound message before routing. */
export function withInboundSelectionText(msg: InboundMessage): InboundMessage {
  const resolved = resolveInboundUserText(msg);
  if (!resolved) return msg;
  return { ...msg, text: resolved };
}
