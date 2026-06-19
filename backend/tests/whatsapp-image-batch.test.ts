import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelImageBatch,
  scheduleImageBatch,
  whatsappImageBatchPendingCount,
  WHATSAPP_IMAGE_BATCH_MAX,
} from '../src/services/whatsapp/pipeline/whatsapp-image-batch.service.js';

const noopSend = async () => {};

function sampleImage(id: string) {
  return {
    imageBase64: Buffer.alloc(512, id.charCodeAt(0)).toString('base64'),
    imageMimeType: 'image/jpeg',
    contentHash: `hash-${id}`,
  };
}

describe('whatsapp image batch', () => {
  it('merges rapid uploads into one pending batch', () => {
    const onFlush = mock.fn(async () => {});

    scheduleImageBatch(
      {
        farmerId: 'farmer-merge',
        phone: '919999999999',
        language: 'en',
        isPremium: false,
        image: sampleImage('a'),
        sendText: noopSend,
      },
      onFlush
    );
    scheduleImageBatch(
      {
        farmerId: 'farmer-merge',
        phone: '919999999999',
        language: 'en',
        isPremium: false,
        image: sampleImage('b'),
        sendText: noopSend,
      },
      onFlush
    );

    assert.equal(whatsappImageBatchPendingCount('farmer-merge'), 2);
    cancelImageBatch('farmer-merge');
    assert.equal(whatsappImageBatchPendingCount('farmer-merge'), 0);
    assert.equal(onFlush.mock.callCount(), 0);
  });

  it('keeps separate batches per farmer', () => {
    const onFlush = mock.fn(async () => {});

    scheduleImageBatch(
      {
        farmerId: 'farmer-1',
        phone: '911',
        language: 'en',
        isPremium: false,
        image: sampleImage('1'),
        sendText: noopSend,
      },
      onFlush
    );
    scheduleImageBatch(
      {
        farmerId: 'farmer-2',
        phone: '912',
        language: 'ml',
        isPremium: false,
        image: sampleImage('2'),
        sendText: noopSend,
      },
      onFlush
    );

    assert.equal(whatsappImageBatchPendingCount('farmer-1'), 1);
    assert.equal(whatsappImageBatchPendingCount('farmer-2'), 1);
    cancelImageBatch('farmer-1');
    cancelImageBatch('farmer-2');
  });

  it('caps batch size', () => {
    const onFlush = mock.fn(async () => {});

    for (let i = 0; i < WHATSAPP_IMAGE_BATCH_MAX + 2; i++) {
      scheduleImageBatch(
        {
          farmerId: 'farmer-cap',
          phone: '913',
          language: 'en',
          isPremium: false,
          image: sampleImage(String(i)),
          sendText: noopSend,
        },
        onFlush
      );
    }

    assert.equal(whatsappImageBatchPendingCount('farmer-cap'), WHATSAPP_IMAGE_BATCH_MAX);
    cancelImageBatch('farmer-cap');
  });
});
