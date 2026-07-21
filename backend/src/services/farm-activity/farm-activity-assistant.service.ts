import { randomUUID } from 'node:crypto';
import {
  FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
  type FarmActivityAssistantDraftV1,
} from '@morbeez/shared/farm-activity-assistant';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { conversationSessionService } from '../whatsapp/conversation-session.service.js';
import { farmActivityCommitService } from './farm-activity-commit.service.js';
import { farmActivityDraftService } from './farm-activity-draft.service.js';
import { farmActivityExtractionService } from './farm-activity-extraction.service.js';
import { looksLikeFarmActivityMessage } from './farm-activity-message-intent.service.js';
import type { InvoiceEvidenceExtractOk } from './farm-activity-invoice-evidence.service.js';

export type FarmActivitySenders = {
  text: (phone: string, text: string) => Promise<void>;
  buttons?: (params: {
    phone: string;
    body: string;
    buttons: Array<{ id: string; title: string }>;
  }) => Promise<void>;
};

const FARM_ACTIVITY_STATES = new Set([
  'farm_activity_draft',
  'farm_activity_clarify',
  'farm_activity_confirm',
]);

const CONFIRM_ID = 'fa.confirm';
const EDIT_ID = 'fa.edit';
const CANCEL_ID = 'fa.cancel';

const ACTIVITY_INTENT_RE =
  /\b(spray|sprayed|fertiliz|fertilis|labour|labor|harvest|harvested|bought|purchase|purchased|expense|irrigat|weeded|plough|plow|applied|drench|scouting|workers?|wage|cost|spent|income|paid)\b|സ്പ്രേ|വളം|തൊഴിലാളി|വിളവെടുപ്പ്|വാങ്ങി|ചെലവ്|തൊழிலாளர்|அறுவடை|வாங்கி|खरीदा|खर्च|मजदूर|ಕೊಂಡು|ಕೂಲಿ|ಸಿಂಪಡಣೆ/i;

function looksLikeFarmActivityIntent(text: string): boolean {
  return looksLikeFarmActivityMessage(text) || ACTIVITY_INTENT_RE.test(text.trim().replace(/^["']+|["']+$/g, ''));
}

function isConfirmButton(text: string): boolean {
  return text === CONFIRM_ID || /^confirm$/i.test(text);
}

function isEditButton(text: string): boolean {
  return text === EDIT_ID || /^edit$/i.test(text);
}

function isCancelButton(text: string): boolean {
  return text === CANCEL_ID || /^cancel$/i.test(text);
}

function formatField(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object' && value && 'amount' in (value as object)) {
    const money = value as { amount: number; currency?: string };
    return `₹${Number(money.amount).toFixed(0)}`;
  }
  return String(value);
}

function summarizeDraft(draft: FarmActivityAssistantDraftV1, lang: AdvisoryLanguage): string {
  const lines: string[] = [];
  for (const event of draft.subEvents) {
    if (event.kind === 'activity') {
      lines.push(
        `• Activity: ${formatField(event.activityType.value)} | ${formatField(event.occurredOn.value)} | block ${formatField(event.blockRef.value)}`
      );
    } else if (event.kind === 'labour') {
      lines.push(
        `• Labour: ${formatField(event.workType.value)} | ${formatField(event.totalCost.value)} | ${formatField(event.occurredOn.value)}`
      );
    } else if (event.kind === 'purchase') {
      lines.push(
        `• Purchase: ${formatField(event.itemName.value)} | ${formatField(event.totalCost.value)} | ${formatField(event.occurredOn.value)}`
      );
    } else if (event.kind === 'expense') {
      lines.push(
        `• Expense: ${formatField(event.category.value)} | ${formatField(event.amount.value)} | ${formatField(event.occurredOn.value)}`
      );
    } else if (event.kind === 'harvest') {
      lines.push(
        `• Harvest: ${formatField(event.cropName.value)} | qty ${formatField(event.quantity.value)} | ${formatField(event.saleAmount.value)}`
      );
    } else if (event.kind === 'inventory_movement') {
      lines.push(
        `• Inventory: ${formatField(event.movementType.value)} | ${formatField(event.itemName.value)} | ${formatField(event.quantity.value)}`
      );
    }
  }
  const header =
    lang === 'ml'
      ? 'റെക്കോർഡ് ചെയ്യാൻ തയ്യാറായ ഡ്രാഫ്റ്റ്:'
      : 'Draft ready to save:';
  return `${header}\n${lines.join('\n') || (lang === 'ml' ? '(ഇനങ്ങളൊന്നുമില്ല)' : '(no items)')}`;
}

async function clearAssistantPointer(farmerId: string): Promise<void> {
  await conversationSessionService.patchContext(farmerId, {
    farmActivityAssistant: undefined,
  });
  await conversationSessionService.setState(farmerId, 'main_menu');
}

async function setAssistantPointer(
  farmerId: string,
  draft: FarmActivityAssistantDraftV1,
  clarificationAttempts: number,
  state: 'farm_activity_draft' | 'farm_activity_clarify' | 'farm_activity_confirm'
): Promise<void> {
  await conversationSessionService.patchContext(farmerId, {
    farmActivityAssistant: {
      draftId: draft.draftId,
      revision: draft.revision,
      clarificationAttempts,
    },
  });
  await conversationSessionService.setState(farmerId, state);
}

export const farmActivityAssistantService = {
  enabled(): boolean {
    return env.ENABLE_FARM_ACTIVITY_ASSISTANT === true;
  },

  voiceEnabled(): boolean {
    return this.enabled() && env.ENABLE_FARM_ACTIVITY_VOICE === true;
  },

  looksLikeIntent(text: string): boolean {
    return looksLikeFarmActivityIntent(text);
  },

  isFarmActivityState(state: string): boolean {
    return FARM_ACTIVITY_STATES.has(state);
  },

  isActionButton(text: string): boolean {
    return isConfirmButton(text) || isEditButton(text) || isCancelButton(text);
  },

  async tryHandleInbound(input: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    text: string;
    messageId: string;
    sessionState: string;
    send: FarmActivitySenders;
    modality?: 'text' | 'voice';
    transcript?: string | null;
    conversationSessionId?: string | null;
    blockId?: string | null;
  }): Promise<boolean> {
    if (!this.enabled()) return false;

    const text = input.text.trim();
    if (!text) return false;

    const inFlow = this.isFarmActivityState(input.sessionState) || this.isActionButton(text);
    if (!inFlow && !looksLikeFarmActivityIntent(text)) {
      return false;
    }

    if (this.isActionButton(text)) {
      return this.handleAction({
        farmerId: input.farmerId,
        phone: input.phone,
        language: input.language,
        text,
        send: input.send,
        blockId: input.blockId ?? null,
      });
    }

    return this.processUtterance({
      farmerId: input.farmerId,
      phone: input.phone,
      language: input.language,
      text,
      messageId: input.messageId,
      send: input.send,
      modality: input.modality ?? 'text',
      transcript: input.transcript ?? null,
      conversationSessionId: input.conversationSessionId ?? null,
      blockId: input.blockId ?? null,
    });
  },

  async processUtterance(input: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    text: string;
    messageId: string;
    send: FarmActivitySenders;
    modality: 'text' | 'voice';
    transcript?: string | null;
    conversationSessionId?: string | null;
    blockId?: string | null;
  }): Promise<boolean> {
    if (!this.enabled()) return false;
    if (input.modality === 'voice' && !this.voiceEnabled()) return false;

    try {
      const ctx = await conversationSessionService.getContext(input.farmerId);
      const pointer = ctx.farmActivityAssistant;
      const existing =
        (pointer?.draftId ? await farmActivityDraftService.getById(pointer.draftId) : null)
        ?? (await farmActivityDraftService.getActiveForFarmer(input.farmerId));

      const clarificationAttempts = Number(
        pointer?.clarificationAttempts
          ?? (existing?.metadata?.clarificationAttempts as number | undefined)
          ?? 0
      );

      const draft = await farmActivityExtractionService.extract({
        farmerId: input.farmerId,
        messageId: input.messageId || randomUUID(),
        channel: 'whatsapp',
        text: input.modality === 'text' ? input.text : undefined,
        transcript: input.modality === 'voice' || input.transcript
          ? [{
              id: `tr_${input.messageId || randomUUID()}`,
              text: (input.transcript ?? input.text).trim(),
            }]
          : [],
        existingDraft: existing?.draft_json,
        clarificationAttempts,
        conversationSessionId: input.conversationSessionId ?? null,
        blockId: input.blockId ?? undefined,
        persist: true,
      });

      const nextAttempts = clarificationAttempts + (draft.clarifications.length ? 1 : 0);

      if (draft.clarifications.length > 0) {
        await setAssistantPointer(input.farmerId, draft, nextAttempts, 'farm_activity_clarify');
        const question = draft.clarifications[0]?.question
          ?? (input.language === 'ml' ? 'കൂടുതൽ വിവരം ആവശ്യമാണ്.' : 'I need one more detail.');
        await input.send.text(input.phone, question);
        return true;
      }

      if (!draft.subEvents.length) {
        await input.send.text(
          input.phone,
          input.language === 'ml'
            ? 'വിള പ്രവർത്തനം രേഖപ്പെടുത്താൻ കൂടുതൽ വിവരം ആവശ്യമാണ് — പ്ലോട്ട്, തീയതി, അളവ്, ചെലവ്.'
            : 'I need a bit more detail to record this — plot/block, date, quantity, and cost.'
        );
        return true;
      }

      await setAssistantPointer(input.farmerId, draft, nextAttempts, 'farm_activity_confirm');
      await this.sendConfirmPrompt({
        phone: input.phone,
        language: input.language,
        draft,
        send: input.send,
      });
      return true;
    } catch (err) {
      logger.warn({ err, farmerId: input.farmerId }, 'Farm activity assistant utterance failed');
      await input.send.text(
        input.phone,
        input.language === 'ml'
          ? 'റെക്കോർഡ് സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും പ്ലോട്ട്, അളവ്, ചെലവ് ഉൾപ്പെടെ അയയ്ക്കുക.'
          : 'Could not record that yet. Please send again with plot, quantities, and costs.'
      );
      return true;
    }
  },

  async sendConfirmPrompt(input: {
    phone: string;
    language: AdvisoryLanguage;
    draft: FarmActivityAssistantDraftV1;
    send: FarmActivitySenders;
  }): Promise<void> {
    const body = summarizeDraft(input.draft, input.language);
    const buttons = [
      { id: CONFIRM_ID, title: 'Confirm' },
      { id: EDIT_ID, title: 'Edit' },
      { id: CANCEL_ID, title: 'Cancel' },
    ];
    if (input.send.buttons) {
      await input.send.buttons({
        phone: input.phone,
        body,
        buttons,
      });
      return;
    }
    await input.send.text(
      input.phone,
      `${body}\n\nReply: Confirm / Edit / Cancel`
    );
  },

  async presentInvoiceDraft(input: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    send: FarmActivitySenders;
    invoice: InvoiceEvidenceExtractOk;
    conversationSessionId?: string | null;
    clarificationAttempts?: number;
  }): Promise<boolean> {
    if (!this.enabled() || !env.ENABLE_FARM_ACTIVITY_INVOICE_OCR) return false;
    const subEvents = [
      ...input.invoice.draftEvidence.purchaseSubEvents,
      ...input.invoice.draftEvidence.expenseSubEvents,
    ];
    if (!subEvents.length) return false;

    const draft: FarmActivityAssistantDraftV1 = {
      contractVersion: FARM_ACTIVITY_ASSISTANT_CONTRACT_VERSION,
      draftId: randomUUID(),
      revision: 1,
      source: input.invoice.draftEvidence.source,
      subEvents,
      clarifications: [],
    };

    await farmActivityDraftService.persistExtraction({
      farmerId: input.farmerId,
      conversationSessionId: input.conversationSessionId ?? null,
      preferredLanguageHint: input.language,
      detectedLanguage: input.language,
      codeMixed: false,
      clarificationAttempts: input.clarificationAttempts ?? 0,
      draft,
      transcript: null,
    });

    await setAssistantPointer(input.farmerId, draft, input.clarificationAttempts ?? 0, 'farm_activity_confirm');
    await this.sendConfirmPrompt({
      phone: input.phone,
      language: input.language,
      draft,
      send: input.send,
    });
    return true;
  },

  async handleAction(input: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    text: string;
    send: FarmActivitySenders;
    blockId?: string | null;
  }): Promise<boolean> {
    const ctx = await conversationSessionService.getContext(input.farmerId);
    const pointer = ctx.farmActivityAssistant;
    const draftRow =
      (pointer?.draftId ? await farmActivityDraftService.getById(pointer.draftId) : null)
      ?? (await farmActivityDraftService.getActiveForFarmer(input.farmerId));

    if (!draftRow) {
      await input.send.text(
        input.phone,
        input.language === 'ml'
          ? 'സജീവ ഡ്രാഫ്റ്റ് ഇല്ല. വീണ്ടും വിവരം അയയ്ക്കുക.'
          : 'No active draft. Please send the activity details again.'
      );
      await clearAssistantPointer(input.farmerId);
      return true;
    }

    if (pointer && pointer.revision !== draftRow.revision) {
      await input.send.text(
        input.phone,
        input.language === 'ml'
          ? 'ഡ്രാഫ്റ്റ് അപ്ഡേറ്റ് ആയി. ഏറ്റവും പുതിയ സംഗ്രഹം നോക്കുക.'
          : 'Draft was updated. Please use the latest summary.'
      );
      await setAssistantPointer(
        input.farmerId,
        draftRow.draft_json,
        Number(draftRow.metadata?.clarificationAttempts ?? 0),
        'farm_activity_confirm'
      );
      await this.sendConfirmPrompt({
        phone: input.phone,
        language: input.language,
        draft: draftRow.draft_json,
        send: input.send,
      });
      return true;
    }

    if (isCancelButton(input.text)) {
      await farmActivityDraftService.markCancelled({
        draftId: draftRow.id,
        revision: draftRow.revision,
        reason: 'farmer_cancelled',
      });
      await clearAssistantPointer(input.farmerId);
      const { farmerFeedbackFlowService } = await import(
        '../whatsapp/scenarios/farmer-feedback-flow.service.js'
      );
      const resumed = await farmerFeedbackFlowService.resumeAfterActivityCommit({
        farmerId: input.farmerId,
        phone: input.phone,
        lang: input.language,
        send: input.send,
      });
      if (!resumed) {
        await input.send.text(
          input.phone,
          input.language === 'ml' ? 'ഡ്രാഫ്റ്റ് റദ്ദാക്കി.' : 'Draft cancelled.'
        );
      }
      return true;
    }

    if (isEditButton(input.text)) {
      await setAssistantPointer(
        input.farmerId,
        draftRow.draft_json,
        Number(draftRow.metadata?.clarificationAttempts ?? 0),
        'farm_activity_clarify'
      );
      await farmActivityDraftService.appendEvent({
        draftId: draftRow.id,
        eventType: 'edit_requested',
        revision: draftRow.revision,
        actor: 'whatsapp:farmer',
      });
      await input.send.text(
        input.phone,
        input.language === 'ml'
          ? 'തിരുത്തൽ അയയ്ക്കുക (ഉദാ: പ്ലോട്ട് / അളവ് / ചെലവ്).'
          : 'Send the correction (plot, quantity, cost, etc.).'
      );
      return true;
    }

    if (isConfirmButton(input.text)) {
      try {
        const result = await farmActivityCommitService.commitDraft({
          farmerId: input.farmerId,
          draftId: draftRow.id,
          expectedRevision: draftRow.revision,
          fallbackBlockId: input.blockId ?? null,
        });
        await clearAssistantPointer(input.farmerId);
        const count = result.activityIds.length + result.roiEntryIds.length + result.harvestIds.length;
        await input.send.text(
          input.phone,
          input.language === 'ml'
            ? `സേവ് ചെയ്തു. ${count} റെക്കോർഡ്(കൾ) സ്ഥിരീകരിച്ചു.`
            : `Saved. Confirmed ${count} record(s).`
        );
        const { farmerFeedbackFlowService } = await import(
          '../whatsapp/scenarios/farmer-feedback-flow.service.js'
        );
        await farmerFeedbackFlowService.resumeAfterActivityCommit({
          farmerId: input.farmerId,
          phone: input.phone,
          lang: input.language,
          send: input.send,
        });
      } catch (err) {
        logger.warn({ err, draftId: draftRow.id }, 'Farm activity confirm failed');
        await input.send.text(
          input.phone,
          input.language === 'ml'
            ? 'സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. Edit ചെയ്ത് വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ Cancel ചെയ്യുക.'
            : 'Could not save yet. Please Edit and retry, or Cancel.'
        );
      }
      return true;
    }

    return false;
  },
};
