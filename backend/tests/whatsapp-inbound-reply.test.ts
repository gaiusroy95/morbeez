import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAdsGyaniWebhook } from '../src/services/whatsapp/whatsapp.service.js';
import { extractInteractiveReplyText } from '../src/services/whatsapp/inbound-reply-text.util.js';

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
