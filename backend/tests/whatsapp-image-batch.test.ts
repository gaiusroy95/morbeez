import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleImageBatch,
  whatsappImageBatchPendingCount,
  cancelImageBatch,
  flushImageBatchNow,
  WHATSAPP_IMAGE_BATCH_MAX,
  type ImageBatchFlushPayload,
} from '../src/services/whatsapp/pipeline/whatsapp-image-batch.service.js';

function fakeImage(id: string) {
  return {
    imageBase64: `base64-${id}`,
    imageMimeType: 'image/jpeg',
    contentHash: `hash-${id}`,
    messageId: `msg-${id}`,
  };
}

describe('whatsapp image batch', () => {
  it(`accepts up to ${WHATSAPP_IMAGE_BATCH_MAX} photos in one batch`, async () => {
    const farmerId = `batch-max-${Date.now()}`;
    cancelImageBatch(farmerId);

    for (let i = 0; i < 6; i++) {
      await scheduleImageBatch(
        {
          farmerId,
          phone: '919999999999',
          language: 'en',
          isPremium: false,
          image: fakeImage(String(i)),
          sendText: async () => {},
        },
        async () => {}
      );
    }

    assert.equal(whatsappImageBatchPendingCount(farmerId), 6);
    cancelImageBatch(farmerId);
  });

  it('dedupes the same messageId within a batch', async () => {
    const farmerId = `batch-dedupe-${Date.now()}`;
    cancelImageBatch(farmerId);

    const img = fakeImage('same');
    await scheduleImageBatch(
      {
        farmerId,
        phone: '919999999999',
        language: 'en',
        isPremium: false,
        image: img,
        sendText: async () => {},
      },
      async () => {}
    );
    await scheduleImageBatch(
      {
        farmerId,
        phone: '919999999999',
        language: 'en',
        isPremium: false,
        image: { ...img },
        sendText: async () => {},
      },
      async () => {}
    );

    assert.equal(whatsappImageBatchPendingCount(farmerId), 1);
    cancelImageBatch(farmerId);
  });

  it('merges concurrent schedules into a single batch and flushes once', async () => {
    const farmerId = `batch-race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cancelImageBatch(farmerId);

    let flushCount = 0;
    let lastCount = 0;
    const onFlush = async (batch: ImageBatchFlushPayload) => {
      flushCount += 1;
      lastCount = batch.images.length;
    };

    await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        scheduleImageBatch(
          {
            farmerId,
            phone: '919999999999',
            language: 'en',
            isPremium: false,
            image: fakeImage(`c${i}`),
            sendText: async () => {},
          },
          onFlush
        )
      )
    );

    assert.equal(whatsappImageBatchPendingCount(farmerId), 5);

    await flushImageBatchNow(farmerId, onFlush);
    assert.equal(flushCount, 1);
    assert.equal(lastCount, 5);
    assert.equal(whatsappImageBatchPendingCount(farmerId), 0);
  });
});
