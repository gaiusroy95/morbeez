import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
const pendingByFarmer = new Map();
export const WHATSAPP_IMAGE_BATCH_MAX = 4;
function batchWindowMs() {
    return Math.max(500, env.WHATSAPP_IMAGE_BATCH_MS);
}
export function whatsappImageBatchPendingCount(farmerId) {
    return pendingByFarmer.get(farmerId)?.images.length ?? 0;
}
/** Merge symptom/caption text into a pending image batch (split message delivery). */
export function mergeImageBatchCaption(farmerId, caption) {
    const trimmed = caption.trim();
    if (!trimmed)
        return false;
    const pending = pendingByFarmer.get(farmerId);
    if (!pending)
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
export function scheduleImageBatch(params, onFlush) {
    const existing = pendingByFarmer.get(params.farmerId);
    if (existing) {
        clearTimeout(existing.timer);
        if (existing.images.length < WHATSAPP_IMAGE_BATCH_MAX) {
            existing.images.push(params.image);
        }
        else {
            logger.warn({ farmerId: params.farmerId, max: WHATSAPP_IMAGE_BATCH_MAX }, 'WhatsApp image batch full — dropping extra photo');
        }
        if (params.caption?.trim() && !existing.caption?.trim()) {
            existing.caption = params.caption.trim();
        }
        existing.timer = setTimeout(() => {
            void flushBatch(params.farmerId, onFlush);
        }, batchWindowMs());
        return;
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
        timer: setTimeout(() => {
            void flushBatch(params.farmerId, onFlush);
        }, batchWindowMs()),
    };
    pendingByFarmer.set(params.farmerId, batch);
}
async function flushBatch(farmerId, onFlush) {
    const pending = pendingByFarmer.get(farmerId);
    if (!pending)
        return;
    pendingByFarmer.delete(farmerId);
    const { timer: _timer, ...payload } = pending;
    if (!payload.images.length)
        return;
    try {
        await onFlush(payload);
    }
    catch (err) {
        logger.error({ err, farmerId, imageCount: payload.images.length }, 'WhatsApp image batch flush failed');
    }
}
//# sourceMappingURL=whatsapp-image-batch.service.js.map