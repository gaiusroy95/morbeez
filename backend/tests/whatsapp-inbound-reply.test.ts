import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdsGyaniWebhook } from '../src/services/whatsapp/whatsapp.service.js';
import {
  extractInteractiveReplyText,
  resolveInboundUserText,
} from '../src/services/whatsapp/inbound-reply-text.util.js';
import type { InboundMessage } from '../src/services/whatsapp/pipeline/types.js';

describe('extractInteractiveReplyText', () => {
  it('prefers button id over title', () => {
    assert.equal(
      extractInteractiveReplyText({
        button_reply: { id: 'lang.en', title: 'English' },
      }),
      'lang.en'
    );
  });

  it('falls back to list reply title when id missing', () => {
    assert.equal(
      extractInteractiveReplyText({
        list_reply: { title: 'Tamil' },
      }),
      'Tamil'
    );
  });
});

describe('resolveInboundUserText', () => {
  it('prefers interactive id over echoed bot body in messageObject', () => {
    const msg: InboundMessage = {
      channel: 'whatsapp_cloud',
      phone: '919876543210',
      messageId: 'wamid.1',
      msgType: 'interactive',
      text: 'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
      messageObject: {
        type: 'interactive',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'lang.en', title: 'English' },
        },
      },
    };
    assert.equal(resolveInboundUserText(msg), 'lang.en');
  });

  it('reads Meta legacy button payload', () => {
    const msg: InboundMessage = {
      channel: 'whatsapp_cloud',
      phone: '919876543210',
      messageId: 'wamid.2',
      msgType: 'button',
      text: 'English',
      messageObject: {
        type: 'button',
        button: { payload: 'lang.en', text: 'English' },
      },
    };
    assert.equal(resolveInboundUserText(msg), 'lang.en');
  });
});

describe('parseAdsGyaniWebhook', () => {
  it('prefers interactive button id over message_body (language menu tap)', () => {
    const parsed = parseAdsGyaniWebhook({
      contact: { phone_number: '919876543210' },
      message: {
        id: 'wamid.ENGLISH123',
        type: 'interactive',
        message_body: 'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
        interactive: {
          type: 'button_reply',
          button_reply: { id: 'lang.en', title: 'English' },
        },
      },
    });

    assert.ok(parsed);
    assert.equal(parsed!.text, 'lang.en');
    assert.equal(parsed!.messageId, 'wamid.ENGLISH123');
  });

  it('uses message_body for plain text when no interactive reply', () => {
    const parsed = parseAdsGyaniWebhook({
      contact: { phone_number: '919876543210' },
      message: {
        id: 'wamid.HI123',
        type: 'text',
        message_body: 'Hi',
      },
    });

    assert.ok(parsed);
    assert.equal(parsed!.text, 'Hi');
  });

  it('ignores empty message_body and reads interactive reply', () => {
    const parsed = parseAdsGyaniWebhook({
      contact: { phone_number: '919876543210' },
      message: {
        id: 'wamid.KN123',
        type: 'interactive',
        message_body: '   ',
        interactive: {
          button_reply: { id: 'lang.kn', title: 'Kannada' },
        },
      },
    });

    assert.ok(parsed);
    assert.equal(parsed!.text, 'lang.kn');
  });
});
