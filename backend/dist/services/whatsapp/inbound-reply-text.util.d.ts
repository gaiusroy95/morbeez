import type { InboundMessage } from './pipeline/types.js';
/** Button / list reply from WhatsApp interactive messages — prefer stable ids (e.g. lang.en). */
export declare function extractInteractiveReplyText(interactive: Record<string, unknown> | undefined): string | null;
/**
 * Best-effort user intent from webhook payload.
 * Prefer interactive ids over visible labels / echoed bot body text.
 */
export declare function resolveInboundUserText(msg: InboundMessage): string;
//# sourceMappingURL=inbound-reply-text.util.d.ts.map