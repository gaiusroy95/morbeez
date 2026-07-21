import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdsGyaniWebhook } from '../src/services/whatsapp/whatsapp.service.js';
import {
  deepFindLanguageButtonId,
  detectInboundLanguageChoice,
  extractInteractiveReplyText,
  isLanguageMenuEcho,
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

  it('deep-scans nested BSP payload for lang.* id', () => {
    const payload = {
      contact: { phone_number: '919876543210' },
      message: {
        message_body: 'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
        data: { nested: { reply: { button_payload: 'lang.ml' } } },
      },
    };
    assert.equal(deepFindLanguageButtonId(payload), 'lang.ml');
  });

  it('detects language from flattened button_reply on message root (BSP format)', () => {
    const msg: InboundMessage = {
      channel: 'whatsapp_adsgyani',
      phone: '919876543210',
      messageId: 'wamid.flat',
      msgType: 'interactive',
      text: 'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
      rawPayload: {
        contact: { phone_number: '919876543210' },
        message: {
          message_body:
            'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
          button_reply: { id: 'lang.en', title: 'English' },
        },
      },
      messageObject: {
        message_body:
          'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
        button_reply: { id: 'lang.en', title: 'English' },
      },
    };
    assert.equal(detectInboundLanguageChoice(msg), 'en');
    assert.equal(resolveInboundUserText(msg), 'lang.en');
  });

  it('detects language from button title only when id missing', () => {
    const msg: InboundMessage = {
      channel: 'whatsapp_cloud',
      phone: '919876543210',
      messageId: 'wamid.title',
      msgType: 'interactive',
      text: 'English',
      messageObject: {
        type: 'interactive',
        button_reply: { title: 'English' },
      },
    };
    assert.equal(detectInboundLanguageChoice(msg), 'en');
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
