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
};

const pendingByFarmer = new Map<string, PendingBatch>();

export const WHATSAPP_IMAGE_BATCH_MAX = 4;

function batchWindowMs(): number {
  return Math.max(500, env.WHATSAPP_IMAGE_BATCH_MS);
}

export function whatsappImageBatchPendingCount(farmerId: string): number {
  return pendingByFarmer.get(farmerId)?.images.length ?? 0;
}

export function cancelImageBatch(farmerId: string): void {
  const pending = pendingByFarmer.get(farmerId);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingByFarmer.delete(farmerId);
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
): void {
  const existing = pendingByFarmer.get(params.farmerId);

  if (existing) {
    clearTimeout(existing.timer);
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
    existing.timer = setTimeout(() => {
      void flushBatch(params.farmerId, onFlush);
    }, batchWindowMs());
    return;
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
    timer: setTimeout(() => {
      void flushBatch(params.farmerId, onFlush);
    }, batchWindowMs()),
  };
  pendingByFarmer.set(params.farmerId, batch);
}

async function flushBatch(
  farmerId: string,
  onFlush: (batch: ImageBatchFlushPayload) => Promise<void>
): Promise<void> {
  const pending = pendingByFarmer.get(farmerId);
  if (!pending) return;
  pendingByFarmer.delete(farmerId);

  const { timer: _timer, ...payload } = pending;
  if (!payload.images.length) return;

  try {
    await onFlush(payload);
  } catch (err) {
    logger.error({ err, farmerId, imageCount: payload.images.length }, 'WhatsApp image batch flush failed');
  }
}
