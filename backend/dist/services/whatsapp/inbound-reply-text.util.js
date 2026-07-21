const LANGUAGE_CODES = new Set(['en', 'ml', 'ta', 'kn', 'hi']);
const LANGUAGE_TITLE_TO_CODE = {
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
const TITLE_TO_SELECTION_ID = {
    english: 'lang.en',
    malayalam: 'lang.ml',
    tamil: 'lang.ta',
    kannada: 'lang.kn',
    hindi: 'lang.hi',
    '0-1 acre': 'acreage.0_1',
    '2-5 acre': 'acreage.2_5',
    '5+ acre': 'acreage.5_plus',
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
const SELECTION_ID_PATTERN = /^(lang|acreage|crop|menu|roi|dfq|plot|acreage|farm)\.[a-z0-9_]+$/i;
function isWhatsAppMessageId(value) {
    const trimmed = value.trim();
    return /^wamid\./i.test(trimmed) || /^[a-f0-9-]{24,}$/i.test(trimmed);
}
function selectionFromReplyValue(raw) {
    const trimmed = raw.trim();
    if (!trimmed || isWhatsAppMessageId(trimmed))
        return null;
    if (SELECTION_ID_PATTERN.test(trimmed))
        return trimmed;
    const mapped = mapTitleToSelectionId(trimmed);
    if (mapped)
        return mapped;
    const langMatch = trimmed.match(/^lang\.(en|ml|ta|kn|hi)$/i);
    if (langMatch)
        return `lang.${langMatch[1].toLowerCase()}`;
    return null;
}
function messageBlob(msg, raw) {
    const message = (raw?.message ?? msg);
    const nested = raw?.webhook?.entry;
    return { ...(raw ?? {}), ...(message ?? {}), ...(msg ?? {}), ...(nested ? { entry: nested } : {}) };
}
function languageFromLabel(label) {
    const key = label.trim().toLowerCase();
    if (key === 'hi' || key === 'hello')
        return null;
    return LANGUAGE_TITLE_TO_CODE[key] ?? null;
}
function languageFromButtonId(id) {
    const match = id.trim().match(/^lang\.(en|ml|ta|kn|hi)$/i);
    if (!match)
        return null;
    const code = match[1].toLowerCase();
    return LANGUAGE_CODES.has(code) ? code : null;
}
function mapTitleToSelectionId(label) {
    const key = label.trim().toLowerCase();
    if (TITLE_TO_SELECTION_ID[key])
        return TITLE_TO_SELECTION_ID[key];
    if (SELECTION_ID_PATTERN.test(label.trim()))
        return label.trim();
    const lang = languageFromLabel(label);
    return lang ? `lang.${lang}` : null;
}
function normalizeSelectionValue(raw) {
    const trimmed = raw.trim();
    const mapped = mapTitleToSelectionId(trimmed);
    return mapped ?? trimmed;
}
/** Button / list reply — prefer stable ids (lang.en, acreage.0_1, menu.crop_assessment, …). */
export function extractInteractiveReplyText(interactive) {
    if (!interactive)
        return null;
    const asFlat = extractFlatReply(interactive);
    if (asFlat)
        return asFlat;
    const btn = interactive.button_reply;
    const list = interactive.list_reply;
    const id = btn?.id ?? list?.id;
    if (id?.trim())
        return id.trim();
    const title = btn?.title ?? list?.title;
    return title?.trim() ? title.trim() : null;
}
function extractFlatReply(blob) {
    const btn = blob.button_reply;
    const list = blob.list_reply;
    if (btn?.id?.trim()) {
        const fromId = selectionFromReplyValue(btn.id);
        if (fromId)
            return fromId;
        return btn.id.trim();
    }
    if (list?.id?.trim()) {
        const fromId = selectionFromReplyValue(list.id);
        if (fromId)
            return fromId;
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
    const directId = blob.id;
    const directTitle = blob.title;
    if (typeof directId === 'string') {
        const fromId = selectionFromReplyValue(directId);
        if (fromId)
            return fromId;
    }
    if (typeof directTitle === 'string' && directTitle.trim()) {
        const mapped = mapTitleToSelectionId(directTitle);
        if (mapped)
            return mapped;
    }
    return null;
}
function extractLegacyButtonText(blob) {
    const button = blob.button;
    const payload = button?.payload?.trim();
    if (payload)
        return payload;
    const text = button?.text?.trim();
    return text || null;
}
function extractInteractiveFromBlob(blob) {
    const flat = extractFlatReply(blob);
    if (flat)
        return flat;
    const direct = extractInteractiveReplyText(blob.interactive);
    if (direct)
        return direct;
    const nestedMessage = blob.message;
    if (nestedMessage) {
        const nestedFlat = extractFlatReply(nestedMessage);
        if (nestedFlat)
            return nestedFlat;
        const fromNested = extractInteractiveReplyText(nestedMessage.interactive);
        if (fromNested)
            return fromNested;
        const legacy = extractLegacyButtonText(nestedMessage);
        if (legacy)
            return legacy;
    }
    return extractLegacyButtonText(blob);
}
function languageFromReplyValue(value) {
    return languageFromButtonId(value) ?? languageFromLabel(value);
}
/** Walk webhook JSON for any known selection id or mappable button title. */
export function deepFindSelectionReply(payload) {
    const seen = new Set();
    const walk = (node) => {
        if (node == null)
            return null;
        if (typeof node === 'string') {
            const trimmed = node.trim();
            if (SELECTION_ID_PATTERN.test(trimmed))
                return trimmed;
            const mapped = mapTitleToSelectionId(trimmed);
            if (mapped)
                return mapped;
            const langOnly = trimmed.match(/^lang\.(en|ml|ta|kn|hi)$/i);
            if (langOnly)
                return `lang.${langOnly[1].toLowerCase()}`;
            return null;
        }
        if (typeof node !== 'object')
            return null;
        if (seen.has(node))
            return null;
        seen.add(node);
        const rec = node;
        const flat = extractFlatReply(rec);
        if (flat) {
            const normalized = normalizeSelectionValue(flat);
            if (normalized && !isLanguageMenuEcho(normalized))
                return normalized;
        }
        for (const key of ['id', 'button_id', 'payload', 'button_payload', 'title', 'description']) {
            const val = rec[key];
            if (typeof val === 'string') {
                const selection = selectionFromReplyValue(val);
                if (selection)
                    return selection;
                if (key === 'title' || key === 'description') {
                    const mapped = mapTitleToSelectionId(val);
                    if (mapped)
                        return mapped;
                }
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
/** @deprecated use deepFindSelectionReply */
export function deepFindLanguageButtonId(payload) {
    const found = deepFindSelectionReply(payload);
    if (!found?.startsWith('lang.'))
        return null;
    return found;
}
export function isLanguageMenuEcho(text) {
    const t = text.trim().toLowerCase();
    return (t.includes('welcome to morbeez agriculture assistant') &&
        t.includes('please select your language'));
}
export function isInteractiveInbound(msg) {
    const t = String(msg.msgType ?? '').toLowerCase();
    return t === 'interactive' || t === 'button' || t === 'list';
}
export function hasInteractiveUserReply(msg) {
    if (isInteractiveInbound(msg))
        return true;
    if (extractInboundSelectionReply(msg))
        return true;
    return false;
}
/**
 * Extract farmer selection from button/list tap (preferred over typed text).
 * Returns stable id string e.g. lang.en, acreage.2_5, menu.crop_assessment.
 */
export function extractInboundSelectionReply(msg) {
    if (msg.messageObject) {
        const fromCloud = parseMetaCloudMessageObject(msg.messageObject);
        if (fromCloud.trim()) {
            const normalized = normalizeSelectionValue(fromCloud);
            if (!isLanguageMenuEcho(normalized))
                return normalized;
        }
    }
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    const fromBlob = extractInteractiveFromBlob(blob);
    if (fromBlob) {
        const normalized = normalizeSelectionValue(fromBlob);
        if (!isLanguageMenuEcho(normalized))
            return normalized;
    }
    const deep = deepFindSelectionReply(msg.rawPayload) ?? deepFindSelectionReply(msg.messageObject);
    if (deep)
        return deep;
    return null;
}
/** Parse Meta Cloud API message object (messages[0]). */
export function parseMetaCloudMessageObject(msg) {
    const interactive = msg.interactive;
    const fromInteractive = extractInteractiveReplyText(interactive);
    if (fromInteractive)
        return normalizeSelectionValue(fromInteractive);
    const fromFlat = extractFlatReply(msg);
    if (fromFlat)
        return normalizeSelectionValue(fromFlat);
    const button = msg.button;
    if (button?.payload?.trim())
        return normalizeSelectionValue(button.payload);
    if (button?.text?.trim())
        return normalizeSelectionValue(button.text);
    const textBody = msg.text?.body?.trim();
    if (textBody && !isLanguageMenuEcho(textBody))
        return textBody;
    const deep = deepFindSelectionReply(msg);
    return deep ?? '';
    // Note: do not fall back to echoed bot menu body for interactive-only payloads.
}
export function detectInboundLanguageChoice(msg) {
    const selection = extractInboundSelectionReply(msg);
    if (selection) {
        const fromSelection = languageFromReplyValue(selection);
        if (fromSelection)
            return fromSelection;
    }
    const trimmed = msg.text?.trim() ?? '';
    if (trimmed && !isLanguageMenuEcho(trimmed)) {
        const fromText = languageFromReplyValue(trimmed);
        if (fromText)
            return fromText;
    }
    return null;
}
/**
 * Resolve farmer intent: button/list selection first, then typed text.
 */
export function resolveInboundUserText(msg) {
    const selection = extractInboundSelectionReply(msg);
    if (selection)
        return selection;
    const trimmed = msg.text?.trim() ?? '';
    if (trimmed && !isLanguageMenuEcho(trimmed))
        return trimmed;
    const blob = messageBlob(msg.messageObject, msg.rawPayload);
    if (!isInteractiveInbound(msg)) {
        const textObj = blob.text;
        if (textObj?.body?.trim() && !isLanguageMenuEcho(textObj.body))
            return textObj.body.trim();
        if (typeof blob.message_body === 'string' && blob.message_body.trim()) {
            const body = blob.message_body.trim();
            if (!isLanguageMenuEcho(body))
                return body;
        }
    }
    return '';
}
/** Apply button/list selection onto inbound message before routing. */
export function withInboundSelectionText(msg) {
    const resolved = resolveInboundUserText(msg);
    if (!resolved)
        return msg;
    return { ...msg, text: resolved };
}
//# sourceMappingURL=inbound-reply-text.util.js.map