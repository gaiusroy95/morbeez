import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import type { AdvisoryLanguage } from '../../ai/types.js';

type BatchSenders = {
  text: (phone: string, text: string) => Promise<void>;
  list?: (params: {
    phone: string;
    header?: string;
    body: string;
    buttonText: string;
    sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
  }) => Promise<void>;
  buttons?: (params: {
    phone: string;
    body: string;
    buttons: Array<{ id: string; title: string }>;
  }) => Promise<void>;
};

export type BatchedDiagnosisImage = {
  imageBase64: string;
  imageMimeType: string;
  storagePath?: string;
  messageId?: string;
  contentHash: string;
};

export type ImageBatchFlushPayload = {
  farmerId: string;
  phone: string;
  language: AdvisoryLanguage;
  isPremium: boolean;
  images: BatchedDiagnosisImage[];
  caption?: string;
  sendText: (phone: string, text: string) => Promise<void>;
  send?: BatchSenders;
};

type PendingBatch = ImageBatchFlushPayload & {
  timer: ReturnType<typeof setTimeout>;
  flushStarted: boolean;
};

const pendingByFarmer = new Map<string, PendingBatch>();
/** Serialize schedule/flush per farmer so concurrent webhooks cannot create multiple batches. */
const farmerChain = new Map<string, Promise<void>>();

export const WHATSAPP_IMAGE_BATCH_MAX = 8;

function batchWindowMs(): number {
  return Math.max(800, env.WHATSAPP_IMAGE_BATCH_MS);
}

async function withFarmerLock(farmerId: string, fn: () => void | Promise<void>): Promise<void> {
  const prev = farmerChain.get(farmerId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const next = prev.then(() => gate);
  farmerChain.set(farmerId, next);
  await prev;
  try {
    await fn();
  } finally {
    release();
    if (farmerChain.get(farmerId) === next) {
      farmerChain.delete(farmerId);
    }
  }
}

export function whatsappImageBatchPendingCount(farmerId: string): number {
  return pendingByFarmer.get(farmerId)?.images.length ?? 0;
}

/** True while a batch is open or a flush is in progress for this farmer. */
export function isImageBatchActive(farmerId: string): boolean {
  const pending = pendingByFarmer.get(farmerId);
  return Boolean(pending && (pending.images.length > 0 || pending.flushStarted));
}

/** Merge symptom/caption text into a pending image batch (split message delivery). */
export function mergeImageBatchCaption(farmerId: string, caption: string): boolean {
  const trimmed = caption.trim();
  if (!trimmed) return false;
  const pending = pendingByFarmer.get(farmerId);
  if (!pending || pending.flushStarted) return false;
  if (!pending.caption?.trim()) {
    pending.caption = trimmed;
  } else if (!pending.caption.includes(trimmed)) {
    pending.caption = `${pending.caption.trim()}\n${trimmed}`;
  }
  return true;
}

export function cancelImageBatch(farmerId: string): void {
  const pending = pendingByFarmer.get(farmerId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingByFarmer.delete(farmerId);
}

function resetTimer(farmerId: string, onFlush: (batch: ImageBatchFlushPayload) => Promise<void>): void {
  const pending = pendingByFarmer.get(farmerId);
  if (!pending || pending.flushStarted) return;
  clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    void flushBatch(farmerId, onFlush);
  }, batchWindowMs());
}

export function scheduleImageBatch(
  params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    isPremium: boolean;
    image: BatchedDiagnosisImage;
    caption?: string;
    sendText: (phone: string, text: string) => Promise<void>;
    send?: BatchSenders;
  },
  onFlush: (batch: ImageBatchFlushPayload) => Promise<void>
): Promise<void> {
  return withFarmerLock(params.farmerId, () => {
    const existing = pendingByFarmer.get(params.farmerId);

    if (existing && !existing.flushStarted) {
      const duplicate = existing.images.some(
        (img) =>
          (params.image.contentHash && img.contentHash === params.image.contentHash) ||
          (params.image.messageId && img.messageId === params.image.messageId)
      );
      if (duplicate) {
        resetTimer(params.farmerId, onFlush);
        return;
      }
      if (existing.images.length < WHATSAPP_IMAGE_BATCH_MAX) {
        existing.images.push(params.image);
      } else {
        logger.warn(
          { farmerId: params.farmerId, max: WHATSAPP_IMAGE_BATCH_MAX },
          'WhatsApp image batch full — dropping extra photo'
        );
      }
      if (params.caption?.trim() && !existing.caption?.trim()) {
        existing.caption = params.caption.trim();
      }
      resetTimer(params.farmerId, onFlush);
      return;
    }

    if (existing?.flushStarted) {
      logger.warn(
        { farmerId: params.farmerId },
        'Image arrived during diagnosis flush — starting a new batch after current run'
      );
    }

    const batch: PendingBatch = {
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
export async function flushImageBatchNow(
  farmerId: string,
  onFlush: (batch: ImageBatchFlushPayload) => Promise<void>
): Promise<void> {
  await flushBatch(farmerId, onFlush);
}

async function flushBatch(
  farmerId: string,
  onFlush: (batch: ImageBatchFlushPayload) => Promise<void>
): Promise<void> {
  await withFarmerLock(farmerId, async () => {
    const pending = pendingByFarmer.get(farmerId);
    if (!pending || pending.flushStarted) return;
    clearTimeout(pending.timer);
    pending.flushStarted = true;
    pendingByFarmer.delete(farmerId);

    const { timer: _timer, flushStarted: _flushStarted, ...payload } = pending;
    if (!payload.images.length) return;

    try {
      await onFlush(payload);
    } catch (err) {
      logger.error(
        { err, farmerId, imageCount: payload.images.length },
        'WhatsApp image batch flush failed'
      );
    }
  });
}
