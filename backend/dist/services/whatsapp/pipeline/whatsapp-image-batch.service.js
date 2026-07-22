import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
const pendingByFarmer = new Map();
/** Serialize schedule/flush per farmer so concurrent webhooks cannot create multiple batches. */
const farmerChain = new Map();
export const WHATSAPP_IMAGE_BATCH_MAX = 8;
function batchWindowMs() {
    return Math.max(800, env.WHATSAPP_IMAGE_BATCH_MS);
}
async function withFarmerLock(farmerId, fn) {
    const prev = farmerChain.get(farmerId) ?? Promise.resolve();
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const next = prev.then(() => gate);
    farmerChain.set(farmerId, next);
    await prev;
    try {
        await fn();
    }
    finally {
        release();
        if (farmerChain.get(farmerId) === next) {
            farmerChain.delete(farmerId);
        }
    }
}
export function whatsappImageBatchPendingCount(farmerId) {
    return pendingByFarmer.get(farmerId)?.images.length ?? 0;
}
/** True while a batch is open or a flush is in progress for this farmer. */
export function isImageBatchActive(farmerId) {
    const pending = pendingByFarmer.get(farmerId);
    return Boolean(pending && (pending.images.length > 0 || pending.flushStarted));
}
/** Merge symptom/caption text into a pending image batch (split message delivery). */
export function mergeImageBatchCaption(farmerId, caption) {
    const trimmed = caption.trim();
    if (!trimmed)
        return false;
    const pending = pendingByFarmer.get(farmerId);
    if (!pending || pending.flushStarted)
        return false;
    if (!pending.caption?.trim()) {
        pending.caption = trimmed;
    }
    else if (!pending.caption.includes(trimmed)) {
        pending.caption = `${pending.caption.trim()}\n${trimmed}`;
    }
    return true;
}
export function cancelImageBatch(farmerId) {
    const pending = pendingByFarmer.get(farmerId);
    if (!pending)
        return;
    clearTimeout(pending.timer);
    pendingByFarmer.delete(farmerId);
}
function resetTimer(farmerId, onFlush) {
    const pending = pendingByFarmer.get(farmerId);
    if (!pending || pending.flushStarted)
        return;
    clearTimeout(pending.timer);
    pending.timer = setTimeout(() => {
        void flushBatch(farmerId, onFlush);
    }, batchWindowMs());
}
export function scheduleImageBatch(params, onFlush) {
    return withFarmerLock(params.farmerId, () => {
        const existing = pendingByFarmer.get(params.farmerId);
        if (existing && !existing.flushStarted) {
            const duplicate = existing.images.some((img) => (params.image.contentHash && img.contentHash === params.image.contentHash) ||
                (params.image.messageId && img.messageId === params.image.messageId));
            if (duplicate) {
                resetTimer(params.farmerId, onFlush);
                return;
            }
            if (existing.images.length < WHATSAPP_IMAGE_BATCH_MAX) {
                existing.images.push(params.image);
            }
            else {
                logger.warn({ farmerId: params.farmerId, max: WHATSAPP_IMAGE_BATCH_MAX }, 'WhatsApp image batch full — dropping extra photo');
            }
            if (params.caption?.trim() && !existing.caption?.trim()) {
                existing.caption = params.caption.trim();
            }
            resetTimer(params.farmerId, onFlush);
            return;
        }
        if (existing?.flushStarted) {
            logger.warn({ farmerId: params.farmerId }, 'Image arrived during diagnosis flush — starting a new batch after current run');
        }
        const batch = {
            farmerId: params.farmerId,
            phone: params.phone,
            language: params.language,
            isPremium: params.isPremium,
            images: [params.image],
            caption: params.caption?.trim() || undefined,
            sendText: params.sendText,
            send: params.send,
            flushStarted: false,
            timer: setTimeout(() => {
                void flushBatch(params.farmerId, onFlush);
            }, batchWindowMs()),
        };
        pendingByFarmer.set(params.farmerId, batch);
    });
}
/** Test/helper: flush a pending batch immediately (clears the debounce timer). */
export async function flushImageBatchNow(farmerId, onFlush) {
    await flushBatch(farmerId, onFlush);
}
async function flushBatch(farmerId, onFlush) {
    await withFarmerLock(farmerId, async () => {
        const pending = pendingByFarmer.get(farmerId);
        if (!pending || pending.flushStarted)
            return;
        clearTimeout(pending.timer);
        pending.flushStarted = true;
        pendingByFarmer.delete(farmerId);
        const { timer: _timer, flushStarted: _flushStarted, ...payload } = pending;
        if (!payload.images.length)
            return;
        try {
            await onFlush(payload);
        }
        catch (err) {
            logger.error({ err, farmerId, imageCount: payload.images.length }, 'WhatsApp image batch flush failed');
        }
    });
}
//# sourceMappingURL=whatsapp-image-batch.service.js.map