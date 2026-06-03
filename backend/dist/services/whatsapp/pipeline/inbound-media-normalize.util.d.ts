import type { InboundMessage } from './types.js';
/** True when webhook payload carries image bytes or a fetchable image URL. */
export declare function hasInboundImageAttachment(msg: InboundMessage): boolean;
export declare function normalizeInboundMsgType(msg: InboundMessage): string;
/** Caption / symptom text sent together with an image. */
export declare function extractInboundCaption(msg: InboundMessage): string;
export declare function withNormalizedMediaFields(msg: InboundMessage): InboundMessage;
//# sourceMappingURL=inbound-media-normalize.util.d.ts.map