import type { InboundMessage } from './pipeline/types.js';
import type { AdvisoryLanguage } from '../ai/types.js';
/** Bot menu / prompt text echoed in quoted reply payloads — not the farmer's choice. */
export declare function isBotPromptEcho(text: string): boolean;
/**
 * BSPs often send button taps as multi-line quoted text:
 *   "How many acres are under cultivation?\n2-5 acre"
 * Prefer the last non-prompt line that maps to a known selection.
 */
export declare function selectionFromMultilineText(raw: string): string | null;
/** Button / list reply — prefer stable ids (lang.en, acreage.0_1, menu.crop_assessment, …). */
export declare function extractInteractiveReplyText(interactive: Record<string, unknown> | undefined): string | null;
/** Walk webhook JSON for any known selection id or mappable button title. */
export declare function deepFindSelectionReply(payload: unknown): string | null;
/** @deprecated use deepFindSelectionReply */
export declare function deepFindLanguageButtonId(payload: unknown): string | null;
export declare function isLanguageMenuEcho(text: string): boolean;
export declare function isInteractiveInbound(msg: InboundMessage): boolean;
export declare function hasInteractiveUserReply(msg: InboundMessage): boolean;
/**
 * Extract farmer selection from button/list tap (preferred over typed text).
 * Returns stable id string e.g. lang.en, acreage.2_5, menu.crop_assessment.
 */
export declare function extractInboundSelectionReply(msg: InboundMessage): string | null;
/** Parse Meta Cloud API message object (messages[0]). */
export declare function parseMetaCloudMessageObject(msg: Record<string, unknown>): string;
export declare function detectInboundLanguageChoice(msg: InboundMessage): AdvisoryLanguage | null;
/**
 * Resolve farmer intent: button/list selection first, then typed text.
 */
export declare function resolveInboundUserText(msg: InboundMessage): string;
/** Apply button/list selection onto inbound message before routing. */
export declare function withInboundSelectionText(msg: InboundMessage): InboundMessage;
//# sourceMappingURL=inbound-reply-text.util.d.ts.map