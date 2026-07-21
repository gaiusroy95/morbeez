import type { InboundMessage } from './pipeline/types.js';
import type { AdvisoryLanguage } from '../ai/types.js';
/** Button / list reply from WhatsApp interactive messages — prefer stable ids (e.g. lang.en). */
export declare function extractInteractiveReplyText(interactive: Record<string, unknown> | undefined): string | null;
/** Walk entire webhook JSON — BSPs nest button_reply in non-standard places. */
export declare function deepFindLanguageButtonId(payload: unknown): string | null;
export declare function isLanguageMenuEcho(text: string): boolean;
export declare function hasInteractiveUserReply(msg: InboundMessage): boolean;
/**
 * Detect language choice from any webhook shape (Cloud, AdsGyani, flattened button_reply).
 */
export declare function detectInboundLanguageChoice(msg: InboundMessage): AdvisoryLanguage | null;
/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export declare function resolveInboundUserText(msg: InboundMessage): string;
//# sourceMappingURL=inbound-reply-text.util.d.ts.map