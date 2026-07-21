/**
 * Returns true if webhook was already processed (duplicate).
 * Uses webhook_logs.idempotency_key unique constraint.
 */
export declare function isWebhookDuplicate(provider: string, idempotencyKey: string): Promise<boolean>;
/**
 * Atomically claim a webhook before processing (prevents concurrent duplicate replies).
 * Returns false if another worker already claimed this key.
 */
export declare function claimWebhook(provider: string, idempotencyKey: string, payload: unknown): Promise<boolean>;
/** Dedupe the same farmer message when Meta + BSP webhooks both fire. */
export declare function claimInboundWhatsAppMessage(messageId: string): Promise<boolean>;
export declare function finalizeWebhookClaim(provider: string, idempotencyKey: string, status: 'processed' | 'failed', errorMessage?: string): Promise<void>;
export declare function logWebhook(provider: string, topic: string, idempotencyKey: string, payload: unknown, status: 'processed' | 'failed' | 'duplicate', errorMessage?: string): Promise<void>;
//# sourceMappingURL=idempotency.d.ts.map