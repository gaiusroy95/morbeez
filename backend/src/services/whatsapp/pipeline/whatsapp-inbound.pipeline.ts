import { env } from '../../../config/env.js';
import { eventBus } from '../../../events/bus.js';
import { supabase } from '../../../lib/supabase.js';
import { logger } from '../../../lib/logger.js';
import { claimInboundWhatsAppMessage } from '../../../middleware/idempotency.js';
import {
  detectInboundLanguageChoice,
  hasInteractiveUserReply,
  isLanguageMenuEcho,
} from '../inbound-reply-text.util.js';
import { cropDoctorService } from '../../ai/crop-doctor.service.js';
import { transcriptionService } from '../../ai/transcription.service.js';
import type { AdvisoryLanguage, DiagnoseInput, StructuredAdvisory } from '../../ai/types.js';
import { leadCaptureService } from './lead-capture.service.js';
import { normalizeLanguage } from './language-detection.service.js';
import { isStructuredSystemMessage } from './system-message.util.js';
import { escalationService } from '../../ai/escalation.service.js';
import { validateAgricultureIntent, guardRejectionMessage } from './agriculture-guard.service.js';
import {
  pickLocalizedFarmerSummary,
  shouldRunCropDoctorTextDiagnosis,
} from './crop-message-intent.service.js';
import {
  assessImageBuffer,
  isDuplicateImage,
  recordImageHash,
  imageQualityMessage,
} from './image-quality.service.js';
import { aiUsageControlService } from './ai-usage-control.service.js';
import { faqCacheService } from './faq-cache.service.js';
import { farmerMemoryService } from './farmer-memory.service.js';
import { tryAgronomyReply } from './agronomy-reply.service.js';
import { regionalTerminologyProcessor } from '../../regional-terminology/regional-terminology.processor.js';
import {
  isConversationFollowUp,
  shouldUseConversationalContinuation,
} from './conversation-continuation.service.js';
import { shouldSkipFaqForMessage } from './faq-cache.service.js';
import { knowledgeFallbackService } from './knowledge-fallback.service.js';
import {
  replyAttributionService,
  type MorbeezReplyModule,
  type ReplyAttributionMeta,
} from './reply-attribution.service.js';
import { farmerReplyPolishService } from './farmer-reply-polish.service.js';
import { validateAdvisorySafety } from './safety-validation.service.js';
import { confidenceLifecycleService } from '../../core/confidence-lifecycle.service.js';
import { extractInboundMedia } from './media-extract.service.js';
import { shopifyLinksService } from '../../shopify/shopify-links.service.js';
import { whatsappConversationalService } from '../whatsapp-conversational.service.js';
import { farmerService } from '../../farmer/farmer.service.js';
import {
  advisoryImageStorageService,
  downloadAdvisoryImageBase64,
} from '../../core/advisory-image-storage.service.js';
import { conversationSessionService } from '../conversation-session.service.js';
import { whatsappScenarioRouter } from '../scenarios/whatsapp-scenario-router.service.js';
import { farmerFeedbackFlowService } from '../scenarios/farmer-feedback-flow.service.js';
import { farmActivityAssistantService } from '../../farm-activity/farm-activity-assistant.service.js';
import { looksLikeFarmActivityMessage } from '../../farm-activity/farm-activity-message-intent.service.js';
import { farmActivityInvoiceEvidenceService } from '../../farm-activity/farm-activity-invoice-evidence.service.js';
import {
  nutrientSoilGateService,
  soilGatePreface,
} from '../scenarios/nutrient-soil-gate.service.js';
import { cropSelectionService } from '../scenarios/crop-selection.service.js';
import { farmerPurgeService } from '../../farmer/farmer-purge.service.js';
import { orderWhatsappService } from '../orders/order-whatsapp.service.js';
import { onboardingFlowService, pincodePrompt } from '../scenarios/onboarding-flow.service.js';
import { sendReplyButtonMenu } from '../whatsapp-interactive-menu.service.js';
import { isMainMenuGreeting } from '../scenarios/whatsapp-menu.service.js';
import { diagnosisFlowService } from '../scenarios/diagnosis-flow.service.js';
import { diagnosisSessionEvidenceService } from './diagnosis-session-evidence.service.js';
import { multiPlotService } from '../scenarios/multi-plot.service.js';
import { aiReuseService } from '../../ai/ai-reuse.service.js';
import { cropDetectionService } from './crop-detection.service.js';
import { contextPackService } from './context-pack.service.js';
import { policyEngineService } from '../../ai/policy-engine.service.js';
import { createTelecallerTask } from './telecaller-tasks.service.js';
import { accuracyMetricsService } from '../../ai/accuracy-metrics.service.js';
import { inputClassifierService } from './input-classifier.service.js';
import { imageInputClassifierService } from './image-input-classifier.service.js';
import {
  compatibilityLookupService,
  parseProductPairFromText,
} from './compatibility-lookup.service.js';
import { isExplicitAgronomyQuestion } from './agriculture-free-text.service.js';
import { responseComposerService } from './response-composer.service.js';
import { whatsappDiagnosisRendererService } from './whatsapp-diagnosis-renderer.service.js';
import { whatsappDiagnosisContextService } from './whatsapp-diagnosis-context.service.js';
import { assessmentPlaybookService } from '../scenarios/assessment-playbook.service.js';
import { roiFlowService } from '../roi/roi-flow.service.js';
import { diagnosisFollowUpService } from './diagnosis-follow-up.service.js';
import { normalizeStructuredAdvisory } from '../../ai/advisory-normalize.js';
import { recommendationFollowUpService } from '../../core/recommendation-follow-up.service.js';
import {
  scheduleImageBatch,
  mergeImageBatchCaption,
  whatsappImageBatchPendingCount,
  WHATSAPP_IMAGE_BATCH_MAX,
  type ImageBatchFlushPayload,
} from './whatsapp-image-batch.service.js';
import { evidenceQualityService } from '../../case/evidence-quality.service.js';
import { caseBuilderService } from '../../case/case-builder.service.js';
import { cropPackLoaderService } from '../../crop-pack/crop-pack-loader.service.js';
import { recoveryValidationService } from '../../case/recovery-validation.service.js';
import { soilFlowService } from '../scenarios/soil-flow.service.js';
import {
  hasInboundImageAttachment,
  withNormalizedMediaFields,
} from './inbound-media-normalize.util.js';
import type { InboundMessage } from './types.js';

const CROP_MEDIA_TYPES = new Set([
  'image',
  'image_message',
  'photo',
  'picture',
  'media',
  'document',
]);

async function attachImageToInboundLog(params: {
  messageId: string;
  storagePath: string;
  caption?: string;
}): Promise<void> {
  if (!params.messageId?.trim()) return;
  const { data: row } = await supabase
    .from('interaction_logs')
    .select('raw_payload')
    .eq('external_message_id', params.messageId)
    .maybeSingle();

  const raw = (row?.raw_payload as Record<string, unknown>) ?? {};
  await supabase
    .from('interaction_logs')
    .update({
      message_type: 'image',
      content: params.caption?.slice(0, 500) || String(raw.caption ?? 'image'),
      raw_payload: {
        ...raw,
        storagePath: params.storagePath,
        image_storage_path: params.storagePath,
        caption: params.caption ?? raw.caption,
      },
    })
    .eq('external_message_id', params.messageId);
}
const VOICE_TYPES = new Set(['audio', 'voice', 'audio_message']);
type Senders = {
  text: (phone: string, text: string) => Promise<void>;
  list?: (params: {
    phone: string;
    header?: string;
    body: string;
    buttonText: string;
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  }) => Promise<void>;
  buttons?: (params: {
    phone: string;
    body: string;
    buttons: Array<{ id: string; title: string }>;
  }) => Promise<void>;
};

async function askCropSelection(
  send: Senders,
  phone: string,
  language: AdvisoryLanguage,
  farmerId: string
): Promise<void> {
  await cropSelectionService.sendCropPicker({
    farmerId,
    phone,
    language,
    send,
    body:
      language === 'ml'
        ? 'വിള കണ്ടെത്താനായില്ല. ദയവായി വിള തിരഞ്ഞെടുക്കുക.'
        : 'AI could not detect crop clearly. Please select crop.',
  });
}

function localizedSummary(advisory: StructuredAdvisory, language: AdvisoryLanguage): string {
  return pickLocalizedFarmerSummary(advisory, language);
}

function buildDiagnosisBody(params: {
  advisory: StructuredAdvisory;
  language: AdvisoryLanguage;
  plotLabel?: string;
  reuseNote?: string;
  escalateNote?: string;
  safetyNote?: string;
  requiresImageEvidence?: boolean;
}): string {
  if (env.ENABLE_WHATSAPP_RICH_DIAGNOSIS) {
    return whatsappDiagnosisRendererService.render({
      advisory: params.advisory,
      language: params.language,
      plotLabel: params.plotLabel,
      reuseNote: params.reuseNote,
      escalateNote: params.escalateNote,
      safetyNote: params.safetyNote,
      requiresImageEvidence: params.requiresImageEvidence,
    });
  }
  let body = localizedSummary(params.advisory, params.language);
  if (params.plotLabel) body = `📍 ${params.plotLabel}\n\n${body}`;
  if (params.reuseNote) body += `\n\n${params.reuseNote}`;
  if (params.escalateNote) body += `\n\n${params.escalateNote}`;
  if (params.safetyNote) body += `\n\n${params.safetyNote}`;
  return body;
}

function buildDiagnosisReply(params: {
  advisory: StructuredAdvisory;
  language: AdvisoryLanguage;
  plotLabel?: string;
  body?: string;
  validationQuestion?: string | null;
  reuseNote?: string;
  escalateNote?: string;
  safetyNote?: string;
}): string {
  const body =
    params.body ??
    buildDiagnosisBody({
      advisory: params.advisory,
      language: params.language,
      plotLabel: params.plotLabel,
      reuseNote: params.reuseNote,
      escalateNote: params.escalateNote,
      safetyNote: params.safetyNote,
    });
  const footer = responseComposerService.brandFooter(params.language);
  if (env.ENABLE_WHATSAPP_RICH_DIAGNOSIS) {
    return responseComposerService.composeDiagnosis({
      body,
      validationQuestion: params.validationQuestion,
      footer,
    });
  }
  return responseComposerService.compose({
    body,
    validationQuestion: params.validationQuestion,
    footer: responseComposerService.advisoryDisclaimer(params.language),
  });
}

async function applyLanguageSelection(params: {
  farmerId: string;
  phone: string;
  language: AdvisoryLanguage;
  send: Senders;
}): Promise<void> {
  await conversationSessionService.setLanguageForOnboarding(params.farmerId, params.language);
  await whatsappScenarioRouter.startMinimalOnboarding(
    params.phone,
    params.farmerId,
    params.language,
    params.send
  );
}

async function tryAssessmentPlaybook(params: {
  farmerId: string;
  phone: string;
  language: AdvisoryLanguage;
  text?: string;
  hasCropMedia: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  sendText: (phone: string, text: string) => Promise<void>;
}): Promise<boolean> {
  const textResult = inputClassifierService.classifyText(params.text, {
    hasCropMedia: params.hasCropMedia,
  });

  let visionMerged = textResult;
  if (params.hasCropMedia && params.imageBase64) {
    const vision = await imageInputClassifierService.classifyImage({
      imageBase64: params.imageBase64,
      imageMimeType: params.imageMimeType ?? 'image/jpeg',
      caption: params.text,
    });
    if (vision) {
      if (vision.photoQuality === 'blurry' || vision.photoQuality === 'too_dark') {
        await params.sendText(
          params.phone,
          imageQualityMessage(
            params.language,
            vision.photoQuality === 'too_dark' ? 'too_dark' : 'blurry'
          )
        );
        return true;
      }
      visionMerged = inputClassifierService.mergeWithVision(textResult, {
        category: imageInputClassifierService.toAgricultureCategory(vision),
        confidence: vision.confidence,
        photoQuality: vision.photoQuality,
      });
    }
  }

  const classification = visionMerged;

  if (classification.category === 'compatibility' && params.text) {
    const pair = parseProductPairFromText(params.text);
    if (pair) {
      const lookup = await compatibilityLookupService.lookup(pair.productA, pair.productB);
      if (lookup.found) {
        await params.sendText(
          params.phone,
          compatibilityLookupService.formatFarmerReply(lookup, params.language, pair)
        );
        if (lookup.compatible === false) {
          await assessmentPlaybookService.applyEscalation(
            params.farmerId,
            'compatibility',
            params.text.slice(0, 300)
          );
        }
        await conversationSessionService.setState(params.farmerId, 'playbook_pending');
        return true;
      }
      return false;
    }
    return false;
  }

  if (!inputClassifierService.shouldUsePlaybook(classification)) {
    return false;
  }

  const playbook = assessmentPlaybookService.resolve(classification, params.language, {
    hasCropMedia: params.hasCropMedia,
  });
  if (playbook.action === 'continue_diagnosis') {
    return false;
  }

  const playbookMemory = await farmerMemoryService.build(params.farmerId);
  const playbookOutbound = await replyAttributionService.deliverAttributedReply({
    farmerId: params.farmerId,
    phone: params.phone,
    language: params.language,
    body: playbook.message,
    module: 'playbook',
    meta: { cropType: playbookMemory.cropType },
    sendText: params.sendText,
  });
  await farmerService
    .logInteraction(params.farmerId, 'whatsapp', 'outbound', playbookOutbound.slice(0, 500))
    .catch(() => {});
  if (playbook.escalate) {
    await assessmentPlaybookService.applyEscalation(
      params.farmerId,
      classification.category,
      params.text?.slice(0, 300)
    );
  }
  await conversationSessionService.setState(params.farmerId, 'playbook_pending');
  await conversationSessionService.patchContext(params.farmerId, {
    lastPlaybookCategory: classification.category,
  });
  return true;
}

function languageSelectCopy(): {
  body: string;
  buttonText: string;
  rows: Array<{ id: string; title: string; description?: string }>;
} {
  return {
    body: 'Welcome to Morbeez Agriculture Assistant.\n\nPlease select your language.',
    buttonText: 'Language',
    rows: [
      { id: 'lang.en', title: 'English' },
      { id: 'lang.ml', title: 'Malayalam' },
      { id: 'lang.ta', title: 'Tamil' },
      { id: 'lang.kn', title: 'Kannada' },
      { id: 'lang.hi', title: 'Hindi' },
    ],
  };
}

async function sendKnowledgeFallbackOrLimit(params: {
  farmerId: string;
  phone: string;
  language: AdvisoryLanguage;
  text: string;
  sendText: (phone: string, text: string) => Promise<void>;
  limitMessage: string;
  followUp?: boolean;
  hasMedia?: boolean;
}): Promise<boolean> {
  const memory = await farmerMemoryService.build(params.farmerId, {
    symptomsText: params.text,
  });
  const kb = await knowledgeFallbackService.tryReplyWithModule({
    farmerId: params.farmerId,
    text: params.text,
    language: params.language,
    memory,
    followUp: params.followUp,
    hasMedia: params.hasMedia,
  });
  if (kb) {
    const outbound = await replyAttributionService.deliverAttributedReply({
      farmerId: params.farmerId,
      phone: params.phone,
      language: params.language,
      body: kb.text,
      module: kb.module,
      meta: kb.meta,
      sendText: params.sendText,
    });
    await farmerService
      .logInteraction(params.farmerId, 'whatsapp', 'outbound', outbound.slice(0, 500))
      .catch(() => {});
    return true;
  }
  await params.sendText(params.phone, params.limitMessage);
  return false;
}

async function classifyCommercialLead(farmerId: string, text: string): Promise<void> {
  const lower = text.toLowerCase();
  let intent: 'quotation' | 'callback' | 'support' | null = null;
  if (/quote|quotation|price|rate|വില/i.test(lower)) intent = 'quotation';
  else if (/call|callback|ഫോൺ/i.test(lower)) intent = 'callback';
  else if (/help|support|problem/i.test(lower)) intent = 'support';
  if (!intent) return;

  const { leadService } = await import('../../crm/lead.service.js');
  await leadService.ensureLeadForFarmer({
    farmerId,
    source: 'whatsapp',
    intent,
    status: 'new',
    stage: 'interested',
    priority: intent === 'callback' ? 'high' : 'normal',
    notes: text.slice(0, 500),
    mergeNotes: true,
  });

  if (intent === 'quotation') {
    await eventBus.publish('quotation.requested', { farmerId, text }, 'whatsapp');
  }
}

function isFarmerResetCommand(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    /^(delete my data|erase my data|reset account|reset my account|delete account|forget me)$/i.test(t) ||
    /^(ഡാറ്റ ഇല്ലാതാക്കുക|എന്റെ ഡാറ്റ മായ്ക്കുക|അക്കൗണ്ട് റീസെറ്റ്)$/i.test(t) ||
    /^(मेरा डेटा हटाएं|खाता रीसेट)$/i.test(t)
  );
}

export const whatsappInboundPipeline = {
  async process(
    msg: InboundMessage,
    send: Senders,
    _hooks?: {
      sendWelcomeTemplate?: (phone: string, farmerId: string, profileName?: string) => Promise<boolean>;
    }
  ): Promise<void> {
    if (msg.messageId?.trim()) {
      const claimed = await claimInboundWhatsAppMessage(msg.messageId);
      if (!claimed) {
        logger.info({ messageId: msg.messageId, phone: msg.phone }, 'Duplicate WhatsApp inbound skipped');
        return;
      }
    }

    if (msg.text?.trim() && isFarmerResetCommand(msg.text)) {
      const phone = orderWhatsappService.normalizePhone(msg.phone);
      await farmerPurgeService.purgeByPhone(phone);
      const resetLang = normalizeLanguage(null, 'en');
      const ack =
        resetLang === 'ml'
          ? 'നിങ്ങളുടെ മോർബീസ് ഡാറ്റ പൂർണ്ണമായും ഇല്ലാതാക്കി. പുതിയ കർഷകനായി രജിസ്റ്റർ ചെയ്യാൻ *Hi* അയയ്ക്കുക.'
          : 'Your Morbeez data has been fully removed. Send *Hi* anytime to register as a new farmer.';
      await send.text(msg.phone, ack);
      return;
    }

    msg = withNormalizedMediaFields(msg);

    const captured = await leadCaptureService.captureAndIdentify(msg, 'en');

    // Conversation state + ownership (human takeover / pause AI)
    let session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);

    // Step 2 — language button tap must win before any reset/echo handling (Hi → menu → lang → pincode).
    const languageChoice = detectInboundLanguageChoice(msg);
    if (
      languageChoice &&
      (!session.preferred_language ||
        session.state === 'language_select' ||
        session.state === 'onboarding_minimal')
    ) {
      logger.info(
        {
          farmerId: captured.farmerId,
          messageId: msg.messageId,
          language: languageChoice,
          msgType: msg.msgType,
          text: msg.text?.slice(0, 80),
        },
        'WhatsApp language selected — starting pincode onboarding'
      );
      await applyLanguageSelection({
        farmerId: captured.farmerId,
        phone: msg.phone,
        language: languageChoice,
        send,
      });
      return;
    }

    const isLanguagePick = Boolean(languageChoice);
    const isGreeting = Boolean(msg.text?.trim() && isMainMenuGreeting(msg.text));
    // Bootstrap brand-new farmers once on first Hi — never reset mid-flow (e.g. after language tap).
    if (
      !captured.hadHistoricalLead &&
      isGreeting &&
      !isLanguagePick &&
      !session.preferred_language
    ) {
      const now = new Date().toISOString();
      await supabase
        .from('conversation_sessions')
        .update({
          preferred_language: null,
          state: 'language_select',
          conversation_owner: 'ai',
          ai_paused: false,
          active_plot_id: null,
          active_block_id: null,
          context: { onboardingComplete: false },
          updated_at: now,
        })
        .eq('farmer_id', captured.farmerId)
        .eq('channel', 'whatsapp');
      session = {
        ...session,
        preferred_language: null,
        state: 'language_select',
        context: { onboardingComplete: false },
      };
    }
    if (await conversationSessionService.shouldPauseAi(captured.farmerId)) {
      logger.info({ farmerId: captured.farmerId }, 'AI paused for WhatsApp conversation');
      return;
    }

    if (msg.text?.trim()) {
      const { expertCaseInboundService } = await import(
        '../../expert-case/expert-case-inbound.service.js'
      );
      const handled = await expertCaseInboundService.tryHandleFarmerReply({
        farmerId: captured.farmerId,
        text: msg.text,
        phone: msg.phone,
      });
      if (handled) return;
    }

    await supabase.from('interaction_logs').insert({
      farmer_id: captured.farmerId,
      channel: 'whatsapp',
      direction: 'inbound',
      message_type: msg.msgType,
      content: msg.text || msg.msgType,
      external_message_id: msg.messageId,
      raw_payload: {
        ...(msg.rawPayload ?? {}),
        message: msg.messageObject,
        caption: msg.text || undefined,
      },
      purge_after: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const { farmerEventCaptureService } = await import(
      '../../intelligence/farmer-event-capture.service.js'
    );
    void farmerEventCaptureService.captureWhatsAppInteraction({
      farmerId: captured.farmerId,
      direction: 'inbound',
      messageType: msg.msgType,
      externalMessageId: msg.messageId,
      contentPreview: msg.text || msg.msgType,
    });

    // Recover farmers whose greeting was misread as Hindi (legacy bug) — never wipe a valid pick.
    const ctxEarly = await conversationSessionService.getContext(captured.farmerId);
    const onboardingDoneEarly = await onboardingFlowService.isComplete(captured.farmerId);
    if (
      !onboardingDoneEarly &&
      session.preferred_language === 'hi' &&
      msg.text &&
      isMainMenuGreeting(msg.text) &&
      (ctxEarly.onboardingStep === 'pincode' ||
        (ctxEarly.onboardingStep === 'acreage' && !ctxEarly.onboardingAcreageBucket))
    ) {
      const now = new Date().toISOString();
      await supabase
        .from('conversation_sessions')
        .update({
          preferred_language: null,
          state: 'language_select',
          updated_at: now,
        })
        .eq('farmer_id', captured.farmerId)
        .eq('channel', 'whatsapp');
      session = { ...session, preferred_language: null, state: 'language_select' };
    }

    // New farmer flow: Hi → language select → pincode → acreage → crop → planting date → main menu
    if (!session.preferred_language) {
      // BSP/Meta sometimes replays our outbound menu body as a fake inbound — never re-show menu for that.
      if (isLanguageMenuEcho(msg.text ?? '') && !hasInteractiveUserReply(msg)) {
        logger.info(
          { farmerId: captured.farmerId, messageId: msg.messageId },
          'Ignored echoed language-menu webhook (no interactive reply)'
        );
        return;
      }

      const ctxLang = await conversationSessionService.getContext(captured.farmerId);
      const onboardingAlreadyStarted =
        session.state === 'onboarding_minimal' || Boolean(ctxLang.onboardingStep);
      if (onboardingAlreadyStarted) {
        const { data: farmerRow } = await supabase
          .from('farmers')
          .select('preferred_language')
          .eq('id', captured.farmerId)
          .maybeSingle();
        const lang = normalizeLanguage(null, farmerRow?.preferred_language ?? captured.language);
        await conversationSessionService.setLanguageForOnboarding(captured.farmerId, lang);
        session = { ...session, preferred_language: lang, state: 'onboarding_minimal' };
        const step = ctxLang.onboardingStep ?? 'pincode';
        if (step === 'pincode') {
          await send.text(msg.phone, pincodePrompt(lang));
        } else if (step === 'acreage') {
          await whatsappScenarioRouter.sendAcreageOnboardingStep(msg.phone, lang, send);
        } else {
          await send.text(msg.phone, onboardingFlowService.currentStepPrompt(step, lang));
        }
        return;
      }

      logger.warn(
        {
          farmerId: captured.farmerId,
          messageId: msg.messageId,
          msgType: msg.msgType,
          text: msg.text?.slice(0, 120),
          hasInteractive: hasInteractiveUserReply(msg),
        },
        'Re-sending WhatsApp language menu (language choice not detected)'
      );

      const copy = languageSelectCopy();
      if (send.list) {
        await send.list({
          phone: msg.phone,
          body: copy.body,
          buttonText: copy.buttonText,
          sections: [{ title: 'Languages', rows: copy.rows }],
        });
      } else if (send.buttons) {
        await sendReplyButtonMenu({
          to: msg.phone,
          body: copy.body,
          options: copy.rows.map((r) => ({ id: r.id, title: r.title })),
          continuationBody: 'Please select your language (continued):',
          sendButtons: (p) =>
            send.buttons!({
              phone: p.to,
              body: p.body,
              buttons: p.buttons,
            }),
        });
      } else {
        await send.text(msg.phone, `${copy.body}\n\nReply with: English / Malayalam / Tamil / Kannada / Hindi`);
      }
      await conversationSessionService.setState(captured.farmerId, 'language_select', {
        last_menu_at: new Date().toISOString(),
      });
      return;
    }

    const onboardingDone = await onboardingFlowService.isComplete(captured.farmerId);

    if (session.preferred_language) {
      captured.language = normalizeLanguage(null, session.preferred_language);
    }

    if (!onboardingDone) {
      const routeOnboarding = await whatsappScenarioRouter.tryRoute(msg, captured, session, send);
      if (routeOnboarding.handled) {
        await eventBus.publish(
          'whatsapp.message.received',
          { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
          'whatsapp'
        );
        return;
      }
    }

    const activeLang = captured.language;

    if (session.preferred_language && onboardingDone && msg.text && isMainMenuGreeting(msg.text)) {
      await whatsappScenarioRouter.showReturningFarmerWelcome(msg, captured, activeLang, send);
      await eventBus.publish(
        'whatsapp.message.received',
        { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
        'whatsapp'
      );
      return;
    }

    const routeResult = await whatsappScenarioRouter.tryRoute(
      msg,
      captured,
      session,
      send
    );

    if (routeResult.handled && 'deliverPendingDiagnosis' in routeResult && routeResult.deliverPendingDiagnosis) {
      await this.deliverPendingDiagnosis({
        farmerId: captured.farmerId,
        phone: msg.phone,
        language: activeLang,
        sendText: send.text,
        send,
      });
      return;
    }

    if (routeResult.handled && 'runDiagnosis' in routeResult && routeResult.runDiagnosis) {
      if (routeResult.welcomePrefix) {
        await send.text(msg.phone, routeResult.welcomePrefix);
      }
      if (routeResult.symptomsText || routeResult.postIntake) {
        const sessCtx = await conversationSessionService.getContext(captured.farmerId);
        const batchPaths = sessCtx.pendingDiagnosisImageBatch ?? [];
        const diagnosisImages =
          batchPaths.length > 0
            ? await Promise.all(
                batchPaths.map(async (entry) => {
                  const downloaded = await downloadAdvisoryImageBase64(entry.path);
                  return {
                    imageBase64: downloaded?.base64,
                    imageMimeType: entry.mime,
                    imageStoragePath: entry.path,
                  };
                })
              )
            : sessCtx.pendingDiagnosisImagePath
              ? [
                  {
                    imageMimeType: sessCtx.pendingDiagnosisImageMime ?? 'image/jpeg',
                    imageStoragePath: sessCtx.pendingDiagnosisImagePath,
                  },
                ]
              : undefined;
        await this.runDiagnosis({
          farmerId: captured.farmerId,
          phone: msg.phone,
          language: activeLang,
          symptomsText:
            routeResult.postIntake?.enrichedSymptoms ?? routeResult.symptomsText,
          fieldInvestigation: routeResult.postIntake?.fieldInvestigation,
          issueLabelHint: routeResult.postIntake?.issueLabelHint,
          skipReuseCache: routeResult.postIntake?.skipReuseCache,
          investigationPattern: routeResult.postIntake?.investigationPattern,
          imageStoragePath: sessCtx.pendingDiagnosisImagePath,
          diagnosisImages,
          channel: 'whatsapp',
          sendText: send.text,
          send,
        });
        await diagnosisSessionEvidenceService.rememberPhotoPaths(
          captured.farmerId,
          diagnosisSessionEvidenceService.collectPendingPhotoPaths(sessCtx)
        );
        await conversationSessionService.patchContext(captured.farmerId, {
          pendingDiagnosisImagePath: undefined,
          pendingDiagnosisImageMime: undefined,
          pendingDiagnosisImageBatch: undefined,
        });
        await eventBus.publish(
          'whatsapp.message.received',
          { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
          'whatsapp'
        );
        return;
      }
      await this.processImage(msg, { ...captured, language: activeLang }, send.text, send);
      await eventBus.publish(
        'whatsapp.message.received',
        { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
        'whatsapp'
      );
      return;
    }

    if (routeResult.handled) {
      await eventBus.publish(
        'whatsapp.message.received',
        { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
        'whatsapp'
      );
      return;
    }

    if (onboardingDone) {
      const eveningRoi = await roiFlowService.tryEveningPromptOnInbound({
        farmerId: captured.farmerId,
        phone: msg.phone,
        language: activeLang,
        sessionState: session.state,
        routeHandled: routeResult.handled,
        text: msg.text,
        send,
      });
      if (eveningRoi) {
        await eventBus.publish(
          'whatsapp.message.received',
          { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
          'whatsapp'
        );
        return;
      }
    }

    if (!onboardingDone) {
      const ctxOnboard = await conversationSessionService.getContext(captured.farmerId);
      const stepPrompt = onboardingFlowService.currentStepPrompt(ctxOnboard.onboardingStep, activeLang);
      await send.text(msg.phone, stepPrompt);
      if (ctxOnboard.onboardingStep === 'crop' || ctxOnboard.onboardingStep === 'custom_crop') {
        await cropSelectionService.sendCropPicker({
          farmerId: captured.farmerId,
          phone: msg.phone,
          language: activeLang,
          send,
        });
      } else if (ctxOnboard.onboardingStep === 'pincode') {
        await send.text(msg.phone, pincodePrompt(activeLang));
      } else if (ctxOnboard.onboardingStep === 'acreage') {
        await whatsappScenarioRouter.sendAcreageOnboardingStep(msg.phone, activeLang, send);
      }
      await eventBus.publish(
        'whatsapp.message.received',
        { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
        'whatsapp'
      );
      return;
    }

    if (!env.ENABLE_AI_CROP_DOCTOR) {
      if (msg.text) await classifyCommercialLead(captured.farmerId, msg.text);
      await this.replyToText(msg, captured, send.text);
      await eventBus.publish(
        'whatsapp.message.received',
        { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
        'whatsapp'
      );
      return;
    }

    const hasCropMedia =
      CROP_MEDIA_TYPES.has(msg.msgType) ||
      hasInboundImageAttachment(msg) ||
      VOICE_TYPES.has(msg.msgType);

    const guard = validateAgricultureIntent({ text: msg.text, hasCropMedia });
    if (!guard.allowed) {
      await send.text(msg.phone, guardRejectionMessage(captured.language));
      return;
    }

    const faqHit =
      msg.text && !shouldSkipFaqForMessage(msg.text)
        ? await faqCacheService.match(msg.text, captured.language)
        : null;
    if (faqHit && !hasCropMedia) {
      await send.text(msg.phone, faqHit);
      return;
    }

    if (VOICE_TYPES.has(msg.msgType)) {
      await this.processVoice(msg, captured, send.text, send);
    } else if (CROP_MEDIA_TYPES.has(msg.msgType)) {
      await this.processImage(msg, captured, send.text, send);
    } else if (msg.text) {
      await this.processText(msg, captured, send.text);
    }

    await eventBus.publish(
      'whatsapp.message.received',
      { phone: msg.phone, farmerId: captured.farmerId, text: msg.text, messageType: msg.msgType },
      'whatsapp'
    );
  },

  async processVoice(
    msg: InboundMessage,
    captured: { farmerId: string; phone: string; language: AdvisoryLanguage; isPremium: boolean },
    sendText: (phone: string, text: string) => Promise<void>,
    send?: Senders
  ): Promise<void> {
    let media: Awaited<ReturnType<typeof extractInboundMedia>>;
    try {
      media = await extractInboundMedia({
        channel: msg.channel,
        msgType: msg.msgType,
        messageObject: msg.messageObject,
      });
    } catch (err) {
      logger.error({ err, farmerId: captured.farmerId, msgType: msg.msgType }, 'WhatsApp media extract failed');
      await sendText(
        captured.phone,
        captured.language === 'ml'
          ? 'വോയ്സ് നോട്ട് ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും അയയ്ക്കുക.'
          : 'We could not load your voice note. Please try again.'
      );
      return;
    }

    if (!media.audioBuffer) {
      await sendText(
        captured.phone,
        captured.language === 'ml'
          ? 'വോയ്സ് നോട്ട് ലഭിച്ചില്ല. വീണ്ടും അയയ്ക്കുക.'
          : 'Could not receive voice note. Please try again.'
      );
      return;
    }

    const usage = await aiUsageControlService.checkAndConsume({
      farmerId: captured.farmerId,
      kind: 'voice',
      isPremium: captured.isPremium,
      voiceDurationSec: media.audioDurationSec ?? 30,
    });
    if (!usage.allowed) {
      await sendText(captured.phone, aiUsageControlService.usageLimitMessage(captured.language, usage.reason));
      return;
    }

    let transcript = await transcriptionService.transcribeVoice(
      media.audioBuffer,
      media.audioMimeType ?? 'audio/ogg',
      captured.language
    );

    const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);
    if (
      farmActivityAssistantService.voiceEnabled() &&
      send &&
      transcript?.trim() &&
      (
        farmActivityAssistantService.isFarmActivityState(session.state) ||
        farmActivityAssistantService.looksLikeIntent(transcript)
      )
    ) {
      const farmHandled = await farmActivityAssistantService.tryHandleInbound({
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        text: transcript.trim(),
        messageId: msg.messageId,
        sessionState: session.state,
        send,
        modality: 'voice',
        transcript: transcript.trim(),
        conversationSessionId: session.id,
        blockId: session.active_block_id ?? null,
      });
      if (farmHandled) return;
    }
    if (session.state === 'farmer_feedback_capture' && send && transcript?.trim()) {
      const handled = await farmerFeedbackFlowService.tryHandleCapture({
        farmerId: captured.farmerId,
        phone: captured.phone,
        lang: captured.language,
        text: transcript.trim(),
        send,
        messageId: msg.messageId,
      });
      if (handled) return;
    }

    if (!transcript?.trim()) {
      await sendText(
        captured.phone,
        captured.language === 'ml'
          ? 'വോയ്സ് നോട്ട് മനസ്സിലായില്ല. വീണ്ടും വ്യക്തമായി സംസാരിക്കുക.'
          : 'Could not understand the voice note. Please try again.'
      );
      return;
    }

    await this.runDiagnosis({
      farmerId: captured.farmerId,
      phone: captured.phone,
      language: captured.language,
      voiceTranscript: transcript,
      channel: 'whatsapp',
      sendText,
      send,
    });
  },

  async processImage(
    msg: InboundMessage,
    captured: { farmerId: string; phone: string; language: AdvisoryLanguage; isPremium: boolean },
    sendText: (phone: string, text: string) => Promise<void>,
    senders?: Senders
  ): Promise<void> {
    let media: Awaited<ReturnType<typeof extractInboundMedia>>;
    try {
      media = await extractInboundMedia({
        channel: msg.channel,
        msgType: msg.msgType,
        messageObject: msg.messageObject,
      });
    } catch (err) {
      logger.error({ err, farmerId: captured.farmerId, msgType: msg.msgType }, 'WhatsApp media extract failed');
      await sendText(
        captured.phone,
        captured.language === 'ml'
          ? 'ചിത്രം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും അയയ്ക്കുക.'
          : 'We could not load your photo. Please send the image again in a moment.'
      );
      return;
    }

    const invoiceCaption = (msg.text ?? '').trim();
    const looksLikeInvoice =
      env.ENABLE_FARM_ACTIVITY_ASSISTANT &&
      env.ENABLE_FARM_ACTIVITY_INVOICE_OCR &&
      (/invoice|receipt|bill|രസീത്|ബിൽ|चालान|ರಸೀದಿ|ரசீது/i.test(invoiceCaption) ||
        /document/i.test(msg.msgType));
    if (looksLikeInvoice && media.imageBase64 && senders) {
      try {
        const buffer = Buffer.from(media.imageBase64, 'base64');
        const invoice = await farmActivityInvoiceEvidenceService.extract({
          farmerId: captured.farmerId,
          source: {
            messageId: msg.messageId,
            channel: 'whatsapp',
            text: invoiceCaption || undefined,
          },
          media: {
            kind: /pdf/i.test(media.imageMimeType ?? '') ? 'pdf' : 'image',
            mimeType: media.imageMimeType ?? 'image/jpeg',
            buffer,
            mediaId: msg.messageId,
          },
        });
        if (invoice.ok) {
          const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);
          const handled = await farmActivityAssistantService.presentInvoiceDraft({
            farmerId: captured.farmerId,
            phone: captured.phone,
            language: captured.language,
            send: senders,
            invoice,
            conversationSessionId: session.id,
          });
          if (handled) return;
        }
      } catch (err) {
        logger.warn({ err, farmerId: captured.farmerId }, 'Farm activity invoice OCR path failed');
      }
    }

    if (!media.imageBase64) {
      await sendText(
        captured.phone,
        imageQualityMessage(captured.language, 'unsupported')
      );
      return;
    }

    const buffer = Buffer.from(media.imageBase64, 'base64');
    const quality = assessImageBuffer(buffer, media.imageMimeType);
    if (!quality.ok) {
      await sendText(captured.phone, imageQualityMessage(captured.language, quality.reason));
      return;
    }

    if (await isDuplicateImage(captured.farmerId, quality.contentHash)) {
      const ctx = await conversationSessionService.getContext(captured.farmerId);
      await sendText(
        captured.phone,
        diagnosisFlowService.duplicateImageReply(captured.language, ctx.diagnosis?.lastAdvisorySummary)
      );
      return;
    }

    await recordImageHash(captured.farmerId, quality.contentHash);

    // Push overdue "Have you applied…" jobs out so album uploads are not flooded
    // with old recommendation follow-ups while photos are being analyzed.
    void recommendationFollowUpService.deferPendingFollowUpJobs(captured.farmerId).catch(() => {});

    const earlyStored = await advisoryImageStorageService.uploadFromBase64(
      captured.farmerId,
      media.imageBase64,
      media.imageMimeType ?? 'image/jpeg'
    );
    const imageMime = media.imageMimeType ?? 'image/jpeg';
    const sessCtx = await conversationSessionService.getContext(captured.farmerId);
    const existingBatch = sessCtx.pendingDiagnosisImageBatch ?? [];
    const batchEntry = earlyStored
      ? {
          path: earlyStored,
          mime: imageMime,
          hash: quality.contentHash,
          messageId: msg.messageId,
        }
      : null;

    if (batchEntry) {
      await conversationSessionService.patchContext(captured.farmerId, {
        pendingDiagnosisImagePath: existingBatch[0]?.path ?? batchEntry.path,
        pendingDiagnosisImageMime: existingBatch[0]?.mime ?? batchEntry.mime,
        pendingDiagnosisImageBatch: [...existingBatch, batchEntry].slice(-WHATSAPP_IMAGE_BATCH_MAX),
      });
      await diagnosisSessionEvidenceService.rememberPhotoPaths(captured.farmerId, [
        batchEntry.path,
        ...existingBatch.map((b) => b.path),
      ]);
      if (msg.text?.trim()) {
        await diagnosisSessionEvidenceService.appendTranscript(
          captured.farmerId,
          'farmer',
          `Photo caption: ${msg.text.trim().slice(0, 400)}`
        );
      } else {
        await diagnosisSessionEvidenceService.appendTranscript(
          captured.farmerId,
          'system',
          'Farmer uploaded a crop photo for diagnosis'
        );
      }
      if (msg.messageId) {
        void attachImageToInboundLog({
          messageId: msg.messageId,
          storagePath: batchEntry.path,
          caption: msg.text?.trim(),
        });
      }
    }

    await scheduleImageBatch(
      {
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        isPremium: captured.isPremium,
        image: {
          imageBase64: media.imageBase64,
          imageMimeType: imageMime,
          storagePath: earlyStored ?? undefined,
          messageId: msg.messageId,
          contentHash: quality.contentHash,
        },
        caption: msg.text?.trim() || undefined,
        sendText,
        send: senders,
      },
      (batch) => this.flushBatchedDiagnosisImages(batch)
    );
  },

  async flushBatchedDiagnosisImages(batch: ImageBatchFlushPayload): Promise<void> {
    if (!batch.images.length) return;

    // Prevent overlapping diagnoses for the same farmer (multi-instance / late photos).
    const sessBefore = await conversationSessionService.getContext(batch.farmerId);
    if (sessBefore.diagnosisInFlightAt) {
      const started = Date.parse(String(sessBefore.diagnosisInFlightAt));
      if (Number.isFinite(started) && Date.now() - started < 3 * 60 * 1000) {
        logger.warn(
          { farmerId: batch.farmerId, imageCount: batch.images.length },
          'Skipping image batch flush — diagnosis already in flight'
        );
        return;
      }
    }
    await conversationSessionService.patchContext(batch.farmerId, {
      diagnosisInFlightAt: new Date().toISOString(),
    });

    // Await defer so overdue "Have you applied…" jobs cannot race the analysis ack.
    await recommendationFollowUpService.deferPendingFollowUpJobs(batch.farmerId).catch(() => {});

    try {
    const primary = batch.images[0]!;
    const caption = batch.caption;

    const memoryPeek = await farmerMemoryService.build(batch.farmerId, {
      symptomsText: caption || undefined,
    });
    const willReuse = await aiReuseService.peekMatch({
      farmerId: batch.farmerId,
      cropType: memoryPeek.cropType,
      symptomsText: caption || undefined,
      activePlotId: memoryPeek.activePlotId,
      compactHistory: farmerMemoryService.formatCompactHistory(memoryPeek),
      hasMedia: true,
    });

    if (!willReuse) {
      const usage = await aiUsageControlService.checkAndConsume({
        farmerId: batch.farmerId,
        kind: 'image',
        isPremium: batch.isPremium,
      });
      if (!usage.allowed) {
        await batch.sendText(
          batch.phone,
          aiUsageControlService.usageLimitMessage(batch.language, usage.reason)
        );
        return;
      }
    }

    if (
      await tryAssessmentPlaybook({
        farmerId: batch.farmerId,
        phone: batch.phone,
        language: batch.language,
        text: caption || undefined,
        hasCropMedia: true,
        imageBase64: primary.imageBase64,
        imageMimeType: primary.imageMimeType,
        sendText: batch.sendText,
      })
    ) {
      await conversationSessionService.patchContext(batch.farmerId, {
        pendingDiagnosisImagePath: undefined,
        pendingDiagnosisImageMime: undefined,
        pendingDiagnosisImageBatch: undefined,
      });
      return;
    }

    const plots = await multiPlotService.listPlots(batch.farmerId);
    const memory = await farmerMemoryService.build(batch.farmerId, {
      symptomsText: caption || undefined,
    });
    const farmerAlreadySelectedCrop = memory.knownCropLocked;

    if (plots.length <= 1 && !farmerAlreadySelectedCrop && batch.send) {
      const detected = await cropDetectionService.detectFromImage({
        imageBase64: primary.imageBase64,
        imageMimeType: primary.imageMimeType,
        caption: caption || undefined,
      });
      if (detected.crop && detected.crop !== 'other' && detected.confidence >= 0.62) {
        await multiPlotService.setPrimaryCropType(batch.farmerId, detected.crop);
      } else {
        await askCropSelection(batch.send, batch.phone, batch.language, batch.farmerId);
        await conversationSessionService.patchContext(batch.farmerId, { pendingCropSelection: true });
        await conversationSessionService.setState(batch.farmerId, 'crop_select');
        return;
      }
    }

    // Vision-first for photos: Crop Doctor runs below; follow-up Q&A only after analysis (post_diagnosis_intake).

    if (batch.images.length > 1) {
      await batch.sendText(
        batch.phone,
        batch.language === 'ml'
          ? `${batch.images.length} ഫോട്ടോകൾ ലഭിച്ചു — ഓരോന്നും വിശകലനം ചെയ്ത് ഒരു രോഗനിർണയം തയ്യാറാക്കുന്നു…`
          : `Received ${batch.images.length} photos — analyzing each one, then combining into one diagnosis…`
      );
    }

    const diagnosisImages = await Promise.all(
      batch.images.map(async (img) => {
        if (img.imageBase64) {
          return {
            imageBase64: img.imageBase64,
            imageMimeType: img.imageMimeType,
            imageStoragePath: img.storagePath,
          };
        }
        if (img.storagePath) {
          const downloaded = await downloadAdvisoryImageBase64(img.storagePath);
          if (downloaded) {
            return {
              imageBase64: downloaded.base64,
              imageMimeType: downloaded.mimeType,
              imageStoragePath: img.storagePath,
            };
          }
        }
        return {
          imageMimeType: img.imageMimeType,
          imageStoragePath: img.storagePath,
        };
      })
    );

    await this.runDiagnosis({
      farmerId: batch.farmerId,
      phone: batch.phone,
      language: batch.language,
      imageBase64: primary.imageBase64,
      imageMimeType: primary.imageMimeType,
      imageStoragePath: primary.storagePath,
      diagnosisImages,
      symptomsText: caption,
      channel: 'whatsapp',
      inboundMessageId: primary.messageId,
      sendText: batch.sendText,
      send: batch.send,
    });

    await diagnosisSessionEvidenceService.rememberPhotoPaths(
      batch.farmerId,
      diagnosisImages.map((i) => i.imageStoragePath).filter(Boolean) as string[]
    );

    await conversationSessionService.patchContext(batch.farmerId, {
      pendingDiagnosisImagePath: undefined,
      pendingDiagnosisImageMime: undefined,
      pendingDiagnosisImageBatch: undefined,
    });
    } finally {
      await conversationSessionService.patchContext(batch.farmerId, {
        diagnosisInFlightAt: undefined,
      });
    }
  },

  async processText(
    msg: InboundMessage,
    captured: { farmerId: string; phone: string; language: AdvisoryLanguage; isPremium: boolean },
    sendText: (phone: string, text: string) => Promise<void>
  ): Promise<void> {
    await this.replyToText(msg, captured, sendText);
  },

  /** OpenAI chat for greetings/help; full Crop Doctor when symptoms are detailed. */
  async replyToText(
    msg: InboundMessage,
    captured: { farmerId: string; phone: string; language: AdvisoryLanguage; isPremium: boolean },
    sendText: (phone: string, text: string) => Promise<void>
  ): Promise<void> {
    if (!msg.text?.trim()) {
      await sendText(
        captured.phone,
        captured.language === 'ml'
          ? 'ദയവായി ടെക്സ്റ്റ് അയയ്ക്കുക, വിളയുടെ ഫോട്ടോ, അല്ലെങ്കിൽ വോയ്സ് നോട്ട്.'
          : 'Please send a text message, crop photo, or voice note.'
      );
      return;
    }

    await classifyCommercialLead(captured.farmerId, msg.text);

    if (looksLikeFarmActivityMessage(msg.text)) {
      const session = await conversationSessionService.ensureWhatsAppSession(captured.farmerId);
      if (farmActivityAssistantService.enabled()) {
        const farmHandled = await farmActivityAssistantService.tryHandleInbound({
          farmerId: captured.farmerId,
          phone: captured.phone,
          language: captured.language,
          text: msg.text,
          messageId: msg.messageId,
          sessionState: session.state,
          send: { text: sendText },
          modality: 'text',
          conversationSessionId: session.id,
          blockId: session.active_block_id ?? null,
        });
        if (farmHandled) return;
      } else {
        await sendText(
          captured.phone,
          captured.language === 'ml'
            ? 'ഇത് വളം/തൊഴിലാളി രേഖയാണെന്ന് തോന്നുന്നു — രോഗനിർണയ അല്ല. ഏത് പ്ലോട്ട്/ബ്ലോക്ക് ആണെന്ന് വ്യക്തമാക്കി വീണ്ടും അയയ്ക്കുക.'
            : 'That looks like fertilizer or labour details to record — not a crop disease question. Please say which plot/block it was for, or contact your agronomist to log it.'
        );
        return;
      }
    }

    const sessCtxEarly = await conversationSessionService.getContext(captured.farmerId);
    const batchPending = whatsappImageBatchPendingCount(captured.farmerId);
    const hasPendingImage =
      batchPending > 0 ||
      Boolean(
        sessCtxEarly.pendingDiagnosisImagePath ||
          (sessCtxEarly.pendingDiagnosisImageBatch?.length ?? 0) > 0
      );
    if (hasPendingImage) {
      mergeImageBatchCaption(captured.farmerId, msg.text.trim());
      await conversationSessionService.patchContext(captured.farmerId, {
        pendingSymptomsText: msg.text.trim(),
      });
      return;
    }

    if (
      shouldUseConversationalContinuation(msg.text) ||
      (isConversationFollowUp(msg.text) && (await farmerMemoryService.hasRecentThread(captured.farmerId)))
    ) {
      const memory = await farmerMemoryService.build(captured.farmerId, {
        symptomsText: msg.text,
      });
      if (whatsappConversationalService.isEnabled()) {
        const usage = await aiUsageControlService.checkAndConsume({
          farmerId: captured.farmerId,
          kind: 'text',
          isPremium: captured.isPremium,
        });
        if (!usage.allowed) {
          await sendKnowledgeFallbackOrLimit({
            farmerId: captured.farmerId,
            phone: captured.phone,
            language: captured.language,
            text: msg.text,
            sendText,
            limitMessage: aiUsageControlService.usageLimitMessage(captured.language, usage.reason),
            followUp: true,
          });
          return;
        }
        const reply = await whatsappConversationalService.generateReply({
          farmerId: captured.farmerId,
          userMessage: msg.text,
          language: captured.language,
          farmerName: msg.profileName,
          memory,
          followUp: true,
        });
        await this.sendAndLog(captured.farmerId, captured.phone, reply, sendText, {
          module: 'follow_up_memory',
          language: captured.language,
          meta: { cropType: memory.cropType },
        });
        return;
      }
    }

    if (
      await tryAssessmentPlaybook({
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        text: msg.text,
        hasCropMedia: false,
        sendText,
      })
    ) {
      return;
    }

    const agriDiagnosisIntent = shouldRunCropDoctorTextDiagnosis(msg.text);

    const generalAgronomyQuestion = isExplicitAgronomyQuestion(msg.text);

    let terminologyDetection = null;
    if (regionalTerminologyProcessor.enabled()) {
      const termFlow = await regionalTerminologyProcessor.processInbound({
        farmerId: captured.farmerId,
        text: msg.text,
        language: captured.language,
        messageType: msg.msgType,
        externalMessageId: msg.messageId,
      });
      terminologyDetection = termFlow.detection;
      if (termFlow.handled) {
        await sendText(captured.phone, regionalTerminologyProcessor.pendingFarmerCopy(captured.language));
        return;
      }
    }

    if (generalAgronomyQuestion || parseProductPairFromText(msg.text)) {
      const agronomyHandled = await tryAgronomyReply({
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        text: msg.text,
        sendText,
        farmerName: msg.profileName,
        isPremium: captured.isPremium,
        terminologyDetection,
      });
      if (agronomyHandled) return;
    }

    if (env.ENABLE_AI_CROP_DOCTOR && agriDiagnosisIntent) {
      const memory = await farmerMemoryService.build(captured.farmerId, {
        symptomsText: msg.text,
      });
      const willReuse = await aiReuseService.peekMatch({
        farmerId: captured.farmerId,
        cropType: memory.cropType,
        symptomsText: msg.text,
        activePlotId: memory.activePlotId,
        compactHistory: farmerMemoryService.formatCompactHistory(memory),
      });

      if (!willReuse) {
        const usage = await aiUsageControlService.checkAndConsume({
          farmerId: captured.farmerId,
          kind: 'text',
          isPremium: captured.isPremium,
        });
        if (!usage.allowed) {
          await sendKnowledgeFallbackOrLimit({
            farmerId: captured.farmerId,
            phone: captured.phone,
            language: captured.language,
            text: msg.text,
            sendText,
            limitMessage: aiUsageControlService.usageLimitMessage(captured.language, usage.reason),
          });
          return;
        }
      }

      const intakeStarted = await diagnosisFollowUpService.startIntake({
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        symptomsText: msg.text,
        cropType: memory.cropType,
        hasPhoto: false,
      });
      if (intakeStarted.started) return;

      await this.runDiagnosis({
        farmerId: captured.farmerId,
        phone: captured.phone,
        language: captured.language,
        symptomsText: msg.text,
        sendText,
      });
      return;
    }

    const memory = await farmerMemoryService.build(captured.farmerId, {
      symptomsText: msg.text,
    });

    if (whatsappConversationalService.isEnabled() && msg.text.trim().length >= 8) {
      const usage = await aiUsageControlService.checkAndConsume({
        farmerId: captured.farmerId,
        kind: 'text',
        isPremium: captured.isPremium,
      });
      if (!usage.allowed) {
        await sendKnowledgeFallbackOrLimit({
          farmerId: captured.farmerId,
          phone: captured.phone,
          language: captured.language,
          text: msg.text,
          sendText,
          limitMessage: aiUsageControlService.usageLimitMessage(captured.language, usage.reason),
        });
        return;
      }

      const reply = await whatsappConversationalService.generateReply({
        farmerId: captured.farmerId,
        userMessage: msg.text,
        language: captured.language,
        farmerName: msg.profileName,
        memory,
      });
      const outbound = await this.sendAndLog(captured.farmerId, captured.phone, reply, sendText, {
        module: 'conversational_openai',
        language: captured.language,
        meta: { cropType: memory.cropType },
      });
      await this.queueCaseReviewForText(captured.farmerId, captured.language, msg.text, outbound);
      return;
    }

    const fallback = farmerMemoryService.memoryAwareFallback(memory, captured.language);
    await sendText(captured.phone, fallback);
    await this.queueCaseReviewForText(captured.farmerId, captured.language, msg.text, fallback);
  },

  async queueCaseReviewForText(
    farmerId: string,
    language: AdvisoryLanguage,
    symptomsText: string | undefined,
    farmerSummary: string
  ): Promise<void> {
    const text = symptomsText?.trim();
    if (!text || isStructuredSystemMessage(text) || farmerSummary.trim().length < 8) return;
    await escalationService
      .enqueueWhatsAppInquiry({
        farmerId,
        language,
        symptomsText: text,
        farmerSummary: farmerSummary.slice(0, 4000),
        probableIssue: text.slice(0, 200),
      })
      .catch((err) => logger.warn({ err, farmerId }, 'Case review enqueue failed'));
  },

  async sendAndLog(
    farmerId: string,
    phone: string,
    text: string,
    sendText: (phone: string, text: string) => Promise<void>,
    attribution?: {
      module: MorbeezReplyModule;
      language: AdvisoryLanguage;
      meta?: ReplyAttributionMeta;
    }
  ): Promise<string> {
    let outbound = text;
    if (attribution) {
      outbound = await replyAttributionService.deliverAttributedReply({
        farmerId,
        phone,
        language: attribution.language,
        body: text,
        module: attribution.module,
        meta: attribution.meta,
        sendText,
      });
    } else {
      await sendText(phone, text);
    }
    await farmerService
      .logInteraction(farmerId, 'whatsapp', 'outbound', outbound.slice(0, 500))
      .catch(() => {});
    return outbound;
  },

  async runDiagnosis(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    symptomsText?: string;
    voiceTranscript?: string;
    imageBase64?: string;
    imageMimeType?: string;
    imageStoragePath?: string;
    diagnosisImages?: Array<{
      imageBase64?: string;
      imageMimeType: string;
      imageStoragePath?: string;
    }>;
    fieldInvestigation?: string;
    issueLabelHint?: string;
    skipReuseCache?: boolean;
    investigationPattern?: DiagnoseInput['investigationPattern'];
    channel?: 'whatsapp' | 'api' | 'web';
    inboundMessageId?: string;
    sendText: (phone: string, text: string) => Promise<void>;
    send?: Senders;
  }): Promise<void> {
    try {
      const sessCtx = await conversationSessionService.getContext(params.farmerId);
      const session = await conversationSessionService.ensureWhatsAppSession(params.farmerId);
      const continuingEvidence =
        session.state === 'diagnosis_awaiting_photos' && Boolean(sessCtx.maiosCase);
      const symptomsText =
        params.symptomsText?.trim() ||
        sessCtx.pendingSymptomsText ||
        undefined;

      let imageBase64 = params.imageBase64;
      let imageMimeType = params.imageMimeType;
      const storagePath =
        params.imageStoragePath ?? sessCtx.pendingDiagnosisImagePath ?? undefined;
      if (!imageBase64 && storagePath) {
        const downloaded = await downloadAdvisoryImageBase64(storagePath);
        if (downloaded) {
          imageBase64 = downloaded.base64;
          imageMimeType = downloaded.mimeType;
        }
      }
      const memory = await farmerMemoryService.build(params.farmerId, { symptomsText });
      const contextPack = await contextPackService.build(params.farmerId, {
        cropType: memory.cropType,
        symptomsText,
        dap: memory.dap,
        blockId: memory.activePlotId,
      });
      const environmentalContext = contextPackService.formatForPrompt(contextPack);
      const morbeezFieldContext = await whatsappDiagnosisContextService.buildFieldContext({
        farmerId: params.farmerId,
        blockId: memory.activePlotId,
        cropType: memory.cropType,
        issueName: params.issueLabelHint ?? symptomsText?.slice(0, 80) ?? 'field issue',
        observation: symptomsText ?? params.voiceTranscript,
      });

      let imageStoragePath: string | undefined = storagePath;
      if (imageBase64 && !imageStoragePath) {
        const stored = await advisoryImageStorageService.uploadFromBase64(
          params.farmerId,
          imageBase64,
          imageMimeType ?? 'image/jpeg'
        );
        if (stored) {
          imageStoragePath = stored;
          if (params.channel === 'whatsapp' && params.inboundMessageId) {
            void attachImageToInboundLog({
              messageId: params.inboundMessageId,
              storagePath: stored,
              caption: symptomsText,
            });
          }
        }
      }

      const photoPaths = [
        ...(params.diagnosisImages?.map((i) => i.imageStoragePath).filter(Boolean) as string[]),
        ...(imageStoragePath && !params.diagnosisImages?.length ? [imageStoragePath] : []),
      ];
      let photoCount = params.diagnosisImages?.length ?? (imageBase64 ? 1 : 0);
      let diagnosisImages = params.diagnosisImages;

      if (continuingEvidence && sessCtx.maiosCase) {
        const priorPaths = sessCtx.maiosCase.evidence.photos
          .filter((p) => p.status === 'captured' && p.storagePath)
          .map((p) => p.storagePath as string);
        const incoming = photoPaths.filter(Boolean);
        const newPaths = incoming.filter((p) => !priorPaths.includes(p));
        const mergedPaths = newPaths.length > 0 ? [...priorPaths, ...newPaths] : priorPaths;
        if (mergedPaths.length > 0) {
          photoCount = mergedPaths.length;
          diagnosisImages = await Promise.all(
            mergedPaths.map(async (path) => {
              const downloaded = await downloadAdvisoryImageBase64(path);
              return {
                imageBase64: downloaded?.base64,
                imageMimeType: downloaded?.mimeType ?? 'image/jpeg',
                imageStoragePath: path,
              };
            })
          );
          const primary = diagnosisImages[diagnosisImages.length - 1];
          if (primary?.imageBase64) {
            imageBase64 = primary.imageBase64;
            imageMimeType = primary.imageMimeType;
            imageStoragePath = primary.imageStoragePath;
          }
        }
      }

      logger.info(
        {
          farmerId: params.farmerId,
          continuingEvidence,
          photoCount,
          mergedPathCount: diagnosisImages?.length ?? photoCount,
          sessionState: session.state,
        },
        'WhatsApp runDiagnosis evidence merge'
      );

      const hasSoilReport = await soilFlowService.hasSoilReport(params.farmerId);

      const result = await cropDoctorService.diagnose({
        farmerId: params.farmerId,
        cropType: memory.cropType,
        cropStage: memory.cropStage,
        language: params.language,
        symptomsText,
        voiceTranscript: params.voiceTranscript,
        imageBase64,
        imageMimeType,
        imageStoragePath,
        diagnosisImages,
        fieldInvestigation: params.fieldInvestigation,
        issueLabelHint: params.issueLabelHint,
        skipReuseCache: params.skipReuseCache ?? continuingEvidence,
        investigationPattern: params.investigationPattern,
        channel: params.channel ?? 'whatsapp',
        compactHistory: farmerMemoryService.formatCompactHistory(memory),
        contextPack,
        environmentalContext,
        morbeezFieldContext: morbeezFieldContext ?? undefined,
        activePlotId: memory.activePlotId,
        maiosPhotoCount: photoCount,
        maiosPhotoPaths: diagnosisImages
          ?.map((i) => i.imageStoragePath)
          .filter(Boolean) as string[] | undefined,
        maiosIntakeConfidence: sessCtx.diagnosisIntake?.matchConfidence,
        maiosHasSoilReport: hasSoilReport,
      });
      const maiosCase = result.maiosCase;
      const hasImage = Boolean(
        imageBase64 || imageStoragePath || (diagnosisImages?.length ?? 0) > 0
      );

      if (hasImage && result.reused) {
        logger.warn(
          { farmerId: params.farmerId, sessionId: result.sessionId },
          'Unexpected reuse cache hit for image diagnosis'
        );
      }

      if (
        hasImage &&
        !whatsappDiagnosisRendererService.hasImageEvidence(result.advisory)
      ) {
        await params.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ചിത്രം വ്യക്തമല്ല. ദയവായി ബാധിത ഇലയുടെ അടുത്ത ഫോട്ടോ വീണ്ടും അയയ്ക്കുക.'
            : 'The photo was not clear enough for a specific diagnosis. Please send a closer photo of the affected leaves.'
        );
        await conversationSessionService.setState(params.farmerId, 'diagnosis_awaiting_photos');
        return;
      }

      const assessment = policyEngineService.evaluate(result.advisory, {
        ...contextPack,
        hasImage,
      });

      const safety = validateAdvisorySafety(result.advisory, params.language);
      if (!safety.safe) {
        await params.sendText(params.phone, safety.farmerMessage);
        return;
      }

      await accuracyMetricsService.logDiagnosisEvent({
        sessionId: result.sessionId,
        farmerId: params.farmerId,
        cropType: memory.cropType,
        confidence: result.advisory.confidence,
        escalated: Boolean(result.escalated),
        source: params.channel ?? 'whatsapp',
        weatherRisk: assessment.weatherRiskBand,
      });

      await createTelecallerTask({
        farmerId: params.farmerId,
        title: maiosCase?.triage.level === 'L4' ? 'MAIOS — emergency' : 'Symptom Confirmation Required',
        notes: maiosCase
          ? caseBuilderService.formatTelecallerNotes(maiosCase)
          : `Probable issue: ${result.advisory.probableIssue}; confidence ${Math.round(result.advisory.confidence * 100)}%; crop ${memory.cropType}`,
        priority:
          maiosCase?.route === 'emergency_callback' || assessment.escalationPriority === 'urgent'
            ? 'urgent'
            : maiosCase?.route === 'field_visit'
              ? 'high'
              : 'normal',
      });

      if (maiosCase?.route === 'emergency_callback') {
        await params.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ഗുരുതരമായ ലക്ഷണങ്ങൾ കണ്ടെത്തി. ഞങ്ങളുടെ വിദഗ്ധ ടീം ഉടൻ ബന്ധപ്പെടും.'
            : 'Severe symptoms detected. Our expert team will contact you urgently.'
        );
      }

      if (
        maiosCase &&
        maiosCase.evidence.completenessPct < 30 &&
        maiosCase.evidence.tier === 'T0' &&
        !continuingEvidence
      ) {
        const capturedSlots = maiosCase.evidence.photos
          .filter((p) => p.status === 'captured')
          .map((p) => p.slot);
        const pack = await cropPackLoaderService.load(memory.cropType);
        const missing = cropPackLoaderService.nextMissingSlots(pack, capturedSlots, 3).map((s) => s.id);
        await params.sendText(
          params.phone,
          evidenceQualityService.missingSlotPrompt(pack, params.language, missing)
        );
        await conversationSessionService.patchContext(params.farmerId, { maiosCase });
        await conversationSessionService.setState(params.farmerId, 'diagnosis_awaiting_photos');
        return;
      }

      if (assessment.shouldRequestMoreEvidence) {
        await createTelecallerTask({
          farmerId: params.farmerId,
          title: 'Symptom confirmation required',
          notes: `Confidence ${Math.round(result.advisory.confidence * 100)}%, Crop ${memory.cropType}, WeatherRisk ${assessment.weatherRiskBand}`,
          priority: assessment.escalationPriority === 'urgent' ? 'urgent' : 'high',
        });
        await params.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ലക്ഷണങ്ങൾ കൂടുതൽ സ്ഥിരീകരിക്കണം. ദയവായി കൂടുതൽ വ്യക്തമായ ഇല/വേരിന്റെ ചിത്രങ്ങൾ അയയ്ക്കുക. ടീം നിങ്ങളെ ബന്ധപ്പെടും.'
            : 'Symptoms need further confirmation. Please send clearer leaf/root images. Our team will contact you.'
        );
        await conversationSessionService.setState(params.farmerId, 'root_photos_requested');
        return;
      }

      if (hasImage && assessment.confidenceBand === 'low' && !localizedSummary(result.advisory, params.language)) {
        await params.sendText(
          params.phone,
          params.language === 'ml'
            ? 'ചിത്രം വ്യക്തമല്ല. ദയവായി ബാധിത ഇലയുടെ അടുത്ത ഫോട്ടോ വീണ്ടും അയയ്ക്കുക.'
            : 'The photo was not clear enough. Please send a closer photo of the affected leaves.'
        );
        await conversationSessionService.setState(params.farmerId, 'diagnosis_awaiting_photos');
        return;
      }

      if (
        params.channel === 'whatsapp' &&
        (await nutrientSoilGateService.shouldGateBeforeFertilizerAdvice(
          params.farmerId,
          result.advisory
        ))
      ) {
        await nutrientSoilGateService.storePending(params.farmerId, {
          sessionId: result.sessionId,
          advisory: result.advisory,
        });
        await params.sendText(params.phone, soilGatePreface(params.language));
        if (params.send) {
          await whatsappScenarioRouter.askSoilReportConfirmation(
            params.phone,
            params.farmerId,
            params.language,
            params.send
          );
        } else {
          await params.sendText(
            params.phone,
            params.language === 'ml'
              ? 'മണ്ണ് പരിശോധന റിപ്പോർട്ട് ഉണ്ടോ? Yes / No'
              : 'Do you have a soil test report? Reply Yes or No.'
          );
          await conversationSessionService.setState(params.farmerId, 'nutrient_soil_confirm');
        }
        return;
      }

      if (assessment.needsValidationQuestion) {
        await createTelecallerTask({
          farmerId: params.farmerId,
          title: 'Telecaller symptom validation',
          notes: `AI confidence in medium band. Issue: ${result.advisory.probableIssue}`,
          priority: 'normal',
        });
      }

      if (
        params.channel === 'whatsapp' &&
        maiosCase?.route !== 'emergency_callback' &&
        !assessment.shouldRequestMoreEvidence
      ) {
        const clarificationStarted = await diagnosisFollowUpService.startPostDiagnosisClarification({
          farmerId: params.farmerId,
          phone: params.phone,
          language: params.language,
          sessionId: result.sessionId,
          advisory: result.advisory,
          escalated: Boolean(result.escalated),
          reused: Boolean(result.reused),
          plotLabel: sessCtx.activePlotLabel ?? undefined,
          symptomsText,
          maiosCase: maiosCase ?? null,
        });
        if (clarificationStarted) return;
      }

      const reuseNote = result.reused
        ? params.language === 'ml'
          ? '(സമാനമായ മുൻ കേസിൽ നിന്നുള്ള ശുപാർശ)'
          : '(Similar successful case in your region)'
        : undefined;
      const escalateNote = result.escalated
        ? 'Our agronomist team will review your case shortly.'
        : undefined;
      const safetyNote = assessment.safetyNotes.length
        ? `⚠️ ${assessment.safetyNotes.join(' ')}`
        : undefined;

      let body = buildDiagnosisBody({
        advisory: result.advisory,
        language: params.language,
        plotLabel: sessCtx.activePlotLabel ?? undefined,
        reuseNote,
        escalateNote,
        safetyNote,
        requiresImageEvidence: hasImage,
      });

      if (
        env.ENABLE_WHATSAPP_DIAGNOSIS_POLISH &&
        farmerReplyPolishService.isEnabled() &&
        body?.trim() &&
        params.channel === 'whatsapp' &&
        !env.ENABLE_WHATSAPP_RICH_DIAGNOSIS
      ) {
        body = await farmerReplyPolishService.polishDiagnosisSummary({
          advisory: result.advisory,
          language: params.language,
          memory,
          extraLines: [reuseNote, escalateNote, safetyNote].filter(Boolean) as string[],
        });
      }

      const productBlock = shopifyLinksService.formatRecommendationsForWhatsApp(
        result.productRecommendations,
        params.language
      );
      if (productBlock) body += `\n\n${productBlock}`;

      const validationQ = responseComposerService.extractValidationQuestion(body);

      const reply = buildDiagnosisReply({
        advisory: result.advisory,
        language: params.language,
        body,
        validationQuestion: validationQ,
      });

      if (sessCtx.pendingSymptomsText) {
        await conversationSessionService.patchContext(params.farmerId, {
          pendingSymptomsText: undefined,
        });
      }

      await this.sendAndLog(params.farmerId, params.phone, reply, params.sendText, {
        module: result.reused ? 'crop_doctor_reuse' : 'crop_doctor_openai',
        language: params.language,
        meta: {
          cropType: memory.cropType,
          issueLabel: result.advisory.probableIssue,
        },
      });

      const mergedConf = result.confidence ?? result.advisory.confidence;
      if (
        confidenceLifecycleService.canAutoSend(mergedConf, result.advisory) &&
        !result.escalated
      ) {
        void confidenceLifecycleService.markAutoSent(
          result.sessionId,
          params.channel ?? 'whatsapp'
        );
      }

      if (params.channel === 'whatsapp' && params.send) {
        await whatsappScenarioRouter.afterDiagnosis({
          phone: params.phone,
          farmerId: params.farmerId,
          lang: params.language,
          sessionId: result.sessionId,
          advisory: result.advisory,
          summary: reply,
          send: params.send,
          hasProductRecommendations: (result.productRecommendations?.length ?? 0) > 0,
        });

        if (maiosCase && recoveryValidationService.enabled()) {
          const { data: rec } = await supabase
            .from('recommendation_records')
            .select('id')
            .eq('ai_session_id', result.sessionId)
            .eq('farmer_id', params.farmerId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          void recoveryValidationService.scheduleRecoveryLoop({
            farmerId: params.farmerId,
            sessionId: result.sessionId,
            cropType: memory.cropType,
            language: params.language,
            recommendationRecordId: rec?.id ?? null,
            issueLabel:
              maiosCase.diagnostics?.primary ??
              result.advisory.probableIssue ??
              null,
          });
        }
      }
    } catch (err) {
      logger.error({ err, farmerId: params.farmerId }, 'WhatsApp pipeline diagnosis failed');
      const symptomText = params.symptomsText ?? params.voiceTranscript ?? '';
      const memory = await farmerMemoryService.build(params.farmerId, {
        symptomsText: symptomText || undefined,
      });
      const kb = await knowledgeFallbackService.tryReplyWithModule({
        farmerId: params.farmerId,
        text: symptomText || 'crop advisory',
        language: params.language,
        memory,
        hasMedia: Boolean(
          params.imageBase64 ||
            params.imageStoragePath ||
            params.diagnosisImages?.length ||
            (await conversationSessionService.getContext(params.farmerId))
              .pendingDiagnosisImagePath
        ),
      });
      if (kb) {
        const outbound = await this.sendAndLog(params.farmerId, params.phone, kb.text, params.sendText, {
          module: kb.module,
          language: params.language,
          meta: kb.meta,
        });
        await this.queueCaseReviewForText(
          params.farmerId,
          params.language,
          symptomText || undefined,
          outbound
        );
        return;
      }
      await params.sendText(
        params.phone,
        params.language === 'ml'
          ? 'ക്ഷമിക്കണം, ഇപ്പോൾ വിശകലനം ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ "call" ടൈപ്പ് ചെയ്യുക.'
          : 'Sorry, we could not analyze your message right now. Try again or type "call" for help.'
      );
    }
  },

  async deliverPendingDiagnosis(params: {
    farmerId: string;
    phone: string;
    language: AdvisoryLanguage;
    sendText: (phone: string, text: string) => Promise<void>;
    send?: Senders;
  }): Promise<void> {
    const sessCtx = await conversationSessionService.getContext(params.farmerId);
    const pending = sessCtx.pendingDiagnosisDelivery;
    if (!pending?.sessionId) return;

    const clarification = sessCtx.diagnosis?.postClarificationSummary?.trim();
    if (clarification) {
      const images = await diagnosisSessionEvidenceService.loadImages({
        farmerId: params.farmerId,
        sessionId: pending.sessionId,
      });
      if (images.length) {
        logger.info(
          {
            farmerId: params.farmerId,
            sessionId: pending.sessionId,
            photoCount: images.length,
          },
          'Re-diagnosing with original photos + post-clarification chat'
        );
        await conversationSessionService.patchContext(params.farmerId, {
          pendingDiagnosisDelivery: undefined,
          diagnosis: {
            imageCount: sessCtx.diagnosis?.imageCount ?? images.length,
            ...sessCtx.diagnosis,
            postClarificationSummary: undefined,
          },
        });
        await this.runDiagnosis({
          farmerId: params.farmerId,
          phone: params.phone,
          language: params.language,
          symptomsText: clarification,
          fieldInvestigation: clarification,
          skipReuseCache: true,
          imageBase64: images[0]!.imageBase64,
          imageMimeType: images[0]!.mimeType,
          imageStoragePath: images[0]!.path,
          diagnosisImages: images.map((i) => ({
            imageBase64: i.imageBase64,
            imageMimeType: i.mimeType,
            imageStoragePath: i.path,
          })),
          channel: 'whatsapp',
          sendText: params.sendText,
          send: params.send,
        });
        return;
      }
    }

    const session = await cropDoctorService.getSession(pending.sessionId);
    const outputs = (session.ai_advisory_outputs as Array<{ raw_response?: StructuredAdvisory }> | null) ?? [];
    const latest = outputs[outputs.length - 1];
    const advisory = normalizeStructuredAdvisory(
      (latest?.raw_response as StructuredAdvisory) ?? {
        probableIssue: '',
        confidence: pending.confidence,
        uncertain: false,
        escalationRecommended: pending.escalated,
        nutrientDeficiency: [],
        stressAnalysis: [],
        treatments: [],
        dosageGuidance: [],
        precautions: [],
        farmerSummaryEn: '',
        farmerSummaryMl: '',
        recommendedProductTags: [],
      }
    );

    const memory = await farmerMemoryService.build(params.farmerId);
    const contextPack = await contextPackService.build(params.farmerId, {
      cropType: memory.cropType,
      dap: memory.dap,
      blockId: memory.activePlotId,
    });
    const assessment = policyEngineService.evaluate(advisory, {
      ...contextPack,
      hasImage: true,
    });

    const reuseNote = pending.reused
      ? params.language === 'ml'
        ? '(സമാനമായ മുൻ കേസിൽ നിന്നുള്ള ശുപാർശ)'
        : '(Similar successful case in your region)'
      : undefined;
    const escalateNote = pending.escalated
      ? 'Our agronomist team will review your case shortly.'
      : undefined;
    const safetyNote = assessment.safetyNotes.length
      ? `⚠️ ${assessment.safetyNotes.join(' ')}`
      : undefined;

    let body = buildDiagnosisBody({
      advisory,
      language: params.language,
      plotLabel: pending.plotLabel ?? sessCtx.activePlotLabel ?? undefined,
      reuseNote,
      escalateNote,
      safetyNote,
      requiresImageEvidence: true,
    });

    if (
      env.ENABLE_WHATSAPP_DIAGNOSIS_POLISH &&
      farmerReplyPolishService.isEnabled() &&
      body?.trim() &&
      !env.ENABLE_WHATSAPP_RICH_DIAGNOSIS
    ) {
      body = await farmerReplyPolishService.polishDiagnosisSummary({
        advisory,
        language: params.language,
        memory,
        extraLines: [reuseNote, escalateNote, safetyNote].filter(Boolean) as string[],
      });
    }

    const productRecs =
      (session.ai_product_recommendations as Array<{
        shopify_product_handle?: string | null;
        product_title?: string;
        reason?: string;
        dosage_schedule?: Record<string, string> | string | null;
        priority?: number;
        combo_kit_id?: string | null;
      }> | null) ?? [];
    const productBlock = shopifyLinksService.formatRecommendationsForWhatsApp(
      productRecs.map((r) => ({
        shopifyProductHandle: r.shopify_product_handle ?? undefined,
        productTitle: r.product_title ?? '',
        reason: r.reason ?? '',
        dosageSchedule:
          typeof r.dosage_schedule === 'object' && r.dosage_schedule
            ? r.dosage_schedule
            : undefined,
        priority: r.priority ?? 0,
        comboKitId: r.combo_kit_id ?? undefined,
      })),
      params.language
    );
    if (productBlock) body += `\n\n${productBlock}`;

    const reply = buildDiagnosisReply({
      advisory,
      language: params.language,
      body,
      plotLabel: pending.plotLabel ?? sessCtx.activePlotLabel ?? undefined,
    });

    await conversationSessionService.patchContext(params.farmerId, {
      pendingDiagnosisDelivery: undefined,
      postDiagnosisIntake: undefined,
    });

    await this.sendAndLog(params.farmerId, params.phone, reply, params.sendText, {
      module: pending.reused ? 'crop_doctor_reuse' : 'crop_doctor_openai',
      language: params.language,
      meta: {
        cropType: memory.cropType,
        issueLabel: advisory.probableIssue,
      },
    });

    if (params.send) {
      await whatsappScenarioRouter.afterDiagnosis({
        phone: params.phone,
        farmerId: params.farmerId,
        lang: params.language,
        sessionId: pending.sessionId,
        advisory,
        summary: reply,
        send: params.send,
        hasProductRecommendations: productRecs.length > 0,
      });
    }
  },
};
